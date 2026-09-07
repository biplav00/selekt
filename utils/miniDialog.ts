/**
 * Floating mini dialog — the Bar, pixel-faithful, living on the page in a
 * shadow root so page CSS can't touch it. One pill row: grip, icon tabs,
 * locator-or-textfield, copy/test, reset, expand.
 */
import { parseManualLocator } from './manualLocators';
import { highlightManualElements, clearManualHighlights, hidePickerHighlight } from './overlay';
import { MINI_TOKENS_CSS, hydrateMiniTheme, watchMiniTheme, type ThemeName } from './theme';

export const MINI_ROOT_ID = '__selekt-mini-root';
const MINI_MIN_WIDTH = 230;

export interface MiniBest {
  raw: string;
  kind: string;
}

export interface MiniShowOptions {
  /** Sidepanel theme — applied instantly so the dialog never flashes. */
  theme?: ThemeName;
}

interface MiniCallbacks {
  onPick: () => void;
  onExpand: () => void;
}

export function clampDialogPosition(
  x: number,
  y: number,
  w: number,
  h: number,
  vw: number,
  vh: number
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(x, 8), Math.max(8, vw - w - 8)),
    y: Math.min(Math.max(y, 8), Math.max(8, vh - h - 8)),
  };
}

let host: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let currentRaw = '';
let lastPos: { x: number; y: number } | null = null;
let callbacks: MiniCallbacks | null = null;
// Whether the element picker is currently armed (inspector mode). Paints the
// ⌖ tab solid signal red. Owned by the content-script picker via setMiniArmed;
// buildDialog re-applies it on every rebuild.
let armed = false;
// True while the dialog should exist — lets us resurrect it if the page
// (or another extension) rips the host out from under us.
let wantedOpen = false;
let resurrections = 0;
let observerWired = false;
let resizeWired = false;

// Never let dialog interactions leak into the page underneath: a copy
// click must not also click the link below it (which navigates and takes
// the dialog down with the page — the "closes by itself" ghost).
const STOPPED_EVENTS = [
  'click',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'dblclick',
  'auxclick',
  'contextmenu',
  'wheel',
  'dragstart',
];

function watchForRemoval(): void {
  if (observerWired || typeof MutationObserver === 'undefined') return;
  observerWired = true;
  const root = document.documentElement;
  if (!root) return;
  const observer = new MutationObserver(() => {
    if (wantedOpen && host && !host.isConnected && resurrections < 3) {
      if (typeof document === 'undefined') return;
      resurrections++;
      (document.body || document.documentElement).appendChild(host);
    }
  });
  observer.observe(root, { childList: true, subtree: true });
}

function clampToViewport(): void {
  if (!host?.isConnected) return;
  const rect = host.getBoundingClientRect();
  const pos = clampDialogPosition(
    rect.left,
    rect.top,
    rect.width,
    rect.height,
    window.innerWidth,
    window.innerHeight
  );
  host.style.left = `${pos.x}px`;
  host.style.top = `${pos.y}px`;
  host.style.right = 'auto';
  lastPos = pos;
}

async function readOmitPage(): Promise<boolean> {
  try {
    const stored = (await browser.storage?.local.get(['locatorSettings'])) as
      | { locatorSettings?: { omitPage?: boolean } }
      | undefined;
    return !!stored?.locatorSettings?.omitPage;
  } catch {
    return false;
  }
}

function displayOf(raw: string, omit: boolean): string {
  return omit ? raw.replace(/^page\./, '') : raw;
}

/**
 * Paint the locator readout: the `page.` prefix dims into `var(--muted)`
 * (same treatment as the sidepanel's `.loc-code .dim`), the rest stays ink.
 * Text is set via text nodes only — locator strings are never HTML.
 */
