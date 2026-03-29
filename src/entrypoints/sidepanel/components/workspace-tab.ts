import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { sharedStyles } from '../styles/shared.js';
import { loadWorkspace, removeFavorite, clearRecent } from '../services/storage.js';
import { testSelector } from '../services/messaging.js';
import type { SavedSelector, WorkspaceData } from '@/types';
import './selector-card.js';

const FORMAT_CHIPS = [
  { key: 'css', label: 'CSS' },
  { key: 'xpath', label: 'XPATH' },
  { key: 'playwright', label: 'PW' },
  { key: 'cypress', label: 'CY' },
  { key: 'selenium', label: 'SE' },
];

@customElement('workspace-tab')
export class WorkspaceTab extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }

      /* ── Search bar ── */
      .search-bar {
        padding: 10px 12px 6px;
        flex-shrink: 0;
      }

      .search-input {
        width: 100%;
        display: block;
      }

      /* ── Format filter chips ── */
      .filter-bar {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 12px 8px;
        flex-shrink: 0;
        flex-wrap: wrap;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 20px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        border: 1px solid var(--border);
        background: var(--bg-tertiary);
        color: var(--text-secondary);
        cursor: pointer;
        transition: background 0.15s, color 0.15s, border-color 0.15s;
      }

      .chip:hover {
        border-color: var(--accent);
        color: var(--accent);
      }

      .chip.active {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }

      /* ── Scrollable content ── */
      .scroll-area {
        flex: 1;
        overflow-y: auto;
        padding: 0 12px 16px;
      }

      /* ── Section headers ── */
      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 0 6px;
        margin-top: 4px;
      }

      .section-title {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-tertiary);
      }

      .clear-btn {
        font-size: 10px;
        color: var(--text-tertiary);
        padding: 2px 6px;
        border-radius: 4px;
        transition: background 0.15s, color 0.15s;
      }

      .clear-btn:hover {
        background: var(--bg-tertiary);
        color: var(--text-secondary);
      }

      /* ── Item wrapper ── */
      .item-wrapper {
        margin-bottom: 6px;
      }

      .item-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 2px 4px 0;
        font-size: 10px;
        color: var(--text-tertiary);
      }

      .item-meta .hostname {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* ── Empty state ── */
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 16px 0;
        color: var(--text-tertiary);
        font-size: 11px;
        text-align: center;
      }

      .empty-icon {
        font-size: 20px;
        opacity: 0.4;
        margin-bottom: 2px;
      }
    `,
  ];

  @state() private _data: WorkspaceData = { favorites: [], recent: [] };
  @state() private _search = '';
  @state() private _formatFilter: string | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this._load();
  }

  private async _load() {
    this._data = await loadWorkspace();
  }

  private _filter(items: SavedSelector[]): SavedSelector[] {
    let filtered = items;

    if (this._formatFilter) {
      filtered = filtered.filter((item) => item.format === this._formatFilter);
    }

    if (this._search.trim()) {
      const q = this._search.trim().toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.selector.toLowerCase().includes(q) || item.elementTag.toLowerCase().includes(q)
      );
    }

    return filtered;
  }

  private async _handleRemoveFavorite(e: CustomEvent) {
    const item = e.detail as SavedSelector;
    this._data = await removeFavorite(item.id);
  }

  private async _handleClearRecent() {
    this._data = await clearRecent();
  }

  private async _handleTest(e: CustomEvent) {
    const item = e.detail as SavedSelector;
    const selectorType = this._extractSelectorType(item);
    try {
      await testSelector(item.selector, selectorType);
    } catch {
      this._emitToast('Could not test selector');
    }
  }

  private _handleCopy() {
    this._emitToast('Copied!');
  }

  private _extractSelectorType(item: SavedSelector): string {
    if (item.format === 'xpath') return 'xpath';
    // For framework formats (playwright, cypress, selenium) we pass 'css' as the testable type
    return 'css';
  }

  private _emitToast(message: string) {
    this.dispatchEvent(new CustomEvent('toast', { detail: message, bubbles: true, composed: true }));
  }

  private _getRelativeTime(timestamp: number): string {
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${diffDay}d ago`;
  }

  private _getHostname(pageUrl: string): string {
    if (!pageUrl) return '';
    try {
      return new URL(pageUrl).hostname;
    } catch {
      return '';
    }
  }

  private _toggleFormatFilter(key: string) {
    this._formatFilter = this._formatFilter === key ? null : key;
  }

  private _renderItem(item: SavedSelector, starred: boolean) {
    const hostname = this._getHostname(item.pageUrl);
    const relTime = this._getRelativeTime(item.createdAt);

    return html`
      <div class="item-wrapper">
        <selector-card
          .data=${{
            selector: item.selector,
            format: item.format,
            score: item.score,
            warnings: item.warnings,
          }}
          .starred=${starred}
          @copy=${this._handleCopy}
          @test=${(e: CustomEvent) => this._handleTest(e)}
          @star=${(e: CustomEvent) => this._handleRemoveFavorite(e)}
        ></selector-card>
        <div class="item-meta">
          ${hostname ? html`<span class="hostname">${hostname}</span>` : nothing}
          <span>${relTime}</span>
        </div>
      </div>
    `;
  }

  override render() {
    const filteredFavorites = this._filter(this._data.favorites);
    const filteredRecent = this._filter(this._data.recent);

    return html`
      <!-- Search bar -->
      <div class="search-bar">
        <input
          type="text"
          class="search-input"
          placeholder="Search selectors or tags…"
          .value=${this._search}
          @input=${(e: Event) => {
            this._search = (e.target as HTMLInputElement).value;
          }}
        />
      </div>

      <!-- Format filter chips -->
      <div class="filter-bar">
        ${FORMAT_CHIPS.map(
          (chip) => html`
          <button
            type="button"
            class="chip ${this._formatFilter === chip.key ? 'active' : ''}"
            @click=${() => this._toggleFormatFilter(chip.key)}
          >${chip.label}</button>
        `
        )}
      </div>

      <!-- Scrollable content -->
      <div class="scroll-area">

        <!-- Favorites section -->
        <div class="section-header">
          <span class="section-title">Favorites (${filteredFavorites.length})</span>
        </div>
        ${
          filteredFavorites.length > 0
            ? filteredFavorites.map((item) => this._renderItem(item, true))
            : html`
              <div class="empty-state">
                <div class="empty-icon">★</div>
                <span>${this._search || this._formatFilter ? 'No matches' : 'No favorites yet'}</span>
              </div>
            `
        }

        <!-- Recents section -->
        <div class="section-header">
          <span class="section-title">Recent (${filteredRecent.length})</span>
          ${
            this._data.recent.length > 0
              ? html`
                <button type="button" class="clear-btn" @click=${this._handleClearRecent}>
                  Clear all
                </button>
              `
              : nothing
          }
        </div>
        ${
          filteredRecent.length > 0
            ? filteredRecent.map((item) => this._renderItem(item, false))
            : html`
              <div class="empty-state">
                <div class="empty-icon">◷</div>
                <span>${this._search || this._formatFilter ? 'No matches' : 'No recent selectors'}</span>
              </div>
            `
        }

      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'workspace-tab': WorkspaceTab;
  }
}
