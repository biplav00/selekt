/**
 * Floating mini dialog — the Bar, pixel-faithful, living on the page in a
 * shadow root so page CSS can't touch it. One pill row: grip, LED,
 * icon tabs, locator-or-textfield, copy/test, reset, expand.
 */
import { parseManualLocator } from './manualLocators';
import { highlightManualElements, clearManualHighlights } from './overlay';

export const MINI_ROOT_ID = '__selekt-mini-root';
const MINI_MIN_WIDTH = 230;

export interface MiniBest {
  raw: string;
  kind: string;
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

function css(): string {
  return `
    :host { color-scheme: light; }
    .bar { background: #f7f6f1; color: #1d1c19; border: 1px solid #b3b0a2;
      border-radius: 999px; display: flex; align-items: center; gap: 6px;
      padding: 5px 6px 5px 5px; box-shadow: 0 14px 34px rgba(0,0,0,0.22);
      font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
      min-width: ${MINI_MIN_WIDTH}px; max-width: 100%; resize: horizontal; overflow: hidden; }
    .grip { display: grid; place-items: center; color: #9b988c; cursor: grab;
      flex-shrink: 0; margin-left: 3px; touch-action: none; }
    .grip:active { cursor: grabbing; }
    .led { width: 8px; height: 8px; border-radius: 999px; background: #d9480f; flex-shrink: 0; }
    .led.dim { background: #b3b0a2; }
    .seg { display: flex; background: #ebe9e2; border-radius: 999px; padding: 2px; flex-shrink: 0; }
    .segbtn { border: 0; background: transparent; border-radius: 999px; width: 28px; height: 28px;
      cursor: pointer; color: #6d6b61; font-size: 13px; display: grid; place-items: center; padding: 0; }
    .segbtn.on { background: #1d1c19; color: #f7f6f1; }
    .pane { display: none; flex: 1; min-width: 0; align-items: center; gap: 6px; }
    .pane.show { display: flex; }
    .code { flex: 1; min-width: 0; font-family: ui-monospace, Menlo, monospace; font-size: 11.5px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .code .m { color: #6d6b61; }
    .code.empty { color: #9b988c; }
    .field { flex: 1; min-width: 0; font-family: ui-monospace, Menlo, monospace; font-size: 11.5px;
      border: 0; background: transparent; outline: none; color: #1d1c19; padding: 0; }
    .ic { width: 30px; height: 30px; border-radius: 999px; border: 1px solid #d6d3c8;
      background: #f7f6f1; color: #1d1c19; cursor: pointer; font-size: 13px;
      display: grid; place-items: center; flex-shrink: 0; padding: 0; }
    .ic:hover { border-color: #1d1c19; }
    .ic.go { background: #1d1c19; color: #f7f6f1; border-color: #1d1c19; }
    .ic.done { background: #d9480f; border-color: #a83408; color: #fff; }
    .ic:disabled { opacity: 0.4; cursor: not-allowed; }
    .verdict { display: none; font-family: ui-monospace, Menlo, monospace; font-size: 10px;
      color: #6d6b61; margin-top: 6px; padding: 0 12px; }
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

  // Grip (drag handle) + LED
  const grip = el('span', { class: 'grip', title: 'Drag to move' });
  grip.appendChild(svgDots());
  const ledDot = el('span', { class: 'led', 'aria-hidden': 'true' });

  // Icon tabs — toggling only switches views; re-clicking active ⌖ re-arms.
  let mode: 'inspect' | 'manual' = 'inspect';
  const seg = el('div', { class: 'seg', role: 'tablist', 'aria-label': 'Mini mode' });
  const inspectTab = el(
    'button',
    { class: 'segbtn', role: 'tab', title: 'Pick element', 'aria-label': 'Pick element' },
    '⌖'
  );
  const manualTab = el(
    'button',
    { class: 'segbtn', role: 'tab', title: 'Manual probe', 'aria-label': 'Manual probe' },
    '⌕'
  );

  // Inspect pane: one locator
  const inspectPane = el('div', { class: 'pane' });
  const code = el('code', { class: 'code empty' }, 'pick an element…');
  code.setAttribute('id', 'selekt-mini-code');
  const copyBtn = el(
    'button',
    { class: 'ic', title: 'Copy locator', 'aria-label': 'Copy locator' },
    '⎘'
  );
  copyBtn.setAttribute('id', 'selekt-mini-copy');
  copyBtn.addEventListener('click', async () => {
    if (!currentRaw) return;
    const ok = await copyText(currentRaw);
    if (ok) {
      copyBtn.textContent = '✓';
      copyBtn.classList.add('done');
      setTimeout(() => {
        copyBtn.textContent = '⎘';
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
  const testBtn = el(
    'button',
    { class: 'ic go', title: 'Test probe', 'aria-label': 'Test probe' },
    '▸'
  );
  testBtn.addEventListener('click', runProbe);
  manualPane.appendChild(input);
  manualPane.appendChild(testBtn);

  // Reset + expand ride in-row, always visible
  const resetBtn = el('button', { class: 'ic', title: 'Reset', 'aria-label': 'Reset' }, '↺');
  resetBtn.addEventListener('click', () => {
    currentRaw = '';
    code.textContent = 'pick an element…';
    code.classList.add('empty');
    code.removeAttribute('title');
    ledDot.classList.add('dim');
    clearManualHighlights();
    verdict.classList.remove('show');
  });
  const expandBtn = el(
    'button',
    { class: 'ic', title: 'Back to full sidepanel', 'aria-label': 'Back to full sidepanel' },
    '⤢'
  );
  expandBtn.addEventListener('click', () => cb.onExpand());
  // Dismiss without reopening the sidebar — otherwise a failed expand
  // (e.g. no user gesture) would strand the dialog with no way out.
  const closeBtn = el(
    'button',
    { class: 'ic', title: 'Close mini dialog', 'aria-label': 'Close mini dialog' },
    '×'
  );
  closeBtn.addEventListener('click', () => {
    clearManualHighlights();
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
    inspectPane.style.display = inspectActive ? '' : 'none';
    manualPane.style.display = inspectActive ? 'none' : '';
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
  bar.appendChild(ledDot);
  bar.appendChild(seg);
  bar.appendChild(inspectPane);
  bar.appendChild(manualPane);
  bar.appendChild(resetBtn);
  bar.appendChild(expandBtn);
  bar.appendChild(closeBtn);
  shadow.appendChild(bar);
  shadow.appendChild(verdict);
  syncTabs();

  // Drag by the grip only
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
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
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
    host.style.left = `${lastPos.x}px`;
    host.style.top = `${lastPos.y}px`;
    host.style.right = 'auto';
  }
  return host;
}

export function isMiniOpen(): boolean {
  return !!host?.isConnected;
}

export function showMiniDialog(best: MiniBest, cb: MiniCallbacks): void {
  callbacks = cb;
  currentRaw = best.raw;
  wantedOpen = true;
  resurrections = 0;
  if (!ensureHost()) return;
  buildDialog();
  void refreshBest(best);
}

export function hideMiniDialog(): void {
  wantedOpen = false;
  host?.remove();
  host = null;
  shadow = null;
}

export async function refreshBest(best: MiniBest): Promise<void> {
  currentRaw = best.raw;
  if (!shadow) return;
  const omit = await readOmitPage();
  if (!shadow) return;
  const code = shadow.querySelector<HTMLElement>('#selekt-mini-code');
  const led = shadow.querySelector<HTMLElement>('.led');
  if (code) {
    if (best.raw) {
      const display = displayOf(best.raw, omit);
      code.textContent = display;
      code.classList.remove('empty');
      code.title = display;
    } else {
      code.textContent = 'pick an element…';
      code.classList.add('empty');
      code.removeAttribute('title');
    }
  }
  if (led) led.classList.toggle('dim', !best.raw);
}
