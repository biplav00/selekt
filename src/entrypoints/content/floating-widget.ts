// floating-widget.ts — Floating widget injected into web pages via Shadow DOM.

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
  return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

function escapeCssAttrValue(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeXPathValue(v: string): string {
  if (!v.includes("'")) return `'${v}'`;
  if (!v.includes('"')) return `"${v}"`;
  return `concat(${v
    .split("'")
    .map((p) => `'${p}'`)
    .join(`, "'", `)})`;
}

function esc1(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function esc2(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// ---------------------------------------------------------------------------
// Locator generation
// ---------------------------------------------------------------------------

export function generateLocators(el: ElementData): Locators {
  const tag = el.tagName.toLowerCase();
  const a = el.attributes;
  const testid = a['data-testid'] || a['data-test'];
  const id = a.id;
  const role = a.role;
  const ariaLabel = a['aria-label'];
  const name = a.name;
  const cls = a.class;
  const txt = el.text?.trim().substring(0, 50) || '';

  // CSS
  let css: string;
  if (testid) css = `[data-testid="${escapeCssAttrValue(testid)}"]`;
  else if (id) css = `#${cssEscape(id)}`;
  else if (role && ariaLabel)
    css = `[role="${escapeCssAttrValue(role)}"][aria-label="${escapeCssAttrValue(ariaLabel)}"]`;
  else if (ariaLabel) css = `[aria-label="${escapeCssAttrValue(ariaLabel)}"]`;
  else if (role) css = `[role="${escapeCssAttrValue(role)}"]`;
  else if (name) css = `${tag}[name="${escapeCssAttrValue(name)}"]`;
  else if (cls)
    css = `${tag}.${cls.split(/\s+/).filter(Boolean).slice(0, 2).map(cssEscape).join('.')}`;
  else css = tag;

  // XPath
  let xpath: string;
  if (testid) xpath = `//${tag}[@data-testid=${escapeXPathValue(testid)}]`;
  else if (id) xpath = `//${tag}[@id=${escapeXPathValue(id)}]`;
  else if (ariaLabel) xpath = `//${tag}[@aria-label=${escapeXPathValue(ariaLabel)}]`;
  else if (role) xpath = `//${tag}[@role=${escapeXPathValue(role)}]`;
  else if (name) xpath = `//${tag}[@name=${escapeXPathValue(name)}]`;
  else if (txt && txt.length <= 30) xpath = `//${tag}[text()=${escapeXPathValue(txt)}]`;
  else xpath = `//${tag}`;

  // Playwright
  let playwright: string;
  if (testid) playwright = `page.getByTestId('${esc1(testid)}')`;
  else if (role) {
    const n = ariaLabel || txt;
    playwright = n
      ? `page.getByRole('${esc1(role)}', { name: '${esc1(n.substring(0, 40))}' })`
      : `page.getByRole('${esc1(role)}')`;
  } else if (ariaLabel) playwright = `page.getByLabel('${esc1(ariaLabel)}')`;
  else if (a.placeholder) playwright = `page.getByPlaceholder('${esc1(a.placeholder)}')`;
  else if ((tag === 'button' || tag === 'a') && txt)
    playwright = `page.getByRole('${tag === 'button' ? 'button' : 'link'}', { name: '${esc1(txt.substring(0, 40))}' })`;
  else if (txt && txt.length <= 30) playwright = `page.getByText('${esc1(txt)}')`;
  else playwright = `page.locator('${esc1(css)}')`;

  // Cypress
  let cypress: string;
  if (testid) cypress = `cy.get('[data-testid="${esc1(escapeCssAttrValue(testid))}"]')`;
  else if (txt && txt.length <= 30 && (tag === 'button' || tag === 'a'))
    cypress = `cy.contains('${esc1(tag)}', '${esc1(txt)}')`;
  else cypress = `cy.get('${esc1(css)}')`;

  // Selenium
  let selenium: string;
  if (id) selenium = `driver.findElement(By.id("${esc2(id)}"))`;
  else if (name) selenium = `driver.findElement(By.name("${esc2(name)}"))`;
  else selenium = `driver.findElement(By.cssSelector("${esc2(css)}"))`;

  return { css, xpath, playwright, cypress, selenium };
}

// ---------------------------------------------------------------------------
// Extract testable selector — Playwright-aware
// ---------------------------------------------------------------------------

// Map of implicit ARIA roles for common HTML tags
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

// Tags that implicitly have a given role (for querySelectorAll matching)
const ROLE_TO_TAGS: Record<string, string[]> = {};
for (const [tag, role] of Object.entries(IMPLICIT_ROLES)) {
  if (!ROLE_TO_TAGS[role]) ROLE_TO_TAGS[role] = [];
  ROLE_TO_TAGS[role].push(tag);
}

/**
 * Count elements matching a Playwright-style role query.
 * Handles both explicit [role="x"] and implicit roles (e.g. <button> = role button).
 */
function countByRole(role: string, nameFilter?: string): number {
  const implicitTags = ROLE_TO_TAGS[role] || [];
  const explicitSelector = `[role="${role}"]`;

  const candidates: Element[] = [];
  // Explicit role attribute
  candidates.push(...Array.from(document.querySelectorAll(explicitSelector)));
  // Implicit roles from tag names
  for (const tag of implicitTags) {
    candidates.push(...Array.from(document.querySelectorAll(tag)));
  }

  if (!nameFilter) return candidates.length;

  // Filter by accessible name (aria-label, textContent, title, value, alt)
  const lower = nameFilter.toLowerCase();
  return candidates.filter((el) => {
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel?.toLowerCase().includes(lower)) return true;
    const text = el.textContent?.trim().toLowerCase() || '';
    if (text.includes(lower)) return true;
    const title = el.getAttribute('title');
    if (title?.toLowerCase().includes(lower)) return true;
    const alt = el.getAttribute('alt');
    if (alt?.toLowerCase().includes(lower)) return true;
    return false;
  }).length;
}

/**
 * Highlight elements matching a Playwright-style role query.
 */
function highlightByRole(role: string, nameFilter?: string): void {
  const implicitTags = ROLE_TO_TAGS[role] || [];
  const candidates: Element[] = [];
  candidates.push(...Array.from(document.querySelectorAll(`[role="${role}"]`)));
  for (const tag of implicitTags) {
    candidates.push(...Array.from(document.querySelectorAll(tag)));
  }

  let matches = candidates;
  if (nameFilter) {
    const lower = nameFilter.toLowerCase();
    matches = candidates.filter((el) => {
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel?.toLowerCase().includes(lower)) return true;
      const text = el.textContent?.trim().toLowerCase() || '';
      if (text.includes(lower)) return true;
      const title = el.getAttribute('title');
      if (title?.toLowerCase().includes(lower)) return true;
      return false;
    });
  }

  for (const el of matches) {
    (el as HTMLElement).style.outline = '2px solid #22c55e';
    (el as HTMLElement).style.outlineOffset = '2px';
    el.setAttribute('data-selekt-highlight', 'true');
  }

  // Auto-clear after 5s
  setTimeout(() => {
    document.querySelectorAll('[data-selekt-highlight]').forEach((el) => {
      (el as HTMLElement).style.outline = '';
      (el as HTMLElement).style.outlineOffset = '';
      el.removeAttribute('data-selekt-highlight');
    });
  }, 5000);
}

function extractTestable(
  locator: string,
  format: SelectorFormat
): { selector: string; selectorType: 'css' | 'xpath' | 'playwright-role' } | null {
  if (format === 'css') return { selector: locator, selectorType: 'css' };
  if (format === 'xpath') return { selector: locator, selectorType: 'xpath' };

  if (format === 'playwright') {
    const loc = locator.match(/page\.locator\((['"`])(.*?)\1\)/);
    if (loc) return { selector: loc[2], selectorType: 'css' };

    const tid = locator.match(/page\.getByTestId\((['"`])(.*?)\1\)/);
    if (tid) return { selector: `[data-testid="${tid[2]}"]`, selectorType: 'css' };

    // getByRole — needs special handling for implicit roles
    const roleWithName = locator.match(
      /page\.getByRole\((['"`])(.*?)\1,\s*\{[^}]*name:\s*(['"`])(.*?)\3/
    );
    if (roleWithName)
      return {
        selector: `${roleWithName[2]}::${roleWithName[4]}`,
        selectorType: 'playwright-role',
      };
    const roleOnly = locator.match(/page\.getByRole\((['"`])(.*?)\1\)/);
    if (roleOnly) return { selector: roleOnly[2], selectorType: 'playwright-role' };

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
    if (role) return { selector: role[2], selectorType: 'playwright-role' };
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
    const tg = locator.match(/By\.tagName\((['"`])(.*?)\1\)/);
    if (tg) return { selector: tg[2], selectorType: 'css' };
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
// CSS
// ---------------------------------------------------------------------------

const WIDGET_CSS = `
  :host { all: initial; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #fafafa; }
  * { box-sizing: border-box; }

  .widget {
    position: fixed; right: 20px; bottom: 20px;
    width: 340px; background: #09090b;
    border: 1px solid #27272a; border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4);
    z-index: 2147483646; overflow: hidden; user-select: none;
  }

  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 6px 0 0; background: #111114;
    border-bottom: 1px solid #27272a; cursor: grab;
  }
  .header:active { cursor: grabbing; }

  .header-left { display: flex; align-items: center; flex: 1; }

  .pick-btn {
    padding: 7px 12px; background: #3b82f6; color: #fff; border: none;
    font-size: 11px; font-weight: 600; cursor: pointer;
    display: flex; align-items: center; gap: 5px;
    transition: background 0.12s; border-radius: 0;
  }
  .pick-btn:hover { background: #2563eb; }
  .pick-btn.picking { background: #7c3aed; }
  .pick-btn svg { width: 12px; height: 12px; }

  .header-actions { display: flex; align-items: center; gap: 2px; }

  .icon-btn {
    width: 24px; height: 24px; display: flex; align-items: center;
    justify-content: center; border-radius: 4px; background: transparent;
    border: none; color: #a1a1aa; cursor: pointer; padding: 0;
    transition: background 0.12s, color 0.12s;
  }
  .icon-btn:hover { background: #18181b; color: #fafafa; }
  .icon-btn svg { width: 14px; height: 14px; }

  .body { padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 6px; }

  .locator-section { display: none; flex-direction: column; gap: 6px; }
  .locator-section.visible { display: flex; }

  .input-row { display: flex; }
  .locator-input {
    width: 100%; padding: 5px 8px; background: #111114;
    border: 1px solid #27272a; border-radius: 5px; color: #fafafa;
    font-family: 'Courier New', monospace; font-size: 11px;
    outline: none; transition: border-color 0.12s;
  }
  .locator-input:focus { border-color: #3b82f6; }
  .locator-input::placeholder { color: #52525b; }

  .controls-row { display: flex; align-items: center; gap: 5px; }

  .format-select {
    padding: 4px 6px; background: #18181b;
    border: 1px solid #27272a; border-radius: 5px;
    color: #fafafa; font-size: 10px; cursor: pointer; outline: none;
  }
  .format-select:focus { border-color: #3b82f6; }

  .match-info {
    flex: 1; font-size: 10px; color: #52525b; min-width: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .match-info.found { color: #22c55e; }
  .match-info.none { color: #ef4444; }

  .action-btn {
    padding: 4px 8px; background: #18181b; border: 1px solid #27272a;
    border-radius: 5px; color: #a1a1aa; font-size: 11px; cursor: pointer;
    transition: background 0.12s, color 0.12s; white-space: nowrap;
  }
  .action-btn:hover { background: #27272a; color: #fafafa; }
  .action-btn.success { color: #22c55e; border-color: #22c55e; }
`;

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

function buildWidgetHTML(): string {
  return `
    <div class="widget" id="widget">
      <div class="header" id="drag-handle">
        <div class="header-left">
          <button class="pick-btn" id="pick-btn">
            <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Pick
          </button>
        </div>
        <div class="header-actions">
          <button class="icon-btn" id="expand-btn" title="Open sidepanel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          </button>
          <button class="icon-btn" id="close-btn" title="Close">
            <svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
      <div class="body">
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
  private shadow: ShadowRoot;
  private host: HTMLElement;
  private widget!: HTMLElement;
  private locators: Locators | null = null;
  private currentFormat: SelectorFormat = 'css';
  private visible = false;
  private isPicking = false;
  private testDebounce: ReturnType<typeof setTimeout> | null = null;

  // Drag
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private widgetStartX = 0;
  private widgetStartY = 0;
  private hasDragged = false;
  private boundDragMove: (e: MouseEvent) => void;
  private boundDragEnd: () => void;

  // Callbacks
  private pickCb: (() => void) | null = null;
  private testCb: ((sel: string, type: string) => void) | null = null;
  private closeCb: (() => void) | null = null;
  private expandCb: (() => void) | null = null;

  constructor() {
    this.host = document.createElement('div');
    this.host.id = 'selekt-floating-host';
    // Host has no positioning — the .widget inside handles it
    this.host.style.cssText = 'all:initial;';

    this.shadow = this.host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = WIDGET_CSS;
    this.shadow.appendChild(style);

    const tmp = document.createElement('div');
    tmp.innerHTML = buildWidgetHTML();
    this.shadow.appendChild(tmp.firstElementChild as Element);

    this.widget = this.shadow.getElementById('widget')!;

    (document.documentElement || document.body).appendChild(this.host);

    this.boundDragMove = (e) => this.onDragMove(e);
    this.boundDragEnd = () => this.stopDrag();

    this.bindEvents();
    this.host.style.display = 'none';
  }

  show(): void {
    this.host.style.display = '';
    this.visible = true;
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

  setElementData(element: ElementData): void {
    this.locators = generateLocators(element);
    this.setPicking(false);
    this.$('locator-section')?.classList.add('visible');
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
      btn.textContent = 'Picking…';
      this.host.style.pointerEvents = 'none';
    } else {
      btn.classList.remove('picking');
      btn.innerHTML = `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><path d="M8 1v2.5M8 12.5V15M1 8h2.5M12.5 8H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Pick`;
      this.host.style.pointerEvents = '';
    }
  }

  // ---- Private ----

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
      this.setMatchInfo('');
      return;
    }
    const val = input.value.trim();
    const format = detectFormat(val);
    const result = extractTestable(val, format);
    if (!result) {
      this.setMatchInfo('Cannot parse', 'none');
      return;
    }

    // Handle playwright-role specially
    if (result.selectorType === 'playwright-role') {
      const parts = result.selector.split('::');
      const role = parts[0];
      const nameFilter = parts[1] || undefined;
      const count = countByRole(role, nameFilter);
      highlightByRole(role, nameFilter);
      if (count > 0) this.setMatchInfo(`${count} match${count !== 1 ? 'es' : ''}`, 'found');
      else this.setMatchInfo('No matches', 'none');
      return;
    }

    // Standard CSS/XPath test
    if (this.testCb) this.testCb(result.selector, result.selectorType);

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
      if (count > 0) this.setMatchInfo(`${count} match${count !== 1 ? 'es' : ''}`, 'found');
      else this.setMatchInfo('No matches', 'none');
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

  // Drag — operates on the .widget element inside shadow DOM
  private startDrag(e: MouseEvent): void {
    if ((e.target as HTMLElement).closest('button, select, input')) return;
    this.dragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;

    const rect = this.widget.getBoundingClientRect();
    this.widgetStartX = rect.left;
    this.widgetStartY = rect.top;

    if (!this.hasDragged) {
      // Switch from right/bottom to left/top on first drag
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
    const newLeft = this.widgetStartX + dx;
    const newTop = this.widgetStartY + dy;
    const maxLeft = window.innerWidth - this.widget.offsetWidth - 4;
    const maxTop = window.innerHeight - this.widget.offsetHeight - 4;
    this.widget.style.left = `${Math.max(4, Math.min(newLeft, maxLeft))}px`;
    this.widget.style.top = `${Math.max(4, Math.min(newTop, maxTop))}px`;
  }

  private stopDrag(): void {
    this.dragging = false;
    window.removeEventListener('mousemove', this.boundDragMove);
    window.removeEventListener('mouseup', this.boundDragEnd);
  }

  private bindEvents(): void {
    this.$('drag-handle')?.addEventListener('mousedown', (e) => this.startDrag(e as MouseEvent));

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
        btn.textContent = '✓';
        btn.classList.add('success');
        setTimeout(() => {
          btn.textContent = 'Copy';
          btn.classList.remove('success');
        }, 1500);
      });
    });

    this.$('expand-btn')?.addEventListener('click', () => {
      this.expandCb?.();
    });
    this.$('close-btn')?.addEventListener('click', () => {
      this.hide();
      this.closeCb?.();
    });
  }
}
