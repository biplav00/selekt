// floating-widget.ts
// A floating widget injected into web pages as an alternative to the sidepanel.
// Lives inside a Shadow DOM container for style isolation.

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
// Escaping utilities (self-contained, no sidepanel imports)
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
// Locator generation (self-contained, lightweight)
// Priority: data-testid > id > role+aria-label > name > class > text > tag
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
  if (testid) {
    css = `[data-testid="${escapeCssAttrValue(testid)}"]`;
  } else if (dataTest) {
    css = `[data-test="${escapeCssAttrValue(dataTest)}"]`;
  } else if (id && !id.includes(' ')) {
    css = `#${cssEscape(id)}`;
  } else if (role && ariaLabel) {
    css = `[role="${escapeCssAttrValue(role)}"][aria-label="${escapeCssAttrValue(ariaLabel)}"]`;
  } else if (ariaLabel) {
    css = `[aria-label="${escapeCssAttrValue(ariaLabel)}"]`;
  } else if (role) {
    css = `[role="${escapeCssAttrValue(role)}"]`;
  } else if (name) {
    css = `${tag}[name="${escapeCssAttrValue(name)}"]`;
  } else if (className) {
    const classes = className
      .split(/\s+/)
      .filter((c) => c)
      .slice(0, 2);
    css = `${tag}.${classes.map(cssEscape).join('.')}`;
  } else {
    css = tag;
  }

  // --- XPath ---
  let xpath: string;
  if (testid) {
    xpath = `//${tag}[@data-testid=${escapeXPathValue(testid)}]`;
  } else if (dataTest) {
    xpath = `//${tag}[@data-test=${escapeXPathValue(dataTest)}]`;
  } else if (id && !id.includes(' ')) {
    xpath = `//*[@id=${escapeXPathValue(id)}]`;
  } else if (ariaLabel) {
    xpath = `//${tag}[@aria-label=${escapeXPathValue(ariaLabel)}]`;
  } else if (role) {
    xpath = `//${tag}[@role=${escapeXPathValue(role)}]`;
  } else if (name) {
    xpath = `//${tag}[@name=${escapeXPathValue(name)}]`;
  } else if (trimmedText) {
    xpath = `//${tag}[normalize-space(text())=${escapeXPathValue(trimmedText)}]`;
  } else {
    xpath = `//${tag}`;
  }

  // --- Playwright ---
  let playwright: string;
  if (testid) {
    playwright = `page.getByTestId('${escapeSingleQuoteJs(testid)}')`;
  } else if (role && ariaLabel) {
    playwright = `page.getByRole('${escapeSingleQuoteJs(role)}', { name: '${escapeSingleQuoteJs(ariaLabel)}' })`;
  } else if (role && trimmedText) {
    playwright = `page.getByRole('${escapeSingleQuoteJs(role)}', { name: '${escapeSingleQuoteJs(trimmedText)}' })`;
  } else if (role) {
    playwright = `page.getByRole('${escapeSingleQuoteJs(role)}')`;
  } else if (ariaLabel) {
    playwright = `page.getByLabel('${escapeSingleQuoteJs(ariaLabel)}')`;
  } else if (trimmedText) {
    playwright = `page.getByText('${escapeSingleQuoteJs(trimmedText)}')`;
  } else if (id && !id.includes(' ')) {
    playwright = `page.locator('#${cssEscape(id)}')`;
  } else {
    playwright = `page.locator('${escapeSingleQuoteJs(css)}')`;
  }

  // --- Cypress ---
  let cypress: string;
  if (testid) {
    cypress = `cy.get('[data-testid="${escapeDoubleQuoteJs(testid)}"]')`;
  } else if (dataTest) {
    cypress = `cy.get('[data-test="${escapeDoubleQuoteJs(dataTest)}"]')`;
  } else if (id && !id.includes(' ')) {
    cypress = `cy.get('#${cssEscape(id)}')`;
  } else if (ariaLabel) {
    cypress = `cy.get('[aria-label="${escapeDoubleQuoteJs(ariaLabel)}"]')`;
  } else if (name) {
    cypress = `cy.get('${tag}[name="${escapeDoubleQuoteJs(name)}"]')`;
  } else if (trimmedText) {
    cypress = `cy.contains('${escapeSingleQuoteJs(trimmedText)}')`;
  } else {
    cypress = `cy.get('${tag}')`;
  }

  // --- Selenium ---
  let selenium: string;
  if (testid) {
    selenium = `driver.findElement(By.css('[data-testid="${escapeDoubleQuoteJs(testid)}"]'))`;
  } else if (dataTest) {
    selenium = `driver.findElement(By.css('[data-test="${escapeDoubleQuoteJs(dataTest)}"]'))`;
  } else if (id && !id.includes(' ')) {
    selenium = `driver.findElement(By.id('${escapeSingleQuoteJs(id)}'))`;
  } else if (name) {
    selenium = `driver.findElement(By.name('${escapeSingleQuoteJs(name)}'))`;
  } else if (ariaLabel) {
    selenium = `driver.findElement(By.css('[aria-label="${escapeDoubleQuoteJs(ariaLabel)}"]'))`;
  } else if (role) {
    selenium = `driver.findElement(By.xpath('//${tag}[@role=${escapeXPathValue(role)}]'))`;
  } else {
    selenium = `driver.findElement(By.tagName('${escapeSingleQuoteJs(tag)}'))`;
  }

  return { css, xpath, playwright, cypress, selenium };
}

