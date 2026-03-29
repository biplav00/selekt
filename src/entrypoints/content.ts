import type { DomTreeNode } from '@/types';
import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    // Guard against duplicate injection using a namespaced symbol
    const GUARD_KEY = '__selekt_content_loaded__';
    if ((window as any)[GUARD_KEY]) return;
    (window as any)[GUARD_KEY] = true;

    let isPicking = false;
    let hoveredElement: HTMLElement | null = null;
    let tooltip: HTMLElement | null = null;
    let highlightTimeout: ReturnType<typeof setTimeout> | null = null;
    const savedOutlines = new WeakMap<HTMLElement, { outline: string; outlineOffset: string }>();

    function saveOutline(el: HTMLElement) {
      if (!savedOutlines.has(el)) {
        savedOutlines.set(el, {
          outline: el.style.outline,
          outlineOffset: el.style.outlineOffset,
        });
      }
    }

    function restoreOutline(el: HTMLElement) {
      const saved = savedOutlines.get(el);
      if (saved) {
        el.style.outline = saved.outline;
        el.style.outlineOffset = saved.outlineOffset;
        savedOutlines.delete(el);
      } else {
        el.style.outline = '';
        el.style.outlineOffset = '';
      }
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'PING') {
        sendResponse({ pong: true });
        return;
      }
      if (message.type === 'START_PICKING') {
        startElementPicker();
        sendResponse({ success: true });
      } else if (message.type === 'STOP_PICKING') {
        stopElementPicker();
        sendResponse({ success: true });
      } else if (message.type === 'TEST_SELECTOR') {
        testSelector(message.selector, message.selectorType);
        sendResponse({ success: true });
      } else if (message.type === 'CLEAR_HIGHLIGHTS') {
        clearHighlights();
        sendResponse({ success: true });
      } else if (message.type === 'GET_DOM_TREE') {
        const tree = getDomTree();
        sendResponse({ tree });
      } else if (message.type === 'GET_DOM_CHILDREN') {
        const children = getDomChildren(message.path);
        sendResponse({ children });
      } else if (message.type === 'HIGHLIGHT_ELEMENT') {
        highlightElementByPath(message.path);
        sendResponse({ success: true });
      } else if (message.type === 'CLEAR_HIGHLIGHT') {
        clearHighlightOverlay();
        sendResponse({ success: true });
      } else if (message.type === 'WATCH_SELECTORS') {
        const newSelectors = message.selectors as Array<{
          id: string;
          selector: string;
          type: 'css' | 'xpath';
        }>;
        for (const s of newSelectors) {
          if (!watchedSelectors.find((w) => w.id === s.id)) {
            watchedSelectors.push(s);
            selectorCounts.set(s.id, countSelectorMatches(s.selector, s.type));
          }
        }
        if (watchedSelectors.length > 0) startObserving();
        sendResponse({ success: true });
      } else if (message.type === 'UNWATCH_SELECTORS') {
        const ids = new Set(message.ids as string[]);
        watchedSelectors = watchedSelectors.filter((w) => !ids.has(w.id));
        for (const id of ids) selectorCounts.delete(id);
        if (watchedSelectors.length === 0) stopObserving();
        sendResponse({ success: true });
      }
      return true;
    });

    // Listen for messages from injected script
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'LOCATOR_PICKER_START') {
        startElementPicker();
      }
    });

    function createTooltip(): HTMLElement {
      tooltip = document.createElement('div');
      tooltip.id = 'locator-tooltip';
      tooltip.style.cssText = `
        position: fixed;
        background: #1e293b;
        color: #f8fafc;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-family: 'Courier New', monospace;
        z-index: 2147483647;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 400px;
        word-break: break-all;
        border: 1px solid #334155;
      `;
      document.body.appendChild(tooltip);
      return tooltip;
    }

    function getLocatorSuggestion(element: Element): string {
      const tag = element.tagName.toLowerCase();

      const id = element.getAttribute('id');
      if (id) return `#${id}`;

      const testid = element.getAttribute('data-testid');
      if (testid) return `[data-testid="${testid}"]`;

      const dataTest = element.getAttribute('data-test');
      if (dataTest) return `[data-test="${dataTest}"]`;

      const name = element.getAttribute('name');
      if (name) return `${tag}[name="${name}"]`;

      const cls = element.getAttribute('class');
      if (cls) {
        const first = cls.split(' ').filter((c) => c)[0];
        if (first) return `${tag}.${first}`;
      }

      const role = element.getAttribute('role');
      if (role) return `${tag}[role="${role}"]`;

      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel) return `${tag}[aria-label="${ariaLabel}"]`;

      return tag;
    }

    const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'link', 'meta', 'svg']);

    function getFilteredChildren(el: Element): Element[] {
      return Array.from(el.children).filter((child) => !SKIP_TAGS.has(child.tagName.toLowerCase()));
    }

    function getDirectTextContent(el: Element): string {
      let text = '';
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          text += child.textContent || '';
        }
      }
      return text.trim().substring(0, 40);
    }

    function buildNodeTree(
      node: Element,
      depth: number,
      maxDepth: number,
      path: number[]
    ): DomTreeNode | null {
      if (!node) return null;
      const tag = node.tagName.toLowerCase();
      if (SKIP_TAGS.has(tag)) return null;

      const id = node.id || '';
      const classList = node.classList ? Array.from(node.classList).slice(0, 3).join(' ') : '';
      const filteredChildren = getFilteredChildren(node);
      const isLoaded = depth < maxDepth;

      const nodeData: DomTreeNode = {
        tag,
        id,
        className: classList,
        textContent: getDirectTextContent(node),
        depth,
        hasChildren: filteredChildren.length > 0,
        children: [],
        childCount: filteredChildren.length,
        path,
        loaded: isLoaded,
        totalChildren: filteredChildren.length,
      };

      if (isLoaded) {
        for (let i = 0; i < filteredChildren.length; i++) {
          const childPath = [...path, i];
          const childData = buildNodeTree(filteredChildren[i], depth + 1, maxDepth, childPath);
          if (childData) {
            nodeData.children.push(childData);
          }
        }
      }

      return nodeData;
    }

    function getDomTree(): DomTreeNode | null {
      return buildNodeTree(document.body, 0, 2, []);
    }

    function getDomChildren(path: number[]): DomTreeNode[] {
      let current: Element = document.body;
      for (const index of path) {
        const filtered = getFilteredChildren(current);
        if (index >= filtered.length) return [];
        current = filtered[index];
      }

      const filteredChildren = getFilteredChildren(current);
      const results: DomTreeNode[] = [];
      const childDepth = path.length + 1;
      const maxDepth = path.length + 3;

      for (let i = 0; i < filteredChildren.length; i++) {
        const childPath = [...path, i];
        const node = buildNodeTree(filteredChildren[i], childDepth, maxDepth, childPath);
        if (node) results.push(node);
      }

      return results;
    }

    // --- Highlight overlay for hover-to-highlight ---
    let highlightOverlay: HTMLElement | null = null;

    function highlightElementByPath(path: number[]): void {
      clearHighlightOverlay();
      let current: Element = document.body;
      for (const index of path) {
        const filtered = getFilteredChildren(current);
        if (index >= filtered.length) return;
        current = filtered[index];
      }

      const rect = current.getBoundingClientRect();
      highlightOverlay = document.createElement('div');
      highlightOverlay.style.cssText = `
        position: fixed;
        top: ${rect.top}px;
        left: ${rect.left}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        background: rgba(59, 130, 246, 0.15);
        border: 2px solid rgba(59, 130, 246, 0.6);
        pointer-events: none;
        z-index: 2147483646;
        border-radius: 2px;
      `;
      document.body.appendChild(highlightOverlay);
    }

    function clearHighlightOverlay(): void {
      if (highlightOverlay) {
        highlightOverlay.remove();
        highlightOverlay = null;
      }
    }

    function blockEvent(e: Event) {
      if (!isPicking) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }

    function startElementPicker() {
      if (isPicking) return; // Prevent double-start
      isPicking = true;
      document.body.style.cursor = 'crosshair';
      document.addEventListener('mouseover', handleMouseOver, true);
      document.addEventListener('mouseout', handleMouseOut, true);
      document.addEventListener('click', handleClick, true);
      document.addEventListener('keydown', handleKeyDown, true);
      // Block mousedown/pointerdown to prevent buttons, links, forms from activating
      document.addEventListener('mousedown', blockEvent, true);
      document.addEventListener('pointerdown', blockEvent, true);
    }

    function stopElementPicker() {
      isPicking = false;
      document.body.style.cursor = '';
      cleanup();
    }

    function handleMouseOver(e: MouseEvent) {
      if (!isPicking) return;
      const target = e.target as HTMLElement;
      if (!target || target === document.body || target === document.documentElement) return;

      // Remove previous highlight
      if (hoveredElement && hoveredElement !== target) {
        restoreOutline(hoveredElement);
      }

      hoveredElement = target;
      saveOutline(target);
      target.style.outline = '2px solid #3B82F6';
      target.style.outlineOffset = '2px';

      // Show tooltip with locator
      if (!tooltip) createTooltip();
      if (tooltip) {
        const locator = getLocatorSuggestion(target);
        tooltip.textContent = locator;
        tooltip.style.display = 'block';

        // Position tooltip using rAF to avoid layout thrashing
        const currentTooltip = tooltip;
        requestAnimationFrame(() => {
          const rect = target.getBoundingClientRect();
          const tooltipHeight = 32;
          let top = rect.bottom + 6;
          let left = rect.left;

          // If tooltip would go below viewport, show above
          if (top + tooltipHeight > window.innerHeight) {
            top = rect.top - tooltipHeight - 6;
          }
          // Keep within viewport vertically
          top = Math.max(4, top);
          // Keep within viewport horizontally
          left = Math.max(4, Math.min(left, window.innerWidth - 300));

          currentTooltip.style.left = `${left}px`;
          currentTooltip.style.top = `${top}px`;
        });
      }
    }

    function handleMouseOut(e: MouseEvent) {
      if (!isPicking) return;
      const target = e.target as HTMLElement;

      if (hoveredElement === target) {
        restoreOutline(target);
        hoveredElement = null;
        if (tooltip) tooltip.style.display = 'none';
      }
    }

    function handleClick(e: MouseEvent) {
      if (!isPicking) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const target = e.target as HTMLElement;
      const elementInfo = {
        tagName: target.tagName.toLowerCase(),
        text: target.innerText?.substring(0, 100) || '',
        attributes: {} as Record<string, string>,
      };

      for (const attr of target.attributes) {
        elementInfo.attributes[attr.name] = attr.value;
      }

      // Clear any existing test highlights
      clearHighlights();

      stopElementPicker();

      chrome.runtime.sendMessage({
        type: 'ELEMENT_SELECTED',
        element: elementInfo,
      });
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isPicking) {
        stopElementPicker();
        // Notify sidepanel so it can reset the pick button
        chrome.runtime.sendMessage({ type: 'PICKING_CANCELLED' });
      }
    }

    function cleanup() {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout', handleMouseOut, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('mousedown', blockEvent, true);
      document.removeEventListener('pointerdown', blockEvent, true);

      if (hoveredElement) {
        restoreOutline(hoveredElement);
        hoveredElement = null;
      }

      if (tooltip) {
        tooltip.remove();
        tooltip = null;
      }
    }

    function clearHighlights() {
      if (highlightTimeout) {
        clearTimeout(highlightTimeout);
        highlightTimeout = null;
      }
      document.querySelectorAll('[data-locator-highlight]').forEach((el) => {
        el.removeAttribute('data-locator-highlight');
        restoreOutline(el as HTMLElement);
      });
    }

    // --- Selector Watching (DOM Change Detection) ---
    let watchedSelectors: Array<{ id: string; selector: string; type: 'css' | 'xpath' }> = [];
    const selectorCounts: Map<string, number> = new Map();
    let mutationObserver: MutationObserver | null = null;
    let mutationDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    function countSelectorMatches(selector: string, type: 'css' | 'xpath'): number {
      try {
        if (type === 'xpath') {
          const result = document.evaluate(
            selector,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          );
          return result.snapshotLength;
        }
        return document.querySelectorAll(selector).length;
      } catch {
        return -1;
      }
    }

    function checkSelectorChanges() {
      for (const watched of watchedSelectors) {
        const newCount = countSelectorMatches(watched.selector, watched.type);
        const oldCount = selectorCounts.get(watched.id) ?? -1;

        if (oldCount !== -1 && newCount !== oldCount) {
          chrome.runtime
            .sendMessage({
              type: 'SELECTOR_STATUS_CHANGED',
              id: watched.id,
              oldCount,
              newCount,
            })
            .catch(() => {});
        }

        selectorCounts.set(watched.id, newCount);
      }
    }

    function startObserving() {
      if (mutationObserver) return;
      mutationObserver = new MutationObserver(() => {
        if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
        mutationDebounceTimer = setTimeout(checkSelectorChanges, 500);
      });
      mutationObserver.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true,
      });
    }

    function stopObserving() {
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
      if (mutationDebounceTimer) {
        clearTimeout(mutationDebounceTimer);
        mutationDebounceTimer = null;
      }
    }

    function testSelector(selector: string, selectorType?: string) {
      // Clear previous highlights
      clearHighlights();

      try {
        let elements: Element[];

        if (selectorType === 'xpath') {
          elements = [];
          const result = document.evaluate(
            selector,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          );
          for (let i = 0; i < result.snapshotLength; i++) {
            const node = result.snapshotItem(i);
            if (node instanceof Element) {
              elements.push(node);
            }
          }
        } else {
          elements = Array.from(document.querySelectorAll(selector));
        }

        elements.forEach((el) => {
          saveOutline(el as HTMLElement);
          (el as HTMLElement).style.outline = '2px solid #10B981';
          (el as HTMLElement).style.outlineOffset = '2px';
          el.setAttribute('data-locator-highlight', 'true');
        });

        // Auto-clear highlights after 5 seconds
        highlightTimeout = setTimeout(() => {
          clearHighlights();
        }, 5000);
      } catch {
        // Invalid selector — silently ignore
      }
    }
  },
});
