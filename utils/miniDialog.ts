/**
 * Floating mini dialog — lives on the page (content-script context) in a
 * shadow root so page CSS can't touch it. One locator row + one probe row,
 * draggable by its strip, expandable back into the side panel.
 */
import { parseManualLocator } from './manualLocators';
import { highlightManualElements, clearManualHighlights } from './overlay';

export const MINI_ROOT_ID = '__selekt-mini-root';
const MINI_WIDTH = 300;

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
    .mini { width: ${MINI_WIDTH}px; background: #f7f6f1; color: #1d1c19;
      border: 1px solid #b3b0a2; border-radius: 12px; overflow: hidden;
      box-shadow: 0 18px 44px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.12);
      font-family: -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 12px; }
    .strip { background: #1d1c19; color: #f7f6f1; padding: 7px 8px 7px 10px;
      display: flex; align-items: center; gap: 8px; cursor: move; user-select: none; }
    .led { width: 8px; height: 8px; border-radius: 999px; background: #d9480f; flex-shrink: 0; }
    .led.dim { background: #6d6b61; }
    .title { font-size: 10.5px; font-weight: 800; letter-spacing: 0.05em; }
    .spacer { margin-left: auto; display: flex; gap: 6px; }
    .iconbtn { width: 24px; height: 24px; display: grid; place-items: center; background: transparent;
      color: #f7f6f1; border: 1px solid rgba(247,246,241,0.3); border-radius: 6px;
      cursor: pointer; font-size: 12px; padding: 0; }
    .iconbtn:hover { border-color: rgba(247,246,241,0.65); }
    .row { display: flex; align-items: center; gap: 7px; padding: 8px 10px; }
    .row + .row { border-top: 1px solid #d6d3c8; }
    .kind { font-family: ui-monospace, Menlo, monospace; font-size: 9px; font-weight: 600;
      letter-spacing: 0.06em; color: #a83408; background: #f9e3d3; border-radius: 4px;
      padding: 2px 6px; flex-shrink: 0; text-transform: uppercase; }
    .code { flex: 1; min-width: 0; font-family: ui-monospace, Menlo, monospace; font-size: 11px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .code.empty { color: #9b988c; }
    .row input { flex: 1; min-width: 0; font-family: ui-monospace, Menlo, monospace; font-size: 11px;
      border: 0; background: transparent; outline: none; color: #1d1c19; padding: 0; }
    .btn { width: 28px; height: 28px; border-radius: 7px; border: 1px solid #d6d3c8;
      background: #f7f6f1; color: #1d1c19; cursor: pointer; font-size: 12px;
      display: grid; place-items: center; flex-shrink: 0; padding: 0; }
    .btn:hover { border-color: #1d1c19; }
    .btn.go { background: #1d1c19; color: #f7f6f1; border-color: #1d1c19; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .verdict { display: none; font-family: ui-monospace, Menlo, monospace; font-size: 10px;
      color: #7a5410; background: #faf3df; border-top: 1px solid #e3cf9d; padding: 6px 10px; }
    .verdict.show { display: block; }
    .verdict.err { color: #96351f; background: #fbe9e4; border-color: #eec0b4; }
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

  const root = el('div', { class: 'mini', role: 'dialog', 'aria-label': 'Selekt mini' });

  // Strip (drag handle)
  const strip = el('div', { class: 'strip' });
  strip.appendChild(el('span', { class: 'led', 'aria-hidden': 'true' }));
  strip.appendChild(el('span', { class: 'title' }, 'SELEKT'));
  const spacer = el('span', { class: 'spacer' });
  const expandBtn = el(
    'button',
    {
      class: 'iconbtn',
      title: 'Back to full sidepanel',
      'aria-label': 'Back to full sidepanel',
    },
    '⤢'
  );
  expandBtn.addEventListener('click', () => cb.onExpand());
  const closeBtn = el(
    'button',
    {
      class: 'iconbtn',
      title: 'Close mini dialog',
      'aria-label': 'Close mini dialog',
    },
    '×'
  );
  closeBtn.addEventListener('click', () => {
    clearManualHighlights();
    hideMiniDialog();
  });
  spacer.appendChild(expandBtn);
  spacer.appendChild(closeBtn);
  strip.appendChild(spacer);
  root.appendChild(strip);

  // Inspect row: one locator
  const inspectRow = el('div', { class: 'row' });
  const kindChip = el('span', { class: 'kind' }, '—');
  const code = el('code', { class: 'code empty' }, 'pick an element…');
  code.setAttribute('id', 'selekt-mini-code');
  const copyBtn = el(
    'button',
    { class: 'btn', title: 'Copy locator', 'aria-label': 'Copy locator' },
    '⎘'
  );
  copyBtn.setAttribute('id', 'selekt-mini-copy');
  copyBtn.addEventListener('click', async () => {
    if (!currentRaw) return;
    const ok = await copyText(currentRaw);
    if (ok) {
      copyBtn.textContent = '✓';
      setTimeout(() => {
        copyBtn.textContent = '⎘';
      }, 1100);
    }
  });
  const pickBtn = el(
    'button',
    { class: 'btn', title: 'Pick element', 'aria-label': 'Pick element' },
    '⌖'
  );
  pickBtn.addEventListener('click', () => cb.onPick());
  inspectRow.appendChild(kindChip);
  inspectRow.appendChild(code);
  inspectRow.appendChild(copyBtn);
  inspectRow.appendChild(pickBtn);
  root.appendChild(inspectRow);

  // Manual row: textfield + test
  const manualRow = el('div', { class: 'row' });
  const input = document.createElement('input');
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
      verdict.classList.add('show', 'err');
      clearManualHighlights();
    } else {
      highlightManualElements(elements);
      verdict.textContent =
        elements.length === 0
          ? 'No matches'
          : `▸ ${elements.length} match${elements.length === 1 ? '' : 'es'} — highlighted`;
      verdict.classList.add('show');
      verdict.classList.remove('err');
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
    { class: 'btn go', title: 'Test probe', 'aria-label': 'Test probe' },
    '▸'
  );
  testBtn.addEventListener('click', runProbe);
  manualRow.appendChild(input);
  manualRow.appendChild(testBtn);
  root.appendChild(manualRow);
  root.appendChild(verdict);

  // Drag by the strip (never from buttons)
  strip.addEventListener('pointerdown', (event) => {
    if (!host) return;
    if ((event.target as Element).closest?.('button')) return;
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

  shadow.appendChild(root);
}

function ensureHost(): HTMLElement | null {
  if (host?.isConnected && shadow) return host;
  hideMiniDialog();
  host = document.createElement('div');
  host.id = MINI_ROOT_ID;
  host.style.cssText = 'position:fixed;z-index:2147483647;top:16px;right:16px;margin:0;padding:0;';
  shadow = host.attachShadow({ mode: 'open' });
  (document.body || document.documentElement).appendChild(host);
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
  if (!ensureHost()) return;
  buildDialog();
  void refreshBest(best);
}

export function hideMiniDialog(): void {
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
  const kind = shadow.querySelector<HTMLElement>('.kind');
  const led = shadow.querySelector<HTMLElement>('.led');
  if (code) {
    if (best.raw) {
      code.textContent = displayOf(best.raw, omit);
      code.classList.remove('empty');
      code.title = displayOf(best.raw, omit);
    } else {
      code.textContent = 'pick an element…';
      code.classList.add('empty');
      code.removeAttribute('title');
    }
  }
  if (kind) kind.textContent = best.kind || '—';
  if (led) led.classList.toggle('dim', !best.raw);
}
