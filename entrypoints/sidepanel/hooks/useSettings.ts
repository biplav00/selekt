import { useEffect, useState } from 'react';
import type { Settings } from '../types';

const DEFAULT_SETTINGS: Settings = { theme: 'light', omitPage: false };

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = (await browser.storage?.local.get(['locatorSettings'])) as { locatorSettings?: Settings } | undefined;
        const saved = stored?.locatorSettings;
        if (saved && !cancelled) {
          setSettings(saved);
          applyTheme(saved.theme);
        } else {
          const fallback = localStorage.getItem('locatorSettings');
          if (fallback && !cancelled) {
            const parsed = JSON.parse(fallback) as Settings;
            setSettings(parsed);
            applyTheme(parsed.theme);
          }
        }
      } catch {
        // ignore - keep defaults
        void 0;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    applyTheme(next.theme);
    try {
      await browser.storage?.local.set({ locatorSettings: next });
    } catch {
      void 0;
    }
    try {
      localStorage.setItem('locatorSettings', JSON.stringify(next));
    } catch {
      void 0;
    }
  };

  return { settings, updateSettings, displayLocator: (value: string) => (settings.omitPage ? value.replace(/^page\./, '') : value) };
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
}
