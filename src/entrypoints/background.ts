import { defineBackground } from 'wxt/utils/define-background';
import { ensureContentScript } from '../utils/content-script';

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

    // Handle floating mode messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'ACTIVATE_FLOATING') {
        // Relay from sidepanel to content script
        chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
          if (!tab?.id) {
            sendResponse({ success: false });
            return;
          }
          try {
            await ensureContentScript(tab.id);
            await chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_FLOATING' });
            sendResponse({ success: true });
          } catch {
            console.log('Could not activate floating mode');
            sendResponse({ success: false });
          }
        });
        return true;
      }

      if (message.type === 'ACTIVATE_SIDEPANEL') {
        // Relay from content script — open sidepanel
        const windowId = sender.tab?.windowId;
        if (windowId) {
          chrome.sidePanel.open({ windowId });
        }
        sendResponse({ success: true });
        return true;
      }
    });
  },
});