// ---------------------------------------------------------------------------
// extractTestable — convert framework locator → raw CSS/XPath for testing
// ---------------------------------------------------------------------------

function extractTestable(
  locator: string,
  format: SelectorFormat
): { selector: string; selectorType: 'css' | 'xpath' } | null {
  if (format === 'css') return { selector: locator, selectorType: 'css' };
  if (format === 'xpath') return { selector: locator, selectorType: 'xpath' };

  if (format === 'playwright') {
    const locMatch = locator.match(/page\.locator\((['"`])(.*?)\1\)/);
    if (locMatch) return { selector: locMatch[2], selectorType: 'css' };

    const testIdMatch = locator.match(/page\.getByTestId\((['"`])(.*?)\1\)/);
    if (testIdMatch) return { selector: `[data-testid="${testIdMatch[2]}"]`, selectorType: 'css' };

    const roleMatch = locator.match(/page\.getByRole\((['"`])(.*?)\1/);
    if (roleMatch) return { selector: `[role="${roleMatch[2]}"]`, selectorType: 'css' };

    const textMatch = locator.match(/page\.getByText\((['"`])(.*?)\1/);
    if (textMatch)
      return { selector: `//*[contains(text(),"${textMatch[2]}")]`, selectorType: 'xpath' };

    const labelMatch = locator.match(/page\.getByLabel\((['"`])(.*?)\1/);
    if (labelMatch) return { selector: `[aria-label="${labelMatch[2]}"]`, selectorType: 'css' };

    const phMatch = locator.match(/page\.getByPlaceholder\((['"`])(.*?)\1/);
    if (phMatch) return { selector: `[placeholder="${phMatch[2]}"]`, selectorType: 'css' };

    const altMatch = locator.match(/page\.getByAltText\((['"`])(.*?)\1/);
    if (altMatch) return { selector: `[alt="${altMatch[2]}"]`, selectorType: 'css' };

    return null;
  }

  if (format === 'cypress') {
    const getMatch = locator.match(/cy\.get\((['"`])(.*?)\1\)/);
    if (getMatch) return { selector: getMatch[2], selectorType: 'css' };

    const containsTagMatch = locator.match(/cy\.contains\((['"`])(.*?)\1,\s*(['"`])(.*?)\3\)/);
    if (containsTagMatch)
      return {
        selector: `//${containsTagMatch[2]}[contains(text(),"${containsTagMatch[4]}")]`,
        selectorType: 'xpath',
      };

    const containsMatch = locator.match(/cy\.contains\((['"`])(.*?)\1\)/);
    if (containsMatch)
      return { selector: `//*[contains(text(),"${containsMatch[2]}")]`, selectorType: 'xpath' };

    const testIdMatch = locator.match(/cy\.findByTestId\((['"`])(.*?)\1/);
    if (testIdMatch) return { selector: `[data-testid="${testIdMatch[2]}"]`, selectorType: 'css' };

    return null;
  }

  if (format === 'selenium') {
    const cssMatch = locator.match(/By\.css(?:Selector)?\((['"`])(.*?)\1\)/);
    if (cssMatch) return { selector: cssMatch[2], selectorType: 'css' };

    const xpathMatch = locator.match(/By\.xpath\((['"`])(.*?)\1\)/);
    if (xpathMatch) return { selector: xpathMatch[2], selectorType: 'xpath' };

    const idMatch = locator.match(/By\.id\((['"`])(.*?)\1\)/);
    if (idMatch) return { selector: `#${idMatch[2]}`, selectorType: 'css' };

    const nameMatch = locator.match(/By\.name\((['"`])(.*?)\1\)/);
    if (nameMatch) return { selector: `[name="${nameMatch[2]}"]`, selectorType: 'css' };

    const classMatch = locator.match(/By\.className\((['"`])(.*?)\1\)/);
    if (classMatch) return { selector: `.${classMatch[2]}`, selectorType: 'css' };

    const tagMatch = locator.match(/By\.tagName\((['"`])(.*?)\1\)/);
    if (tagMatch) return { selector: tagMatch[2], selectorType: 'css' };

    return null;
  }

  return null;
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

  * {
    box-sizing: border-box;
  }

  .widget {
    position: fixed;
    right: 20px;
    bottom: 20px;
    width: 320px;
    background: #09090b;
    border: 1px solid #27272a;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4);
    z-index: 2147483646;
    overflow: hidden;
    user-select: none;
  }

  /* Header / drag handle */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: #111114;
    border-bottom: 1px solid #27272a;
    cursor: grab;
  }

  .header:active {
    cursor: grabbing;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .logo-icon {
    width: 18px;
    height: 18px;
    background: #3b82f6;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .logo-icon svg {
    width: 10px;
    height: 10px;
    fill: #fff;
  }

  .logo-text {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #fafafa;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .icon-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    background: transparent;
    border: none;
    color: #a1a1aa;
    cursor: pointer;
    padding: 0;
    transition: background 0.12s, color 0.12s;
    flex-shrink: 0;
  }

  .icon-btn:hover {
    background: #18181b;
    color: #fafafa;
  }

  .icon-btn svg {
    width: 14px;
    height: 14px;
  }

  /* Body */
  .body {
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Pick button */
  .pick-btn {
    width: 100%;
    padding: 8px 12px;
    background: #3b82f6;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: background 0.12s;
  }

  .pick-btn:hover {
    background: #2563eb;
  }

  .pick-btn.picking {
    background: #7c3aed;
  }

  .pick-btn svg {
    width: 13px;
    height: 13px;
  }

  /* Locator row — shown after picking */
  .locator-row {
    display: none;
    flex-direction: column;
    gap: 6px;
  }

  .locator-row.visible {
    display: flex;
  }

  .locator-top {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .format-select {
    flex-shrink: 0;
    padding: 4px 6px;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 5px;
    color: #fafafa;
    font-size: 11px;
    cursor: pointer;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
  }

  .format-select:focus {
    border-color: #3b82f6;
  }

  .locator-text {
    flex: 1;
    min-width: 0;
    padding: 4px 8px;
    background: #111114;
    border: 1px solid #27272a;
    border-radius: 5px;
    color: #fafafa;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .action-btn {
    flex-shrink: 0;
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

  .action-btn:hover {
    background: #27272a;
    color: #fafafa;
  }

  .action-btn.success {
    color: #22c55e;
    border-color: #22c55e;
  }

  /* Expand button */
  .expand-btn {
    width: 100%;
    padding: 6px 10px;
    background: transparent;
    border: 1px solid #27272a;
    border-radius: 6px;
    color: #a1a1aa;
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }

  .expand-btn:hover {
    background: #18181b;
    color: #fafafa;
    border-color: #3b82f6;
  }

  .expand-btn svg {
    width: 12px;
    height: 12px;
  }
`;

// ---------------------------------------------------------------------------
// Widget HTML template
// ---------------------------------------------------------------------------

function buildWidgetHTML(): string {
  return `
    <div class="widget" id="selekt-widget">
      <div class="header" id="drag-handle">
        <div class="header-left">
          <div class="logo-icon">
            <svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
              <circle cx="5" cy="5" r="3.5" fill="none" stroke="#fff" stroke-width="1.5"/>
              <circle cx="5" cy="5" r="1" fill="#fff"/>
            </svg>
          </div>
          <span class="logo-text">SELEKT</span>
        </div>
        <div class="header-actions">
          <button class="icon-btn" id="expand-icon-btn" title="Open in sidepanel">
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3h4v1.5H4.5V12h7.5v-2.5H13.5V13H3V3Z" fill="currentColor"/>
              <path d="M9 2.5h4.5V7H12V4.5H9.5V3H9V2.5Z" fill="currentColor"/>
              <path d="M13 2.5 8 7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
          </button>
          <button class="icon-btn" id="close-btn" title="Close widget">
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="body">
        <button class="pick-btn" id="pick-btn">
          <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
            <path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          Pick Element
        </button>

        <div class="locator-row" id="locator-row">
          <div class="locator-top">
            <select class="format-select" id="format-select">
              <option value="css">CSS</option>
              <option value="xpath">XPath</option>
              <option value="playwright">Playwright</option>
              <option value="cypress">Cypress</option>
              <option value="selenium">Selenium</option>
            </select>
            <div class="locator-text" id="locator-text" title=""></div>
            <button class="action-btn" id="copy-btn">Copy</button>
            <button class="action-btn" id="test-btn">Test</button>
          </div>
          <button class="expand-btn" id="expand-btn">
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 2h5v1.5H3.5v9h9V11H14v3H2V2Z" fill="currentColor"/>
              <path d="M9.5 2H14v4.5h-1.5V4L9 7.5 8 6.5 11.5 3H9.5V2Z" fill="currentColor"/>
            </svg>
            Open in Sidepanel
          </button>
        </div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// FloatingWidget class
// ---------------------------------------------------------------------------

export class FloatingWidget {
  private container: HTMLElement;
  private shadow: ShadowRoot;
  private locators: Locators | null = null;
  private currentFormat: SelectorFormat = 'css';
  private visible = false;
  private isPicking = false;

  // Drag state
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private widgetStartX = 0;
  private widgetStartY = 0;

  // Callbacks
  private pickCallback: (() => void) | null = null;
  private testCallback: ((selector: string, selectorType: string) => void) | null = null;
  private expandCallback: (() => void) | null = null;
  private closeCallback: (() => void) | null = null;

  constructor() {
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'selekt-floating-host';
    this.container.style.cssText = `
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147483646;
      pointer-events: auto;
    `;

    // Attach shadow DOM
    this.shadow = this.container.attachShadow({ mode: 'open' });

    // Inject styles
    const style = document.createElement('style');
    style.textContent = WIDGET_CSS;
    this.shadow.appendChild(style);

    // Inject HTML
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildWidgetHTML();
    this.shadow.appendChild(wrapper.firstElementChild as Element);

    // Mount
    (document.documentElement || document.body).appendChild(this.container);

    // Bind interactions
    this.bindEvents();

    // Hidden by default
    this.container.style.display = 'none';
  }

  // ---- Lifecycle ----

  show(): void {
    this.container.style.display = '';
    this.visible = true;
  }

  hide(): void {
    this.container.style.display = 'none';
    this.visible = false;
  }

  destroy(): void {
    this.container.remove();
  }

  isVisible(): boolean {
    return this.visible;
  }

  // ---- Data ----

  setElementData(element: ElementData): void {
    this.locators = generateLocators(element);
    this.setPicking(false);
    this.showLocatorRow();
    this.updateLocatorDisplay();
  }

  // ---- Callbacks ----

  onPick(callback: () => void): void {
    this.pickCallback = callback;
  }

  onTest(callback: (selector: string, selectorType: string) => void): void {
    this.testCallback = callback;
  }

  onExpandToSidepanel(callback: () => void): void {
    this.expandCallback = callback;
  }

  onClose(callback: () => void): void {
    this.closeCallback = callback;
  }

  // ---- Picking mode ----

  setPicking(active: boolean): void {
    this.isPicking = active;
    const pickBtn = this.shadow.getElementById('pick-btn');
    if (!pickBtn) return;
    if (active) {
      pickBtn.classList.add('picking');
      pickBtn.textContent = '⏳ Picking…';
      // Disable pointer events on the widget so the picker can reach the page
      this.container.style.pointerEvents = 'none';
    } else {
      pickBtn.classList.remove('picking');
      // Restore pick button HTML (icon + text)
      pickBtn.innerHTML = `
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
          <path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        Pick Element
      `;
      this.container.style.pointerEvents = 'auto';
    }
  }

  // ---- Private helpers ----

  private showLocatorRow(): void {
    const row = this.shadow.getElementById('locator-row');
    row?.classList.add('visible');
  }

  private updateLocatorDisplay(): void {
    if (!this.locators) return;
    const text = this.locators[this.currentFormat];
    const locatorText = this.shadow.getElementById('locator-text');
    if (locatorText) {
      locatorText.textContent = text;
      locatorText.title = text;
    }
  }

  private getCurrentSelector(): { selector: string; selectorType: 'css' | 'xpath' } | null {
    if (!this.locators) return null;
    const raw = this.locators[this.currentFormat];
    return extractTestable(raw, this.currentFormat);
  }

  // ---- Dragging ----

  private startDrag(e: MouseEvent): void {
    if ((e.target as HTMLElement).closest('button, select')) return;
    this.dragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;

    const rect = this.container.getBoundingClientRect();
    this.widgetStartX = rect.left;
    this.widgetStartY = rect.top;

    // Switch from right/bottom to left/top positioning
    this.container.style.right = '';
    this.container.style.bottom = '';
    this.container.style.left = `${rect.left}px`;
    this.container.style.top = `${rect.top}px`;

    e.preventDefault();
  }

  private onDragMove(e: MouseEvent): void {
    if (!this.dragging) return;

    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;
    const newLeft = this.widgetStartX + dx;
    const newTop = this.widgetStartY + dy;

    // Prevent going off-screen
    const maxLeft = window.innerWidth - this.container.offsetWidth - 4;
    const maxTop = window.innerHeight - this.container.offsetHeight - 4;

    this.container.style.left = `${Math.max(4, Math.min(newLeft, maxLeft))}px`;
    this.container.style.top = `${Math.max(4, Math.min(newTop, maxTop))}px`;
  }

  private stopDrag(): void {
    this.dragging = false;
  }

  // ---- Event binding ----

  private bindEvents(): void {
    // Drag
    const handle = this.shadow.getElementById('drag-handle');
    if (handle) {
      handle.addEventListener('mousedown', (e) => this.startDrag(e as MouseEvent));
    }
    document.addEventListener('mousemove', (e) => this.onDragMove(e));
    document.addEventListener('mouseup', () => this.stopDrag());

    // Pick button
    const pickBtn = this.shadow.getElementById('pick-btn');
    if (pickBtn) {
      pickBtn.addEventListener('click', () => {
        if (!this.isPicking) {
          this.setPicking(true);
          this.pickCallback?.();
        }
      });
    }

    // Format select
    const formatSelect = this.shadow.getElementById('format-select') as HTMLSelectElement | null;
    if (formatSelect) {
      formatSelect.addEventListener('change', () => {
        this.currentFormat = formatSelect.value as SelectorFormat;
        this.updateLocatorDisplay();
      });
    }

    // Copy button
    const copyBtn = this.shadow.getElementById('copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (!this.locators) return;
        const text = this.locators[this.currentFormat];
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = '✓';
          copyBtn.classList.add('success');
          setTimeout(() => {
            copyBtn.textContent = 'Copy';
            copyBtn.classList.remove('success');
          }, 1500);
        });
      });
    }

    // Test button
    const testBtn = this.shadow.getElementById('test-btn');
    if (testBtn) {
      testBtn.addEventListener('click', () => {
        const result = this.getCurrentSelector();
        if (result && this.testCallback) {
          this.testCallback(result.selector, result.selectorType);
        }
      });
    }

    // Expand icon in header
    const expandIconBtn = this.shadow.getElementById('expand-icon-btn');
    if (expandIconBtn) {
      expandIconBtn.addEventListener('click', () => {
        this.expandCallback?.();
      });
    }

    // Expand button in body
    const expandBtn = this.shadow.getElementById('expand-btn');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        this.expandCallback?.();
      });
    }

    // Close button
    const closeBtn = this.shadow.getElementById('close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hide();
        this.closeCallback?.();
      });
    }
  }
}
