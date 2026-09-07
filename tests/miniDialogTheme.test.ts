import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { showMiniDialog, hideMiniDialog, MINI_ROOT_ID } from '../utils/miniDialog';
import {
  MINI_TOKENS_CSS,
  applyMiniTheme,
  applyThemeChange,
  hydrateMiniTheme,
  isThemeName,
  readStoredTheme,
} from '../utils/theme';

const styleCssPath = path.resolve(process.cwd(), 'entrypoints/sidepanel/style.css');

function shadowCss(): string {
  const host = document.getElementById(MINI_ROOT_ID);
  return host?.shadowRoot?.querySelector('style')?.textContent ?? '';
}

function mockBrowser(
  theme: unknown,
  onListener?: (fn: (changes: unknown, area: string) => void) => void
) {
  (globalThis as Record<string, unknown>).browser = {
    storage: {
      local: {
        get: async () => ({ locatorSettings: { theme } }),
      },
      onChanged: {
        addListener: (fn: (changes: unknown, area: string) => void) => {
          onListener?.(fn);
        },
      },
    },
  };
}

describe('mini dialog theming', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    hideMiniDialog();
    delete (globalThis as Record<string, unknown>).browser;
  });

  afterEach(() => {
    hideMiniDialog();
    delete (globalThis as Record<string, unknown>).browser;
  });

  it('consumes the global css vars instead of hardcoded colors', () => {
    showMiniDialog(
      { raw: "page.getByTestId('x')", kind: 'testId' },
      { onPick: () => {}, onExpand: () => {} }
    );
    const css = shadowCss();
    for (const token of [
      'var(--panel)',
      'var(--bg)',
      'var(--ink)',
      'var(--bar)',
      'var(--bar-ink)',
      'var(--muted)',
      'var(--muted-2)',
      'var(--line)',
      'var(--line-strong)',
      'var(--sig)',
      'var(--sig-deep)',
      'var(--font-sans',
      'var(--font-code',
      'var(--text-code-sm',
      'var(--text-label',
    ]) {
      expect(css, `missing ${token}`).toContain(token);
    }
    // No hardcoded palette hexes may remain in component rules.
    for (const hex of ['#f7f6f1', '#ebe9e2', '#1d1c19', '#6d6b61', '#d9480f', '#b3b0a2']) {
      const outsideTokens = css
        .replace(/:host\s*\{[^}]*\}/s, '')
        .replace(/:host\(\[data-theme='dark'\]\)\s*\{[^}]*\}/s, '');
      expect(outsideTokens, `hardcoded ${hex} outside token blocks`).not.toContain(hex);
    }
  });

  it('defines light :host tokens and a dark override', () => {
    showMiniDialog({ raw: '', kind: '' }, { onPick: () => {}, onExpand: () => {} });
    const css = shadowCss();
    expect(css).toContain(":host([data-theme='dark'])");
    expect(css).toMatch(/:host\(\[data-theme='dark'\]\)\s*\{[^}]*--panel:\s*#22211b/s);
    expect(css).toMatch(/:host\s*\{[^}]*--panel:\s*#f7f6f1/s);
    expect(css).toContain('color-scheme');
  });

  it('sizes icons from the global icon tokens', () => {
    showMiniDialog({ raw: '', kind: '' }, { onPick: () => {}, onExpand: () => {} });
    const css = shadowCss();
    // Mirrors the sidepanel: 30px boxes (.icon-btn--md), 12px tab glyphs
    // (.tab-glyph), 14px action glyphs (.icon-btn svg).
    expect(css).toMatch(/\.segbtn\s*\{[^}]*width:\s*30px[^}]*height:\s*30px/s);
    expect(css).toMatch(/\.ic\s*\{[^}]*width:\s*30px[^}]*height:\s*30px/s);
    expect(css).toMatch(/\.segbtn svg\s*\{[^}]*var\(--icon-xs/s);
    expect(css).toMatch(/\.ic svg\s*\{[^}]*var\(--icon-sm/s);
  });

  it('paints action icons like sidepanel icon buttons', () => {
    showMiniDialog({ raw: '', kind: '' }, { onPick: () => {}, onExpand: () => {} });
    const css = shadowCss();
    expect(css).toMatch(/\.ic\s*\{[^}]*color:\s*var\(--muted\)/s);
    expect(css).toMatch(/\.ic:disabled\s*\{[^}]*opacity:\s*0\.6/s);
    expect(css).not.toContain('.ic:hover');
  });

  it('paints the armed icon solid red with no blink and no LED', () => {
    showMiniDialog({ raw: '', kind: '' }, { onPick: () => {}, onExpand: () => {} });
    const css = shadowCss();
    expect(css).toMatch(/\.segbtn\.is-armed\s*\{[^}]*var\(--sig\)/s);
    expect(css).not.toContain('.led');
    expect(css).not.toContain('is-blink');
    expect(css).not.toContain('@keyframes');
    expect(css).not.toContain('prefers-reduced-motion');
  });

  it('applies the theme hint synchronously (no flash)', () => {
    showMiniDialog(
      { raw: '', kind: '' },
      { onPick: () => {}, onExpand: () => {} },
      { theme: 'dark' }
    );
    expect(document.getElementById(MINI_ROOT_ID)?.dataset.theme).toBe('dark');

    hideMiniDialog();
    showMiniDialog(
      { raw: '', kind: '' },
      { onPick: () => {}, onExpand: () => {} },
      { theme: 'light' }
    );
    expect(document.getElementById(MINI_ROOT_ID)?.dataset.theme).toBe('light');
  });

  it('defaults to light and hydrates the stored theme', async () => {
    mockBrowser(undefined);
    showMiniDialog({ raw: '', kind: '' }, { onPick: () => {}, onExpand: () => {} });
    // Sync default first…
    expect(document.getElementById(MINI_ROOT_ID)?.dataset.theme).toBe('light');

    mockBrowser('dark');
    hydrateMiniTheme(document.getElementById(MINI_ROOT_ID), undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.getElementById(MINI_ROOT_ID)?.dataset.theme).toBe('dark');
  });

  it('live-syncs when the sidepanel theme changes mid-session', async () => {
    let wired: ((changes: unknown, area: string) => void) | null = null;
    mockBrowser('light', (fn) => {
      wired = fn;
    });
    // Wiring is once-per-module: an earlier show without storage may have
    // taken the slot, so fall back to the forwarded handler directly.
    const { watchMiniTheme } = await import('../utils/theme');
    watchMiniTheme(() => document.getElementById(MINI_ROOT_ID));
    showMiniDialog(
      { raw: '', kind: '' },
      { onPick: () => {}, onExpand: () => {} },
      { theme: 'light' }
    );
    const host = () => document.getElementById(MINI_ROOT_ID);
    expect(host()?.dataset.theme).toBe('light');
    const emit = (changes: unknown, area: string) => {
      if (wired) wired(changes, area);
      else applyThemeChange(changes, area, host);
    };
    emit({ locatorSettings: { newValue: { theme: 'dark' } } }, 'local');
    expect(host()?.dataset.theme).toBe('dark');
    // Non-theme areas and invalid payloads are ignored.
    emit({ other: { newValue: 1 } }, 'local');
    emit({ locatorSettings: { newValue: { theme: 'neon' } } }, 'local');
    emit({ locatorSettings: { newValue: { theme: 'light' } } }, 'sync');
    expect(host()?.dataset.theme).toBe('dark');
  });

  it('ignores invalid theme hints', () => {
    const host = document.createElement('div');
    applyMiniTheme(host, 'dark');
    hydrateMiniTheme(host, 'neon');
    // Invalid hint falls back to the sync default…
    expect(host.dataset.theme).toBe('light');
    expect(isThemeName('dark')).toBe(true);
    expect(isThemeName('neon')).toBe(false);
  });
});

