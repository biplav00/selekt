import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  outDir: 'output',
  vite: () => ({
    esbuild: {
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
          useDefineForClassFields: false,
        },
      },
    },
  }),
  manifest: {
    name: 'Selekt',
    description: 'Test automation locator generation tool for Chrome',
    version: '1.0.0',
    icons: {
      16: 'icons/16.png',
      48: 'icons/48.png',
      128: 'icons/128.png',
    },
    permissions: ['activeTab', 'scripting', 'tabs', 'storage', 'sidePanel'],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    action: {
      default_title: 'Selekt',
      default_icon: {
        16: 'icons/16.png',
        48: 'icons/48.png',
      },
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