function renderCode(code: HTMLElement, display: string): void {
  code.textContent = '';
  if (!display) {
    code.textContent = 'pick an element…';
    code.classList.add('empty');
    code.removeAttribute('title');
    return;
  }
  code.classList.remove('empty');
  code.title = display;
  const prefix = display.startsWith('page.') ? 'page.' : '';
  if (prefix) {
    const dim = document.createElement('span');
    dim.className = 'm';
    dim.textContent = prefix;
    code.appendChild(dim);
    code.appendChild(document.createTextNode(display.slice(prefix.length)));
  } else {
    code.textContent = display;
  }
}

/** Armed-state tweak shared by setMiniArmed and post-build re-apply. */
function paintArmed(): void {
  if (!shadow) return;
  shadow.querySelector('#selekt-mini-inspect')?.classList.toggle('is-armed', armed);
}

export function isMiniArmed(): boolean {
  return armed;
}

/** Called by the content-script picker on arm/disarm (incl. ESC + lock). */
export function setMiniArmed(next: boolean): void {
  armed = next;
  paintArmed();
}

function css(): string {
  return `
    ${MINI_TOKENS_CSS}
    .bar { background: var(--panel); color: var(--ink); border: 1px solid var(--line-strong);
      border-radius: 999px; display: flex; align-items: center; gap: 6px;
      padding: 5px 6px 5px 5px; box-shadow: 0 14px 34px rgba(0,0,0,0.22);
      font-family: var(--font-sans, -apple-system, "Segoe UI", Roboto, sans-serif);
      min-width: ${MINI_MIN_WIDTH}px; max-width: 100%; resize: horizontal; overflow: hidden; }
    .grip { display: grid; place-items: center; color: var(--muted-2); cursor: grab;
      flex-shrink: 0; margin-left: 3px; touch-action: none; }
    .grip:active { cursor: grabbing; }
    .seg { display: flex; background: var(--bg); border-radius: 999px; padding: 2px; flex-shrink: 0; }
    .segbtn { border: 0; background: transparent; border-radius: 999px; width: 30px; height: 30px;
      cursor: pointer; color: var(--muted);
      display: grid; place-items: center; padding: 0; }
    .segbtn.on { background: var(--bar); color: var(--bar-ink); }
    /* Armed picker — the ⌖ tab goes solid signal red while inspect mode is
       live. No blink, no LED: one state, one color. */
    .segbtn.is-armed { background: var(--sig); color: #fff; }
    .pane { display: none; flex: 1; min-width: 0; align-items: center; gap: 6px; }
    .pane.show { display: flex; }
    .code { flex: 1; min-width: 0; font-family: var(--font-code, ui-monospace, Menlo, monospace);
      font-size: var(--text-code-sm, 11px); color: var(--ink);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .code .m { color: var(--muted); }
    .code.empty { color: var(--muted-2); }
    .field { flex: 1; min-width: 0; font-family: var(--font-code, ui-monospace, Menlo, monospace);
      font-size: var(--text-code-sm, 11px);
      border: 0; background: transparent; outline: none; color: var(--ink); padding: 0; }
    /* Button system mirrors the sidepanel: .ic tracks .icon-btn--md
       (30px box, 14px glyph, muted ink on panel) and .segbtn tracks the
       tab glyph (12px). Active/filled states share bar/bar-ink. */
    .ic { width: 30px; height: 30px; border-radius: 999px; border: 1px solid var(--line);
      background: var(--panel); color: var(--muted); cursor: pointer;
      display: grid; place-items: center; flex-shrink: 0; padding: 0; }
    .ic.go { background: var(--bar); color: var(--bar-ink); border-color: var(--bar); }
    .ic.done { background: var(--sig); border-color: var(--sig-deep); color: #fff; }
    .ic:disabled { opacity: 0.6; cursor: not-allowed; }
    /* Stroke icons ride the global icon scale and center geometrically —
       text glyphs can't (font-dependent bearings), so every button icon is
       an inline SVG below. */
    .segbtn svg { width: var(--icon-xs, 12px); height: var(--icon-xs, 12px); display: block; }
    .ic svg { width: var(--icon-sm, 14px); height: var(--icon-sm, 14px); display: block; }
    .verdict { display: none; font-family: var(--font-code, ui-monospace, Menlo, monospace);
      font-size: var(--text-label, 10px);
      color: var(--muted); margin-top: 6px; padding: 0 12px; }
    .verdict.show { display: block; }
  `;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

function svgDots(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 10 16');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  for (const cx of [2.5, 7.5]) {
    for (const cy of [3, 8, 13]) {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', String(cx));
      c.setAttribute('cy', String(cy));
      c.setAttribute('r', '1.4');
      svg.appendChild(c);
    }
  }
  return svg;
}

