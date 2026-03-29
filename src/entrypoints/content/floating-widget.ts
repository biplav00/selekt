// floating-widget.ts
// Floating widget injected into web pages via Shadow DOM.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
// Escaping utilities
// ---------------------------------------------------------------------------

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return value
    .replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1')
    .replace(/^([0-9])/, '\\3$1 ');
}

function escapeCssAttrValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeXPathValue(value: string): string {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  const parts = value.split("'").map((p) => `'${p}'`);
  return `concat(${parts.join(`, "'"`)})`;
}

function escapeSingleQuoteJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escapeDoubleQuoteJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// ---------------------------------------------------------------------------
// Locator generation
// ---------------------------------------------------------------------------

export function generateLocators(element: ElementData): Locators {
  const { tagName, attributes, text } = element;
  const tag = tagName.toLowerCase();
  const testid = attributes['data-testid'];
  const dataTest = attributes['data-test'];
  const id = attributes.id;
  const role = attributes.role;
  const ariaLabel = attributes['aria-label'];
  const name = attributes.name;
  const className = attributes.class;
  const trimmedText = text?.trim().substring(0, 50) || '';

  // --- CSS ---
  let css: string;
  if (testid) css = `[data-testid="${escapeCssAttrValue(testid)}"]`;
  else if (dataTest) css = `[data-test="${escapeCssAttrValue(dataTest)}"]`;
  else if (id && !id.includes(' ')) css = `#${cssEscape(id)}`;
  else if (role && ariaLabel)
    css = `[role="${escapeCssAttrValue(role)}"][aria-label="${escapeCssAttrValue(ariaLabel)}"]`;
  else if (ariaLabel) css = `[aria-label="${escapeCssAttrValue(ariaLabel)}"]`;
  else if (role) css = `[role="${escapeCssAttrValue(role)}"]`;
  else if (name) css = `${tag}[name="${escapeCssAttrValue(name)}"]`;
  else if (className) {
    const classes = className.split(/\s+/).filter(Boolean).slice(0, 2);
    css = `${tag}.${classes.map(cssEscape).join('.')}`;
  } else css = tag;

  // --- XPath ---
  let xpath: string;
  if (testid) xpath = `//${tag}[@data-testid=${escapeXPathValue(testid)}]`;
  else if (id) xpath = `//${tag}[@id=${escapeXPathValue(id)}]`;
  else if (ariaLabel) xpath = `//${tag}[@aria-label=${escapeXPathValue(ariaLabel)}]`;
  else if (role) xpath = `//${tag}[@role=${escapeXPathValue(role)}]`;
  else if (name) xpath = `//${tag}[@name=${escapeXPathValue(name)}]`;
  else if (trimmedText && trimmedText.length <= 30)
    xpath = `//${tag}[text()=${escapeXPathValue(trimmedText)}]`;
  else xpath = `//${tag}`;

  // --- Playwright ---
  let playwright: string;
  if (testid) playwright = `page.getByTestId('${escapeSingleQuoteJs(testid)}')`;
  else if (role) {
    const n = ariaLabel || trimmedText;
    playwright = n
      ? `page.getByRole('${escapeSingleQuoteJs(role)}', { name: '${escapeSingleQuoteJs(n.substring(0, 40))}' })`
      : `page.getByRole('${escapeSingleQuoteJs(role)}')`;
  } else if (ariaLabel) playwright = `page.getByLabel('${escapeSingleQuoteJs(ariaLabel)}')`;
  else if (attributes.placeholder)
    playwright = `page.getByPlaceholder('${escapeSingleQuoteJs(attributes.placeholder)}')`;
  else if ((tag === 'button' || tag === 'a') && trimmedText)
    playwright = `page.getByRole('${tag === 'button' ? 'button' : 'link'}', { name: '${escapeSingleQuoteJs(trimmedText.substring(0, 40))}' })`;
  else if (trimmedText && trimmedText.length <= 30)
    playwright = `page.getByText('${escapeSingleQuoteJs(trimmedText)}')`;
  else playwright = `page.locator('${escapeSingleQuoteJs(css)}')`;

  // --- Cypress ---
  let cypress: string;
  if (testid)
    cypress = `cy.get('[data-testid="${escapeSingleQuoteJs(escapeCssAttrValue(testid))}"]')`;
  else if (trimmedText && trimmedText.length <= 30 && (tag === 'button' || tag === 'a'))
    cypress = `cy.contains('${escapeSingleQuoteJs(tag)}', '${escapeSingleQuoteJs(trimmedText)}')`;
  else cypress = `cy.get('${escapeSingleQuoteJs(css)}')`;

  // --- Selenium ---
  let selenium: string;
  if (id) selenium = `driver.findElement(By.id("${escapeDoubleQuoteJs(id)}"))`;
  else if (name) selenium = `driver.findElement(By.name("${escapeDoubleQuoteJs(name)}"))`;
  else selenium = `driver.findElement(By.cssSelector("${escapeDoubleQuoteJs(css)}"))`;

  return { css, xpath, playwright, cypress, selenium };
}

