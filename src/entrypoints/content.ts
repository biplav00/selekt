import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    // Guard against duplicate injection
    if ((window as any).__locatorGenLoaded) return;
    (window as any).__locatorGenLoaded = true;

    let isPicking = false;
    let hoveredElement: HTMLElement | null = null;
    let tooltip: HTMLElement | null = null;
    let highlightTimeout: ReturnType<typeof setTimeout> | null = null;

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'PING') {
        sendResponse({ success: true });
      } else if (message.type === 'START_PICKING') {
        startElementPicker();
        sendResponse({ success: true });
      } else if (message.type === 'STOP_PICKING') {
        stopElementPicker();
        sendResponse({ success: true });
      } else if (message.type === 'TEST_SELECTOR') {
        testSelector(message.selector);
        sendResponse({ success: true });
      } else if (message.type === 'CLEAR_HIGHLIGHTS') {
        clearHighlights();
        sendResponse({ success: true });
      } else if (message.type === 'GET_DOM_TREE') {
        const tree = getDomTree();
        sendResponse({ tree });
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

    interface DomTreeNode {
      tag: string;
      id: string;
      className: string;
      depth: number;
      hasChildren: boolean;
      children: DomTreeNode[];
      childCount: number;
    }

    function getDomTree(): DomTreeNode | null {
      function buildTree(node: Element, depth = 0, maxDepth = 5): DomTreeNode | null {
        if (depth > maxDepth || !node) return null;

        const tag = node.tagName.toLowerCase();
        // Skip script, style, svg internals, and hidden elements
        if (['script', 'style', 'noscript', 'link', 'meta'].includes(tag)) return null;

        const id = node.id || '';
        const classList = node.classList ? Array.from(node.classList).slice(0, 3).join(' ') : '';

        const nodeData: DomTreeNode = {
          tag,
          id,
          className: classList,
          depth,
          hasChildren: node.children.length > 0,
          children: [],
          childCount: node.children.length,
        };

        const children = Array.from(node.children).slice(0, 20);
        for (const child of children) {
          const childData = buildTree(child, depth + 1, maxDepth);
          if (childData) {
            nodeData.children.push(childData);
          }
        }

        return nodeData;
      }

      return buildTree(document.body);
    }

    function startElementPicker() {
      if (isPicking) return; // Prevent double-start
      isPicking = true;
      document.body.style.cursor = 'crosshair';
      document.addEventListener('mouseover', handleMouseOver, true);
      document.addEventListener('mouseout', handleMouseOut, true);
      document.addEventListener('click', handleClick, true);
      document.addEventListener('keydown', handleKeyDown, true);
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
        hoveredElement.style.outline = '';
        hoveredElement.style.outlineOffset = '';
      }

      hoveredElement = target;
      target.style.outline = '2px solid #3B82F6';
      target.style.outlineOffset = '2px';

      // Show tooltip with locator
      if (!tooltip) createTooltip();
      if (tooltip) {
        const locator = getLocatorSuggestion(target);
        tooltip.textContent = locator;
        tooltip.style.display = 'block';

        // Position tooltip near element (fixed positioning)
        const rect = target.getBoundingClientRect();
        const tooltipHeight = 32;
        let top = rect.bottom + 6;
        let left = rect.left;

        // If tooltip would go below viewport, show above
        if (top + tooltipHeight > window.innerHeight) {
          top = rect.top - tooltipHeight - 6;
        }
        // Keep within viewport horizontally
        left = Math.max(4, Math.min(left, window.innerWidth - 300));

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
      }
    }

    function handleMouseOut(e: MouseEvent) {
      if (!isPicking) return;
      const target = e.target as HTMLElement;

      if (hoveredElement === target) {
        target.style.outline = '';
        target.style.outlineOffset = '';
        hoveredElement = null;
        if (tooltip) tooltip.style.display = 'none';
      }
    }

    function handleClick(e: MouseEvent) {
      if (!isPicking) return;
      e.preventDefault();
      e.stopPropagation();

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

      if (hoveredElement) {
        hoveredElement.style.outline = '';
        hoveredElement.style.outlineOffset = '';
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
        (el as HTMLElement).style.outline = '';
        (el as HTMLElement).style.outlineOffset = '';
      });
    }

    function testSelector(selector: string) {
      // Clear previous highlights
      clearHighlights();

      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          (el as HTMLElement).style.outline = '2px solid #10B981';
          (el as HTMLElement).style.outlineOffset = '2px';
          el.setAttribute('data-locator-highlight', 'true');
        });

        chrome.runtime.sendMessage({
          type: 'SELECTOR_TESTED',
          count: elements.length,
        });

        // Auto-clear highlights after 5 seconds
        highlightTimeout = setTimeout(() => {
          clearHighlights();
        }, 5000);
      } catch (e) {
        chrome.runtime.sendMessage({
          type: 'SELECTOR_TESTED',
          count: -1,
          error: 'Invalid selector',
        });
      }
    }
  },
});