type MiniIconName = 'inspect' | 'manual' | 'copy' | 'go' | 'reset' | 'expand' | 'close' | 'check';

const MINI_ICON_SHAPES: Record<Exclude<MiniIconName, 'go'>, string> = {
  inspect: '<circle cx="12" cy="12" r="6"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  manual: '<circle cx="11" cy="11" r="6"/><path d="M15.5 15.5 20 20"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  reset: '<path d="M23 4v6h-6"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M4 12.5l5 5L20 7"/>',
};

/**
 * Button icons as inline stroke SVGs (same idiom as the sidepanel header).
 * Symmetric viewBox geometry + grid centering keeps every icon optically
 * centered — raw text glyphs can't promise that across page fonts.
 */
function svgIcon(name: MiniIconName): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  if (name === 'go') {
    svg.setAttribute('fill', 'currentColor');
    svg.innerHTML = '<path d="M8 5v14l11-7z"/>';
  } else {
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', name === 'close' ? '2.2' : '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = MINI_ICON_SHAPES[name];
  }
  return svg;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;';
      (document.body || document.documentElement).appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function buildDialog(): void {
  if (!shadow || !callbacks) return;
  const cb = callbacks;
  shadow.innerHTML = '';

  const style = document.createElement('style');
  style.textContent = css();
  shadow.appendChild(style);

  const bar = el('div', { class: 'bar', role: 'dialog', 'aria-label': 'Selekt mini' });
  bar.setAttribute('dir', 'ltr');

  // Grip (drag handle)
  const grip = el('span', { class: 'grip', title: 'Drag to move' });
  grip.appendChild(svgDots());

  // Icon tabs — toggling only switches views; re-clicking active ⌖ re-arms.
  let mode: 'inspect' | 'manual' = 'inspect';
  const seg = el('div', { class: 'seg', role: 'tablist', 'aria-label': 'Mini mode' });
  const inspectTab = el('button', {
    class: 'segbtn',
    role: 'tab',
    title: 'Pick element',
    'aria-label': 'Pick element',
  });
  inspectTab.appendChild(svgIcon('inspect'));
  inspectTab.setAttribute('id', 'selekt-mini-inspect');
  const manualTab = el('button', {
    class: 'segbtn',
    role: 'tab',
    title: 'Manual probe',
    'aria-label': 'Manual probe',
  });
  manualTab.appendChild(svgIcon('manual'));

  // Inspect pane: one locator
  const inspectPane = el('div', { class: 'pane' });
  const code = el('code', { class: 'code empty' }, 'pick an element…');
  code.setAttribute('id', 'selekt-mini-code');
  const copyBtn = el('button', {
    class: 'ic',
    title: 'Copy locator',
    'aria-label': 'Copy locator',
  });
  copyBtn.appendChild(svgIcon('copy'));
  copyBtn.setAttribute('id', 'selekt-mini-copy');
  copyBtn.addEventListener('click', async () => {
    if (!currentRaw) return;
    const ok = await copyText(currentRaw);
    if (ok) {
      copyBtn.replaceChildren(svgIcon('check'));
      copyBtn.classList.add('done');
      setTimeout(() => {
        copyBtn.replaceChildren(svgIcon('copy'));
        copyBtn.classList.remove('done');
      }, 1100);
    }
  });
  inspectPane.appendChild(code);
  inspectPane.appendChild(copyBtn);

  // Manual pane: textfield + test only
  const manualPane = el('div', { class: 'pane' });
  const input = document.createElement('input');
  input.setAttribute('class', 'field');
  input.setAttribute('aria-label', 'Manual locator');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('autocomplete', 'off');
  const verdict = el('div', { class: 'verdict', role: 'status' });
  const runProbe = () => {
    const query = input.value.trim();
    if (!query) return;
    const normalized = /^(getBy[A-Z]\w*|locator)\s*\(/.test(query) ? `page.${query}` : query;
    const { elements, error } = parseManualLocator(normalized);
    if (error) {
      verdict.textContent = `✕ ${error}`;
      verdict.classList.add('show');
      clearManualHighlights();
    } else {
      highlightManualElements(elements);
      verdict.textContent =
        elements.length === 0
          ? 'No matches'
          : `▸ ${elements.length} match${elements.length === 1 ? '' : 'es'} — highlighted`;
      verdict.classList.add('show');
    }
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runProbe();
    }
  });
  const testBtn = el('button', {
    class: 'ic go',
    title: 'Test probe',
    'aria-label': 'Test probe',
  });
  testBtn.appendChild(svgIcon('go'));
  testBtn.addEventListener('click', runProbe);
  manualPane.appendChild(input);
  manualPane.appendChild(testBtn);

  // Reset + expand ride in-row, always visible
  const resetBtn = el('button', { class: 'ic', title: 'Reset', 'aria-label': 'Reset' });
  resetBtn.appendChild(svgIcon('reset'));
  resetBtn.addEventListener('click', () => {
    currentRaw = '';
    renderCode(code, '');
    clearManualHighlights();
    hidePickerHighlight();
    verdict.classList.remove('show');
  });
  const expandBtn = el('button', {
    class: 'ic',
    title: 'Back to full sidepanel',
    'aria-label': 'Back to full sidepanel',
  });
  expandBtn.appendChild(svgIcon('expand'));
  expandBtn.addEventListener('click', () => cb.onExpand());
  // Dismiss without reopening the sidebar — otherwise a failed expand
  // (e.g. no user gesture) would strand the dialog with no way out.
  const closeBtn = el('button', {
    class: 'ic',
    title: 'Close mini dialog',
    'aria-label': 'Close mini dialog',
  });
  closeBtn.appendChild(svgIcon('close'));
  closeBtn.addEventListener('click', () => {
    hideMiniDialog();
  });

  const syncTabs = () => {
    const inspectActive = mode === 'inspect';
    for (const [btn, on] of [
      [inspectTab, inspectActive],
      [manualTab, !inspectActive],
    ] as const) {
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-selected', String(on));
    }
    // Both the `.show` class and the inline display matter: the stylesheet
    // defaults `.pane` to `display: none`, so clearing the inline style
    // alone still leaves the pane invisible (the "missing locator" ghost).
    inspectPane.classList.toggle('show', inspectActive);
    manualPane.classList.toggle('show', !inspectActive);
    inspectPane.style.display = inspectActive ? 'flex' : 'none';
    manualPane.style.display = inspectActive ? 'none' : 'flex';
  };
  inspectTab.addEventListener('click', () => {
    if (mode === 'inspect') cb.onPick();
    else {
      mode = 'inspect';
      syncTabs();
    }
  });
  manualTab.addEventListener('click', () => {
    mode = 'manual';
    syncTabs();
  });
  seg.appendChild(inspectTab);
  seg.appendChild(manualTab);

  bar.appendChild(grip);
  bar.appendChild(seg);
  bar.appendChild(inspectPane);
  bar.appendChild(manualPane);
  bar.appendChild(resetBtn);
  bar.appendChild(expandBtn);
  bar.appendChild(closeBtn);
  shadow.appendChild(bar);
  shadow.appendChild(verdict);
  syncTabs();
  paintArmed();

  // Drag by the grip only.
  // NOTE: the host stops propagation of pointerup/mouseup in the bubble
  // phase (to keep dialog clicks out of the page), so the drag-end listener
  // must run in the capture phase — otherwise releasing over the dialog
  // never fires `up` and the dialog sticks to the mouse forever.
  grip.addEventListener('pointerdown', (event) => {
    if (!host) return;
    event.preventDefault();
    const rect = host.getBoundingClientRect();
    host.style.left = `${rect.left}px`;
    host.style.top = `${rect.top}px`;
    host.style.right = 'auto';
    const startX = event.clientX;
    const startY = event.clientY;
    const baseX = rect.left;
    const baseY = rect.top;
    const move = (moveEvent: PointerEvent) => {
      if (!host) return;
      const pos = clampDialogPosition(
        baseX + moveEvent.clientX - startX,
        baseY + moveEvent.clientY - startY,
        rect.width,
        rect.height,
        window.innerWidth,
        window.innerHeight
      );
      host.style.left = `${pos.x}px`;
      host.style.top = `${pos.y}px`;
      lastPos = pos;
    };
    const up = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      window.removeEventListener('mouseup', up, true);
    };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    window.addEventListener('mouseup', up, true);
  });
}

