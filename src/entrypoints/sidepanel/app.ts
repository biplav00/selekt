import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { checkConnection } from './services/messaging.js';
import {
  type Settings,
  loadSettings,
  migrateHistoryToWorkspace,
  saveSettings,
} from './services/storage.js';
import { sharedStyles } from './styles/shared.js';
import { themeStyles } from './styles/theme.js';
import './components/build-tab.js';
import './components/pick-tab.js';
import './components/toast.js';
import './components/workspace-tab.js';
import type { SelektToast } from './components/toast.js';

type Tab = 'pick' | 'build' | 'workspace';

@customElement('selekt-app')
export class SelektApp extends LitElement {
  static styles = [
    themeStyles,
    sharedStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
        overflow: hidden;
        position: relative;
      }

      /* ── Header ── */
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 12px;
        height: 44px;
        border-bottom: 1px solid var(--border);
        background: var(--bg-secondary);
        flex-shrink: 0;
      }

      .logo-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .logo-icon {
        width: 24px;
        height: 24px;
        background: var(--accent);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .logo-icon svg {
        width: 14px;
        height: 14px;
      }

      .logo-text {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: var(--text-primary);
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 2px;
      }

      .header-btn {
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        color: var(--text-secondary);
        transition: background 0.15s, color 0.15s;
        flex-shrink: 0;
      }

      .header-btn:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
      }

      .header-btn svg {
        width: 16px;
        height: 16px;
      }

      /* ── Connection bar ── */
      .connection-bar {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        font-size: 11px;
        color: var(--text-tertiary);
        background: var(--bg-primary);
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
      }

      .connection-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--error);
        flex-shrink: 0;
      }

      .connection-dot.connected {
        background: var(--success);
      }

      /* ── Tab navigation ── */
      .tab-bar {
        display: flex;
        align-items: center;
        padding: 8px 10px;
        gap: 4px;
        background: var(--bg-primary);
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
      }

      .tab-pill {
        flex: 1;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-secondary);
        background: transparent;
        transition: background 0.15s, color 0.15s;
        text-align: center;
      }

      .tab-pill:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
      }

      .tab-pill.active {
        background: var(--accent);
        color: #fff;
      }

      /* ── Tab content ── */
      .tab-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px 12px;
        color: var(--text-secondary);
        font-size: 12px;
      }
    `,
  ];

  @state() private _activeTab: Tab = 'pick';
  @state() private _settings: Settings = {
    defaultFormat: 'xpath',
    historyLimit: 50,
    theme: 'dark',
  };
  @state() private _connected = false;

  override connectedCallback() {
    super.connectedCallback();
    this._init();
  }

  private async _init() {
    await migrateHistoryToWorkspace();
    this._settings = await loadSettings();
    this._applyTheme();
    await this._checkConnection();
  }

  private _applyTheme() {
    const { theme } = this._settings;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setAttribute('theme', prefersDark ? 'dark' : 'light');
    } else {
      this.setAttribute('theme', theme);
    }
  }

  private async _checkConnection() {
    const status = await checkConnection();
    this._connected = status === 'connected';
  }

  private async _cycleTheme() {
    const order: Array<Settings['theme']> = ['dark', 'light', 'system'];
    const idx = order.indexOf(this._settings.theme);
    const next = order[(idx + 1) % order.length];
    this._settings = { ...this._settings, theme: next };
    await saveSettings({ theme: next });
    this._applyTheme();
    this._showToast(`Theme: ${next}`);
  }

  private async _switchTab(tab: Tab) {
    this._activeTab = tab;
    await this._checkConnection();
  }

  private _showToast(message: string) {
    const toast = this.shadowRoot?.querySelector<SelektToast>('selekt-toast');
    toast?.show(message);
  }

  private _renderThemeIcon() {
    const { theme } = this._settings;
    if (theme === 'dark') {
      return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>`;
    }
    if (theme === 'light') {
      return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/>
        <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>`;
    }
    // system
    return html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>`;
  }

  private _renderTabContent() {
    switch (this._activeTab) {
      case 'pick':
        return html`<pick-tab
          .historyLimit=${this._settings.historyLimit}
          @toast=${(e: CustomEvent) => this._showToast(e.detail)}
        ></pick-tab>`;
      case 'build':
        return html`<build-tab @toast=${(e: CustomEvent) => this._showToast(e.detail)}></build-tab>`;
      case 'workspace':
        return html`<workspace-tab @toast=${(e: CustomEvent) => this._showToast(e.detail)}></workspace-tab>`;
    }
  }

  override render() {
    return html`
      <header class="header">
        <div class="logo-group">
          <div class="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <span class="logo-text">SELEKT</span>
        </div>
        <div class="header-actions">
          <button
            type="button"
            class="header-btn"
            title="Cycle theme (${this._settings.theme})"
            aria-label="Cycle theme"
            @click=${this._cycleTheme}
          >
            ${this._renderThemeIcon()}
          </button>
          <button
            type="button"
            class="header-btn"
            title="Settings"
            aria-label="Open settings"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </header>

      <div class="connection-bar">
        <span class="connection-dot ${this._connected ? 'connected' : ''}"></span>
        <span>${this._connected ? 'Connected' : 'No page'}</span>
      </div>

      <nav class="tab-bar" role="tablist" aria-label="Main navigation">
        <button
          type="button"
          role="tab"
          class="tab-pill ${this._activeTab === 'pick' ? 'active' : ''}"
          aria-selected=${this._activeTab === 'pick'}
          @click=${() => this._switchTab('pick')}
        >Pick</button>
        <button
          type="button"
          role="tab"
          class="tab-pill ${this._activeTab === 'build' ? 'active' : ''}"
          aria-selected=${this._activeTab === 'build'}
          @click=${() => this._switchTab('build')}
        >Build</button>
        <button
          type="button"
          role="tab"
          class="tab-pill ${this._activeTab === 'workspace' ? 'active' : ''}"
          aria-selected=${this._activeTab === 'workspace'}
          @click=${() => this._switchTab('workspace')}
        >Workspace</button>
      </nav>

      <div class="tab-content" role="tabpanel">
        ${this._renderTabContent()}
      </div>

      <selekt-toast></selekt-toast>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'selekt-app': SelektApp;
  }
}
