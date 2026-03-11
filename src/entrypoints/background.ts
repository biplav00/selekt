import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground({
  main() {
    // Open side panel when extension icon is clicked
    chrome.action.onClicked?.addListener(async (tab) => {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    });

    // Handle keyboard shortcut
    chrome.commands.onCommand.addListener(async (command) => {
      if (command === 'toggle-picker') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;

        // Skip restricted pages
        if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('about:')) {
          console.log('Cannot activate picker on restricted pages');
          return;
        }

        try {
          // Ensure content script is injected before sending message
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
          } catch {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content-scripts/content.js'],
            });
            await new Promise((r) => setTimeout(r, 150));
          }

          await chrome.tabs.sendMessage(tab.id, { type: 'START_PICKING' });
        } catch {
          console.log('Could not activate picker on this page');
        }
      }
    });
  },
});
