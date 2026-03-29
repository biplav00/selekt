import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ScoredSelector } from '@/types';
import { sharedStyles } from '../styles/shared.js';

const FORMAT_LABEL: Record<string, string> = {
  css: 'CSS',
  xpath: 'XP',
  playwright: 'PW',
  cypress: 'CY',
  selenium: 'SE',
};

const FORMAT_BADGE_CLASS: Record<string, string> = {
  css: 'badge-css',
  xpath: 'badge-xpath',
  playwright: 'badge-pw',
  cypress: 'badge-cy',
  selenium: 'badge-se',
};

@customElement('selector-card')
export class SelectorCard extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      .row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 10px;
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 6px;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
        position: relative;
        overflow: hidden;
      }

      .row:hover {
        border-color: var(--accent);
        background: var(--bg-tertiary);
      }

      .selector-text {
        flex: 1;
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        font-size: 11px;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }

      .actions {
        display: flex;
        align-items: center;
        gap: 4px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.15s;
        flex-shrink: 0;
      }

      .row:hover .actions {
        opacity: 1;
        pointer-events: auto;
      }

      .action-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        color: var(--text-secondary);
        font-size: 12px;
        transition: background 0.15s, color 0.15s, border-color 0.15s;
        flex-shrink: 0;
      }

      .action-btn:hover {
        background: var(--accent);
        border-color: var(--accent);
        color: #fff;
      }

      .action-btn.starred {
        color: var(--warning);
        border-color: var(--warning);
        background: color-mix(in srgb, var(--warning) 10%, transparent);
      }

      .status-badge {
        display: inline-flex;
        align-items: center;
        padding: 1px 5px;
        border-radius: 3px;
        font-size: 9px;
        font-weight: 600;
        text-transform: uppercase;
        flex-shrink: 0;
      }

      .status-changed {
        background: color-mix(in srgb, var(--warning) 15%, transparent);
        color: var(--warning);
      }

      .status-broken {
        background: color-mix(in srgb, var(--score-poor) 15%, transparent);
        color: var(--score-poor);
      }

      .warning-row {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 3px;
        padding-left: 4px;
        color: var(--warning);
        font-size: 10px;
      }

      .warning-row span {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ];

  @property({ type: Object })
  data: ScoredSelector | null = null;

  @property({ type: Boolean })
  starred = false;

  @property({ type: String })
  status: 'normal' | 'changed' | 'broken' = 'normal';

  @property({ type: String })
  statusText = '';

  private _scoreClass(score: number): string {
    if (score >= 70) return 'score-good';
    if (score >= 40) return 'score-medium';
    return 'score-poor';
  }

  private _onRowClick(e: Event) {
    // Don't copy when clicking action buttons
    if ((e.target as HTMLElement).closest('.actions')) return;
    if (this.data) {
      this.dispatchEvent(new CustomEvent('copy', { detail: this.data, bubbles: true, composed: true }));
    }
  }

  private _onTest(e: Event) {
    e.stopPropagation();
    if (this.data) {
      this.dispatchEvent(new CustomEvent('test', { detail: this.data, bubbles: true, composed: true }));
    }
  }

  private _onStar(e: Event) {
    e.stopPropagation();
    if (this.data) {
      this.dispatchEvent(new CustomEvent('star', { detail: this.data, bubbles: true, composed: true }));
    }
  }

  render() {
    if (!this.data) return nothing;

    const { selector, format, score, warnings } = this.data;
    const scoreClass = this._scoreClass(score);
    const formatLabel = FORMAT_LABEL[format] ?? format.toUpperCase();
    const formatBadgeClass = FORMAT_BADGE_CLASS[format] ?? '';

    return html`
      <div class="row" @click=${this._onRowClick} title="Click to copy">
        <span class="score-badge ${scoreClass}">${score}</span>
        <span class="badge ${formatBadgeClass}">${formatLabel}</span>
        <span class="selector-text">${selector}</span>
        ${this.status !== 'normal' && this.statusText
          ? html`<span class="status-badge status-${this.status}">${this.statusText}</span>`
          : nothing}
        <div class="actions">
          <button class="action-btn" title="Test on page" @click=${this._onTest}>▶</button>
          <button
            class="action-btn ${this.starred ? 'starred' : ''}"
            title="${this.starred ? 'Remove from favorites' : 'Add to favorites'}"
            @click=${this._onStar}
          >★</button>
        </div>
      </div>
      ${warnings && warnings.length > 0
        ? warnings.map(
            (w) => html`
              <div class="warning-row">
                <span>⚠</span>
                <span>${w}</span>
              </div>
            `,
          )
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'selector-card': SelectorCard;
  }
}
