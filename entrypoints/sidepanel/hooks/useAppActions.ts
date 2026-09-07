import { useCallback } from 'react';
import type { usePicker } from './usePicker';
import type { useManual } from './useManual';
import { findProbeTab } from '../../../utils/tabs';
import type { ThemeName } from '../../../utils/theme';

type PickerReturn = ReturnType<typeof usePicker>;
type ManualReturn = ReturnType<typeof useManual>;

async function sendToTab(type: string, payload?: Record<string, unknown>): Promise<void> {
  try {
    const target = await findProbeTab();
    if (!target?.id) return;
    await browser.tabs.sendMessage(target.id, { type, ...payload }).catch(() => {
      void 0;
    });
  } catch {
    void 0;
  }
}

export function useAppActions(picker: PickerReturn, manual: ManualReturn, theme: ThemeName) {
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
  // (plus the active theme so the dialog opens in the right mode) to the
  // tab, then close the sidebar (a side panel may close itself).
  const handleMinimize = useCallback(async () => {
    const best = picker.locators[0];
    await sendToTab('picker:off');
    picker.setIsInspecting(false);
    await sendToTab('mini:show', {
      raw: best?.value ?? '',
      kind: best?.kind ?? '',
      theme,
    });
    window.close();
  }, [picker, theme]);

  return { sendToTab, handleReset, handleToggleInspect, handleMinimize };
}