// ---------------------------------------------------------------------------
// Extract testable selector from any format
// ---------------------------------------------------------------------------

function extractTestable(
  locator: string,
  format: SelectorFormat
): { selector: string; selectorType: 'css' | 'xpath' } | null {
  if (format === 'css') return { selector: locator, selectorType: 'css' };
  if (format === 'xpath') return { selector: locator, selectorType: 'xpath' };

  if (format === 'playwright') {
    const loc = locator.match(/page\.locator\((['"`])(.*?)\1\)/);
    if (loc) return { selector: loc[2], selectorType: 'css' };
    const tid = locator.match(/page\.getByTestId\((['"`])(.*?)\1\)/);
    if (tid) return { selector: `[data-testid="${tid[2]}"]`, selectorType: 'css' };
    const role = locator.match(/page\.getByRole\((['"`])(.*?)\1/);
    if (role) return { selector: `[role="${role[2]}"]`, selectorType: 'css' };
    const txt = locator.match(/page\.getByText\((['"`])(.*?)\1/);
    if (txt) return { selector: `//*[contains(text(),"${txt[2]}")]`, selectorType: 'xpath' };
    const lbl = locator.match(/page\.getByLabel\((['"`])(.*?)\1/);
    if (lbl) return { selector: `[aria-label="${lbl[2]}"]`, selectorType: 'css' };
    const ph = locator.match(/page\.getByPlaceholder\((['"`])(.*?)\1/);
    if (ph) return { selector: `[placeholder="${ph[2]}"]`, selectorType: 'css' };
    const alt = locator.match(/page\.getByAltText\((['"`])(.*?)\1/);
    if (alt) return { selector: `[alt="${alt[2]}"]`, selectorType: 'css' };
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
    const cls = locator.match(/By\.className\((['"`])(.*?)\1\)/);
    if (cls) return { selector: `.${cls[2]}`, selectorType: 'css' };
    const tag = locator.match(/By\.tagName\((['"`])(.*?)\1\)/);
    if (tag) return { selector: tag[2], selectorType: 'css' };
    return null;
  }

  return null;
}

// Auto-detect format from freeform input
function detectFormat(input: string): SelectorFormat {
  const s = input.trimStart();
  if (s.startsWith('//') || s.startsWith('(/')) return 'xpath';
  if (s.startsWith('page.')) return 'playwright';
  if (s.startsWith('cy.')) return 'cypress';
  if (s.startsWith('driver.')) return 'selenium';
  return 'css';
}

// ---------------------------------------------------------------------------
// Widget CSS
// ---------------------------------------------------------------------------

const WIDGET_CSS = `
  :host {
    all: initial;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    line-height: 1.4;
    color: #fafafa;
  }
  * { box-sizing: border-box; }

  .widget {
    width: 340px;
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4);
    overflow: hidden;
    user-select: none;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 10px;
    background: #111114;
    border-bottom: 1px solid #27272a;
    cursor: grab;
  }
  .header:active { cursor: grabbing; }

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .logo-icon {
    width: 18px; height: 18px;
    background: #3b82f6;
    border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .logo-icon svg { width: 10px; height: 10px; fill: #fff; }

  .logo-text {
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.08em; color: #fafafa;
  }

  .icon-btn {
    width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 4px; background: transparent;
    border: none; color: #a1a1aa; cursor: pointer; padding: 0;
    transition: background 0.12s, color 0.12s;
  }
  .icon-btn:hover { background: #18181b; color: #fafafa; }
  .icon-btn svg { width: 13px; height: 13px; }

  .body {
    padding: 8px 10px 10px;
    display: flex; flex-direction: column; gap: 6px;
  }

  .pick-btn {
    width: 100%; padding: 7px 10px;
    background: #3b82f6; color: #fff; border: none;
    border-radius: 6px; font-size: 12px; font-weight: 600;
    cursor: pointer; display: flex; align-items: center;
    justify-content: center; gap: 5px;
    transition: background 0.12s;
  }
  .pick-btn:hover { background: #2563eb; }
  .pick-btn.picking { background: #7c3aed; }
  .pick-btn svg { width: 13px; height: 13px; }

  .locator-section { display: none; flex-direction: column; gap: 6px; }
  .locator-section.visible { display: flex; }

  /* Row 1: input field */
  .input-row {
    display: flex;
  }
  .locator-input {
    width: 100%;
    padding: 5px 8px;
    background: #111114;
    border: 1px solid #27272a;
    border-radius: 5px;
    color: #fafafa;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    outline: none;
    transition: border-color 0.12s;
  }
  .locator-input:focus { border-color: #3b82f6; }
  .locator-input::placeholder { color: #52525b; }

  /* Row 2: format + copy */
  .controls-row {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .format-select {
    padding: 4px 6px;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 5px;
    color: #fafafa;
    font-size: 10px;
    cursor: pointer;
    outline: none;
  }
  .format-select:focus { border-color: #3b82f6; }

  .match-info {
    flex: 1;
    font-size: 10px;
    color: #52525b;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .match-info.found { color: #22c55e; }
  .match-info.none { color: #ef4444; }

  .action-btn {
    padding: 4px 8px;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 5px;
    color: #a1a1aa;
    font-size: 11px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
    white-space: nowrap;
  }
  .action-btn:hover { background: #27272a; color: #fafafa; }
  .action-btn.success { color: #22c55e; border-color: #22c55e; }
`;

// ---------------------------------------------------------------------------
// Widget HTML
// ---------------------------------------------------------------------------

function buildWidgetHTML(): string {
  return `
    <div class="widget">
      <div class="header" id="drag-handle">
        <div class="header-left">
          <div class="logo-icon">
            <svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="3.5" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="5" cy="5" r="1" fill="#fff"/></svg>
          </div>
          <span class="logo-text">SELEKT</span>
        </div>
        <button class="icon-btn" id="close-btn" title="Close">
          <svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="body">
        <button class="pick-btn" id="pick-btn">
          <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          Pick Element
        </button>
        <div class="locator-section" id="locator-section">
          <div class="input-row">
            <input type="text" class="locator-input" id="locator-input" placeholder="Type or pick a selector..." spellcheck="false" autocomplete="off" />
          </div>
          <div class="controls-row">
            <select class="format-select" id="format-select">
              <option value="css">CSS</option>
              <option value="xpath">XPath</option>
              <option value="playwright">PW</option>
              <option value="cypress">CY</option>
              <option value="selenium">SE</option>
            </select>
            <span class="match-info" id="match-info"></span>
            <button class="action-btn" id="copy-btn">Copy</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// FloatingWidget class
// ---------------------------------------------------------------------------

export class FloatingWidget {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private locators: Locators | null = null;
  private currentFormat: SelectorFormat = 'css';
  private visible = false;
  private isPicking = false;
  private testDebounce: ReturnType<typeof setTimeout> | null = null;

  // Drag state
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private hostStartX = 0;
  private hostStartY = 0;
  private boundDragMove: (e: MouseEvent) => void;
  private boundDragEnd: () => void;

  // Callbacks
  private pickCallback: (() => void) | null = null;
  private testCallback: ((selector: string, selectorType: string) => void) | null = null;
  private closeCallback: (() => void) | null = null;

  constructor() {
    this.host = document.createElement('div');
    this.host.id = 'selekt-floating-host';
    this.host.style.cssText =
      'position:fixed;right:20px;bottom:20px;z-index:2147483646;pointer-events:auto;';

    this.shadow = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = WIDGET_CSS;
    this.shadow.appendChild(style);

    const tmp = document.createElement('div');
    tmp.innerHTML = buildWidgetHTML();
    this.shadow.appendChild(tmp.firstElementChild as Element);

    (document.documentElement || document.body).appendChild(this.host);

    // Bind drag handlers at window level so they work outside shadow DOM
    this.boundDragMove = (e: MouseEvent) => this.onDragMove(e);
    this.boundDragEnd = () => this.stopDrag();

    this.bindEvents();
    this.host.style.display = 'none';
  }

  // ---- Lifecycle ----

  show(): void {
    this.host.style.display = '';
    this.visible = true;
    // Show the locator section immediately so user can type freeform
    this.$('locator-section')?.classList.add('visible');
  }

  hide(): void {
    this.host.style.display = 'none';
    this.visible = false;
  }

  destroy(): void {
    window.removeEventListener('mousemove', this.boundDragMove);
    window.removeEventListener('mouseup', this.boundDragEnd);
    this.host.remove();
  }

  isVisible(): boolean {
    return this.visible;
  }

  // ---- Data ----

  setElementData(element: ElementData): void {
    this.locators = generateLocators(element);
    this.setPicking(false);
    this.$('locator-section')?.classList.add('visible');
    this.updateInputFromLocators();
    this.scheduleTest();
  }

  // ---- Callbacks ----

  onPick(callback: () => void): void {
    this.pickCallback = callback;
  }

  onTest(callback: (selector: string, selectorType: string) => void): void {
    this.testCallback = callback;
  }

  onClose(callback: () => void): void {
    this.closeCallback = callback;
  }

  // ---- Picking mode ----

  setPicking(active: boolean): void {
    this.isPicking = active;
    const pickBtn = this.$('pick-btn');
    if (!pickBtn) return;
    if (active) {
      pickBtn.classList.add('picking');
      pickBtn.textContent = 'Picking…';
      this.host.style.pointerEvents = 'none';
    } else {
      pickBtn.classList.remove('picking');
      pickBtn.innerHTML = `
        <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        Pick Element
      `;
      this.host.style.pointerEvents = 'auto';
    }
  }

  // ---- Private helpers ----

  private $(id: string): HTMLElement | null {
    return this.shadow.getElementById(id);
  }

  private updateInputFromLocators(): void {
    if (!this.locators) return;
    const input = this.$('locator-input') as HTMLInputElement | null;
    if (input) {
      input.value = this.locators[this.currentFormat];
    }
  }

  private getTestableFromInput(): { selector: string; selectorType: 'css' | 'xpath' } | null {
    const input = this.$('locator-input') as HTMLInputElement | null;
    if (!input || !input.value.trim()) return null;
    const val = input.value.trim();
    const format = detectFormat(val);
    return extractTestable(val, format);
  }

  private scheduleTest(): void {
    if (this.testDebounce) clearTimeout(this.testDebounce);
    this.testDebounce = setTimeout(() => this.runTest(), 400);
  }

  private runTest(): void {
    const result = this.getTestableFromInput();
    if (!result) {
      this.setMatchInfo('');
      return;
    }
    if (this.testCallback) {
      this.testCallback(result.selector, result.selectorType);
    }
    // Count matches
    try {
      let count: number;
      if (result.selectorType === 'xpath') {
        const xr = document.evaluate(
          result.selector,
          document,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        );
        count = xr.snapshotLength;
      } else {
        count = document.querySelectorAll(result.selector).length;
      }
      if (count > 0) {
        this.setMatchInfo(`${count} match${count !== 1 ? 'es' : ''}`, 'found');
      } else {
        this.setMatchInfo('No matches', 'none');
      }
    } catch {
      this.setMatchInfo('Invalid', 'none');
    }
  }

  private setMatchInfo(text: string, cls?: 'found' | 'none'): void {
    const el = this.$('match-info');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('found', 'none');
    if (cls) el.classList.add(cls);
  }

  // ---- Dragging ----

  private startDrag(e: MouseEvent): void {
    if ((e.target as HTMLElement).closest('button, select, input')) return;
    this.dragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;

    const rect = this.host.getBoundingClientRect();
    this.hostStartX = rect.left;
    this.hostStartY = rect.top;

    // Switch from right/bottom to left/top positioning
    this.host.style.right = '';
    this.host.style.bottom = '';
    this.host.style.left = `${rect.left}px`;
    this.host.style.top = `${rect.top}px`;

    window.addEventListener('mousemove', this.boundDragMove);
    window.addEventListener('mouseup', this.boundDragEnd);
    e.preventDefault();
  }

  private onDragMove(e: MouseEvent): void {
    if (!this.dragging) return;
    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    const newLeft = this.hostStartX + dx;
    const newTop = this.hostStartY + dy;
    const maxLeft = window.innerWidth - this.host.offsetWidth - 4;
    const maxTop = window.innerHeight - this.host.offsetHeight - 4;
    this.host.style.left = `${Math.max(4, Math.min(newLeft, maxLeft))}px`;
    this.host.style.top = `${Math.max(4, Math.min(newTop, maxTop))}px`;
  }

  private stopDrag(): void {
    this.dragging = false;
    window.removeEventListener('mousemove', this.boundDragMove);
    window.removeEventListener('mouseup', this.boundDragEnd);
  }

  // ---- Event binding ----

  private bindEvents(): void {
    // Drag — mousedown on header
    const handle = this.$('drag-handle');
    handle?.addEventListener('mousedown', (e) => this.startDrag(e as MouseEvent));

    // Pick
    this.$('pick-btn')?.addEventListener('click', () => {
      if (!this.isPicking) {
        this.setPicking(true);
        this.pickCallback?.();
      }
    });

    // Format select
    const formatSelect = this.$('format-select') as HTMLSelectElement | null;
    formatSelect?.addEventListener('change', () => {
      this.currentFormat = formatSelect.value as SelectorFormat;
      this.updateInputFromLocators();
      this.scheduleTest();
    });

    // Input — freeform typing with auto-detect and debounced test
    const input = this.$('locator-input') as HTMLInputElement | null;
    input?.addEventListener('input', () => {
      const val = input.value.trim();
      if (val) {
        const detected = detectFormat(val);
        // Sync dropdown to detected format
        if (formatSelect && formatSelect.value !== detected) {
          formatSelect.value = detected;
          this.currentFormat = detected;
        }
      }
      // Clear stored locators since user is typing freeform
      this.locators = null;
      this.scheduleTest();
    });

    // Copy
    this.$('copy-btn')?.addEventListener('click', () => {
      const inputEl = this.$('locator-input') as HTMLInputElement | null;
      const text = inputEl?.value || '';
      if (!text) return;
      const copyBtn = this.$('copy-btn')!;
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = '✓';
        copyBtn.classList.add('success');
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
          copyBtn.classList.remove('success');
        }, 1500);
      });
    });

    // Close
    this.$('close-btn')?.addEventListener('click', () => {
      this.hide();
      this.closeCallback?.();
    });
  }
}
