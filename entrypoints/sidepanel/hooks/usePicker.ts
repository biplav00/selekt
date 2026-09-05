import { useCallback, useState } from 'react';
import type { Locator, Meta, PickerState } from '../types';

export function usePicker() {
  const [isInspecting, setIsInspecting] = useState(false);
  const [locators, setLocators] = useState<Locator[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [hoverPreview, setHoverPreview] = useState<Meta | null>(null);
  const [url, setUrl] = useState('');

  const handleLocators = useCallback((locs: Locator[], m: Meta | null, u: string) => {
    setLocators(locs);
    setMeta(m);
    setUrl(u);
    setIsInspecting(false);
    setTimeout(() => document.getElementById('locator-list')?.focus(), 60);
  }, []);

  const handleHover = useCallback((m: Meta) => setHoverPreview(m), []);
  const handlePickerState = useCallback((active: boolean) => setIsInspecting(active), []);

  const clearPicker = useCallback(() => {
    setLocators([]);
    setMeta(null);
    setHoverPreview(null);
  }, []);

  return {
    isInspecting,
    locators,
    meta,
    hoverPreview,
    url,
    setIsInspecting,
    handleLocators,
    handleHover,
    handlePickerState,
    clearPicker,
  };
}
