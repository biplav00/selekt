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

  // Pop the panel out into a small floating window and close the sidebar.
  const handleFloat = useCallback(async () => {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const url = browser.runtime.getURL('/sidepanel.html?float=1');
      await browser.windows.create({ url, type: 'popup', width: 360, height: 580, focused: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sidePanel = (browser as any).sidePanel;
      if (sidePanel?.close && tab?.id != null) {
        try {
          await sidePanel.close({ tabId: tab.id });
        } catch {
          if (tab.windowId != null) {
            await sidePanel.close({ windowId: tab.windowId }).catch(() => {
              void 0;
            });
          }
        }
      }
    } catch {
      void 0;
    }
  }, []);

  // Dock the floating window back into the sidebar.
  const handleDock = useCallback(async () => {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sidePanel = (browser as any).sidePanel;
      if (sidePanel?.open && tab?.id != null) {
        await sidePanel.open({ tabId: tab.id });
      }
    } catch {
      void 0;
    }
    window.close();
  }, []);

  return { sendToTab, handleReset, handleToggleInspect, handleFloat, handleDock };
}
