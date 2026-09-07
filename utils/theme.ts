/**
 * Shared theme source of truth.
 *
 * The sidepanel (`entrypoints/sidepanel/style.css`) owns the `:root` /
 * `:root[data-theme='dark']` token values for the extension UI. The floating
 * mini dialog lives in a shadow root on arbitrary pages, so page CSS can't
 * reach it — and its own `:root` vars can't leak out either. This module
 * mirrors those same global token values onto the dialog's `:host`, so the
 * dialog styles below can consume `var(--panel)`, `var(--ink)`, … exactly
 * like sidepanel components do, in both light and dark mode.
 *
 * Keep the hex values here in sync with `entrypoints/sidepanel/style.css`.
 */

export type ThemeName = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'locatorSettings';

export function isThemeName(value: unknown): value is ThemeName {
  return value === 'light' || value === 'dark';
}

/** Best-effort read of the stored sidepanel theme (defaults to light). */
export async function readStoredTheme(): Promise<ThemeName> {
  try {
    const stored = (await browser.storage?.local.get([THEME_STORAGE_KEY])) as
      | { locatorSettings?: { theme?: unknown } }
      | undefined;
    const theme = stored?.[THEME_STORAGE_KEY as 'locatorSettings']?.theme;
    if (isThemeName(theme)) return theme;
  } catch {
    // browser/storage unavailable (e.g. tests) — fall through to default.
  }
  return 'light';
}

/**
 * Global design tokens injected into the mini dialog shadow root.
 * Same variable names and values as the sidepanel globals; `:host` plays
 * the role `:root` plays in the sidepanel document.
 */
export const MINI_TOKENS_CSS = `
  :host {
    color-scheme: light;
    --bg: #ebe9e2;
    --panel: #f7f6f1;
    --panel-deep: #e2e0d7;
    --ink: #1d1c19;
    --ink-soft: #2b2a25;
    --bar: #1d1c19;
    --bar-ink: #f7f6f1;
    --muted: #6d6b61;
    --muted-2: #9b988c;
    --line: #d6d3c8;
    --line-strong: #b3b0a2;
    --sig: #d9480f;
    --sig-deep: #a83408;
    --sig-soft: #f9e3d3;
    --ok: #2e7d44;
    --ok-soft: #e0efe2;
    --warn-bg: #faf3df;
    --warn-line: #e3cf9d;
    --warn-ink: #7a5410;
    --err-bg: #fbe9e4;
    --err-line: #eec0b4;
    --err-ink: #96351f;
    --font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    --font-code: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    --text-label: 10px;
    --text-code-sm: 11px;
    --text-body: 12px;
    --text-title: 13px;
    --icon-xs: 12px;
    --icon-sm: 14px;
    --icon-md: 16px;
    --radius: 10px;
    --radius-sm: 7px;
    --radius-xs: 4px;
    --radius-md: 8px;
    --ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
  }
  :host([data-theme='dark']) {
    color-scheme: dark;
    --bg: #171612;
    --panel: #22211b;
    --panel-deep: #2c2b23;
    --ink: #f0eee5;
    --ink-soft: #d8d5c8;
    --bar: #2a2923;
    --bar-ink: #f0eee5;
    --muted: #a49f8f;
    --muted-2: #6f6c5f;
    --line: #35332a;
    --line-strong: #4c4a3d;
    --sig: #ff5d1f;
    --sig-deep: #ff8a55;
    --sig-soft: #3a2113;
    --ok: #58b26f;
    --ok-soft: #1d3325;
    --warn-bg: #332712;
    --warn-line: #6b5426;
    --warn-ink: #e8c26a;
    --err-bg: #3a1f16;
    --err-line: #72392a;
    --err-ink: #f0977c;
  }
`;

/** Apply a theme to an open mini dialog host (`data-theme` drives `:host`). */
export function applyMiniTheme(host: HTMLElement | null, theme: ThemeName): void {
  if (!host) return;
  host.dataset.theme = theme;
}

/** Resolve-then-apply: sync default now, stored value when it arrives. */
export function hydrateMiniTheme(host: HTMLElement | null, hint?: unknown): void {
  if (!host) return;
  if (isThemeName(hint)) {
    applyMiniTheme(host, hint);
    return;
  }
  applyMiniTheme(host, 'light');
  void readStoredTheme().then((theme) => {
    // The dialog may have closed while storage was resolving.
    if (host.isConnected) applyMiniTheme(host, theme);
  });
}

/**
 * Apply a `storage.onChanged` payload to the open dialog. Extracted so the
 * filtering rules (area, key, valid theme) are unit-testable without a
 * `browser` mock; `watchMiniTheme` just forwards live events here.
 */
export function applyThemeChange(
  changes: unknown,
  area: string,
  getHost: () => HTMLElement | null
): void {
  if (area !== 'local') return;
  const next = (changes as Record<string, { newValue?: unknown }>)[THEME_STORAGE_KEY]?.newValue as
    | { theme?: unknown }
    | undefined;
  if (next && isThemeName(next.theme)) applyMiniTheme(getHost(), next.theme);
}

let themeWatcherWired = false;

/**
 * Live-sync an open dialog when the user flips the theme in the sidepanel
 * while the dialog is out. Safe to call on every show; wires up once.
 */
export function watchMiniTheme(getHost: () => HTMLElement | null): void {
  if (themeWatcherWired) return;
  try {
    const onChanged = browser.storage?.onChanged as
      | { addListener?: (fn: (changes: unknown, area: string) => void) => void }
      | undefined;
    if (typeof onChanged?.addListener !== 'function') return;
    onChanged.addListener((changes, area) => applyThemeChange(changes, area, getHost));
    themeWatcherWired = true;
  } catch {
    // storage events unavailable — dialog keeps the theme from show time.
  }
}
