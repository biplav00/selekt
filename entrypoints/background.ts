export default defineBackground(() => {
  // Open side panel when action icon is clicked
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id != null) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (browser as any).sidePanel.open({ tabId: tab.id });
      } catch (e) {
        console.warn('sidePanel.open failed', e);
      }
    }
  });

  // Ensure side panel is enabled
  if (
    (browser as unknown as { sidePanel?: { setPanelBehavior?: (opts: unknown) => Promise<void> } })
      .sidePanel?.setPanelBehavior
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (browser as any).sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
      void 0;
    });
  }

  // Relay messages between content and sidePanel (validate sender, forward)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser.runtime.onMessage.addListener((msg: any, sender) => {
    // Validate internal sender
    if (sender.id && sender.id !== browser.runtime.id) return false;
    if (
      msg?.type === 'locators' ||
      msg?.type === 'picker:state' ||
      msg?.type === 'picker:hover' ||
      msg?.type === 'manual:result'
    ) {
      // Explicitly forward to sidePanel listeners (runtime broadcast)
      browser.runtime.sendMessage(msg).catch(() => {
        // ignore - no listeners
      });
      return false;
    }
    if (
      msg?.type === 'picker:on' ||
      msg?.type === 'picker:off' ||
      msg?.type === 'picker:toggle' ||
      msg?.type === 'manual:highlight' ||
      msg?.type === 'manual:clear' ||
      msg?.type === 'mini:show' ||
      msg?.type === 'mini:hide'
    ) {
      return false;
    }
    if (msg?.type === 'mini:expand') {
      // Floating mini dialog asked to dock back: reopen the sidebar for its
      // tab (content-script button click counts as the user gesture), then
      // tell the tab to take the overlay down.
      (async () => {
        try {
          const tabId = sender.tab?.id;
          if (tabId == null) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (browser as any).sidePanel.open({ tabId });
          await browser.tabs.sendMessage(tabId, { type: 'mini:hide' }).catch(() => {
            void 0;
          });
        } catch (e) {
          console.warn('[background] mini:expand failed', e);
        }
      })();
      return false;
    }
    return false;
  });

  // Keyboard shortcut toggle - single path to content, sidePanel will hear via state relay
  browser.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-picker') {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        browser.tabs.sendMessage(tab.id, { type: 'picker:toggle' }).catch(() => {
          console.warn(
            '[background] toggle-picker: cannot inject into this page (chrome://, PDF, CSP)'
          );
        });
      }
    }
  });
});
