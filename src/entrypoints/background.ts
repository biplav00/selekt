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
        if (tab?.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'START_PICKING' });
          } catch (e) {
            console.log('Could not activate picker on this page');
          }
        }
      }
    });
  },
});
