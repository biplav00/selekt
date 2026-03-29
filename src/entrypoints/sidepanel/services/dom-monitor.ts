import type { ScoredSelector, SelectorStatusChange } from '@/types';
import { onSelectorStatusChanged, unwatchSelectors, watchSelectors } from './messaging.js';

type StatusCallback = (change: SelectorStatusChange) => void;

const currentlyWatched: Map<string, { selector: string; type: 'css' | 'xpath' }> = new Map();
const statusCallbacks: StatusCallback[] = [];

export function onStatusChange(callback: StatusCallback): void {
  statusCallbacks.push(callback);
}

export function initDomMonitor(): void {
  onSelectorStatusChanged((change) => {
    for (const cb of statusCallbacks) {
      cb(change);
    }
  });
}

export async function watch(selectors: ScoredSelector[]): Promise<void> {
  const toWatch = selectors
    .filter((s) => s.format === 'css' || s.format === 'xpath')
    .map((s) => ({
      id: s.selector,
      selector: s.selector,
      type: (s.format === 'xpath' ? 'xpath' : 'css') as 'css' | 'xpath',
    }))
    .filter((s) => !currentlyWatched.has(s.id));

  if (toWatch.length === 0) return;

  for (const s of toWatch) {
    currentlyWatched.set(s.id, { selector: s.selector, type: s.type });
  }

  try {
    await watchSelectors(toWatch);
  } catch {
    // Content script not available
  }
}

export async function unwatch(selectorStrings: string[]): Promise<void> {
  const ids = selectorStrings.filter((s) => currentlyWatched.has(s));
  if (ids.length === 0) return;

  for (const id of ids) currentlyWatched.delete(id);

  try {
    await unwatchSelectors(ids);
  } catch {
    // Content script not available
  }
}

export async function unwatchAll(): Promise<void> {
  const ids = Array.from(currentlyWatched.keys());
  currentlyWatched.clear();
  if (ids.length > 0) {
    try {
      await unwatchSelectors(ids);
    } catch {}
  }
}
