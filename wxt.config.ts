import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    // version omitted on purpose: WXT falls back to package.json version (single source).
    name: 'Selekt',
    description: 'Selekt — Playwright-first locator helper with side panel picker',
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