describe('readStoredTheme', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).browser;
  });

  it('returns the stored theme and falls back to light', async () => {
    mockBrowser('dark');
    await expect(readStoredTheme()).resolves.toBe('dark');
    mockBrowser('light');
    await expect(readStoredTheme()).resolves.toBe('light');
    mockBrowser('neon');
    await expect(readStoredTheme()).resolves.toBe('light');
    delete (globalThis as Record<string, unknown>).browser;
    await expect(readStoredTheme()).resolves.toBe('light');
  });
});

describe('token parity with sidepanel globals', () => {
  it('mirrors every :root / dark token value in MINI_TOKENS_CSS', () => {
    const css = fs.readFileSync(styleCssPath, 'utf8');
    const lightBlocks = [...css.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1]).join('\n');
    const darkMatch = css.match(/:root\[data-theme='dark'\][^{]*\{([^}]*)\}/s);
    expect(darkMatch, 'dark block in style.css').not.toBeNull();

    const pairs = (block: string) =>
      [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => ({
        name: m[1],
        value: m[2].trim().replace(/\s+/g, ' '),
      }));

    const flat = MINI_TOKENS_CSS.replace(/\s+/g, ' ');
    for (const { name, value } of pairs(lightBlocks)) {
      expect(flat, `light token ${name}`).toContain(`${name}: ${value}`);
    }
    const darkBlock = darkMatch![1];
    for (const { name, value } of pairs(darkBlock)) {
      expect(flat, `dark token ${name}`).toContain(`${name}: ${value}`);
    }
  });
});
