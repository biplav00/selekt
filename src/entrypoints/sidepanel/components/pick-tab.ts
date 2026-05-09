import type {
  ElementInfo,
  RichElementData,
  SavedSelector,
  ScoredSelector,
  SelectorFormat,
} from '@/types';
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  onElementSelected,
  onPickingCancelled,
  startPicking,
  testSelector,
} from '../services/messaging.js';
import { extractTestable, generateScoredSelectors } from '../services/selector-engine.js';
import { addFavorite, addRecent, loadWorkspace } from '../services/storage.js';
import { sharedStyles } from '../styles/shared.js';
import './dom-tree.js';
import './selector-card.js';

const PICK_TIMEOUT_MS = 30_000;

const FORMAT_LABELS: Record<string, string> = {
  css: 'CSS',
  xpath: 'XPath',
  playwright: 'Playwright',
  cypress: 'Cypress',
  selenium: 'Selenium',
};

function makeSavedSelector(scored: ScoredSelector, element: ElementInfo): SavedSelector {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    selector: scored.selector,
    format: scored.format,
    score: scored.score,
    warnings: scored.warnings,
    pageUrl: '',
    elementTag: element.tagName,
    createdAt: Date.now(),
  };
}

@customElement('pick-tab')
export class PickTab extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      /* ── Pick button ── */
      .pick-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 10px 14px;
        background: var(--accent);
        color: #fff;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        transition: background 0.15s, opacity 0.15s;
        gap: 8px;
      }

      .pick-btn:hover {
        background: var(--accent-hover);
      }

      .pick-btn.picking {
        background: var(--warning);
        color: #000;
      }

      .pick-btn.picking:hover {
        opacity: 0.9;
      }

      .pick-btn-label {
        flex: 1;
        text-align: left;
      }

      .pick-btn-shortcut {
        font-size: 10px;
        font-weight: 500;
        opacity: 0.75;
        background: rgba(0 0 0 / 0.15);
        padding: 2px 6px;
        border-radius: 4px;
        white-space: nowrap;
        flex-shrink: 0;
      }

      /* ── Element info card ── */
      .element-card {
        margin-top: 12px;
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 10px;
      }

      .element-card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 6px;
      }

      .tag-badge {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        background: color-mix(in srgb, var(--accent) 15%, transparent);
        color: var(--accent);
        border-radius: 4px;
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        font-size: 11px;
        font-weight: 600;
      }

      .element-path {
        font-size: 11px;
        color: var(--text-tertiary);
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
        min-width: 0;
      }

      .attr-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 6px;
      }

      .attr-chip {
        display: inline-flex;
        align-items: center;
        padding: 1px 6px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        border-radius: 3px;
        font-size: 10px;
        color: var(--text-secondary);
        font-family: 'JetBrains Mono', 'Courier New', monospace;
      }

      /* ── Results list ── */
      .results-section {
        margin-top: 12px;
      }

      .results-header {
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

      .results-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .show-all-btn {
        margin-top: 8px;
        width: 100%;
        padding: 6px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        color: var(--text-secondary);
        border-radius: 6px;
        font-size: 11px;
        font-weight: 500;
        transition: background 0.15s, color 0.15s;
      }

      .show-all-btn:hover {
        background: var(--border);
        color: var(--text-primary);
      }

      /* ── DOM Tree toggle ── */
      .section-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 12px;
      }

      .toggle-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 10px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        border-radius: 6px;
        font-size: 11px;
        font-weight: 500;
        color: var(--text-secondary);
        transition: background 0.15s, color 0.15s, border-color 0.15s;
      }

      .toggle-btn:hover {
        background: var(--border);
        color: var(--text-primary);
      }

      .toggle-btn.active {
        background: color-mix(in srgb, var(--accent) 12%, transparent);
        border-color: color-mix(in srgb, var(--accent) 40%, transparent);
        color: var(--accent);
      }

      .dom-tree-section {
        margin-top: 12px;
      }

      /* ── Loading state ── */
      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 32px 16px;
        color: var(--text-tertiary);
        text-align: center;
      }

      .loading-spinner {
        width: 24px;
        height: 24px;
        border: 2px solid var(--border);
        border-top-color: var(--accent);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .skeleton-card {
        height: 40px;
        background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-tertiary) 50%, var(--bg-secondary) 75%);
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: 6px;
        margin-bottom: 4px;
      }

      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      /* ── Format groups ── */
      .format-group {
        margin-bottom: 2px;
      }

      .format-header {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 10px;
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 6px;
        cursor: pointer;
        font-family: inherit;
        font-size: 12px;
        color: var(--text-primary);
        transition: background 0.15s;
      }

      .format-header:hover {
        background: var(--bg-tertiary);
      }

      .format-arrow {
        font-size: 10px;
        color: var(--text-secondary);
        width: 12px;
      }

      .format-name {
        font-weight: 600;
        flex: 1;
        text-align: left;
      }

      .format-best-score {
        font-size: 11px;
        color: var(--text-secondary);
        font-weight: 500;
      }

      .format-selectors {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 4px 0 4px 20px;
      }

      .show-more-btn {
        padding: 4px 10px;
        background: transparent;
        border: 1px dashed var(--border);
        border-radius: 4px;
        color: var(--text-secondary);
        font-family: inherit;
        font-size: 11px;
        cursor: pointer;
      }

      /* ── Empty state ── */
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 32px 16px;
        color: var(--text-tertiary);
        text-align: center;
      }

      .empty-icon {
        width: 40px;
        height: 40px;
        opacity: 0.4;
      }

      .empty-state p {
        font-size: 12px;
        line-height: 1.5;
        max-width: 200px;
      }
    `,
  ];

  @property({ type: Number }) historyLimit = 50;
  @property({ type: String }) defaultFormat: SelectorFormat = 'xpath';

  @state() private _picking = false;
  @state() private _element: RichElementData | null = null;
  @state() private _selectors: ScoredSelector[] = [];
  @state() private _selectorsLoading = false;
  @state() private _favoriteIds = new Set<string>();
  @state() private _showDomTree = false;
  @state() private _expandedFormats: Set<string> = new Set();

  private _pickTimer: ReturnType<typeof setTimeout> | null = null;
  private _unsubscribers: Array<() => void> = [];

  override connectedCallback() {
    super.connectedCallback();
    this._registerListeners();
    this._loadFavorites();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._clearPickTimer();
    for (const off of this._unsubscribers) off();
    this._unsubscribers = [];
  }

  private _registerListeners() {
    this._unsubscribers.push(
      onElementSelected((element: RichElementData) => {
        this._onElementSelected(element);
      })
    );
    this._unsubscribers.push(
      onPickingCancelled(() => {
        this._onPickingCancelled();
      })
    );
  }

  private async _loadFavorites() {
    try {
      const ws = await loadWorkspace();
      const ids = new Set(ws.favorites.map((f) => `${f.format}::${f.selector}`));
      this._favoriteIds = ids;
    } catch {
      // silently ignore
    }
  }

  private _clearPickTimer() {
    if (this._pickTimer !== null) {
      clearTimeout(this._pickTimer);
      this._pickTimer = null;
    }
  }

  private async _handlePickClick() {
    if (this._picking) {
      // Cancel picking
      this._picking = false;
      this._clearPickTimer();
      return;
    }

    try {
      await startPicking();
      this._picking = true;
      this._clearPickTimer();
      this._pickTimer = setTimeout(() => {
        this._picking = false;
        this._pickTimer = null;
      }, PICK_TIMEOUT_MS);
    } catch (err) {
      this._emitToast('Could not start picking. Make sure a page is open.');
    }
  }

  private async _onElementSelected(element: RichElementData) {
    this._picking = false;
    this._clearPickTimer();
    this._element = element;
    this._selectors = [];
    this._selectorsLoading = true;
    this._expandedFormats = new Set([this.defaultFormat]);

    try {
      const richElement = {
        ...element,
        parentChain: element.parentChain || [],
        siblingTags: element.siblingTags || [],
        accessibleName: element.accessibleName || '',
      };
      const { selectors } = generateScoredSelectors(richElement);
      this._selectors = selectors;

      // Auto-save top selector to recent
      if (this._selectors.length > 0) {
        try {
          const top = this._selectors[0];
          const saved = makeSavedSelector(top, element);
          await addRecent(saved, this.historyLimit);
        } catch {
          // silently ignore
        }
      }

      // Focus the highest-scored card so keyboard users can press Enter to copy.
      await this.updateComplete;
      this._focusFirstCard();
    } finally {
      this._selectorsLoading = false;
    }
  }

  private _focusFirstCard() {
    const first = this.renderRoot?.querySelector<HTMLElement>('selector-card');
    first?.focus();
  }

  private _onPickingCancelled() {
    this._picking = false;
    this._clearPickTimer();
  }

  private _onCopy(e: CustomEvent<ScoredSelector>) {
    const { selector } = e.detail;
    navigator.clipboard.writeText(selector).catch(() => {});
    this._emitToast('Copied!');
  }

  private async _onTest(e: CustomEvent<ScoredSelector>) {
    const testable = extractTestable(e.detail.selector, e.detail.format);
    if (!testable) {
      this._emitToast('Cannot extract testable selector from this locator');
      return;
    }
    try {
      await testSelector(testable.selector, testable.selectorType);
    } catch {
      this._emitToast('Could not test selector on the page.');
    }
  }

  private async _onStar(e: CustomEvent<ScoredSelector>) {
    const scored = e.detail;
    const key = `${scored.format}::${scored.selector}`;
    if (!this._element) return;

    try {
      const saved = makeSavedSelector(scored, this._element);
      await addFavorite(saved);
      this._favoriteIds = new Set([...this._favoriteIds, key]);
      this._emitToast('Saved to favorites!');
    } catch {
      this._emitToast('Could not save to favorites.');
    }
  }

  private _emitToast(message: string) {
    this.dispatchEvent(
      new CustomEvent('toast', { detail: message, bubbles: true, composed: true })
    );
  }

  private _onDomTreeElementSelected(e: CustomEvent<ElementInfo>) {
    this._onElementSelected(e.detail);
  }

  private _buildElementPath(element: ElementInfo): string {
    const { tagName, attributes } = element;
    const tag = tagName.toLowerCase();
    const id = attributes.id ? `#${attributes.id}` : '';
    const classes = attributes.class
      ? attributes.class
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 3)
          .map((c) => `.${c}`)
          .join('')
      : '';
    return `${tag}${id}${classes}`;
  }

  private _renderAttrChips(element: ElementInfo) {
    const SHOW_ATTRS = ['id', 'class', 'role', 'aria-label', 'data-testid', 'name', 'type'];
    const chips = SHOW_ATTRS.filter((a) => element.attributes[a]).map(
      (a) => html`<span class="attr-chip">${a}="${element.attributes[a]}"</span>`
    );
    return chips.length > 0 ? html`<div class="attr-chips">${chips}</div>` : nothing;
  }

  private _renderElementCard(element: RichElementData) {
    return html`
      <div class="element-card">
        <div class="element-card-header">
          <span class="tag-badge">&lt;${element.tagName.toLowerCase()}&gt;</span>
          <span class="element-path">${this._buildElementPath(element)}</span>
        </div>
        ${this._renderAttrChips(element)}
      </div>
    `;
  }

  private _groupByFormat(selectors: ScoredSelector[]): Map<string, ScoredSelector[]> {
    const groups = new Map<string, ScoredSelector[]>();
    for (const s of selectors) {
      if (!groups.has(s.format)) groups.set(s.format, []);
      groups.get(s.format)!.push(s);
    }
    return groups;
  }

  private _toggleFormat(format: string) {
    const next = new Set(this._expandedFormats);
    if (next.has(format)) next.delete(format);
    else next.add(format);
    this._expandedFormats = next;
  }

  private _renderFormatGroup(format: string, selectors: ScoredSelector[]) {
    const expanded = this._expandedFormats.has(format);
    const best = selectors[0]?.score ?? 0;
    const shown = expanded ? selectors.slice(0, 5) : [];

    return html`
      <div class="format-group">
        <button class="format-header" type="button" @click=${() => this._toggleFormat(format)}>
          <span class="format-arrow">${expanded ? '▼' : '▸'}</span>
          <span class="format-name">${FORMAT_LABELS[format] || format}</span>
          <span class="format-best-score">${best}</span>
        </button>
        ${
          expanded
            ? html`
          <div class="format-selectors">
            ${shown.map(
              (s) => html`
              <selector-card
                .data=${s}
                .starred=${this._favoriteIds.has(`${s.format}::${s.selector}`)}
                @copy=${this._onCopy}
                @selector-test=${this._onTest}
                @selector-star=${this._onStar}
              ></selector-card>
            `
            )}
            ${
              selectors.length > 5
                ? html`
              <button class="show-more-btn" type="button" @click=${() => {
                /* expand all handled via full list */ void 0;
              }}>
                Show all ${selectors.length}
              </button>
            `
                : nothing
            }
          </div>
        `
            : nothing
        }
      </div>
    `;
  }

  private _renderResults() {
    if (this._selectorsLoading) {
      return html`
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <span>Generating selectors…</span>
          <div class="skeleton-card" style="width:100%"></div>
          <div class="skeleton-card" style="width:80%"></div>
          <div class="skeleton-card" style="width:60%"></div>
        </div>
      `;
    }

    if (this._selectors.length === 0) return nothing;

    const groups = this._groupByFormat(this._selectors);

    // Sort groups: preferred format first, then by best score descending
    const preferredFormat = 'playwright';
    const sortedFormats = [...groups.keys()].sort((a, b) => {
      if (a === preferredFormat) return -1;
      if (b === preferredFormat) return 1;
      const scoreA = groups.get(a)![0]?.score ?? 0;
      const scoreB = groups.get(b)![0]?.score ?? 0;
      return scoreB - scoreA;
    });

    return html`
      <div class="results-section">
        <div class="results-header">
          <span>Selectors</span>
          <span>${this._selectors.length} found</span>
        </div>
        <div class="results-list">
          ${sortedFormats.map((format) => this._renderFormatGroup(format, groups.get(format)!))}
        </div>
      </div>
    `;
  }

  private _renderEmptyState() {
    return html`
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/>
          <path d="m21 21-4.35-4.35"/>
          <path d="M8 11h6M11 8v6" stroke-linecap="round"/>
        </svg>
        <p>Click the button or press ⌘⇧L to pick an element</p>
      </div>
    `;
  }

  override render() {
    return html`
      <button
        type="button"
        class="pick-btn ${this._picking ? 'picking' : ''}"
        @click=${this._handlePickClick}
        aria-pressed=${this._picking}
      >
        <span class="pick-btn-label">${this._picking ? 'Picking...' : 'Pick Element'}</span>
        <span class="pick-btn-shortcut">${this._picking ? 'ESC' : '⌘⇧L'}</span>
      </button>

      ${this._element ? this._renderElementCard(this._element) : nothing}
      ${this._element ? this._renderResults() : this._renderEmptyState()}

      ${
        this._element
          ? html`
              <div class="section-toggle">
                <button
                  type="button"
                  class="toggle-btn ${this._showDomTree ? 'active' : ''}"
                  @click=${() => {
                    this._showDomTree = !this._showDomTree;
                  }}
                >
                  ${this._showDomTree ? '▼' : '▶'} DOM Tree
                </button>
              </div>
              ${
                this._showDomTree
                  ? html`
                      <div class="dom-tree-section">
                        <dom-tree
                          @element-selected=${this._onDomTreeElementSelected}
                          @toast=${(e: CustomEvent<string>) => this._emitToast(e.detail)}
                        ></dom-tree>
                      </div>
                    `
                  : nothing
              }
            `
          : nothing
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pick-tab': PickTab;
  }
}
