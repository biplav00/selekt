import { useEffect, useState } from 'react';
import type { Settings } from '../types';

const DEFAULT_SETTINGS: Settings = { theme: 'light', omitPage: false, compact: false };

// Stored settings may predate newer keys — always merge over defaults.
function withDefaults(saved: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...saved };
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = (await browser.storage?.local.get(['locatorSettings'])) as
          | { locatorSettings?: Settings }
          | undefined;
        const saved = stored?.locatorSettings;
        if (saved && !cancelled) {
          setSettings(withDefaults(saved));
          applyTheme(withDefaults(saved).theme);
        } else {
          const fallback = localStorage.getItem('locatorSettings');
          if (fallback && !cancelled) {
            const parsed = withDefaults(JSON.parse(fallback) as Partial<Settings>);
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

  return {
    settings,
    updateSettings,
    displayLocator: (value: string) => (settings.omitPage ? value.replace(/^page\./, '') : value),
  };
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
}
