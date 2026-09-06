import { useState, useCallback } from 'react';
import { usePicker } from './usePicker';
import { useManual } from './useManual';
import { useCopy } from './useCopy';
import { useSettings } from './useSettings';
import type { TabId } from '../types';

export function useAppState() {
  const [activeTab, setActiveTab] = useState<TabId>('inspect');
  const [showSettings, setShowSettings] = useState(false);
  const { settings, updateSettings, displayLocator } = useSettings();
  const picker = usePicker();
  const manual = useManual(activeTab, picker.url);
  const { copied, copy } = useCopy(displayLocator);

  const handleReset = useCallback(async () => {
    picker.clearPicker();
    manual.setManualLocator('');
    manual.setManualResult(null);
    picker.setIsInspecting(false);
    const send = async (type: string) => {
      try {
        const tabs = await browser.tabs.query({});
        const httpTabs = tabs.filter((tab) => tab.url && tab.url.startsWith('http'));
        let target = tabs.find((tab) => tab.active && tab.url && tab.url.startsWith('http'));
        if (!target) target = httpTabs[0];
        if (!target) {
          const [active] = await browser.tabs.query({ active: true, currentWindow: true });
          target = active;
        }
        if (!target?.id) return;
        await browser.tabs.sendMessage(target.id, { type }).catch(() => {
          void 0;
        });
      } catch {
        void 0;
      }
    };
    await send('picker:off');
    await send('picker:clear');
    await send('manual:clear');
  }, [picker, manual]);

  return {
    activeTab,
    setActiveTab,
    showSettings,
    setShowSettings,
    settings,
    updateSettings,
    displayLocator,
    picker,
    manual,
    copied,
    copy,
    handleReset,
  };
}
