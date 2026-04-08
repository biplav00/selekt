// floating-widget.ts — Floating locator widget injected into web pages via Shadow DOM.
// Aesthetic: Utilitarian dark instrument panel. Sharp edges, dense information, glowing accents.

import {
  type SimpleElementData,
  type SimpleLocators,
  clearHighlights,
  detectFormat,
  extractTestable,
  generateLocators,
  highlightElements,
  runSelectorTest,
} from '@/shared/selector-core';
import type { SelectorFormat } from '@/types';

// ---------------------------------------------------------------------------
// CSS — utilitarian dark instrument panel
// ---------------------------------------------------------------------------

const WIDGET_CSS = `
  :host {
    font-size: 12px; line-height: 1.4;
    -webkit-font-smoothing: antialiased;

    /* Dark (default) */
    --bg: #0a0a0c; --bg2: #111116; --bg3: #18181d;
    --border: #1e1e24; --border2: #27272d;
    --text: #e4e4e7; --text2: #a1a1aa; --text3: #52525b;
    --accent: #3b82f6; --accent-h: #2563eb;
    --ok: #22c55e; --err: #ef4444;
    --shadow: 0 20px 60px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.5);
    --input-bg: #07070a;
    color: var(--text);
  }

  :host(.light) {
    --bg: #ffffff; --bg2: #f4f4f5; --bg3: #e4e4e7;
    --border: #d4d4d8; --border2: #a1a1aa;
    --text: #18181b; --text2: #3f3f46; --text3: #71717a;
    --accent: #2563eb; --accent-h: #1d4ed8;
    --ok: #16a34a; --err: #dc2626;
    --shadow: 0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08);
    --input-bg: #ffffff;
  }

  *, :host {
    box-sizing: border-box; margin: 0; padding: 0;
    font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Liberation Mono', ui-monospace, monospace;
  }

  .widget {
    display: none;
    position: fixed; right: 16px; bottom: 16px;
    width: 360px; background: var(--bg);
    border: 1px solid var(--border); border-radius: 8px;
    box-shadow: var(--shadow);
    z-index: 2147483646; overflow: hidden;
  }

  /* ── Header: [Pick] ──drag area── [expand][close] ── */
  .header {
    display: flex; align-items: center;
    background: var(--bg2);
    border-bottom: 1px solid var(--border);
    height: 32px;
  }

  .pick-col { display: flex; align-items: center; }

  .pick-btn {
    height: 32px; padding: 0 12px;
    background: var(--accent); color: #fff; border: none;
    font-family: inherit; font-size: 10px; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer;
    display: flex; align-items: center; gap: 4px;
    transition: background 0.15s;
    text-transform: uppercase; border-radius: 0;
  }
  .pick-btn:hover { background: var(--accent-h); }
  .pick-btn.picking { background: #7c3aed; }
  .pick-btn svg { width: 11px; height: 11px; opacity: 0.9; }

  .drag-area { flex: 1; cursor: grab; height: 32px; min-width: 20px; }
  .drag-area:active { cursor: grabbing; }

  .actions-col {
    display: flex; align-items: center;
    gap: 2px; padding: 0 4px;
  }

  .icon-btn {
    width: 24px; height: 24px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 4px; background: transparent;
    border: none; color: var(--text3); cursor: pointer; padding: 0;
    transition: background 0.15s, color 0.15s;
  }
  .icon-btn:hover { background: var(--bg3); color: var(--text2); }
  .icon-btn svg { width: 12px; height: 12px; }

  /* ── Body ── */
  .body {
    padding: 10px;
    display: flex; flex-direction: column; gap: 8px;
  }

  .locator-input {
    width: 100%; padding: 7px 10px;
    background: var(--input-bg);
    border: 1px solid var(--border); border-radius: 5px;
    color: var(--text);
    font-family: inherit; font-size: 11.5px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    caret-color: var(--accent);
  }
  .locator-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(59,130,246,0.12);
  }
  .locator-input::placeholder { color: var(--text3); font-style: italic; }

  .controls-row { display: flex; align-items: center; gap: 6px; }

  .format-select {
    padding: 3px 6px; background: var(--bg2);
    border: 1px solid var(--border); border-radius: 4px;
    color: var(--text2); font-family: inherit;
    font-size: 10px; font-weight: 500; cursor: pointer; outline: none;
    letter-spacing: 0.04em; text-transform: uppercase;
  }
  .format-select:focus { border-color: var(--accent); }

  .match-pill {
    font-size: 10px; padding: 2px 7px; border-radius: 10px;
    font-weight: 500; letter-spacing: 0.02em;
    background: var(--bg2); border: 1px solid var(--border);
    color: var(--text3); transition: all 0.2s; white-space: nowrap;
  }
  .match-pill.found {
    color: var(--ok); border-color: rgba(34,197,94,0.25);
    background: rgba(34,197,94,0.06);
  }
  .match-pill.none {
    color: var(--err); border-color: rgba(239,68,68,0.2);
    background: rgba(239,68,68,0.04);
  }

  .spacer { flex: 1; }

  .copy-btn {
    padding: 3px 10px; background: var(--bg2);
    border: 1px solid var(--border); border-radius: 4px;
    color: var(--text3); font-family: inherit;
    font-size: 10px; font-weight: 500; cursor: pointer;
    letter-spacing: 0.04em; text-transform: uppercase;
    transition: all 0.15s;
  }
  .copy-btn:hover { background: var(--bg3); color: var(--text); }
  .copy-btn.ok { color: var(--ok); border-color: rgba(34,197,94,0.3); background: rgba(34,197,94,0.08); }

  .theme-btn { margin-top: 1px; }
`;

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