function ensureHost(): HTMLElement | null {
  if (host?.isConnected && shadow) return host;
  // Direct cleanup (not hideMiniDialog — that would clear wantedOpen).
  host?.remove();
  host = null;
  shadow = null;
  host = document.createElement('div');
  host.id = MINI_ROOT_ID;
  host.style.cssText = 'position:fixed;z-index:2147483647;top:16px;right:16px;margin:0;padding:0;';
  shadow = host.attachShadow({ mode: 'open' });
  (document.body || document.documentElement).appendChild(host);
  // Contain every interaction: nothing the user does in the dialog may
  // reach page listeners (clicks, keys, wheel). Handlers inside the shadow
  // tree run before these, so dialog buttons keep working. Escape is let
  // through so an armed picker can still be cancelled from the keyboard.
  for (const type of STOPPED_EVENTS) {
    host.addEventListener(type, (event) => event.stopPropagation());
  }
  host.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key !== 'Escape') event.stopPropagation();
  });
  if (!resizeWired) {
    resizeWired = true;
    window.addEventListener('resize', clampToViewport);
  }
  watchForRemoval();
  if (lastPos) {
    // A stale position from a larger viewport could strand the dialog
    // off-screen (the "doesn't appear" ghost) — re-clamp on every show.
    const pos = clampDialogPosition(
      lastPos.x,
      lastPos.y,
      MINI_MIN_WIDTH,
      48,
      window.innerWidth,
      window.innerHeight
    );
    host.style.left = `${pos.x}px`;
    host.style.top = `${pos.y}px`;
    host.style.right = 'auto';
    lastPos = pos;
  }
  return host;
}

