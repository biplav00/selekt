import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Selekt',
    description: 'Selekt — Playwright-first locator helper with side panel picker',
    version: '0.1.0',
    permissions: ['storage', 'sidePanel', 'activeTab', 'tabs'],
    action: {},
    commands: {
      'toggle-picker': {
        suggested_key: { default: 'Alt+Shift+C' },
        description: 'Toggle picker',
      },
    },
  },
});
