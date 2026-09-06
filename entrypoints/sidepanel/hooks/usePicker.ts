import { useCallback, useEffect, useRef, useState } from 'react';
import type { Locator, Meta, PickerSnapshot } from '../types';

function stamp(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const HISTORY_KEY = 'pickerHistory';

function isStoredSnapshot(value: unknown): value is PickerSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const snap = value as { locators?: unknown; time?: unknown };
  return Array.isArray(snap.locators) && typeof snap.time === 'string';
}

export function usePicker() {
  const [isInspecting, setIsInspecting] = useState(false);
  const [locators, setLocators] = useState<Locator[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [hoverPreview, setHoverPreview] = useState<Meta | null>(null);
  const [url, setUrl] = useState('');
  const [history, setHistory] = useState<PickerSnapshot[]>([]);
  const loadedRef = useRef(false);

  // Persist across sessions; skip the first save or a fresh mount would
  // wipe the stored history before the load below resolves.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof browser === 'undefined') return;
        const stored = (await browser.storage?.local.get([HISTORY_KEY])) as
          | { pickerHistory?: unknown }
          | undefined;
        const saved = stored?.pickerHistory;
        if (Array.isArray(saved) && !cancelled) {
          setHistory(saved.filter(isStoredSnapshot).slice(0, 20));
        }
      } catch {
        void 0;
      } finally {
        if (!cancelled) loadedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      if (typeof browser === 'undefined') return;
      const pending = browser.storage?.local.set({ pickerHistory: history });
      if (pending) {
        pending.catch(() => {
          void 0;
        });
      }
    } catch {
      // ignore - history stays in memory
    }
  }, [history]);

  const handleLocators = useCallback((locs: Locator[], m: Meta | null, u: string) => {
    setLocators(locs);
    setMeta(m);
    setUrl(u);
    setIsInspecting(false);
    // Skip consecutive duplicates (re-locking the same element).
    setHistory((prev) =>
      prev[0]?.url === u && prev[0]?.locators[0]?.value === locs[0]?.value
        ? prev
        : [{ time: stamp(), url: u, meta: m, locators: locs }, ...prev].slice(0, 20)
    );
    setTimeout(() => document.getElementById('locator-list')?.focus(), 60);
  }, []);

  const handleHover = useCallback((m: Meta) => setHoverPreview(m), []);
  const handlePickerState = useCallback((active: boolean) => setIsInspecting(active), []);

  const clearPicker = useCallback(() => {
    setLocators([]);
    setMeta(null);
    setHoverPreview(null);
  }, []);

  const restoreSnapshot = useCallback((snap: PickerSnapshot) => {
    setLocators(snap.locators);
    setMeta(snap.meta);
    setUrl(snap.url);
    setHoverPreview(null);
    setIsInspecting(false);
    setTimeout(() => document.getElementById('locator-list')?.focus(), 60);
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  return {
    isInspecting,
    locators,
    meta,
    hoverPreview,
    url,
    history,
    setIsInspecting,
    handleLocators,
    handleHover,
    handlePickerState,
    clearPicker,
    restoreSnapshot,
    clearHistory,
  };
}
