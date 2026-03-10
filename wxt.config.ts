import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  outDir: 'output',
  manifest: {
    name: 'Locator Generator',
    description: 'Test automation locator generation tool for Chrome',
    version: '1.0.0',
    permissions: ['activeTab', 'scripting', 'tabs', 'storage', 'sidePanel'],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    action: {
      default_title: 'Locator Generator',
    },
    commands: {
      'toggle-picker': {
        suggested_key: {
          default: 'Ctrl+Shift+L',
          mac: 'Command+Shift+L',
        },
        description: 'Toggle element picker',
      },
    },
  },
});
