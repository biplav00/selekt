import type { PageElement, WatchedSelector } from '@/types';
import { ensureContentScript } from '@/utils/content-script';

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('about:')) {
    throw new Error('Cannot access Chrome pages');
  }
  return tab;
}

export async function sendToTab(message: Record<string, unknown>): Promise<any> {
  const tab = await getActiveTab();
  const ready = await ensureContentScript(tab.id!);
  if (!ready) throw new Error('Cannot inject content script');
  return chrome.tabs.sendMessage(tab.id!, message);
}

export async function startPicking(): Promise<void> {
  await sendToTab({ type: 'START_PICKING' });
}

export async function stopPicking(): Promise<void> {
  await sendToTab({ type: 'STOP_PICKING' });
}

export async function testSelector(selector: string, selectorType = 'css'): Promise<void> {
  await sendToTab({ type: 'TEST_SELECTOR', selector, selectorType });
}

export async function clearHighlights(): Promise<void> {
  await sendToTab({ type: 'CLEAR_HIGHLIGHTS' });
}

export async function getDomTree(): Promise<any> {
  const response = await sendToTab({ type: 'GET_DOM_TREE' });
  return response?.tree ?? null;
}

export async function getDomChildren(path: number[]): Promise<any[]> {
  const response = await sendToTab({ type: 'GET_DOM_CHILDREN', path });
  return response?.children ?? [];
}

export async function highlightElement(path: number[]): Promise<void> {
  await sendToTab({ type: 'HIGHLIGHT_ELEMENT', path });
}

export async function clearHighlight(): Promise<void> {
  await sendToTab({ type: 'CLEAR_HIGHLIGHT' });
}

export async function getRichElementData(path: number[]): Promise<any> {
  const response = await sendToTab({ type: 'GET_RICH_ELEMENT_DATA', path });
  return response?.data ?? null;
}

export async function watchSelectors(selectors: WatchedSelector[]): Promise<void> {
  await sendToTab({ type: 'WATCH_SELECTORS', selectors });
}

export async function unwatchSelectors(ids: string[]): Promise<void> {
  await sendToTab({ type: 'UNWATCH_SELECTORS', ids });
}

export async function countMatches(selector: string, selectorType = 'css'): Promise<number> {
  const tab = await getActiveTab();
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: (sel: string, selType: string) => {
      try {
        if (selType === 'xpath') {
          const xpathResult = document.evaluate(
            sel,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          );
          return xpathResult.snapshotLength;
        }
        return document.querySelectorAll(sel).length;
      } catch {
        return -1;
      }
    },
    args: [selector, selectorType],
  });
  return result?.[0]?.result ?? -1;
}

export async function fetchPageElements(): Promise<PageElement[]> {
  try {
    const tab = await getActiveTab();
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      func: () => {
        const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'SVG', 'HEAD']);
        const MAX_ELEMENTS = 200;
        const MAX_CLASSES = 5;
        const TEXT_MAX = 40;

        interface PE {
          tag: string;
          id: string;
          classes: string[];
          testId: string;
          role: string;
          ariaLabel: string;
          name: string;
          placeholder: string;
          title: string;
          altText: string;
          text: string;
          matchCount: number;
        }

        // First pass: collect raw data
        const raw: PE[] = [];
        const seen = new Map<string, number>(); // dedup key -> index in raw

        const all = document.querySelectorAll('*');
        for (let i = 0; i < all.length; i++) {
          const el = all[i] as HTMLElement;
          if (SKIP_TAGS.has(el.tagName)) continue;

          const id = el.id || '';
          const testId = el.getAttribute('data-testid') || el.getAttribute('data-test') || '';
          const role = el.getAttribute('role') || '';
          const ariaLabel = el.getAttribute('aria-label') || '';
          const name = (el as HTMLInputElement).name || el.getAttribute('name') || '';
          const placeholder = el.getAttribute('placeholder') || '';
          const title = el.getAttribute('title') || '';
          const altText = el.getAttribute('alt') || '';

          // Direct text only (not children)
          let text = '';
          for (let n = el.firstChild; n; n = n.nextSibling) {
            if (n.nodeType === 3) {
              text += (n as Text).textContent || '';
            }
          }
          text = text.trim().slice(0, TEXT_MAX);

          // Classes: first 5 non-empty
          const classArr: string[] = [];
          if (el.classList) {
            for (let c = 0; c < el.classList.length && classArr.length < MAX_CLASSES; c++) {
              const cls = el.classList[c];
              if (cls) classArr.push(cls);
            }
          }

          // Skip elements with nothing useful
          if (!id && !testId && !role && !ariaLabel && !name && !text && classArr.length === 0) {
            continue;
          }

          const dedupKey = `${el.tagName}|${id}|${testId}|${role}|${ariaLabel}|${name}`;

          if (seen.has(dedupKey)) {
            raw[seen.get(dedupKey)!].matchCount++;
            continue;
          }

          const entry: PE = {
            tag: el.tagName.toLowerCase(),
            id,
            classes: classArr,
            testId,
            role,
            ariaLabel,
            name,
            placeholder,
            title,
            altText,
            text,
            matchCount: 1,
          };
          seen.set(dedupKey, raw.length);
          raw.push(entry);
        }

        // Sort by usefulness: testId > id > role+ariaLabel > name > rest
        raw.sort((a, b) => {
          const score = (e: PE) => {
            if (e.testId) return 4;
            if (e.id) return 3;
            if (e.role && e.ariaLabel) return 2;
            if (e.name) return 1;
            return 0;
          };
          return score(b) - score(a);
        });

        return raw.slice(0, MAX_ELEMENTS);
      },
    });
    return (result?.[0]?.result as PageElement[]) ?? [];
  } catch {
    return [];
  }
}

export function onElementSelected(callback: (element: any) => void): void {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'ELEMENT_SELECTED') callback(message.element);
  });
}

export function onPickingCancelled(callback: () => void): void {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PICKING_CANCELLED') callback();
  });
}

export function onSelectorStatusChanged(
  callback: (change: { id: string; oldCount: number; newCount: number }) => void
): void {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SELECTOR_STATUS_CHANGED') callback(message);
  });
}

export async function checkConnection(): Promise<'connected' | 'no-page'> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('about:')) {
      return 'connected';
    }
    return 'no-page';
  } catch {
    return 'no-page';
  }
}
