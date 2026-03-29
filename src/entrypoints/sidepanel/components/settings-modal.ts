import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Settings } from '../services/storage.js';
import { sharedStyles } from '../styles/shared.js';

@customElement('settings-modal')
export class SettingsModal extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: contents;
      }

      .overlay {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 500;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
      }

      :host([open]) .overlay {
        display: flex;
      }

      .card {
        background: var(--bg-secondary, #111114);
        border: 1px solid var(--border, #27272a);
        border-radius: 12px;
        width: 320px;
        max-width: calc(100vw - 32px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        overflow: hidden;
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid var(--border, #27272a);
      }

      .modal-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary, #fafafa);
      }

      .close-btn {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        color: var(--text-secondary, #a1a1aa);
        transition: background 0.15s, color 0.15s;
        flex-shrink: 0;
      }

      .close-btn:hover {
        background: var(--bg-tertiary, #18181b);
        color: var(--text-primary, #fafafa);
      }

      .close-btn svg {
        width: 14px;
        height: 14px;
      }

      .modal-body {
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .field-label {
        font-size: 11px;
        font-weight: 500;
        color: var(--text-secondary, #a1a1aa);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      select {
        width: 100%;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 10px center;
        padding-right: 30px;
        cursor: pointer;
      }

      .modal-footer {
        padding: 12px 16px;
        border-top: 1px solid var(--border, #27272a);
        display: flex;
        justify-content: flex-end;
      }

      .btn-primary {
        padding: 7px 16px;
        font-size: 12px;
      }
    `,
  ];

  @property({ type: Boolean, reflect: true })
  open = false;

  @property({ type: Object })
  settings: Settings = {
    defaultFormat: 'xpath',
    historyLimit: 50,
    theme: 'dark',
  };

  // Local draft state
  private _draft: Settings = { ...this.settings };

  override willUpdate(changed: Map<string, unknown>) {
    if (changed.has('settings') || (changed.has('open') && this.open)) {
      this._draft = { ...this.settings };
    }
  }

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener('keydown', this._onKeyDown);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('keydown', this._onKeyDown);
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    if (!this.open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this._close();
    }
    if (e.key === 'Tab') {
      this._trapFocus(e);
    }
  };

  private _trapFocus(e: KeyboardEvent) {
    const card = this.shadowRoot?.querySelector<HTMLElement>('.card');
    if (!card) return;
    const focusable = Array.from(
      card.querySelectorAll<HTMLElement>('button, select, input, [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => !el.hasAttribute('disabled'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first || this.shadowRoot?.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last || this.shadowRoot?.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  private _onOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('overlay')) {
      this._close();
    }
  }

  private _close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private _save() {
    this.dispatchEvent(
      new CustomEvent('settings-changed', {
        detail: { ...this._draft },
        bubbles: true,
        composed: true,
      }),
    );
    this._close();
  }

  private _onFormatChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value as Settings['defaultFormat'];
    this._draft = { ...this._draft, defaultFormat: val };
  }

  private _onHistoryChange(e: Event) {
    const val = Number((e.target as HTMLSelectElement).value) as Settings['historyLimit'];
    this._draft = { ...this._draft, historyLimit: val };
  }

  override render() {
    return html`
      <div class="overlay" @click=${this._onOverlayClick} role="dialog" aria-modal="true" aria-label="Settings">
        <div class="card">
          <div class="modal-header">
            <span class="modal-title">Settings</span>
            <button type="button" class="close-btn" aria-label="Close settings" @click=${this._close}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="field">
              <label class="field-label" for="fmt-select">Default format</label>
              <select id="fmt-select" .value=${this._draft.defaultFormat} @change=${this._onFormatChange}>
                <option value="css">CSS</option>
                <option value="xpath">XPath</option>
                <option value="playwright">Playwright</option>
                <option value="cypress">Cypress</option>
                <option value="selenium">Selenium</option>
              </select>
            </div>

            <div class="field">
              <label class="field-label" for="history-select">History limit</label>
              <select id="history-select" .value=${String(this._draft.historyLimit)} @change=${this._onHistoryChange}>
                <option value="25">25 items</option>
                <option value="50">50 items</option>
                <option value="100">100 items</option>
                <option value="200">200 items</option>
              </select>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn-primary" @click=${this._save}>Save</button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'settings-modal': SettingsModal;
  }
}
