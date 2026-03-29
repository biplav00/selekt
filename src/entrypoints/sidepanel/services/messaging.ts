import type { WatchedSelector } from '@/types';
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

export async function fetchPageSuggestions(): Promise<Record<
  string,
  Array<{ type: string; label: string; code: string }>
> | null> {
  try {
    const tab = await getActiveTab();
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      func: () => {
        const MAX_PER_CATEGORY = 50;
        const suggestions: Record<string, Array<{ type: string; label: string; code: string }>> = {
          id: [],
          class: [],
          testid: [],
          role: [],
        };

        const idEls = document.querySelectorAll('[id]');
        for (let i = 0; i < idEls.length && suggestions.id.length < MAX_PER_CATEGORY; i++) {
          const el = idEls[i];
          if (el.id && !el.id.includes(' ') && el.id.length < 50) {
            suggestions.id.push({ type: 'ID', label: `#${el.id}`, code: `#${el.id}` });
          }
        }

        document.querySelectorAll('[data-testid]').forEach((el) => {
          if (suggestions.testid.length >= MAX_PER_CATEGORY) return;
          const val = el.getAttribute('data-testid');
          if (val)
            suggestions.testid.push({
              type: 'testid',
              label: `[data-testid="${val}"]`,
              code: `[data-testid="${val}"]`,
            });
        });

        document.querySelectorAll('[data-test]').forEach((el) => {
          if (suggestions.testid.length >= MAX_PER_CATEGORY) return;
          const val = el.getAttribute('data-test');
          if (val)
            suggestions.testid.push({
              type: 'testid',
              label: `[data-test="${val}"]`,
              code: `[data-test="${val}"]`,
            });
        });

        const seen = new Set<string>();
        const classEls = document.querySelectorAll('[class]');
        for (let i = 0; i < classEls.length && suggestions.class.length < MAX_PER_CATEGORY; i++) {
          const cn = classEls[i].className;
          if (typeof cn === 'string') {
            cn.split(' ')
              .filter((c) => c && c.length < 30 && !seen.has(c))
              .slice(0, 2)
              .forEach((c) => {
                if (suggestions.class.length >= MAX_PER_CATEGORY) return;
                seen.add(c);
                suggestions.class.push({ type: 'class', label: `.${c}`, code: `.${c}` });
              });
          }
        }

        const roles = new Set<string>();
        document.querySelectorAll('[role]').forEach((el) => {
          if (roles.size >= MAX_PER_CATEGORY) return;
          const role = el.getAttribute('role');
          if (role && !roles.has(role)) {
            roles.add(role);
            suggestions.role.push({
              type: 'role',
              label: `[role="${role}"]`,
              code: `[role="${role}"]`,
            });
          }
        });

        return suggestions;
      },
    });
    return result[0].result;
  } catch {
    return null;
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
