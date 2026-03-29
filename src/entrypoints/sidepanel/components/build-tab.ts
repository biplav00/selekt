import type { PageElement, ScoredSelector, SelectorFormat } from '@/types';
import { LitElement, css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { countMatches, fetchPageElements, testSelector } from '../services/messaging.js';
import {
  escapeCssAttrValue,
  escapeDoubleQuoteJs,
  escapeSingleQuoteJs,
  escapeXPathValue,
  extractTestable,
  generateScoredSelectors,
  scoreSelector,
} from '../services/selector-engine.js';
import { addFavorite } from '../services/storage.js';
import { sharedStyles } from '../styles/shared.js';
import './selector-card.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BuildMode = 'freeform' | 'structured';
type PlaywrightMethod =
  | 'getByRole'
  | 'getByText'
  | 'getByTestId'
  | 'getByLabel'
  | 'getByPlaceholder'
  | 'getByAltText'
  | 'getByTitle'
  | 'locator';
type CypressMethod =
  | 'cy.get'
  | 'cy.contains'
  | 'cy.findByRole'
  | 'cy.findByText'
  | 'cy.findByTestId';
type SeleniumStrategy =
  | 'By.cssSelector'
  | 'By.xpath'
  | 'By.id'
  | 'By.name'
  | 'By.className'
  | 'By.tagName'
  | 'By.linkText'
  | 'By.partialLinkText';
type XPathAxis = '//' | '/';

interface ChainStep {
  method: string;
  value: string;
}

interface Suggestion {
  type: string;
  label: string;
  code: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectFormat(selector: string): SelectorFormat {
  const s = selector.trimStart();
  if (s.startsWith('//') || s.startsWith('(/')) return 'xpath';
  if (s.startsWith('page.')) return 'playwright';
  if (s.startsWith('cy.')) return 'cypress';
  if (s.startsWith('driver.')) return 'selenium';
  return 'css';
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Static suggestion seeds
// ---------------------------------------------------------------------------

const STATIC_CSS_SUGGESTIONS: Suggestion[] = [
  { type: 'attr', label: '[data-testid="..."]', code: '[data-testid=""]' },
  { type: 'attr', label: '[aria-label="..."]', code: '[aria-label=""]' },
  { type: 'attr', label: '[role="button"]', code: '[role="button"]' },
  { type: 'pseudo', label: ':first-child', code: ':first-child' },
  { type: 'pseudo', label: ':last-child', code: ':last-child' },
  { type: 'pseudo', label: ':nth-child(n)', code: ':nth-child()' },
  { type: 'tag', label: 'input[type="text"]', code: 'input[type="text"]' },
  { type: 'tag', label: 'button[type="submit"]', code: 'button[type="submit"]' },
];

const STATIC_XPATH_SUGGESTIONS: Suggestion[] = [
  { type: 'axis', label: '//*[@id="..."]', code: '//*[@id=""]' },
  { type: 'axis', label: '//*[@class="..."]', code: '//*[@class=""]' },
  { type: 'axis', label: '//*[@data-testid="..."]', code: '//*[@data-testid=""]' },
  { type: 'text', label: '//*[text()="..."]', code: '//*[text()=""]' },
  { type: 'func', label: '//*[contains(text(), "...")]', code: '//*[contains(text(), "")]' },
  { type: 'func', label: '//*[contains(@class, "...")]', code: '//*[contains(@class, "")]' },
];

const STATIC_PLAYWRIGHT_SUGGESTIONS: Suggestion[] = [
  {
    type: 'role',
    label: "page.getByRole('button', { name: '...' })",
    code: "page.getByRole('button', { name: '' })",
  },
  {
    type: 'role',
    label: "page.getByRole('link', { name: '...' })",
    code: "page.getByRole('link', { name: '' })",
  },
  { type: 'role', label: "page.getByRole('textbox')", code: "page.getByRole('textbox')" },
  { type: 'testid', label: "page.getByTestId('...')", code: "page.getByTestId('')" },
  { type: 'text', label: "page.getByText('...')", code: "page.getByText('')" },
  { type: 'label', label: "page.getByLabel('...')", code: "page.getByLabel('')" },
  { type: 'ph', label: "page.getByPlaceholder('...')", code: "page.getByPlaceholder('')" },
  { type: 'alt', label: "page.getByAltText('...')", code: "page.getByAltText('')" },
  { type: 'title', label: "page.getByTitle('...')", code: "page.getByTitle('')" },
  { type: 'loc', label: "page.locator('...')", code: "page.locator('')" },
];

const STATIC_CYPRESS_SUGGESTIONS: Suggestion[] = [
  { type: 'get', label: 'cy.get(\'[data-testid="..."]\')', code: 'cy.get(\'[data-testid=""]\')' },
  { type: 'get', label: "cy.get('...')", code: "cy.get('')" },
  { type: 'text', label: "cy.contains('...')", code: "cy.contains('')" },
  { type: 'text', label: "cy.contains('button', '...')", code: "cy.contains('button', '')" },
  { type: 'role', label: "cy.findByRole('button')", code: "cy.findByRole('button')" },
  { type: 'testid', label: "cy.findByTestId('...')", code: "cy.findByTestId('')" },
];

const STATIC_SELENIUM_SUGGESTIONS: Suggestion[] = [
  {
    type: 'css',
    label: 'driver.findElement(By.cssSelector("..."))',
    code: 'driver.findElement(By.cssSelector(""))',
  },
  {
    type: 'xpath',
    label: 'driver.findElement(By.xpath("..."))',
    code: 'driver.findElement(By.xpath(""))',
  },
  { type: 'id', label: 'driver.findElement(By.id("..."))', code: 'driver.findElement(By.id(""))' },
  {
    type: 'name',
    label: 'driver.findElement(By.name("..."))',
    code: 'driver.findElement(By.name(""))',
  },
  {
    type: 'class',
    label: 'driver.findElement(By.className("..."))',
    code: 'driver.findElement(By.className(""))',
  },
  {
    type: 'tag',
    label: 'driver.findElement(By.tagName("..."))',
    code: 'driver.findElement(By.tagName(""))',
  },
  {
    type: 'link',
    label: 'driver.findElement(By.linkText("..."))',
    code: 'driver.findElement(By.linkText(""))',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@customElement('build-tab')
export class BuildTab extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      /* ── Mode toggle ── */
      .mode-toggle {
        display: flex;
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 3px;
        gap: 2px;
        margin-bottom: 14px;
      }

      .mode-pill {
        flex: 1;
        padding: 5px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-secondary);
        background: transparent;
        transition: background 0.15s, color 0.15s;
        text-align: center;
      }

      .mode-pill.active {
        background: var(--accent);
        color: #fff;
      }

      .mode-pill:hover:not(.active) {
        background: var(--bg-secondary);
        color: var(--text-primary);
      }

      /* ── Section labels ── */
      .section-label {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-tertiary);
        margin-bottom: 5px;
      }

      /* ── Freeform ── */
      .freeform-input-wrap {
        position: relative;
      }

      .freeform-textarea {
        width: 100%;
        min-height: 64px;
        resize: vertical;
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.5;
      }

      .freeform-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
      }

      .format-select {
        flex: 1;
        min-width: 0;
      }

      .match-count {
        font-size: 11px;
        color: var(--text-tertiary);
        white-space: nowrap;
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
      }

      .match-count.match-ok {
        color: var(--score-good);
      }

      .match-count.match-none {
        color: var(--score-poor);
      }

      /* ── Score display ── */
      .score-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 6px;
      }

      .score-label {
        font-size: 10px;
        color: var(--text-tertiary);
      }

      .score-bar-wrap {
        flex: 1;
        height: 4px;
        background: var(--bg-tertiary);
        border-radius: 2px;
        overflow: hidden;
      }

      .score-bar {
        height: 100%;
        border-radius: 2px;
        transition: width 0.3s;
      }

      .score-bar.good {
        background: var(--score-good);
      }

      .score-bar.medium {
        background: var(--score-medium);
      }

      .score-bar.poor {
        background: var(--score-poor);
      }

      .score-value {
        font-size: 10px;
        font-weight: 700;
        width: 24px;
        text-align: right;
        flex-shrink: 0;
      }

      .score-value.good {
        color: var(--score-good);
      }

      .score-value.medium {
        color: var(--score-medium);
      }

      .score-value.poor {
        color: var(--score-poor);
      }

      /* ── Suggestions panel ── */
      .suggestions-panel {
        position: relative;
        margin-top: 6px;
      }

      .suggestions-list {
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 6px;
        overflow: hidden;
        max-height: 160px;
        overflow-y: auto;
      }

      .suggestion-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px 8px;
        cursor: pointer;
        transition: background 0.1s;
        font-size: 11px;
      }

      .suggestion-item:hover {
        background: var(--bg-tertiary);
      }

      .suggestion-type {
        font-size: 9px;
        font-weight: 600;
        color: var(--text-tertiary);
        text-transform: uppercase;
        flex-shrink: 0;
        width: 36px;
      }

      .suggestion-label {
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        color: var(--text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* ── Action buttons ── */
      .action-row {
        display: flex;
        gap: 6px;
        margin-top: 10px;
      }

      .action-row .btn-primary {
        flex: 1;
        justify-content: center;
      }

      .action-row .btn-secondary {
        flex: 1;
        justify-content: center;
      }

      /* ── Structured mode ── */
      .struct-section {
        margin-bottom: 12px;
      }

      .framework-tabs {
        display: flex;
        gap: 3px;
        margin-bottom: 10px;
        flex-wrap: wrap;
      }

      .fw-tab {
        padding: 4px 8px;
        border-radius: 5px;
        font-size: 11px;
        font-weight: 500;
        color: var(--text-secondary);
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        transition: all 0.15s;
      }

      .fw-tab.active {
        background: var(--accent);
        color: #fff;
        border-color: var(--accent);
      }

      .fw-tab:hover:not(.active) {
        border-color: var(--accent);
        color: var(--text-primary);
      }

      .form-grid {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .form-field {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .field-label {
        font-size: 10px;
        color: var(--text-tertiary);
        font-weight: 500;
      }

      .form-field input,
      .form-field select,
      .form-field textarea {
        width: 100%;
      }

      /* ── Chain steps ── */
      .chain-section {
        margin-top: 10px;
      }

      .chain-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }

      .chain-list {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-bottom: 8px;
      }

      .chain-step {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .chain-step select {
        width: 130px;
        flex-shrink: 0;
      }

      .chain-step input {
        flex: 1;
        min-width: 0;
      }

      .chain-remove {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        color: var(--text-tertiary);
        font-size: 12px;
        flex-shrink: 0;
        transition: background 0.1s, color 0.1s;
      }

      .chain-remove:hover {
        background: color-mix(in srgb, var(--score-poor) 15%, transparent);
        border-color: var(--score-poor);
        color: var(--score-poor);
      }

      .add-chain-btn {
        font-size: 11px;
        padding: 4px 8px;
      }

      /* ── Result display ── */
      .result-section {
        margin-top: 12px;
      }

      .result-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
        font-size: 11px;
        color: var(--text-tertiary);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .result-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      /* ── Warnings ── */
      .warning-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-top: 4px;
      }

      .warning-item {
        display: flex;
        align-items: flex-start;
        gap: 4px;
        font-size: 10px;
        color: var(--warning);
        line-height: 1.4;
      }
    `,
  ];

  // ── Mode ──
  @state() private _mode: BuildMode = 'freeform';

  // ── Freeform state ──
  @state() private _freeformSelector = '';
  @state() private _freeformFormat: SelectorFormat = 'css';
  @state() private _freeformAutoFormat = true;
  @state() private _matchCount: number | null = null;
  @state() private _matchLoading = false;
  @state() private _scored: ScoredSelector | null = null;
  @state() private _showSuggestions = false;
  @state() private _pageElements: PageElement[] = [];

  // ── Structured state ──
  @state() private _structFramework: SelectorFormat = 'playwright';

  // Playwright fields
  @state() private _pwMethod: PlaywrightMethod = 'getByRole';
  @state() private _pwRole = '';
  @state() private _pwName = '';
  @state() private _pwText = '';
  @state() private _pwTestId = '';
  @state() private _pwLabel = '';
  @state() private _pwPlaceholder = '';
  @state() private _pwAltText = '';
  @state() private _pwTitle = '';
  @state() private _pwLocator = '';
  @state() private _pwExact = false;

  // CSS fields
  @state() private _cssTag = '';
  @state() private _cssId = '';
  @state() private _cssClass = '';
  @state() private _cssAttrName = '';
  @state() private _cssAttrValue = '';

  // XPath fields
  @state() private _xpathAxis: XPathAxis = '//';
  @state() private _xpathTag = '*';
  @state() private _xpathPredicate = '';

  // Cypress fields
  @state() private _cyMethod: CypressMethod = 'cy.get';
  @state() private _cyValue = '';

  // Selenium fields
  @state() private _seStrategy: SeleniumStrategy = 'By.cssSelector';
  @state() private _seValue = '';

  // Chain steps
  @state() private _chainSteps: ChainStep[] = [];

  // Shared results
  @state() private _structResult: ScoredSelector | null = null;
  @state() private _allResults: ScoredSelector[] = [];
  @state() private _structMatchCount: number | null = null;

  // Debounce timers
  private _matchDebounce: ReturnType<typeof setTimeout> | null = null;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  override connectedCallback() {
    super.connectedCallback();
    this._loadPageSuggestions();
  }

  private async _loadPageSuggestions() {
    try {
      this._pageElements = await fetchPageElements();
    } catch {
      // silently ignore
    }
  }

  // ---------------------------------------------------------------------------
  // Freeform helpers
  // ---------------------------------------------------------------------------

  private _onFreeformKeydown(e: KeyboardEvent) {
    const ta = e.target as HTMLTextAreaElement;
    const pairs: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
      "'": "'",
      '"': '"',
      '`': '`',
    };

    const closing = pairs[e.key];
    if (closing) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;

      // If text is selected, wrap it
      if (start !== end) {
        e.preventDefault();
        const selected = ta.value.substring(start, end);
        const replacement = e.key + selected + closing;
        ta.setRangeText(replacement, start, end, 'end');
        // Place cursor after the selected text, before closing char
        ta.setSelectionRange(start + 1, start + 1 + selected.length);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }

      // For quotes: if cursor is right before the same quote, just move past it
      if ((e.key === "'" || e.key === '"' || e.key === '`') && ta.value[start] === e.key) {
        e.preventDefault();
        ta.setSelectionRange(start + 1, start + 1);
        return;
      }

      // Auto-insert closing character
      e.preventDefault();
      ta.setRangeText(e.key + closing, start, end, 'end');
      ta.setSelectionRange(start + 1, start + 1);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    // If typing a closing bracket/quote and it already exists at cursor, skip over it
    const closingChars = [')', ']', '}'];
    if (closingChars.includes(e.key) && ta.value[ta.selectionStart] === e.key) {
      e.preventDefault();
      ta.setSelectionRange(ta.selectionStart + 1, ta.selectionStart + 1);
      return;
    }

    // Backspace: if deleting an opening bracket/quote with its matching close right after, delete both
    if (e.key === 'Backspace') {
      const pos = ta.selectionStart;
      if (pos > 0 && pos === ta.selectionEnd) {
        const before = ta.value[pos - 1];
        const after = ta.value[pos];
        if (pairs[before] && pairs[before] === after) {
          e.preventDefault();
          ta.setRangeText('', pos - 1, pos + 1, 'end');
          ta.setSelectionRange(pos - 1, pos - 1);
          ta.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }

    // Tab key inserts 2 spaces instead of changing focus
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = ta.selectionStart;
      ta.setRangeText('  ', start, ta.selectionEnd, 'end');
      ta.setSelectionRange(start + 2, start + 2);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  private _onFreeformInput(e: Event) {
    const val = (e.target as HTMLTextAreaElement).value;
    this._freeformSelector = val;

    if (this._freeformAutoFormat) {
      this._freeformFormat = detectFormat(val);
    }

    if (val.trim()) {
      this._scored = scoreSelector(val.trim(), this._freeformFormat);
    } else {
      this._scored = null;
      this._matchCount = null;
    }

    this._scheduleMatchCount();
  }

  private _onFormatChange(e: Event) {
    this._freeformFormat = (e.target as HTMLSelectElement).value as SelectorFormat;
    this._freeformAutoFormat = false;
    if (this._freeformSelector.trim()) {
      this._scored = scoreSelector(this._freeformSelector.trim(), this._freeformFormat);
    }
    this._scheduleMatchCount();
  }

  private _scheduleMatchCount() {
    if (this._matchDebounce) clearTimeout(this._matchDebounce);
    this._matchDebounce = setTimeout(() => this._runMatchCount(), 300);
  }

  private async _runMatchCount() {
    const sel = this._freeformSelector.trim();
    if (!sel) {
      this._matchCount = null;
      return;
    }
    const testable = extractTestable(sel, this._freeformFormat);
    if (!testable) {
      this._matchCount = null;
      return;
    }
    this._matchLoading = true;
    try {
      const n = await countMatches(testable.selector, testable.selectorType);
      this._matchCount = n;
    } catch {
      this._matchCount = null;
    } finally {
      this._matchLoading = false;
    }
  }

  private async _onFreeformTest() {
    const sel = this._freeformSelector.trim();
    if (!sel) return;
    const testable = extractTestable(sel, this._freeformFormat);
    if (!testable) {
      this._emitToast('Cannot extract testable selector from this locator');
      return;
    }
    try {
      await testSelector(testable.selector, testable.selectorType);
      this._emitToast('Testing on page!');
    } catch {
      this._emitToast('Could not test selector. Make sure a page is open.');
    }
  }

  private _onSuggestionClick(suggestion: Suggestion) {
    this._freeformSelector = suggestion.code;
    this._freeformAutoFormat = true;
    this._freeformFormat = detectFormat(suggestion.code);
    this._scored = scoreSelector(suggestion.code.trim(), this._freeformFormat);
    this._showSuggestions = false;
    this._scheduleMatchCount();
  }

  private _pageElementsToSuggestions(format: SelectorFormat): Suggestion[] {
    const results: Suggestion[] = [];
    for (const el of this._pageElements) {
      const sug = this._elementToSuggestions(el, format);
      results.push(...sug);
    }
    return results;
  }

  private _elementToSuggestions(el: PageElement, format: SelectorFormat): Suggestion[] {
    const out: Suggestion[] = [];
    const tag = el.tag;

    if (format === 'css') {
      if (el.testId)
        out.push({
          type: 'testid',
          label: `${tag}[data-testid="${el.testId}"]`,
          code: `[data-testid="${el.testId}"]`,
        });
      if (el.id) out.push({ type: 'id', label: `#${el.id}`, code: `#${el.id}` });
      if (el.ariaLabel)
        out.push({
          type: 'aria',
          label: `${tag}[aria-label="${el.ariaLabel}"]`,
          code: `[aria-label="${el.ariaLabel}"]`,
        });
      if (el.role)
        out.push({ type: 'role', label: `${tag}[role="${el.role}"]`, code: `[role="${el.role}"]` });
      if (el.name)
        out.push({ type: 'name', label: `${tag}[name="${el.name}"]`, code: `[name="${el.name}"]` });
      if (el.placeholder)
        out.push({
          type: 'ph',
          label: `${tag}[placeholder="${el.placeholder}"]`,
          code: `[placeholder="${el.placeholder}"]`,
        });
      for (const c of el.classes.slice(0, 2)) {
        out.push({ type: 'class', label: `${tag}.${c}`, code: `.${c}` });
      }
    } else if (format === 'xpath') {
      if (el.testId)
        out.push({
          type: 'testid',
          label: `//${tag}[@data-testid="${el.testId}"]`,
          code: `//${tag}[@data-testid="${el.testId}"]`,
        });
      if (el.id)
        out.push({
          type: 'id',
          label: `//${tag}[@id="${el.id}"]`,
          code: `//${tag}[@id="${el.id}"]`,
        });
      if (el.ariaLabel)
        out.push({
          type: 'aria',
          label: `//${tag}[@aria-label="${el.ariaLabel}"]`,
          code: `//${tag}[@aria-label="${el.ariaLabel}"]`,
        });
      if (el.role)
        out.push({
          type: 'role',
          label: `//${tag}[@role="${el.role}"]`,
          code: `//${tag}[@role="${el.role}"]`,
        });
      if (el.text)
        out.push({
          type: 'text',
          label: `//${tag}[text()="${el.text}"]`,
          code: `//${tag}[text()="${el.text}"]`,
        });
      if (el.name)
        out.push({
          type: 'name',
          label: `//${tag}[@name="${el.name}"]`,
          code: `//${tag}[@name="${el.name}"]`,
        });
    } else if (format === 'playwright') {
      if (el.testId)
        out.push({
          type: 'testid',
          label: `page.getByTestId('${el.testId}')`,
          code: `page.getByTestId('${el.testId}')`,
        });
      if (el.role) {
        const nameOpt = el.ariaLabel
          ? `, { name: '${el.ariaLabel}' }`
          : el.text
            ? `, { name: '${el.text}' }`
            : '';
        out.push({
          type: 'role',
          label: `page.getByRole('${el.role}'${nameOpt})`,
          code: `page.getByRole('${el.role}'${nameOpt})`,
        });
      }
      if (el.ariaLabel)
        out.push({
          type: 'label',
          label: `page.getByLabel('${el.ariaLabel}')`,
          code: `page.getByLabel('${el.ariaLabel}')`,
        });
      if (el.placeholder)
        out.push({
          type: 'ph',
          label: `page.getByPlaceholder('${el.placeholder}')`,
          code: `page.getByPlaceholder('${el.placeholder}')`,
        });
      if (el.text && el.text.length <= 30)
        out.push({
          type: 'text',
          label: `page.getByText('${el.text}')`,
          code: `page.getByText('${el.text}')`,
        });
      if (el.altText)
        out.push({
          type: 'alt',
          label: `page.getByAltText('${el.altText}')`,
          code: `page.getByAltText('${el.altText}')`,
        });
      if (el.title)
        out.push({
          type: 'title',
          label: `page.getByTitle('${el.title}')`,
          code: `page.getByTitle('${el.title}')`,
        });
    } else if (format === 'cypress') {
      if (el.testId)
        out.push({
          type: 'testid',
          label: `cy.get('[data-testid="${el.testId}"]')`,
          code: `cy.get('[data-testid="${el.testId}"]')`,
        });
      if (el.id)
        out.push({ type: 'id', label: `cy.get('#${el.id}')`, code: `cy.get('#${el.id}')` });
      if (el.text && el.text.length <= 30)
        out.push({
          type: 'text',
          label: `cy.contains('${tag}', '${el.text}')`,
          code: `cy.contains('${tag}', '${el.text}')`,
        });
      if (el.role)
        out.push({
          type: 'role',
          label: `cy.findByRole('${el.role}')`,
          code: `cy.findByRole('${el.role}')`,
        });
      if (el.testId)
        out.push({
          type: 'testid',
          label: `cy.findByTestId('${el.testId}')`,
          code: `cy.findByTestId('${el.testId}')`,
        });
    } else if (format === 'selenium') {
      if (el.id)
        out.push({
          type: 'id',
          label: `By.id("${el.id}")`,
          code: `driver.findElement(By.id("${el.id}"))`,
        });
      if (el.name)
        out.push({
          type: 'name',
          label: `By.name("${el.name}")`,
          code: `driver.findElement(By.name("${el.name}"))`,
        });
      if (el.testId)
        out.push({
          type: 'css',
          label: `By.css [data-testid="${el.testId}"]`,
          code: `driver.findElement(By.cssSelector("[data-testid='${el.testId}']"))`,
        });
      if (el.classes.length > 0)
        out.push({
          type: 'class',
          label: `By.className("${el.classes[0]}")`,
          code: `driver.findElement(By.className("${el.classes[0]}"))`,
        });
      if (el.tag)
        out.push({
          type: 'tag',
          label: `By.tagName("${el.tag}")`,
          code: `driver.findElement(By.tagName("${el.tag}"))`,
        });
    }

    return out;
  }

  private _allSuggestions(): Suggestion[] {
    let base: Suggestion[];
    switch (this._freeformFormat) {
      case 'xpath':
        base = STATIC_XPATH_SUGGESTIONS;
        break;
      case 'playwright':
        base = STATIC_PLAYWRIGHT_SUGGESTIONS;
        break;
      case 'cypress':
        base = STATIC_CYPRESS_SUGGESTIONS;
        break;
      case 'selenium':
        base = STATIC_SELENIUM_SUGGESTIONS;
        break;
      default:
        base = STATIC_CSS_SUGGESTIONS;
    }
    const pageSuggestions = this._pageElementsToSuggestions(this._freeformFormat);
    // Page suggestions first (real elements from the DOM), then static templates
    const combined = [...pageSuggestions, ...base];
    const query = this._freeformSelector.toLowerCase();
    if (!query) return combined.slice(0, 25);

    // Deduplicate by code
    const seen = new Set<string>();
    return combined
      .filter((s) => {
        if (seen.has(s.code)) return false;
        seen.add(s.code);
        return s.label.toLowerCase().includes(query) || s.code.toLowerCase().includes(query);
      })
      .slice(0, 25);
  }

  // ---------------------------------------------------------------------------
  // Structured generators
  // ---------------------------------------------------------------------------

  private _generatePlaywright(): string {
    const method = this._pwMethod;
    const esc = escapeSingleQuoteJs;
    switch (method) {
      case 'getByRole': {
        const role = esc(this._pwRole || 'button');
        if (this._pwName) {
          const exact = this._pwExact ? ', { exact: true }' : '';
          return `page.getByRole('${role}', { name: '${esc(this._pwName)}'${exact} })`;
        }
        return `page.getByRole('${role}')`;
      }
      case 'getByText':
        return `page.getByText('${esc(this._pwText)}')`;
      case 'getByTestId':
        return `page.getByTestId('${esc(this._pwTestId)}')`;
      case 'getByLabel':
        return `page.getByLabel('${esc(this._pwLabel)}')`;
      case 'getByPlaceholder':
        return `page.getByPlaceholder('${esc(this._pwPlaceholder)}')`;
      case 'getByAltText':
        return `page.getByAltText('${esc(this._pwAltText)}')`;
      case 'getByTitle':
        return `page.getByTitle('${esc(this._pwTitle)}')`;
      case 'locator':
        return `page.locator('${esc(this._pwLocator)}')`;
    }
  }

  private _generateCss(): string {
    const parts: string[] = [];
    const tag = this._cssTag.trim();
    const id = this._cssId.trim();
    const cls = this._cssClass.trim();
    const attrName = this._cssAttrName.trim();
    const attrVal = this._cssAttrValue.trim();

    let base = tag || '';
    if (id) base += `#${id}`;
    if (cls) {
      base += cls
        .split(/\s+/)
        .filter(Boolean)
        .map((c) => `.${c}`)
        .join('');
    }
    if (attrName) {
      base += attrVal ? `[${attrName}="${escapeCssAttrValue(attrVal)}"]` : `[${attrName}]`;
    }
    parts.push(base || '*');
    return parts.join('');
  }

  private _generateXPath(): string {
    const axis = this._xpathAxis;
    const tag = this._xpathTag.trim() || '*';
    const pred = this._xpathPredicate.trim();
    return pred ? `${axis}${tag}[${pred}]` : `${axis}${tag}`;
  }

  private _generateCypress(): string {
    const method = this._cyMethod;
    const val = this._cyValue.trim();
    const esc = escapeDoubleQuoteJs;
    switch (method) {
      case 'cy.get':
        return `cy.get('${escapeSingleQuoteJs(val)}')`;
      case 'cy.contains':
        return `cy.contains('${escapeSingleQuoteJs(val)}')`;
      case 'cy.findByRole':
        return `cy.findByRole('${escapeSingleQuoteJs(val)}')`;
      case 'cy.findByText':
        return `cy.findByText('${escapeSingleQuoteJs(val)}')`;
      case 'cy.findByTestId':
        return `cy.findByTestId('${escapeSingleQuoteJs(val)}')`;
    }
    return `cy.get('${esc(val)}')`;
  }

  private _generateSelenium(): string {
    const strategy = this._seStrategy;
    const val = this._seValue.trim();
    const esc1 = escapeSingleQuoteJs;
    const esc2 = escapeDoubleQuoteJs;
    switch (strategy) {
      case 'By.cssSelector':
        return `driver.findElement(By.cssSelector("${esc2(val)}"))`;
      case 'By.xpath':
        return `driver.findElement(By.xpath("${esc2(val)}"))`;
      case 'By.id':
        return `driver.findElement(By.id('${esc1(val)}'))`;
      case 'By.name':
        return `driver.findElement(By.name('${esc1(val)}'))`;
      case 'By.className':
        return `driver.findElement(By.className('${esc1(val)}'))`;
      case 'By.tagName':
        return `driver.findElement(By.tagName('${esc1(val)}'))`;
      case 'By.linkText':
        return `driver.findElement(By.linkText('${esc1(val)}'))`;
      case 'By.partialLinkText':
        return `driver.findElement(By.partialLinkText('${esc1(val)}'))`;
    }
    return `driver.findElement(By.cssSelector("${esc2(val)}"))`;
  }

  private _buildBaseSelector(): string {
    let base = '';
    switch (this._structFramework) {
      case 'playwright':
        base = this._generatePlaywright();
        break;
      case 'css':
        base = this._generateCss();
        break;
      case 'xpath':
        base = this._generateXPath();
        break;
      case 'cypress':
        base = this._generateCypress();
        break;
      case 'selenium':
        base = this._generateSelenium();
        break;
    }
    return base;
  }

  private _applyChain(base: string): string {
    if (this._chainSteps.length === 0) return base;
    return this._chainSteps.reduce((acc, step) => {
      if (!step.value) return `${acc}.${step.method}()`;
      return `${acc}.${step.method}('${escapeSingleQuoteJs(step.value)}')`;
    }, base);
  }

  private async _onGenerateLocator() {
    const base = this._buildBaseSelector();
    const full = this._applyChain(base);
    this._structResult = scoreSelector(full, this._structFramework);
    this._allResults = [];

    // Count matches for css/xpath
    if (this._structFramework === 'css' || this._structFramework === 'xpath') {
      try {
        this._structMatchCount = await countMatches(full, this._structFramework);
      } catch {
        this._structMatchCount = null;
      }
    } else {
      this._structMatchCount = null;
    }
  }

  private async _onGenerateAllFormats() {
    // Build a synthetic ElementInfo from the structured form fields
    // so we can run generateScoredSelectors.
    const attrs: Record<string, string> = {};
    let tagName = 'div';

    switch (this._structFramework) {
      case 'playwright':
        if (this._pwTestId) attrs['data-testid'] = this._pwTestId;
        if (this._pwRole) attrs.role = this._pwRole;
        if (this._pwName) attrs['aria-label'] = this._pwName;
        if (this._pwLabel) attrs['aria-label'] = this._pwLabel;
        if (this._pwPlaceholder) attrs.placeholder = this._pwPlaceholder;
        if (this._pwAltText) attrs.alt = this._pwAltText;
        if (this._pwTitle) attrs.title = this._pwTitle;
        break;
      case 'css':
        tagName = this._cssTag || 'div';
        if (this._cssId) attrs.id = this._cssId;
        if (this._cssClass) attrs.class = this._cssClass;
        if (this._cssAttrName && this._cssAttrValue) attrs[this._cssAttrName] = this._cssAttrValue;
        break;
      case 'xpath':
        tagName = this._xpathTag && this._xpathTag !== '*' ? this._xpathTag : 'div';
        break;
      case 'cypress':
      case 'selenium':
        break;
    }

    const element = { tagName, text: '', attributes: attrs };
    this._allResults = generateScoredSelectors(element);
    this._structResult = null;
    this._structMatchCount = null;
  }

  // ---------------------------------------------------------------------------
  // Chain step management
  // ---------------------------------------------------------------------------

  private _chainMethodsForFramework(): string[] {
    switch (this._structFramework) {
      case 'playwright':
        return ['filter', 'first', 'last', 'nth', 'locator', 'getByRole', 'getByText'];
      case 'cypress':
        return ['find', 'children', 'first', 'last', 'eq', 'filter', 'parent', 'closest'];
      case 'selenium':
        return ['findElement', 'findElements'];
      default:
        return [];
    }
  }

  private _addChainStep() {
    const methods = this._chainMethodsForFramework();
    this._chainSteps = [...this._chainSteps, { method: methods[0] ?? 'filter', value: '' }];
  }

  private _removeChainStep(index: number) {
    this._chainSteps = this._chainSteps.filter((_, i) => i !== index);
  }

  private _updateChainStep(index: number, field: 'method' | 'value', val: string) {
    this._chainSteps = this._chainSteps.map((step, i) =>
      i === index ? { ...step, [field]: val } : step
    );
  }

  // ---------------------------------------------------------------------------
  // Star / toast
  // ---------------------------------------------------------------------------

  private async _onStarResult(scored: ScoredSelector) {
    try {
      await addFavorite({
        id: makeId(),
        selector: scored.selector,
        format: scored.format,
        score: scored.score,
        warnings: scored.warnings,
        pageUrl: '',
        elementTag: '',
        createdAt: Date.now(),
      });
      this._emitToast('Saved to favorites!');
    } catch {
      this._emitToast('Could not save to favorites.');
    }
  }

  private async _onTestResult(scored: ScoredSelector) {
    try {
      let sel = scored.selector;
      let type: string = scored.format;
      if (scored.format === 'playwright') {
        const m = sel.match(/page\.\w+\('([^']+)'/);
        if (m) {
          sel = m[1];
          type = 'css';
        }
      } else if (scored.format === 'cypress') {
        const m = sel.match(/cy\.\w+\('([^']+)'/);
        if (m) {
          sel = m[1];
          type = 'css';
        }
      } else if (scored.format === 'selenium') {
        const byXpath = sel.match(/By\.xpath\("([^"]+)"\)/);
        if (byXpath) {
          sel = byXpath[1];
          type = 'xpath';
        }
        const byCss = sel.match(/By\.(?:cssSelector|css)\("([^"]+)"\)/);
        if (byCss) {
          sel = byCss[1];
          type = 'css';
        }
      }
      await testSelector(sel, type);
    } catch {
      this._emitToast('Could not test selector on the page.');
    }
  }

  private _onCopyResult(scored: ScoredSelector) {
    navigator.clipboard.writeText(scored.selector).catch(() => {});
    this._emitToast('Copied!');
  }

  private _emitToast(message: string) {
    this.dispatchEvent(
      new CustomEvent('toast', { detail: message, bubbles: true, composed: true })
    );
  }

  // ---------------------------------------------------------------------------
  // Render helpers — score bar
  // ---------------------------------------------------------------------------

  private _scoreClass(score: number): string {
    if (score >= 70) return 'good';
    if (score >= 40) return 'medium';
    return 'poor';
  }

  private _renderScoreBar(scored: ScoredSelector) {
    const cls = this._scoreClass(scored.score);
    return html`
      <div class="score-row">
        <span class="score-label">Stability</span>
        <div class="score-bar-wrap">
          <div class="score-bar ${cls}" style="width:${scored.score}%"></div>
        </div>
        <span class="score-value ${cls}">${scored.score}</span>
      </div>
      ${
        scored.warnings.length > 0
          ? html`
              <div class="warning-list">
                ${scored.warnings.map(
                  (w) => html`<div class="warning-item"><span>⚠</span><span>${w}</span></div>`
                )}
              </div>
            `
          : nothing
      }
    `;
  }

  // ---------------------------------------------------------------------------
  // Render — freeform mode
  // ---------------------------------------------------------------------------

  private _renderMatchBadge(count: number | null, loading: boolean) {
    if (loading) return html`<span class="match-count">…</span>`;
    if (count === null) return nothing;
    if (count < 0) return html`<span class="match-count match-none">invalid</span>`;
    return html`<span class="match-count ${count > 0 ? 'match-ok' : 'match-none'}">${count} match${count !== 1 ? 'es' : ''}</span>`;
  }

  private _renderFreeform() {
    const suggestions = this._allSuggestions();

    return html`
      <div class="freeform-input-wrap">
        <textarea
          class="freeform-textarea"
          .value=${this._freeformSelector}
          placeholder="Type a CSS selector, XPath, or framework locator..."
          @input=${this._onFreeformInput}
          @keydown=${this._onFreeformKeydown}
          @focus=${() => {
            this._showSuggestions = true;
          }}
          @blur=${() => {
            setTimeout(() => {
              this._showSuggestions = false;
            }, 150);
          }}
          spellcheck="false"
          autocomplete="off"
        ></textarea>
      </div>

      <div class="freeform-row">
        <select class="format-select" .value=${this._freeformFormat} @change=${this._onFormatChange}>
          <option value="css">CSS</option>
          <option value="xpath">XPath</option>
          <option value="playwright">Playwright</option>
          <option value="cypress">Cypress</option>
          <option value="selenium">Selenium</option>
        </select>
        ${this._renderMatchBadge(this._matchCount, this._matchLoading)}
      </div>

      ${this._scored ? this._renderScoreBar(this._scored) : nothing}

      ${
        this._showSuggestions && suggestions.length > 0
          ? html`
              <div class="suggestions-panel">
                <div class="suggestions-list">
                  ${suggestions.map(
                    (s) => html`
                      <div class="suggestion-item" @mousedown=${() => this._onSuggestionClick(s)}>
                        <span class="suggestion-type">${s.type}</span>
                        <span class="suggestion-label">${s.label}</span>
                      </div>
                    `
                  )}
                </div>
              </div>
            `
          : nothing
      }

      <div class="action-row">
        <button
          type="button"
          class="btn-primary"
          ?disabled=${!this._freeformSelector.trim()}
          @click=${this._onFreeformTest}
        >
          Test on Page
        </button>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Render — structured mode forms
  // ---------------------------------------------------------------------------

  private _renderPlaywrightForm() {
    return html`
      <div class="form-grid">
        <div class="form-field">
          <label class="field-label">Method</label>
          <select
            .value=${this._pwMethod}
            @change=${(e: Event) => {
              this._pwMethod = (e.target as HTMLSelectElement).value as PlaywrightMethod;
            }}
          >
            <option value="getByRole">getByRole</option>
            <option value="getByText">getByText</option>
            <option value="getByTestId">getByTestId</option>
            <option value="getByLabel">getByLabel</option>
            <option value="getByPlaceholder">getByPlaceholder</option>
            <option value="getByAltText">getByAltText</option>
            <option value="getByTitle">getByTitle</option>
            <option value="locator">locator</option>
          </select>
        </div>

        ${
          this._pwMethod === 'getByRole'
            ? html`
          <div class="form-field">
            <label class="field-label">Role</label>
            <input
              type="text"
              .value=${this._pwRole}
              placeholder="button, link, textbox..."
              @input=${(e: Event) => {
                this._pwRole = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
          <div class="form-field">
            <label class="field-label">Name (accessible name, optional)</label>
            <input
              type="text"
              .value=${this._pwName}
              placeholder="Submit"
              @input=${(e: Event) => {
                this._pwName = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
          <div class="form-field" style="flex-direction:row;align-items:center;gap:8px;">
            <input
              type="checkbox"
              id="pw-exact"
              .checked=${this._pwExact}
              @change=${(e: Event) => {
                this._pwExact = (e.target as HTMLInputElement).checked;
              }}
            />
            <label class="field-label" for="pw-exact" style="margin:0;">Exact match</label>
          </div>
        `
            : nothing
        }

        ${
          this._pwMethod === 'getByText'
            ? html`
          <div class="form-field">
            <label class="field-label">Text</label>
            <input type="text" .value=${this._pwText} placeholder="Login"
              @input=${(e: Event) => {
                this._pwText = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
        `
            : nothing
        }

        ${
          this._pwMethod === 'getByTestId'
            ? html`
          <div class="form-field">
            <label class="field-label">Test ID</label>
            <input type="text" .value=${this._pwTestId} placeholder="submit-btn"
              @input=${(e: Event) => {
                this._pwTestId = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
        `
            : nothing
        }

        ${
          this._pwMethod === 'getByLabel'
            ? html`
          <div class="form-field">
            <label class="field-label">Label text</label>
            <input type="text" .value=${this._pwLabel} placeholder="Email address"
              @input=${(e: Event) => {
                this._pwLabel = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
        `
            : nothing
        }

        ${
          this._pwMethod === 'getByPlaceholder'
            ? html`
          <div class="form-field">
            <label class="field-label">Placeholder text</label>
            <input type="text" .value=${this._pwPlaceholder} placeholder="Enter your email"
              @input=${(e: Event) => {
                this._pwPlaceholder = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
        `
            : nothing
        }

        ${
          this._pwMethod === 'getByAltText'
            ? html`
          <div class="form-field">
            <label class="field-label">Alt text</label>
            <input type="text" .value=${this._pwAltText} placeholder="Company logo"
              @input=${(e: Event) => {
                this._pwAltText = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
        `
            : nothing
        }

        ${
          this._pwMethod === 'getByTitle'
            ? html`
          <div class="form-field">
            <label class="field-label">Title</label>
            <input type="text" .value=${this._pwTitle} placeholder="Tooltip text"
              @input=${(e: Event) => {
                this._pwTitle = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
        `
            : nothing
        }

        ${
          this._pwMethod === 'locator'
            ? html`
          <div class="form-field">
            <label class="field-label">CSS / XPath locator</label>
            <input type="text" .value=${this._pwLocator} placeholder=".submit-btn"
              @input=${(e: Event) => {
                this._pwLocator = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
        `
            : nothing
        }
      </div>
    `;
  }

  private _renderCssForm() {
    return html`
      <div class="form-grid">
        <div class="form-field">
          <label class="field-label">Tag (optional)</label>
          <input type="text" .value=${this._cssTag} placeholder="div, button, input..."
            @input=${(e: Event) => {
              this._cssTag = (e.target as HTMLInputElement).value;
            }}
          />
        </div>
        <div class="form-field">
          <label class="field-label">ID (optional)</label>
          <input type="text" .value=${this._cssId} placeholder="submit-btn"
            @input=${(e: Event) => {
              this._cssId = (e.target as HTMLInputElement).value;
            }}
          />
        </div>
        <div class="form-field">
          <label class="field-label">Classes (space-separated, optional)</label>
          <input type="text" .value=${this._cssClass} placeholder="btn btn-primary"
            @input=${(e: Event) => {
              this._cssClass = (e.target as HTMLInputElement).value;
            }}
          />
        </div>
        <div class="form-field">
          <label class="field-label">Attribute name (optional)</label>
          <input type="text" .value=${this._cssAttrName} placeholder="data-testid"
            @input=${(e: Event) => {
              this._cssAttrName = (e.target as HTMLInputElement).value;
            }}
          />
        </div>
        <div class="form-field">
          <label class="field-label">Attribute value (optional)</label>
          <input type="text" .value=${this._cssAttrValue} placeholder="submit-button"
            @input=${(e: Event) => {
              this._cssAttrValue = (e.target as HTMLInputElement).value;
            }}
          />
        </div>
      </div>
    `;
  }

  private _renderXPathForm() {
    return html`
      <div class="form-grid">
        <div class="form-field">
          <label class="field-label">Axis</label>
          <select
            .value=${this._xpathAxis}
            @change=${(e: Event) => {
              this._xpathAxis = (e.target as HTMLSelectElement).value as XPathAxis;
            }}
          >
            <option value="//">//  (descendant)</option>
            <option value="/">/   (child)</option>
          </select>
        </div>
        <div class="form-field">
          <label class="field-label">Tag</label>
          <input type="text" .value=${this._xpathTag} placeholder="* or div, button..."
            @input=${(e: Event) => {
              this._xpathTag = (e.target as HTMLInputElement).value;
            }}
          />
        </div>
        <div class="form-field">
          <label class="field-label">Predicate (optional)</label>
          <input
            type="text"
            .value=${this._xpathPredicate}
            placeholder="@id='foo' or contains(text(),'Bar')"
            @input=${(e: Event) => {
              this._xpathPredicate = (e.target as HTMLInputElement).value;
            }}
          />
        </div>
      </div>
    `;
  }

  private _renderCypressForm() {
    return html`
      <div class="form-grid">
        <div class="form-field">
          <label class="field-label">Method</label>
          <select
            .value=${this._cyMethod}
            @change=${(e: Event) => {
              this._cyMethod = (e.target as HTMLSelectElement).value as CypressMethod;
            }}
          >
            <option value="cy.get">cy.get</option>
            <option value="cy.contains">cy.contains</option>
            <option value="cy.findByRole">cy.findByRole</option>
            <option value="cy.findByText">cy.findByText</option>
            <option value="cy.findByTestId">cy.findByTestId</option>
          </select>
        </div>
        <div class="form-field">
          <label class="field-label">
            ${this._cyMethod === 'cy.get' ? 'CSS Selector' : 'Value'}
          </label>
          <input
            type="text"
            .value=${this._cyValue}
            placeholder=${this._cyMethod === 'cy.get' ? '[data-testid="btn"]' : 'Submit'}
            @input=${(e: Event) => {
              this._cyValue = (e.target as HTMLInputElement).value;
            }}
          />
        </div>
      </div>
    `;
  }

  private _renderSeleniumForm() {
    return html`
      <div class="form-grid">
        <div class="form-field">
          <label class="field-label">Strategy</label>
          <select
            .value=${this._seStrategy}
            @change=${(e: Event) => {
              this._seStrategy = (e.target as HTMLSelectElement).value as SeleniumStrategy;
            }}
          >
            <option value="By.cssSelector">By.cssSelector</option>
            <option value="By.xpath">By.xpath</option>
            <option value="By.id">By.id</option>
            <option value="By.name">By.name</option>
            <option value="By.className">By.className</option>
            <option value="By.tagName">By.tagName</option>
            <option value="By.linkText">By.linkText</option>
            <option value="By.partialLinkText">By.partialLinkText</option>
          </select>
        </div>
        <div class="form-field">
          <label class="field-label">Value</label>
          <input
            type="text"
            .value=${this._seValue}
            placeholder="#submit-btn"
            @input=${(e: Event) => {
              this._seValue = (e.target as HTMLInputElement).value;
            }}
          />
        </div>
      </div>
    `;
  }

  private _renderChainSteps() {
    const methods = this._chainMethodsForFramework();
    const showChain = ['playwright', 'cypress', 'selenium'].includes(this._structFramework);
    if (!showChain) return nothing;

    return html`
      <div class="chain-section">
        <div class="chain-header">
          <span class="section-label">Chain steps</span>
          <button type="button" class="btn-secondary add-chain-btn" @click=${this._addChainStep}>
            + Add step
          </button>
        </div>
        ${
          this._chainSteps.length > 0
            ? html`
                <div class="chain-list">
                  ${this._chainSteps.map(
                    (step, i) => html`
                      <div class="chain-step">
                        <select
                          .value=${step.method}
                          @change=${(e: Event) => {
                            this._updateChainStep(
                              i,
                              'method',
                              (e.target as HTMLSelectElement).value
                            );
                          }}
                        >
                          ${methods.map((m) => html`<option value=${m}>${m}</option>`)}
                        </select>
                        <input
                          type="text"
                          .value=${step.value}
                          placeholder="value (optional)"
                          @input=${(e: Event) => {
                            this._updateChainStep(i, 'value', (e.target as HTMLInputElement).value);
                          }}
                        />
                        <button
                          type="button"
                          class="chain-remove"
                          title="Remove step"
                          @click=${() => this._removeChainStep(i)}
                        >×</button>
                      </div>
                    `
                  )}
                </div>
              `
            : nothing
        }
      </div>
    `;
  }

  private _renderStructured() {
    return html`
      <div class="struct-section">
        <div class="section-label" style="margin-bottom:8px;">Framework</div>
        <div class="framework-tabs">
          ${(['playwright', 'css', 'xpath', 'cypress', 'selenium'] as SelectorFormat[]).map(
            (fw) => html`
              <button
                type="button"
                class="fw-tab ${this._structFramework === fw ? 'active' : ''}"
                @click=${() => {
                  this._structFramework = fw;
                  this._chainSteps = [];
                  this._structResult = null;
                  this._allResults = [];
                }}
              >
                ${fw === 'playwright' ? 'Playwright' : ''}
                ${fw === 'css' ? 'CSS' : ''}
                ${fw === 'xpath' ? 'XPath' : ''}
                ${fw === 'cypress' ? 'Cypress' : ''}
                ${fw === 'selenium' ? 'Selenium' : ''}
              </button>
            `
          )}
        </div>

        ${this._structFramework === 'playwright' ? this._renderPlaywrightForm() : nothing}
        ${this._structFramework === 'css' ? this._renderCssForm() : nothing}
        ${this._structFramework === 'xpath' ? this._renderXPathForm() : nothing}
        ${this._structFramework === 'cypress' ? this._renderCypressForm() : nothing}
        ${this._structFramework === 'selenium' ? this._renderSeleniumForm() : nothing}

        ${this._renderChainSteps()}

        <div class="action-row" style="margin-top:12px;">
          <button type="button" class="btn-primary" @click=${this._onGenerateLocator}>
            Generate Locator
          </button>
          <button type="button" class="btn-secondary" @click=${this._onGenerateAllFormats}>
            All Formats
          </button>
        </div>
      </div>

      ${this._structResult || this._allResults.length > 0 ? this._renderStructResults() : nothing}
    `;
  }

  private _renderStructResults() {
    if (this._allResults.length > 0) {
      return html`
        <div class="result-section">
          <div class="result-header">
            <span>All formats</span>
            <span>${this._allResults.length} selectors</span>
          </div>
          <div class="result-list">
            ${this._allResults.slice(0, 10).map(
              (s) => html`
                <selector-card
                  .data=${s}
                  @copy=${(e: CustomEvent<ScoredSelector>) => this._onCopyResult(e.detail)}
                  @test=${(e: CustomEvent<ScoredSelector>) => this._onTestResult(e.detail)}
                  @star=${(e: CustomEvent<ScoredSelector>) => this._onStarResult(e.detail)}
                ></selector-card>
              `
            )}
          </div>
        </div>
      `;
    }

    if (this._structResult) {
      return html`
        <div class="result-section">
          <div class="result-header">
            <span>Generated locator</span>
            ${this._renderMatchBadge(this._structMatchCount, false)}
          </div>
          <div class="result-list">
            <selector-card
              .data=${this._structResult}
              @copy=${(e: CustomEvent<ScoredSelector>) => this._onCopyResult(e.detail)}
              @test=${(e: CustomEvent<ScoredSelector>) => this._onTestResult(e.detail)}
              @star=${(e: CustomEvent<ScoredSelector>) => this._onStarResult(e.detail)}
            ></selector-card>
          </div>
          ${this._renderScoreBar(this._structResult)}
        </div>
      `;
    }

    return nothing;
  }

  // ---------------------------------------------------------------------------
  // Root render
  // ---------------------------------------------------------------------------

  override render() {
    return html`
      <div class="mode-toggle" role="group" aria-label="Build mode">
        <button
          type="button"
          class="mode-pill ${this._mode === 'freeform' ? 'active' : ''}"
          @click=${() => {
            this._mode = 'freeform';
          }}
          aria-pressed=${this._mode === 'freeform'}
        >Freeform</button>
        <button
          type="button"
          class="mode-pill ${this._mode === 'structured' ? 'active' : ''}"
          @click=${() => {
            this._mode = 'structured';
          }}
          aria-pressed=${this._mode === 'structured'}
        >Structured</button>
      </div>

      ${this._mode === 'freeform' ? this._renderFreeform() : this._renderStructured()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'build-tab': BuildTab;
  }
}
