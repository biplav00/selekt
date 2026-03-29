// floating-widget.ts — Floating locator widget injected into web pages via Shadow DOM.
// Aesthetic: Utilitarian dark instrument panel. Sharp edges, dense information, glowing accents.

type SelectorFormat = 'css' | 'xpath' | 'playwright' | 'cypress' | 'selenium';

interface ElementData {
  tagName: string;
  text: string;
  attributes: Record<string, string>;
}

interface Locators {
  css: string;
  xpath: string;
  playwright: string;
  cypress: string;
  selenium: string;
}

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

function cssEscape(v: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(v);
  return v.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}
function escAttr(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
function escXP(v: string): string {
  if (!v.includes("'")) return `'${v}'`;
  if (!v.includes('"')) return `"${v}"`;
  return `concat(${v
    .split("'")
    .map((p) => `'${p}'`)
    .join(`, "'", `)})`;
}
function e1(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
function e2(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// ---------------------------------------------------------------------------
// Locator generation
// ---------------------------------------------------------------------------

export function generateLocators(el: ElementData): Locators {
  const tag = el.tagName.toLowerCase();
  const a = el.attributes;
  const tid = a['data-testid'] || a['data-test'];
  const id = a.id;
  const role = a.role;
  const aria = a['aria-label'];
  const name = a.name;
  const cls = a.class;
  const txt = el.text?.trim().substring(0, 50) || '';

  let css: string;
  if (tid) css = `[data-testid="${escAttr(tid)}"]`;
  else if (id) css = `#${cssEscape(id)}`;
  else if (role && aria) css = `[role="${escAttr(role)}"][aria-label="${escAttr(aria)}"]`;
  else if (aria) css = `[aria-label="${escAttr(aria)}"]`;
  else if (role) css = `[role="${escAttr(role)}"]`;
  else if (name) css = `${tag}[name="${escAttr(name)}"]`;
  else if (cls)
    css = `${tag}.${cls.split(/\s+/).filter(Boolean).slice(0, 2).map(cssEscape).join('.')}`;
  else css = tag;

  let xpath: string;
  if (tid) xpath = `//${tag}[@data-testid=${escXP(tid)}]`;
  else if (id) xpath = `//${tag}[@id=${escXP(id)}]`;
  else if (aria) xpath = `//${tag}[@aria-label=${escXP(aria)}]`;
  else if (role) xpath = `//${tag}[@role=${escXP(role)}]`;
  else if (name) xpath = `//${tag}[@name=${escXP(name)}]`;
  else if (txt && txt.length <= 30) xpath = `//${tag}[text()=${escXP(txt)}]`;
  else xpath = `//${tag}`;

  let playwright: string;
  if (tid) playwright = `page.getByTestId('${e1(tid)}')`;
  else if (role) {
    const n = aria || txt;
    playwright = n
      ? `page.getByRole('${e1(role)}', { name: '${e1(n.substring(0, 40))}' })`
      : `page.getByRole('${e1(role)}')`;
  } else if (aria) playwright = `page.getByLabel('${e1(aria)}')`;
  else if (a.placeholder) playwright = `page.getByPlaceholder('${e1(a.placeholder)}')`;
  else if ((tag === 'button' || tag === 'a') && txt)
    playwright = `page.getByRole('${tag === 'button' ? 'button' : 'link'}', { name: '${e1(txt.substring(0, 40))}' })`;
  else if (txt && txt.length <= 30) playwright = `page.getByText('${e1(txt)}')`;
  else playwright = `page.locator('${e1(css)}')`;

  let cypress: string;
  if (tid) cypress = `cy.get('[data-testid="${e1(escAttr(tid))}"]')`;
  else if (txt && txt.length <= 30 && (tag === 'button' || tag === 'a'))
    cypress = `cy.contains('${e1(tag)}', '${e1(txt)}')`;
  else cypress = `cy.get('${e1(css)}')`;

  let selenium: string;
  if (id) selenium = `driver.findElement(By.id("${e2(id)}"))`;
  else if (name) selenium = `driver.findElement(By.name("${e2(name)}"))`;
  else selenium = `driver.findElement(By.cssSelector("${e2(css)}"))`;

  return { css, xpath, playwright, cypress, selenium };
}

// ---------------------------------------------------------------------------
// ARIA role intelligence
// ---------------------------------------------------------------------------

const IMPLICIT_ROLES: Record<string, string> = {
  button: 'button',
  a: 'link',
  input: 'textbox',
  select: 'combobox',
  textarea: 'textbox',
  img: 'img',
  nav: 'navigation',
  main: 'main',
  header: 'banner',
  footer: 'contentinfo',
  aside: 'complementary',
  form: 'form',
  table: 'table',
  dialog: 'dialog',
  article: 'article',
  section: 'region',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  ul: 'list',
  ol: 'list',
  li: 'listitem',
  details: 'group',
  summary: 'button',
  progress: 'progressbar',
  meter: 'meter',
  output: 'status',
};

const ROLE_TO_TAGS: Record<string, string[]> = {};
for (const [tag, role] of Object.entries(IMPLICIT_ROLES)) {
  if (!ROLE_TO_TAGS[role]) ROLE_TO_TAGS[role] = [];
  ROLE_TO_TAGS[role].push(tag);
}

function getRoleCandidates(role: string): Element[] {
  const out: Element[] = [];
  out.push(...Array.from(document.querySelectorAll(`[role="${role}"]`)));
  for (const tag of ROLE_TO_TAGS[role] || []) {
    for (const el of document.querySelectorAll(tag)) {
      if (!el.hasAttribute('role')) out.push(el); // only implicit
    }
  }
  return out;
}

function filterByName(els: Element[], name: string): Element[] {
  const lower = name.toLowerCase();
  return els.filter((el) => {
    if (el.getAttribute('aria-label')?.toLowerCase().includes(lower)) return true;
    if ((el.textContent?.trim().toLowerCase() || '').includes(lower)) return true;
    if (el.getAttribute('title')?.toLowerCase().includes(lower)) return true;
    if (el.getAttribute('alt')?.toLowerCase().includes(lower)) return true;
    if ((el as HTMLInputElement).value?.toLowerCase().includes(lower)) return true;
    return false;
  });
}

// ---------------------------------------------------------------------------
// Shared highlight logic — persists until next test (no auto-clear)
// ---------------------------------------------------------------------------

const HIGHLIGHT_ATTR = 'data-selekt-hl';

function clearAllHighlights(): void {
  document.querySelectorAll(`[${HIGHLIGHT_ATTR}]`).forEach((el) => {
    (el as HTMLElement).style.outline = '';
    (el as HTMLElement).style.outlineOffset = '';
    el.removeAttribute(HIGHLIGHT_ATTR);
  });
}

function highlightElements(elements: Element[]): void {
  clearAllHighlights();
  for (const el of elements) {
    (el as HTMLElement).style.outline = '2px solid #22c55e';
    (el as HTMLElement).style.outlineOffset = '2px';
    el.setAttribute(HIGHLIGHT_ATTR, '1');
  }
}

// ---------------------------------------------------------------------------
// Extract testable selector
// ---------------------------------------------------------------------------

function extractTestable(
  locator: string,
  format: SelectorFormat
): { selector: string; selectorType: 'css' | 'xpath' | 'role' } | null {
  if (format === 'css') return { selector: locator, selectorType: 'css' };
  if (format === 'xpath') return { selector: locator, selectorType: 'xpath' };

  if (format === 'playwright') {
    const loc = locator.match(/page\.locator\((['"`])(.*?)\1\)/);
    if (loc) return { selector: loc[2], selectorType: 'css' };
    const tid = locator.match(/page\.getByTestId\((['"`])(.*?)\1\)/);
    if (tid) return { selector: `[data-testid="${tid[2]}"]`, selectorType: 'css' };
    const rwn = locator.match(/page\.getByRole\((['"`])(.*?)\1,\s*\{[^}]*name:\s*(['"`])(.*?)\3/);
    if (rwn) return { selector: `${rwn[2]}::${rwn[4]}`, selectorType: 'role' };
    const ro = locator.match(/page\.getByRole\((['"`])(.*?)\1/);
    if (ro) return { selector: ro[2], selectorType: 'role' };
    const txt = locator.match(/page\.getByText\((['"`])(.*?)\1/);
    if (txt) return { selector: `//*[contains(text(),"${txt[2]}")]`, selectorType: 'xpath' };
    const lbl = locator.match(/page\.getByLabel\((['"`])(.*?)\1/);
    if (lbl) return { selector: `[aria-label="${lbl[2]}"]`, selectorType: 'css' };
    const ph = locator.match(/page\.getByPlaceholder\((['"`])(.*?)\1/);
    if (ph) return { selector: `[placeholder="${ph[2]}"]`, selectorType: 'css' };
    const alt = locator.match(/page\.getByAltText\((['"`])(.*?)\1/);
    if (alt) return { selector: `[alt="${alt[2]}"]`, selectorType: 'css' };
    const ttl = locator.match(/page\.getByTitle\((['"`])(.*?)\1/);
    if (ttl) return { selector: `[title="${ttl[2]}"]`, selectorType: 'css' };
    return null;
  }

  if (format === 'cypress') {
    const get = locator.match(/cy\.get\((['"`])(.*?)\1\)/);
    if (get) return { selector: get[2], selectorType: 'css' };
    const ctag = locator.match(/cy\.contains\((['"`])(.*?)\1,\s*(['"`])(.*?)\3\)/);
    if (ctag)
      return { selector: `//${ctag[2]}[contains(text(),"${ctag[4]}")]`, selectorType: 'xpath' };
    const c = locator.match(/cy\.contains\((['"`])(.*?)\1\)/);
    if (c) return { selector: `//*[contains(text(),"${c[2]}")]`, selectorType: 'xpath' };
    const tid = locator.match(/cy\.findByTestId\((['"`])(.*?)\1/);
    if (tid) return { selector: `[data-testid="${tid[2]}"]`, selectorType: 'css' };
    const role = locator.match(/cy\.findByRole\((['"`])(.*?)\1/);
    if (role) return { selector: role[2], selectorType: 'role' };
    return null;
  }

  if (format === 'selenium') {
    const css = locator.match(/By\.css(?:Selector)?\((['"`])(.*?)\1\)/);
    if (css) return { selector: css[2], selectorType: 'css' };
    const xp = locator.match(/By\.xpath\((['"`])(.*?)\1\)/);
    if (xp) return { selector: xp[2], selectorType: 'xpath' };
    const id = locator.match(/By\.id\((['"`])(.*?)\1\)/);
    if (id) return { selector: `#${id[2]}`, selectorType: 'css' };
    const nm = locator.match(/By\.name\((['"`])(.*?)\1\)/);
    if (nm) return { selector: `[name="${nm[2]}"]`, selectorType: 'css' };
    const cl = locator.match(/By\.className\((['"`])(.*?)\1\)/);
    if (cl) return { selector: `.${cl[2]}`, selectorType: 'css' };
    return null;
  }

  return null;
}

function detectFormat(input: string): SelectorFormat {
  const s = input.trimStart();
  if (s.startsWith('//') || s.startsWith('(/')) return 'xpath';
  if (s.startsWith('page.')) return 'playwright';
  if (s.startsWith('cy.')) return 'cypress';
  if (s.startsWith('driver.')) return 'selenium';
  return 'css';
}

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
  private locators: Locators | null = null;
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
  private testCb: ((sel: string, type: string) => void) | null = null;
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
    clearAllHighlights();
  }

  destroy(): void {
    window.removeEventListener('mousemove', this.boundDragMove);
    window.removeEventListener('mouseup', this.boundDragEnd);
    clearAllHighlights();
    this.host.remove();
  }

  isVisible(): boolean {
    return this.visible;
  }

  setElementData(element: ElementData): void {
    this.locators = generateLocators(element);
    this.setPicking(false);
    this.updateInputFromLocators();
    this.scheduleTest();
  }

  onPick(cb: () => void): void {
    this.pickCb = cb;
  }
  onTest(cb: (sel: string, type: string) => void): void {
    this.testCb = cb;
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
      clearAllHighlights();
      return;
    }

    const val = input.value.trim();
    const format = detectFormat(val);
    const result = extractTestable(val, format);
    if (!result) {
      this.setMatch('parse error', 'none');
      clearAllHighlights();
      return;
    }

    // Role-based matching (Playwright getByRole, Cypress findByRole)
    if (result.selectorType === 'role') {
      const parts = result.selector.split('::');
      const role = parts[0];
      const nameFilter = parts[1] || undefined;
      const candidates = getRoleCandidates(role);
      const matches = nameFilter ? filterByName(candidates, nameFilter) : candidates;
      highlightElements(matches);
      this.setMatch(
        matches.length > 0 ? `${matches.length}` : '0',
        matches.length > 0 ? 'found' : 'none'
      );
      return;
    }

    // CSS / XPath
    try {
      let elements: Element[];
      if (result.selectorType === 'xpath') {
        elements = [];
        const xr = document.evaluate(
          result.selector,
          document,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        );
        for (let i = 0; i < xr.snapshotLength; i++) {
          const n = xr.snapshotItem(i);
          if (n instanceof Element) elements.push(n);
        }
      } else {
        elements = Array.from(document.querySelectorAll(result.selector));
      }
      highlightElements(elements);
      this.setMatch(
        elements.length > 0 ? `${elements.length}` : '0',
        elements.length > 0 ? 'found' : 'none'
      );
    } catch {
      clearAllHighlights();
      this.setMatch('invalid', 'none');
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
    // Also allow dragging from the header edges (but not buttons)
    this.$('drag-handle')?.addEventListener('mousedown', (e) => {
      if (!(e.target as HTMLElement).closest('button, select, input, .drag-area')) return;
      // drag-area handles it
    });

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
