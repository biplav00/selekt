import { useCallback } from 'react';
import type { usePicker } from './usePicker';
import type { useManual } from './useManual';

type PickerReturn = ReturnType<typeof usePicker>;
type ManualReturn = ReturnType<typeof useManual>;

async function sendToTab(type: string, payload?: Record<string, unknown>): Promise<void> {
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
    await browser.tabs.sendMessage(target.id, { type, ...payload }).catch(() => {
      void 0;
    });
  } catch {
    void 0;
  }
}

export function useAppActions(picker: PickerReturn, manual: ManualReturn) {
  const handleReset = useCallback(async () => {
    picker.clearPicker();
    picker.clearHistory();
    manual.setManualLocator('');
    manual.setManualResult(null);
    manual.clearHistory();
    picker.setIsInspecting(false);
    await sendToTab('picker:off');
    await sendToTab('picker:clear');
    await sendToTab('manual:clear');
  }, [picker, manual]);

  const handleToggleInspect = useCallback(async () => {
    if (picker.isInspecting) {
      picker.setIsInspecting(false);
      await sendToTab('picker:off');
    } else {
      picker.clearPicker();
      picker.setIsInspecting(true);
      await sendToTab('picker:on');
    }
  }, [picker]);

  // Minimize into the floating page dialog: hand the current best locator
  // to the tab, then close the sidebar (a side panel may close itself).
  const handleMinimize = useCallback(async () => {
    const best = picker.locators[0];
    await sendToTab('picker:off');
    picker.setIsInspecting(false);
    await sendToTab('mini:show', {
      raw: best?.value ?? '',
      kind: best?.kind ?? '',
    });
    window.close();
  }, [picker]);

  return { sendToTab, handleReset, handleToggleInspect, handleMinimize };
}