export function isMiniOpen(): boolean {
  return !!host?.isConnected;
}

export function showMiniDialog(best: MiniBest, cb: MiniCallbacks, opts?: MiniShowOptions): void {
  callbacks = cb;
  currentRaw = best.raw;
  wantedOpen = true;
  resurrections = 0;
  // Fresh dialog starts disarmed; the picker's activate()/teardown() calls
  // re-assert the live state via setMiniArmed from here on.
  armed = false;
  if (!ensureHost()) return;
  hydrateMiniTheme(host, opts?.theme);
  watchMiniTheme(() => host);
  buildDialog();
  void refreshBest(best);
}

export function hideMiniDialog(): void {
  wantedOpen = false;
  armed = false;
  try {
    clearManualHighlights();
  } catch {
    void 0;
  }
  try {
    hidePickerHighlight();
  } catch {
    void 0;
  }
  host?.remove();
  host = null;
  shadow = null;
}

export async function refreshBest(best: MiniBest): Promise<void> {
  currentRaw = best.raw;
  if (!shadow) return;
  const omit = await readOmitPage();
  if (!shadow) return;
  // A new lock is a new context — never show the previous probe verdict
  // next to a locator it doesn't belong to.
  const staleVerdict = shadow.querySelector<HTMLElement>('.verdict');
  if (staleVerdict) staleVerdict.classList.remove('show');
  const code = shadow.querySelector<HTMLElement>('#selekt-mini-code');
  if (code) renderCode(code, best.raw ? displayOf(best.raw, omit) : '');
}
