import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('selekt-toast')
export class SelektToast extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s, transform 0.2s;
      z-index: 1000;
    }

    :host([visible]) {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
      pointer-events: auto;
    }

    .toast {
      background: var(--bg-tertiary, #18181b);
      color: var(--text-primary, #fafafa);
      border: 1px solid var(--border, #27272a);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
  `;

  @property({ type: Boolean, reflect: true })
  visible = false;

  private _timer: ReturnType<typeof setTimeout> | null = null;

  show(message: string, duration = 2000) {
    this._message = message;
    this.visible = true;
    this.requestUpdate();

    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this.visible = false;
    }, duration);
  }

  private _message = '';

  render() {
    return html`<div class="toast">${this._message}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'selekt-toast': SelektToast;
  }
}