function buildWidgetHTML(): string {
  return `
    <div class="widget" id="widget">
      <div class="header" id="drag-handle">
        <div class="pick-col">
          <button class="pick-btn" id="pick-btn">
            <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Pick
          </button>
        </div>
        <div class="drag-area" id="drag-area"></div>
        <div class="actions-col">
          <button class="icon-btn" id="expand-btn" title="Open sidepanel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          </button>
          <button class="icon-btn theme-btn" id="theme-btn" title="Toggle theme">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          </button>
          <button class="icon-btn" id="close-btn" title="Close">
            <svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
      <div class="body">
        <input type="text" class="locator-input" id="locator-input" placeholder="type or pick a selector…" spellcheck="false" autocomplete="off" />
        <div class="controls-row">
          <select class="format-select" id="format-select">
            <option value="css">CSS</option>
            <option value="xpath">XPath</option>
            <option value="playwright">PW</option>
            <option value="cypress">CY</option>
            <option value="selenium">SE</option>
          </select>
          <span class="match-pill" id="match-pill"></span>
          <span class="spacer"></span>
          <button class="copy-btn" id="copy-btn">Copy</button>
        </div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// FloatingWidget
// ---------------------------------------------------------------------------

export class FloatingWidget {
  private shadow: ShadowRoot;
  private host: HTMLElement;
  private widget!: HTMLElement;
  private locators: SimpleLocators | null = null;
  private currentFormat: SelectorFormat = 'css';
  private visible = false;
  private isPicking = false;
  private testDebounce: ReturnType<typeof setTimeout> | null = null;

  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private widgetStartX = 0;
  private widgetStartY = 0;
  private hasDragged = false;
  private boundDragMove: (e: MouseEvent) => void;
  private boundDragEnd: () => void;

  private pickCb: (() => void) | null = null;
  private closeCb: (() => void) | null = null;
  private expandCb: (() => void) | null = null;

  private isDark = true;

  constructor() {
    // Remove any orphaned widget from a previous extension reload
    document.querySelectorAll('#selekt-floating-host').forEach((el) => el.remove());

    this.host = document.createElement('div');
    this.host.id = 'selekt-floating-host';
    this.host.style.cssText = 'display:contents;';

    this.shadow = this.host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = WIDGET_CSS;
    this.shadow.appendChild(style);

    const tmp = document.createElement('div');
    tmp.innerHTML = buildWidgetHTML();
    this.shadow.appendChild(tmp.firstElementChild as Element);
    this.widget = this.shadow.getElementById('widget')!;

    this.boundDragMove = (ev) => this.onDragMove(ev);
    this.boundDragEnd = () => this.stopDrag();
    this.bindEvents();

    // Append to DOM (widget starts hidden via CSS display:none)
    (document.documentElement || document.body).appendChild(this.host);

    // Load theme from storage
    try {
      chrome.storage.local.get('theme', (result) => {
        const theme = result?.theme;
        if (theme === 'light') this.setTheme(false);
        else if (theme === 'system') {
          this.setTheme(!window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
      });
    } catch {
      // Not in extension context
    }
  }

  private setTheme(dark: boolean): void {
    this.isDark = dark;
    if (dark) {
      this.host.classList.remove('light');
    } else {
      this.host.classList.add('light');
    }
  }

  private toggleTheme(): void {
    this.setTheme(!this.isDark);
    // Persist
    try {
      chrome.storage.local.set({ theme: this.isDark ? 'dark' : 'light' });
    } catch {
      // Not in extension context
    }
  }

  show(): void {
    this.widget.style.display = 'block';
    this.visible = true;
  }

  hide(): void {
    this.widget.style.display = 'none';
    this.visible = false;
    clearHighlights();
  }

  destroy(): void {
    window.removeEventListener('mousemove', this.boundDragMove);
    window.removeEventListener('mouseup', this.boundDragEnd);
    clearHighlights();
    this.host.remove();
  }

  isVisible(): boolean {
    return this.visible;
  }

  setElementData(element: SimpleElementData): void {
    this.locators = generateLocators(element);
    this.setPicking(false);
    this.updateInputFromLocators();
    this.scheduleTest();
  }

  onPick(cb: () => void): void {
    this.pickCb = cb;
  }
  onClose(cb: () => void): void {
    this.closeCb = cb;
  }
  onExpandToSidepanel(cb: () => void): void {
    this.expandCb = cb;
  }

  setPicking(active: boolean): void {
    this.isPicking = active;
    const btn = this.$('pick-btn');
    if (!btn) return;
    if (active) {
      btn.classList.add('picking');
      btn.textContent = 'PICKING…';
      this.host.style.pointerEvents = 'none';
    } else {
      btn.classList.remove('picking');
      btn.innerHTML = `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> PICK`;
      this.host.style.pointerEvents = '';
    }
  }

  private $(id: string): HTMLElement | null {
    return this.shadow.getElementById(id);
  }

  private updateInputFromLocators(): void {
    if (!this.locators) return;
    const input = this.$('locator-input') as HTMLInputElement | null;
    if (input) input.value = this.locators[this.currentFormat];
  }

  private scheduleTest(): void {
    if (this.testDebounce) clearTimeout(this.testDebounce);
    this.testDebounce = setTimeout(() => this.runTest(), 400);
  }

  private runTest(): void {
    const input = this.$('locator-input') as HTMLInputElement | null;
    if (!input || !input.value.trim()) {
      this.setMatch('', '');
      clearHighlights();
      return;
    }

    const val = input.value.trim();
    const format = detectFormat(val);
    const result = extractTestable(val, format);
    if (!result) {
      this.setMatch('parse error', 'none');
      clearHighlights();
      return;
    }

    const testResult = runSelectorTest(result.selector, result.selectorType);
    if (testResult.count === -1) {
      clearHighlights();
      this.setMatch('invalid', 'none');
    } else {
      highlightElements(testResult.elements);
      this.setMatch(`${testResult.count}`, testResult.count > 0 ? 'found' : 'none');
    }
  }

  private setMatch(text: string, cls: string): void {
    const el = this.$('match-pill');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('found', 'none');
    if (cls) el.classList.add(cls);
  }

  // Drag
  private startDrag(e: MouseEvent): void {
    if ((e.target as HTMLElement).closest('button, select, input')) return;
    this.dragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    const rect = this.widget.getBoundingClientRect();
    this.widgetStartX = rect.left;
    this.widgetStartY = rect.top;

    if (!this.hasDragged) {
      this.widget.style.right = 'auto';
      this.widget.style.bottom = 'auto';
      this.widget.style.left = `${rect.left}px`;
      this.widget.style.top = `${rect.top}px`;
      this.hasDragged = true;
    }

    window.addEventListener('mousemove', this.boundDragMove);
    window.addEventListener('mouseup', this.boundDragEnd);
    e.preventDefault();
  }

  private onDragMove(e: MouseEvent): void {
    if (!this.dragging) return;
    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    const maxL = window.innerWidth - this.widget.offsetWidth - 4;
    const maxT = window.innerHeight - this.widget.offsetHeight - 4;
    this.widget.style.left = `${Math.max(4, Math.min(this.widgetStartX + dx, maxL))}px`;
    this.widget.style.top = `${Math.max(4, Math.min(this.widgetStartY + dy, maxT))}px`;
  }

  private stopDrag(): void {
    this.dragging = false;
    window.removeEventListener('mousemove', this.boundDragMove);
    window.removeEventListener('mouseup', this.boundDragEnd);
  }

  private bindEvents(): void {
    this.$('drag-area')?.addEventListener('mousedown', (e) => this.startDrag(e as MouseEvent));

    this.$('pick-btn')?.addEventListener('click', () => {
      if (!this.isPicking) {
        this.setPicking(true);
        this.pickCb?.();
      }
    });

    const fmt = this.$('format-select') as HTMLSelectElement | null;
    fmt?.addEventListener('change', () => {
      this.currentFormat = fmt.value as SelectorFormat;
      this.updateInputFromLocators();
      this.scheduleTest();
    });

    const input = this.$('locator-input') as HTMLInputElement | null;
    input?.addEventListener('input', () => {
      const val = input.value.trim();
      if (val && fmt) {
        const detected = detectFormat(val);
        if (fmt.value !== detected) {
          fmt.value = detected;
          this.currentFormat = detected;
        }
      }
      this.locators = null;
      this.scheduleTest();
    });

    this.$('copy-btn')?.addEventListener('click', () => {
      const text = (this.$('locator-input') as HTMLInputElement)?.value || '';
      if (!text) return;
      const btn = this.$('copy-btn')!;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '\u2713';
        btn.classList.add('ok');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('ok');
        }, 1500);
      });
    });

    this.$('expand-btn')?.addEventListener('click', () => this.expandCb?.());
    this.$('theme-btn')?.addEventListener('click', () => this.toggleTheme());
    this.$('close-btn')?.addEventListener('click', () => {
      this.hide();
      this.closeCb?.();
    });
  }
}
