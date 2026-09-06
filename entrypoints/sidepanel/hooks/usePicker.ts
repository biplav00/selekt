import { useCallback, useState } from 'react';
import type { Locator, Meta, PickerSnapshot } from '../types';

function stamp(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function usePicker() {
  const [isInspecting, setIsInspecting] = useState(false);
  const [locators, setLocators] = useState<Locator[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [hoverPreview, setHoverPreview] = useState<Meta | null>(null);
  const [url, setUrl] = useState('');
  const [history, setHistory] = useState<PickerSnapshot[]>([]);

  const handleLocators = useCallback((locs: Locator[], m: Meta | null, u: string) => {
    setLocators(locs);
    setMeta(m);
    setUrl(u);
    setIsInspecting(false);
    setHistory((prev) => [{ time: stamp(), url: u, meta: m, locators: locs }, ...prev].slice(0, 20));
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
