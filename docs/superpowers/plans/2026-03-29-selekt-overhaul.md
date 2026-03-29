# Selekt Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the Selekt Chrome extension with Lit components, intelligent selector ranking/fragility analysis, redesigned Pick tab, enhanced Build tab, new Workspace tab, and page change detection.

**Architecture:** Incremental migration of the 2100-line vanilla TS sidepanel to Lit Web Components with a services layer. Content script and background script stay vanilla. Each phase produces a working extension.

**Tech Stack:** Lit, TypeScript, WXT, Chrome Extension APIs, Biome

---

## Phase 1 — Foundation

### Task 1: Install Lit and configure WXT

**Files:**
- Modify: `package.json`
- Modify: `wxt.config.ts`

- [ ] **Step 1: Install Lit**

```bash
npm install lit
```

- [ ] **Step 2: Verify WXT builds with Lit**

```bash
npm run build
```

Expected: Build succeeds. WXT uses Vite under the hood, which handles Lit's tagged template literals natively. No additional config needed.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add Lit dependency for sidepanel component migration"
```

---

### Task 2: Create shared types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Extend types with new interfaces**

Add the following to `src/types.ts` (keep all existing interfaces):

```typescript
// --- Selector Intelligence ---

export type SelectorFormat = 'css' | 'xpath' | 'playwright' | 'cypress' | 'selenium';

export interface ScoredSelector {
  selector: string;
  format: SelectorFormat;
  score: number;
  warnings: string[];
}

export interface RichElementData {
  tagName: string;
  text: string;
  attributes: Record<string, string>;
  parentChain: Array<{ tag: string; id: string; classes: string[] }>;
  siblingTags: string[];
  accessibleName: string;
}

// --- Workspace ---

export interface SavedSelector {
  id: string;
  selector: string;
  format: SelectorFormat;
  score: number;
  warnings: string[];
  pageUrl: string;
  elementTag: string;
  createdAt: number;
}

export interface WorkspaceData {
  favorites: SavedSelector[];
  recent: SavedSelector[];
}

// --- DOM Monitoring ---

export interface WatchedSelector {
  id: string;
  selector: string;
  type: 'css' | 'xpath';
}

export interface SelectorStatusChange {
  id: string;
  oldCount: number;
  newCount: number;
}

// --- Messages ---

export type MessageType =
  | 'PING'
  | 'START_PICKING'
  | 'STOP_PICKING'
  | 'ELEMENT_SELECTED'
  | 'PICKING_CANCELLED'
  | 'TEST_SELECTOR'
  | 'CLEAR_HIGHLIGHTS'
  | 'GET_DOM_TREE'
  | 'GET_DOM_CHILDREN'
  | 'HIGHLIGHT_ELEMENT'
  | 'CLEAR_HIGHLIGHT'
  | 'GET_RICH_ELEMENT_DATA'
  | 'WATCH_SELECTORS'
  | 'UNWATCH_SELECTORS'
  | 'SELECTOR_STATUS_CHANGED';
```

- [ ] **Step 2: Verify lint passes**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add types for selector intelligence, workspace, and DOM monitoring"
```

---

### Task 3: Create theme system

**Files:**
- Create: `src/entrypoints/sidepanel/styles/theme.ts`

- [ ] **Step 1: Create theme CSS as Lit CSS**

```typescript
import { css } from 'lit';

export const themeStyles = css`
  :host {
    /* Dark theme (default) */
    --bg-primary: #09090b;
    --bg-secondary: #111114;
    --bg-tertiary: #18181b;
    --border: #27272a;
    --text-primary: #fafafa;
    --text-secondary: #a1a1aa;
    --text-tertiary: #8b8b93;
    --accent: #3b82f6;
    --accent-hover: #2563eb;
    --success: #22c55e;
    --warning: #eab308;
    --error: #ef4444;

    /* Format badge colors */
    --badge-css: #3b82f6;
    --badge-xpath: #f97316;
    --badge-pw: #8b5cf6;
    --badge-cy: #22c55e;
    --badge-se: #06b6d4;

    /* Score colors */
    --score-good: #22c55e;
    --score-medium: #eab308;
    --score-poor: #ef4444;

    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    font-size: 13px;
    color: var(--text-primary);
    background: var(--bg-primary);
  }

  :host([theme='light']) {
    --bg-primary: #ffffff;
    --bg-secondary: #f4f4f5;
    --bg-tertiary: #e4e4e7;
    --border: #e4e4e7;
    --text-primary: #09090b;
    --text-secondary: #3f3f46;
    --text-tertiary: #71717a;
    --accent: #2563eb;
    --accent-hover: #1d4ed8;
    --success: #16a34a;
    --warning: #ca8a04;
    --error: #dc2626;

    --badge-css: #2563eb;
    --badge-xpath: #ea580c;
    --badge-pw: #7c3aed;
    --badge-cy: #16a34a;
    --badge-se: #0891b2;

    --score-good: #16a34a;
    --score-medium: #ca8a04;
    --score-poor: #dc2626;
  }
`;
```

- [ ] **Step 2: Commit**

```bash
git add src/entrypoints/sidepanel/styles/theme.ts
git commit -m "feat: create Lit theme system with dark/light CSS custom properties"
```

---

### Task 4: Create shared styles

**Files:**
- Create: `src/entrypoints/sidepanel/styles/shared.ts`

- [ ] **Step 1: Create shared component CSS**

```typescript
import { css } from 'lit';

export const sharedStyles = css`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  button {
    cursor: pointer;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
  }

  .card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .badge-css { background: color-mix(in srgb, var(--badge-css) 15%, transparent); color: var(--badge-css); }
  .badge-xpath { background: color-mix(in srgb, var(--badge-xpath) 15%, transparent); color: var(--badge-xpath); }
  .badge-pw { background: color-mix(in srgb, var(--badge-pw) 15%, transparent); color: var(--badge-pw); }
  .badge-cy { background: color-mix(in srgb, var(--badge-cy) 15%, transparent); color: var(--badge-cy); }
  .badge-se { background: color-mix(in srgb, var(--badge-se) 15%, transparent); color: var(--badge-se); }

  .score-badge {
    display: inline-flex;
    align-items: center;
    padding: 1px 4px;
    border-radius: 2px;
    font-size: 9px;
    font-weight: 700;
  }

  .score-good { background: color-mix(in srgb, var(--score-good) 12%, transparent); color: var(--score-good); }
  .score-medium { background: color-mix(in srgb, var(--score-medium) 12%, transparent); color: var(--score-medium); }
  .score-poor { background: color-mix(in srgb, var(--score-poor) 12%, transparent); color: var(--score-poor); }

  .mono {
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 11px;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--accent);
    color: #fff;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    transition: background 0.15s;
  }

  .btn-primary:hover {
    background: var(--accent-hover);
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    transition: background 0.15s;
  }

  .btn-secondary:hover {
    background: var(--border);
  }

  .warning-text {
    color: var(--warning);
    font-size: 10px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  input[type="text"],
  textarea,
  select {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    padding: 6px 10px;
    font-size: 12px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
  }

  input[type="text"]:focus,
  textarea:focus,
  select:focus {
    border-color: var(--accent);
  }
`;
```

- [ ] **Step 2: Commit**

```bash
git add src/entrypoints/sidepanel/styles/shared.ts
git commit -m "feat: create shared Lit CSS for badges, buttons, inputs, and cards"
```

---

### Task 5: Create messaging service

**Files:**
- Create: `src/entrypoints/sidepanel/services/messaging.ts`

- [ ] **Step 1: Create messaging abstraction**

This wraps Chrome messaging so components don't call Chrome APIs directly. Extract the `sendToTab` pattern from the existing `main.ts:47-59`.

```typescript
import { ensureContentScript } from '@/utils/content-script';
import type { WatchedSelector } from '@/types';

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('about:')) {
    throw new Error('Cannot access Chrome pages');
  }
  return tab;
}

export async function sendToTab(message: Record<string, unknown>): Promise<any> {
  const tab = await getActiveTab();
  const ready = await ensureContentScript(tab.id!);
  if (!ready) throw new Error('Cannot inject content script');
  return chrome.tabs.sendMessage(tab.id!, message);
}

export async function startPicking(): Promise<void> {
  await sendToTab({ type: 'START_PICKING' });
}

export async function stopPicking(): Promise<void> {
  await sendToTab({ type: 'STOP_PICKING' });
}

export async function testSelector(
  selector: string,
  selectorType: string = 'css'
): Promise<void> {
  await sendToTab({ type: 'TEST_SELECTOR', selector, selectorType });
}

export async function clearHighlights(): Promise<void> {
  await sendToTab({ type: 'CLEAR_HIGHLIGHTS' });
}

export async function getDomTree(): Promise<any> {
  const response = await sendToTab({ type: 'GET_DOM_TREE' });
  return response?.tree ?? null;
}

export async function getDomChildren(path: number[]): Promise<any[]> {
  const response = await sendToTab({ type: 'GET_DOM_CHILDREN', path });
  return response?.children ?? [];
}

export async function highlightElement(path: number[]): Promise<void> {
  await sendToTab({ type: 'HIGHLIGHT_ELEMENT', path });
}

export async function clearHighlight(): Promise<void> {
  await sendToTab({ type: 'CLEAR_HIGHLIGHT' });
}

export async function getRichElementData(path: number[]): Promise<any> {
  const response = await sendToTab({ type: 'GET_RICH_ELEMENT_DATA', path });
  return response?.data ?? null;
}

export async function watchSelectors(selectors: WatchedSelector[]): Promise<void> {
  await sendToTab({ type: 'WATCH_SELECTORS', selectors });
}

export async function unwatchSelectors(ids: string[]): Promise<void> {
  await sendToTab({ type: 'UNWATCH_SELECTORS', ids });
}

export async function countMatches(
  selector: string,
  selectorType: string = 'css'
): Promise<number> {
  const tab = await getActiveTab();
  const result = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: (sel: string, selType: string) => {
      try {
        if (selType === 'xpath') {
          const xpathResult = document.evaluate(
            sel, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
          );
          return xpathResult.snapshotLength;
        }
        return document.querySelectorAll(sel).length;
      } catch {
        return -1;
      }
    },
    args: [selector, selectorType],
  });
  return result?.[0]?.result ?? -1;
}

export async function fetchPageSuggestions(): Promise<Record<string, Array<{ type: string; label: string; code: string }>> | null> {
  try {
    const tab = await getActiveTab();
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id! },
      func: () => {
        const MAX_PER_CATEGORY = 50;
        const suggestions: Record<string, Array<{ type: string; label: string; code: string }>> = {
          id: [], class: [], testid: [], role: [],
        };

        const idEls = document.querySelectorAll('[id]');
        for (let i = 0; i < idEls.length && suggestions.id.length < MAX_PER_CATEGORY; i++) {
          const el = idEls[i];
          if (el.id && !el.id.includes(' ') && el.id.length < 50) {
            suggestions.id.push({ type: 'ID', label: `#${el.id}`, code: `#${el.id}` });
          }
        }

        document.querySelectorAll('[data-testid]').forEach((el) => {
          if (suggestions.testid.length >= MAX_PER_CATEGORY) return;
          const val = el.getAttribute('data-testid');
          if (val) suggestions.testid.push({ type: 'testid', label: `[data-testid="${val}"]`, code: `[data-testid="${val}"]` });
        });

        document.querySelectorAll('[data-test]').forEach((el) => {
          if (suggestions.testid.length >= MAX_PER_CATEGORY) return;
          const val = el.getAttribute('data-test');
          if (val) suggestions.testid.push({ type: 'testid', label: `[data-test="${val}"]`, code: `[data-test="${val}"]` });
        });

        const seen = new Set<string>();
        const classEls = document.querySelectorAll('[class]');
        for (let i = 0; i < classEls.length && suggestions.class.length < MAX_PER_CATEGORY; i++) {
          const cn = classEls[i].className;
          if (typeof cn === 'string') {
            cn.split(' ').filter((c) => c && c.length < 30 && !seen.has(c)).slice(0, 2).forEach((c) => {
              if (suggestions.class.length >= MAX_PER_CATEGORY) return;
              seen.add(c);
              suggestions.class.push({ type: 'class', label: `.${c}`, code: `.${c}` });
            });
          }
        }

        const roles = new Set<string>();
        document.querySelectorAll('[role]').forEach((el) => {
          if (roles.size >= MAX_PER_CATEGORY) return;
          const role = el.getAttribute('role');
          if (role && !roles.has(role)) {
            roles.add(role);
            suggestions.role.push({ type: 'role', label: `[role="${role}"]`, code: `[role="${role}"]` });
          }
        });

        return suggestions;
      },
    });
    return result[0].result;
  } catch {
    return null;
  }
}

export function onElementSelected(callback: (element: any) => void): void {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'ELEMENT_SELECTED') callback(message.element);
  });
}

export function onPickingCancelled(callback: () => void): void {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PICKING_CANCELLED') callback();
  });
}

export function onSelectorStatusChanged(
  callback: (change: { id: string; oldCount: number; newCount: number }) => void
): void {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SELECTOR_STATUS_CHANGED') callback(message);
  });
}

export async function checkConnection(): Promise<'connected' | 'no-page'> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('about:')) {
      return 'connected';
    }
    return 'no-page';
  } catch {
    return 'no-page';
  }
}
```

- [ ] **Step 2: Verify lint passes**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/entrypoints/sidepanel/services/messaging.ts
git commit -m "feat: create messaging service abstracting Chrome extension APIs"
```

---

### Task 6: Create storage service

**Files:**
- Create: `src/entrypoints/sidepanel/services/storage.ts`

- [ ] **Step 1: Create storage abstraction**

Wraps `chrome.storage.local` for settings, workspace, and history data.

```typescript
import type { WorkspaceData, SavedSelector, SelectorFormat } from '@/types';

export interface Settings {
  defaultFormat: SelectorFormat;
  historyLimit: number;
  theme: 'dark' | 'light' | 'system';
}

const DEFAULT_SETTINGS: Settings = {
  defaultFormat: 'xpath',
  historyLimit: 50,
  theme: 'dark',
};

export async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(['defaultFormat', 'historyLimit', 'theme']);
  return {
    defaultFormat: result.defaultFormat || DEFAULT_SETTINGS.defaultFormat,
    historyLimit: result.historyLimit || DEFAULT_SETTINGS.historyLimit,
    theme: result.theme || DEFAULT_SETTINGS.theme,
  };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(settings);
}

export async function loadWorkspace(): Promise<WorkspaceData> {
  const result = await chrome.storage.local.get('workspace');
  return result.workspace || { favorites: [], recent: [] };
}

export async function saveWorkspace(data: WorkspaceData): Promise<void> {
  await chrome.storage.local.set({ workspace: data });
}

export async function addFavorite(selector: SavedSelector): Promise<WorkspaceData> {
  const data = await loadWorkspace();
  // Avoid duplicates by selector + format
  const exists = data.favorites.some(
    (f) => f.selector === selector.selector && f.format === selector.format
  );
  if (!exists) {
    data.favorites.unshift(selector);
    await saveWorkspace(data);
  }
  return data;
}

export async function removeFavorite(id: string): Promise<WorkspaceData> {
  const data = await loadWorkspace();
  data.favorites = data.favorites.filter((f) => f.id !== id);
  await saveWorkspace(data);
  return data;
}

export async function addRecent(
  selector: SavedSelector,
  limit: number
): Promise<WorkspaceData> {
  const data = await loadWorkspace();
  data.recent.unshift(selector);
  if (data.recent.length > limit) {
    data.recent = data.recent.slice(0, limit);
  }
  await saveWorkspace(data);
  return data;
}

export async function clearRecent(): Promise<WorkspaceData> {
  const data = await loadWorkspace();
  data.recent = [];
  await saveWorkspace(data);
  return data;
}

// Migration: convert old history format to workspace recent
export async function migrateHistoryToWorkspace(): Promise<void> {
  const result = await chrome.storage.local.get(['locatorHistory', 'workspace']);
  if (result.locatorHistory && !result.workspace) {
    const history = result.locatorHistory as Array<{
      id: string;
      timestamp: number;
      element: { tagName: string; attributes: Record<string, string> };
      locators: Record<string, string>;
    }>;

    const recent: SavedSelector[] = history.map((item) => ({
      id: item.id,
      selector: item.locators.css || '',
      format: 'css' as const,
      score: 0, // legacy items get no score
      warnings: [],
      pageUrl: '',
      elementTag: item.element.tagName,
      createdAt: item.timestamp,
    }));

    const workspace: WorkspaceData = { favorites: [], recent };
    await chrome.storage.local.set({ workspace });
  }
}
```

- [ ] **Step 2: Verify lint passes**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/entrypoints/sidepanel/services/storage.ts
git commit -m "feat: create storage service for settings, workspace, and history migration"
```

---

### Task 7: Create toast component

**Files:**
- Create: `src/entrypoints/sidepanel/components/toast.ts`

- [ ] **Step 1: Create the toast Lit component**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/entrypoints/sidepanel/components/toast.ts
git commit -m "feat: create toast notification Lit component"
```

---

### Task 8: Create app shell with tab navigation

**Files:**
- Create: `src/entrypoints/sidepanel/app.ts`
- Modify: `src/entrypoints/sidepanel/index.html`
- Modify: `src/entrypoints/sidepanel/main.ts`

- [ ] **Step 1: Create the app shell component**

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { themeStyles } from './styles/theme.js';
import { sharedStyles } from './styles/shared.js';
import { loadSettings, saveSettings, type Settings } from './services/storage.js';
import { checkConnection } from './services/messaging.js';
import './components/toast.js';

type TabName = 'pick' | 'build' | 'workspace';

@customElement('selekt-app')
export class SelektApp extends LitElement {
  static styles = [
    themeStyles,
    sharedStyles,
    css`
      :host {
        display: block;
        height: 100vh;
        overflow: hidden;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border-bottom: 1px solid var(--border);
      }

      .logo-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .logo-icon {
        width: 22px;
        height: 22px;
        background: var(--accent);
        border-radius: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .logo-icon svg {
        width: 14px;
        height: 14px;
      }

      .logo-text {
        font-weight: 700;
        font-size: 13px;
        letter-spacing: 1.5px;
      }

      .header-actions {
        display: flex;
        gap: 4px;
      }

      .header-btn {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        color: var(--text-tertiary);
        transition: color 0.15s, background 0.15s;
      }

      .header-btn:hover {
        color: var(--text-primary);
        background: var(--bg-secondary);
      }

      .header-btn svg {
        width: 16px;
        height: 16px;
      }

      .tabs {
        display: flex;
        gap: 4px;
        padding: 6px 12px;
        background: var(--bg-secondary);
        margin: 8px 12px;
        border-radius: 8px;
      }

      .tab {
        flex: 1;
        text-align: center;
        padding: 6px 0;
        font-size: 11px;
        font-weight: 500;
        color: var(--text-tertiary);
        border-radius: 6px;
        transition: all 0.15s;
      }

      .tab:hover {
        color: var(--text-secondary);
      }

      .tab[aria-selected='true'] {
        background: var(--accent);
        color: #fff;
      }

      .tab-content {
        flex: 1;
        overflow-y: auto;
        padding: 0 12px 12px;
      }

      .connection-status {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        font-size: 10px;
        color: var(--text-tertiary);
      }

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--success);
      }

      .status-dot.disconnected {
        background: var(--text-tertiary);
      }
    `,
  ];

  @state() private _activeTab: TabName = 'pick';
  @state() private _settings: Settings = { defaultFormat: 'xpath', historyLimit: 50, theme: 'dark' };
  @state() private _connected = false;

  async connectedCallback() {
    super.connectedCallback();
    this._settings = await loadSettings();
    this._applyTheme(this._settings.theme);
    const status = await checkConnection();
    this._connected = status === 'connected';

    chrome.tabs.onActivated.addListener(() => this._checkConnection());
    chrome.tabs.onUpdated.addListener(() => this._checkConnection());
  }

  private async _checkConnection() {
    const status = await checkConnection();
    this._connected = status === 'connected';
  }

  private _applyTheme(theme: string) {
    let effective = theme;
    if (theme === 'system') {
      effective = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    this.setAttribute('theme', effective);
  }

  private _cycleTheme() {
    const order: Array<'dark' | 'light' | 'system'> = ['dark', 'light', 'system'];
    const nextIndex = (order.indexOf(this._settings.theme) + 1) % order.length;
    this._settings = { ...this._settings, theme: order[nextIndex] };
    this._applyTheme(this._settings.theme);
    saveSettings({ theme: this._settings.theme });
    this._showToast(`Theme: ${this._settings.theme.charAt(0).toUpperCase() + this._settings.theme.slice(1)}`);
  }

  private _switchTab(tab: TabName) {
    this._activeTab = tab;
  }

  private _showToast(message: string) {
    const toast = this.shadowRoot?.querySelector('selekt-toast');
    if (toast) (toast as any).show(message);
  }

  render() {
    return html`
      <div class="header">
        <div class="logo-group">
          <div class="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
              <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <span class="logo-text">SELEKT</span>
        </div>
        <div class="header-actions">
          <button class="header-btn" @click=${this._cycleTheme} title="Toggle theme">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>
          <button class="header-btn" title="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="connection-status">
        <span class="status-dot ${this._connected ? '' : 'disconnected'}"></span>
        ${this._connected ? 'Connected' : 'No page'}
      </div>

      <div class="tabs" role="tablist">
        ${(['pick', 'build', 'workspace'] as TabName[]).map(
          (tab) => html`
            <button
              class="tab"
              role="tab"
              aria-selected=${this._activeTab === tab}
              tabindex=${this._activeTab === tab ? 0 : -1}
              @click=${() => this._switchTab(tab)}
            >
              ${tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          `
        )}
      </div>

      <div class="tab-content">
        ${this._activeTab === 'pick' ? html`<div>Pick tab placeholder</div>` : ''}
        ${this._activeTab === 'build' ? html`<div>Build tab placeholder</div>` : ''}
        ${this._activeTab === 'workspace' ? html`<div>Workspace tab placeholder</div>` : ''}
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
```

- [ ] **Step 2: Replace index.html with minimal shell**

Replace the entire `index.html` with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Selekt</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #09090b; }
  </style>
</head>
<body>
  <selekt-app></selekt-app>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

- [ ] **Step 3: Replace main.ts with bootstrap**

Replace the entire `main.ts` with:

```typescript
import './app.js';
```

- [ ] **Step 4: Remove old styles.css**

Delete `src/entrypoints/sidepanel/styles.css` — styles are now in Lit CSS.

```bash
rm src/entrypoints/sidepanel/styles.css
```

- [ ] **Step 5: Verify extension builds and loads**

```bash
npm run build
```

Expected: Build succeeds. The sidepanel should show the header, tabs, connection status, and placeholder content for each tab.

- [ ] **Step 6: Commit**

```bash
git add src/entrypoints/sidepanel/app.ts src/entrypoints/sidepanel/index.html src/entrypoints/sidepanel/main.ts
git rm src/entrypoints/sidepanel/styles.css
git commit -m "feat: create Lit app shell with header, tab navigation, and theme toggle"
```

---

## Phase 2 — Selector Engine + Pick Tab

### Task 9: Create selector engine — scoring and fragility analysis

**Files:**
- Create: `src/entrypoints/sidepanel/services/selector-engine.ts`

- [ ] **Step 1: Create the selector engine**

This is the core intelligence layer. It generates multiple selector strategies from element data and scores each one.

```typescript
import type { RichElementData, ScoredSelector, SelectorFormat, ElementInfo } from '@/types';

// --- Escaping utilities (migrated from old main.ts) ---

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

function escapeCssAttrValue(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeXPathValue(str: string): string {
  if (!str.includes("'")) return `'${str}'`;
  if (!str.includes('"')) return `"${str}"`;
  const parts = str.split("'").map((p) => `'${p}'`);
  return `concat(${parts.join(',"\'",')})`;
}

function escapeSingleQuoteJs(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escapeDoubleQuoteJs(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// --- Dynamic class detection ---

const DYNAMIC_CLASS_PATTERNS = [
  /^css-[a-z0-9]+$/i,        // CSS-in-JS (emotion, etc.)
  /^sc-[a-zA-Z]+$/,           // styled-components
  /^_[a-z]+_[a-z0-9]+$/,      // CSS Modules
  /^[a-z0-9]{5,8}$/,          // hash-like short classes
  /^jsx-[a-f0-9]+$/,          // styled-jsx
  /^svelte-[a-z0-9]+$/,       // Svelte
];

function isDynamicClass(cls: string): boolean {
  return DYNAMIC_CLASS_PATTERNS.some((pattern) => pattern.test(cls));
}

// --- Semantic tags ---

const SEMANTIC_TAGS = new Set([
  'button', 'a', 'input', 'select', 'textarea', 'form', 'nav', 'main',
  'header', 'footer', 'article', 'section', 'aside', 'dialog', 'table',
  'img', 'video', 'audio', 'label', 'fieldset', 'legend', 'h1', 'h2',
  'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
]);

// --- Scoring ---

interface ScoreFactors {
  hasTestId: boolean;
  hasId: boolean;
  idLooksDynamic: boolean;
  hasRole: boolean;
  hasAccessibleName: boolean;
  hasAriaLabel: boolean;
  isShort: boolean;   // few combinators (<=2)
  isSemanticTag: boolean;
  isDeepNested: boolean;  // >3 levels
  usesNthChild: boolean;
  usesDynamicClass: boolean;
  usesIndexPosition: boolean;
}

function computeScore(factors: ScoreFactors): number {
  let score = 50; // base

  if (factors.hasTestId) score += 40;
  if (factors.hasId && !factors.idLooksDynamic) score += 35;
  if (factors.hasRole && factors.hasAccessibleName) score += 30;
  if (factors.hasAriaLabel) score += 25;
  if (factors.isShort) score += 15;
  if (factors.isSemanticTag) score += 10;

  if (factors.isDeepNested) score -= 20;
  if (factors.usesNthChild) score -= 15;
  if (factors.usesDynamicClass) score -= 25;
  if (factors.usesIndexPosition) score -= 15;

  return Math.max(0, Math.min(100, score));
}

function getWarnings(factors: ScoreFactors): string[] {
  const warnings: string[] = [];
  if (factors.usesDynamicClass) warnings.push('Relies on dynamic class names that may change between builds');
  if (factors.isDeepNested) warnings.push('Deep nesting — layout changes could break this');
  if (factors.usesNthChild || factors.usesIndexPosition) warnings.push('Position-dependent — adding/removing siblings will break this');
  if (factors.hasId && factors.idLooksDynamic) warnings.push('ID appears auto-generated and may not be stable');
  return warnings;
}

// --- ID dynamic detection ---

function isIdDynamic(id: string): boolean {
  // IDs that look auto-generated: very long, contain hashes, numeric-heavy
  if (/^[a-f0-9-]{20,}$/i.test(id)) return true;
  if (/^:r[0-9]+:$/.test(id)) return true; // React useId
  if (/[0-9]{4,}/.test(id)) return true; // many consecutive digits
  return false;
}

// --- Strategy generators ---

function generateCssStrategies(tag: string, attrs: Record<string, string>): Array<{ selector: string; factors: ScoreFactors }> {
  const strategies: Array<{ selector: string; factors: ScoreFactors }> = [];
  const isSemantic = SEMANTIC_TAGS.has(tag);
  const baseFactors: ScoreFactors = {
    hasTestId: false, hasId: false, idLooksDynamic: false,
    hasRole: false, hasAccessibleName: false, hasAriaLabel: false,
    isShort: true, isSemanticTag: isSemantic,
    isDeepNested: false, usesNthChild: false,
    usesDynamicClass: false, usesIndexPosition: false,
  };

  if (attrs['data-testid']) {
    strategies.push({
      selector: `[data-testid="${escapeCssAttrValue(attrs['data-testid'])}"]`,
      factors: { ...baseFactors, hasTestId: true },
    });
  }

  if (attrs['data-test']) {
    strategies.push({
      selector: `[data-test="${escapeCssAttrValue(attrs['data-test'])}"]`,
      factors: { ...baseFactors, hasTestId: true },
    });
  }

  if (attrs.id) {
    const dynamic = isIdDynamic(attrs.id);
    strategies.push({
      selector: `#${cssEscape(attrs.id)}`,
      factors: { ...baseFactors, hasId: true, idLooksDynamic: dynamic },
    });
  }

  if (attrs['aria-label']) {
    strategies.push({
      selector: `${tag}[aria-label="${escapeCssAttrValue(attrs['aria-label'])}"]`,
      factors: { ...baseFactors, hasAriaLabel: true },
    });
  }

  if (attrs.role) {
    strategies.push({
      selector: `${tag}[role="${escapeCssAttrValue(attrs.role)}"]`,
      factors: { ...baseFactors, hasRole: true, hasAccessibleName: !!attrs['aria-label'] },
    });
  }

  if (attrs.name) {
    strategies.push({
      selector: `${tag}[name="${escapeCssAttrValue(attrs.name)}"]`,
      factors: { ...baseFactors },
    });
  }

  if (attrs.class) {
    const classes = attrs.class.split(' ').filter(Boolean);
    const nonDynamic = classes.filter((c) => !isDynamicClass(c));
    const hasDynamic = classes.length > nonDynamic.length;

    if (nonDynamic.length > 0) {
      strategies.push({
        selector: `${tag}.${cssEscape(nonDynamic[0])}`,
        factors: { ...baseFactors, usesDynamicClass: false },
      });
    }
    if (hasDynamic && classes.length > 0) {
      strategies.push({
        selector: `${tag}.${cssEscape(classes[0])}`,
        factors: { ...baseFactors, usesDynamicClass: true },
      });
    }
  }

  // Tag only fallback
  strategies.push({
    selector: tag,
    factors: { ...baseFactors, isShort: true },
  });

  return strategies;
}

function generateXpathStrategies(tag: string, attrs: Record<string, string>, text: string): Array<{ selector: string; factors: ScoreFactors }> {
  const strategies: Array<{ selector: string; factors: ScoreFactors }> = [];
  const isSemantic = SEMANTIC_TAGS.has(tag);
  const baseFactors: ScoreFactors = {
    hasTestId: false, hasId: false, idLooksDynamic: false,
    hasRole: false, hasAccessibleName: false, hasAriaLabel: false,
    isShort: true, isSemanticTag: isSemantic,
    isDeepNested: false, usesNthChild: false,
    usesDynamicClass: false, usesIndexPosition: false,
  };

  if (attrs['data-testid']) {
    strategies.push({
      selector: `//${tag}[@data-testid=${escapeXPathValue(attrs['data-testid'])}]`,
      factors: { ...baseFactors, hasTestId: true },
    });
  }

  if (attrs.id) {
    const dynamic = isIdDynamic(attrs.id);
    strategies.push({
      selector: `//${tag}[@id=${escapeXPathValue(attrs.id)}]`,
      factors: { ...baseFactors, hasId: true, idLooksDynamic: dynamic },
    });
  }

  if (attrs['aria-label']) {
    strategies.push({
      selector: `//${tag}[@aria-label=${escapeXPathValue(attrs['aria-label'])}]`,
      factors: { ...baseFactors, hasAriaLabel: true },
    });
  }

  if (text && text.length <= 30 && !text.includes('\n')) {
    strategies.push({
      selector: `//${tag}[text()=${escapeXPathValue(text)}]`,
      factors: { ...baseFactors },
    });
  }

  if (attrs.name) {
    strategies.push({
      selector: `//${tag}[@name=${escapeXPathValue(attrs.name)}]`,
      factors: { ...baseFactors },
    });
  }

  strategies.push({
    selector: `//${tag}`,
    factors: { ...baseFactors },
  });

  return strategies;
}

function generatePlaywrightStrategies(tag: string, attrs: Record<string, string>, text: string): Array<{ selector: string; factors: ScoreFactors }> {
  const strategies: Array<{ selector: string; factors: ScoreFactors }> = [];
  const isSemantic = SEMANTIC_TAGS.has(tag);
  const baseFactors: ScoreFactors = {
    hasTestId: false, hasId: false, idLooksDynamic: false,
    hasRole: false, hasAccessibleName: false, hasAriaLabel: false,
    isShort: true, isSemanticTag: isSemantic,
    isDeepNested: false, usesNthChild: false,
    usesDynamicClass: false, usesIndexPosition: false,
  };

  if (attrs['data-testid']) {
    strategies.push({
      selector: `page.getByTestId('${escapeSingleQuoteJs(attrs['data-testid'])}')`,
      factors: { ...baseFactors, hasTestId: true },
    });
  }

  if (attrs.role) {
    const name = attrs['aria-label'] || text;
    const hasName = !!name;
    const selectorText = hasName
      ? `page.getByRole('${escapeSingleQuoteJs(attrs.role)}', { name: '${escapeSingleQuoteJs(name.substring(0, 40))}' })`
      : `page.getByRole('${escapeSingleQuoteJs(attrs.role)}')`;
    strategies.push({
      selector: selectorText,
      factors: { ...baseFactors, hasRole: true, hasAccessibleName: hasName },
    });
  }

  if (attrs['aria-label']) {
    strategies.push({
      selector: `page.getByLabel('${escapeSingleQuoteJs(attrs['aria-label'])}')`,
      factors: { ...baseFactors, hasAriaLabel: true },
    });
  }

  if (attrs.placeholder) {
    strategies.push({
      selector: `page.getByPlaceholder('${escapeSingleQuoteJs(attrs.placeholder)}')`,
      factors: { ...baseFactors },
    });
  }

  if (text && text.length <= 30 && !text.includes('\n')) {
    strategies.push({
      selector: `page.getByText('${escapeSingleQuoteJs(text)}')`,
      factors: { ...baseFactors },
    });
  }

  if ((tag === 'button' || tag === 'a') && text) {
    const role = tag === 'button' ? 'button' : 'link';
    strategies.push({
      selector: `page.getByRole('${role}', { name: '${escapeSingleQuoteJs(text.substring(0, 40))}' })`,
      factors: { ...baseFactors, hasRole: true, hasAccessibleName: true, isSemanticTag: true },
    });
  }

  return strategies;
}

function generateCypressStrategies(tag: string, attrs: Record<string, string>, text: string, cssSelector: string): Array<{ selector: string; factors: ScoreFactors }> {
  const strategies: Array<{ selector: string; factors: ScoreFactors }> = [];
  const isSemantic = SEMANTIC_TAGS.has(tag);
  const baseFactors: ScoreFactors = {
    hasTestId: false, hasId: false, idLooksDynamic: false,
    hasRole: false, hasAccessibleName: false, hasAriaLabel: false,
    isShort: true, isSemanticTag: isSemantic,
    isDeepNested: false, usesNthChild: false,
    usesDynamicClass: false, usesIndexPosition: false,
  };

  if (attrs['data-testid']) {
    strategies.push({
      selector: `cy.get('[data-testid="${escapeSingleQuoteJs(escapeCssAttrValue(attrs['data-testid']))}"]')`,
      factors: { ...baseFactors, hasTestId: true },
    });
  }

  if (text && text.length <= 30 && !text.includes('\n') && (tag === 'button' || tag === 'a')) {
    strategies.push({
      selector: `cy.contains('${escapeSingleQuoteJs(tag)}', '${escapeSingleQuoteJs(text)}')`,
      factors: { ...baseFactors, isSemanticTag: true },
    });
  }

  if (cssSelector && cssSelector !== tag) {
    strategies.push({
      selector: `cy.get('${escapeSingleQuoteJs(cssSelector)}')`,
      factors: { ...baseFactors },
    });
  }

  return strategies;
}

function generateSeleniumStrategies(tag: string, attrs: Record<string, string>, cssSelector: string): Array<{ selector: string; factors: ScoreFactors }> {
  const strategies: Array<{ selector: string; factors: ScoreFactors }> = [];
  const isSemantic = SEMANTIC_TAGS.has(tag);
  const baseFactors: ScoreFactors = {
    hasTestId: false, hasId: false, idLooksDynamic: false,
    hasRole: false, hasAccessibleName: false, hasAriaLabel: false,
    isShort: true, isSemanticTag: isSemantic,
    isDeepNested: false, usesNthChild: false,
    usesDynamicClass: false, usesIndexPosition: false,
  };

  if (attrs.id) {
    const dynamic = isIdDynamic(attrs.id);
    strategies.push({
      selector: `driver.findElement(By.id("${escapeDoubleQuoteJs(attrs.id)}"))`,
      factors: { ...baseFactors, hasId: true, idLooksDynamic: dynamic },
    });
  }

  if (attrs.name) {
    strategies.push({
      selector: `driver.findElement(By.name("${escapeDoubleQuoteJs(attrs.name)}"))`,
      factors: { ...baseFactors },
    });
  }

  if (attrs.class) {
    const first = attrs.class.split(' ').filter(Boolean)[0];
    if (first) {
      strategies.push({
        selector: `driver.findElement(By.className("${escapeDoubleQuoteJs(first)}"))`,
        factors: { ...baseFactors, usesDynamicClass: isDynamicClass(first) },
      });
    }
  }

  if (cssSelector) {
    strategies.push({
      selector: `driver.findElement(By.cssSelector("${escapeDoubleQuoteJs(cssSelector)}"))`,
      factors: { ...baseFactors },
    });
  }

  return strategies;
}

// --- Main API ---

export function generateScoredSelectors(element: ElementInfo): ScoredSelector[] {
  const tag = (element.tagName || 'div').toLowerCase();
  const attrs = element.attributes || {};
  const text = element.text?.trim().substring(0, 40) || '';

  // Generate best CSS selector for cross-framework use
  const cssStrategies = generateCssStrategies(tag, attrs);
  const bestCss = cssStrategies.length > 0 ? cssStrategies[0].selector : tag;

  const allStrategies: Array<{ selector: string; format: SelectorFormat; factors: ScoreFactors }> = [];

  for (const s of cssStrategies) {
    allStrategies.push({ selector: s.selector, format: 'css', factors: s.factors });
  }
  for (const s of generateXpathStrategies(tag, attrs, text)) {
    allStrategies.push({ selector: s.selector, format: 'xpath', factors: s.factors });
  }
  for (const s of generatePlaywrightStrategies(tag, attrs, text)) {
    allStrategies.push({ selector: s.selector, format: 'playwright', factors: s.factors });
  }
  for (const s of generateCypressStrategies(tag, attrs, text, bestCss)) {
    allStrategies.push({ selector: s.selector, format: 'cypress', factors: s.factors });
  }
  for (const s of generateSeleniumStrategies(tag, attrs, bestCss)) {
    allStrategies.push({ selector: s.selector, format: 'selenium', factors: s.factors });
  }

  // Score, deduplicate, and sort
  const scored = allStrategies.map((s) => ({
    selector: s.selector,
    format: s.format,
    score: computeScore(s.factors),
    warnings: computeScore(s.factors) < 50 ? getWarnings(s.factors) : [],
  }));

  // Deduplicate by selector string
  const seen = new Set<string>();
  const unique = scored.filter((s) => {
    if (seen.has(s.selector)) return false;
    seen.add(s.selector);
    return true;
  });

  // Sort by score descending
  unique.sort((a, b) => b.score - a.score);

  return unique;
}

export function scoreSelector(selector: string, format: SelectorFormat): ScoredSelector {
  const factors: ScoreFactors = {
    hasTestId: /data-test(id)?/.test(selector),
    hasId: selector.includes('#') || /\[@id/.test(selector) || /By\.id/.test(selector),
    idLooksDynamic: false,
    hasRole: /role|getByRole/.test(selector),
    hasAccessibleName: /name:|aria-label/.test(selector),
    hasAriaLabel: /aria-label/.test(selector),
    isShort: (selector.match(/[> +~]/g) || []).length <= 2,
    isSemanticTag: false,
    isDeepNested: (selector.match(/[> ]/g) || []).length > 3,
    usesNthChild: /nth-child|nth-of-type|:nth/.test(selector),
    usesDynamicClass: false,
    usesIndexPosition: /\.nth\(|\.eq\(|\[\d+\]/.test(selector),
  };

  // Check for dynamic classes in selector
  const classMatch = selector.match(/\.([a-zA-Z_-][\w-]*)/g);
  if (classMatch) {
    factors.usesDynamicClass = classMatch.some((c) => isDynamicClass(c.slice(1)));
  }

  const score = computeScore(factors);
  return {
    selector,
    format,
    score,
    warnings: score < 50 ? getWarnings(factors) : [],
  };
}

export { isDynamicClass, escapeSingleQuoteJs, escapeDoubleQuoteJs, cssEscape, escapeCssAttrValue, escapeXPathValue };
```

- [ ] **Step 2: Verify lint passes**

```bash
npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/entrypoints/sidepanel/services/selector-engine.ts
git commit -m "feat: create selector engine with stability scoring and fragility analysis"
```

---

### Task 10: Create selector-card shared component

**Files:**
- Create: `src/entrypoints/sidepanel/components/selector-card.ts`

- [ ] **Step 1: Create the selector card component**

This is the shared component used in Pick, Build, and Workspace.

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ScoredSelector } from '@/types';
import { sharedStyles } from '../styles/shared.js';

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
        gap: 6px;
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 7px 9px;
        cursor: pointer;
        transition: background 0.15s;
      }

      .row:hover {
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
      }

      .actions {
        display: flex;
        align-items: center;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.15s;
      }

      .row:hover .actions {
        opacity: 1;
      }

      .action-btn {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        font-size: 10px;
        color: var(--text-tertiary);
        transition: background 0.15s, color 0.15s;
      }

      .action-btn:hover {
        background: var(--border);
        color: var(--text-primary);
      }

      .action-btn.star {
        color: var(--text-tertiary);
      }

      .action-btn.star.active {
        color: var(--warning);
      }

      .warning-row {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 2px 9px 4px;
        font-size: 10px;
        color: var(--warning);
      }

      .status-badge {
        font-size: 9px;
        padding: 1px 4px;
        border-radius: 2px;
        background: color-mix(in srgb, var(--accent) 15%, transparent);
        color: var(--accent);
      }
    `,
  ];

  @property({ type: Object })
  data!: ScoredSelector;

  @property({ type: Boolean })
  starred = false;

  @property({ type: String })
  status: 'normal' | 'changed' | 'broken' = 'normal';

  @property({ type: String })
  statusText = '';

  private _formatBadgeClass(format: string): string {
    const map: Record<string, string> = {
      css: 'badge-css', xpath: 'badge-xpath',
      playwright: 'badge-pw', cypress: 'badge-cy', selenium: 'badge-se',
    };
    return map[format] || 'badge-css';
  }

  private _formatLabel(format: string): string {
    const map: Record<string, string> = {
      css: 'CSS', xpath: 'XP', playwright: 'PW', cypress: 'CY', selenium: 'SE',
    };
    return map[format] || format.toUpperCase();
  }

  private _scoreClass(score: number): string {
    if (score >= 70) return 'score-good';
    if (score >= 40) return 'score-medium';
    return 'score-poor';
  }

  private async _copy() {
    await navigator.clipboard.writeText(this.data.selector);
    this.dispatchEvent(new CustomEvent('copy', { detail: this.data }));
  }

  private _test() {
    this.dispatchEvent(new CustomEvent('test', { detail: this.data }));
  }

  private _toggleStar() {
    this.dispatchEvent(new CustomEvent('star', { detail: this.data }));
  }

  render() {
    const d = this.data;
    return html`
      <div class="row" @click=${this._copy} title="Click to copy">
        <span class="score-badge ${this._scoreClass(d.score)}">${d.score}</span>
        <span class="badge ${this._formatBadgeClass(d.format)}">${this._formatLabel(d.format)}</span>
        <span class="selector-text">${d.selector}</span>
        ${this.status !== 'normal' ? html`<span class="status-badge">${this.statusText}</span>` : ''}
        <div class="actions">
          <button class="action-btn" @click=${(e: Event) => { e.stopPropagation(); this._test(); }} title="Test on page">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="8" cy="8" r="6"/><path d="M8 5v6M5 8h6"/>
            </svg>
          </button>
          <button class="action-btn star ${this.starred ? 'active' : ''}" @click=${(e: Event) => { e.stopPropagation(); this._toggleStar(); }} title="${this.starred ? 'Remove from favorites' : 'Save to workspace'}">
            ${this.starred
              ? html`<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M8 1l2.5 4.5L16 6.5l-4 3.5L13 16l-5-3-5 3 1-6L0 6.5l5.5-1z"/></svg>`
              : html`<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 1l2.5 4.5L16 6.5l-4 3.5L13 16l-5-3-5 3 1-6L0 6.5l5.5-1z"/></svg>`
            }
          </button>
        </div>
      </div>
      ${d.warnings.length > 0
        ? d.warnings.map((w) => html`<div class="warning-row">⚠ ${w}</div>`)
        : ''
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'selector-card': SelectorCard;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/entrypoints/sidepanel/components/selector-card.ts
git commit -m "feat: create selector-card Lit component with score, format badge, and actions"
```

---

### Task 11: Create pick-tab component

**Files:**
- Create: `src/entrypoints/sidepanel/components/pick-tab.ts`

- [ ] **Step 1: Create the pick tab component**

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { sharedStyles } from '../styles/shared.js';
import { generateScoredSelectors } from '../services/selector-engine.js';
import { startPicking, testSelector, onElementSelected, onPickingCancelled } from '../services/messaging.js';
import { addFavorite, addRecent, loadWorkspace } from '../services/storage.js';
import type { ElementInfo, ScoredSelector, SavedSelector } from '@/types';
import './selector-card.js';

@customElement('pick-tab')
export class PickTab extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host { display: block; }

      .pick-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px;
        background: var(--accent);
        color: #fff;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        transition: background 0.15s;
      }

      .pick-btn:hover { background: var(--accent-hover); }
      .pick-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .pick-btn.active { background: var(--warning); color: #000; }

      .pick-shortcut {
        font-size: 10px;
        opacity: 0.7;
        background: rgba(255,255,255,0.15);
        padding: 2px 6px;
        border-radius: 3px;
      }

      .element-card {
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 10px;
        margin: 10px 0;
      }

      .element-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
      }

      .tag-badge {
        background: color-mix(in srgb, var(--success) 15%, transparent);
        color: var(--success);
        padding: 1px 6px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: 600;
      }

      .element-selector {
        color: var(--text-secondary);
        font-size: 11px;
      }

      .attrs {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 6px;
      }

      .attr-chip {
        font-size: 10px;
        color: var(--text-tertiary);
        background: var(--bg-tertiary);
        padding: 1px 6px;
        border-radius: 3px;
      }

      .attr-chip .key { color: var(--accent); }

      .results-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 12px 0 6px;
        font-size: 11px;
        color: var(--text-secondary);
      }

      .show-all {
        color: var(--accent);
        font-size: 10px;
      }

      .results-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-tertiary);
        font-size: 12px;
      }

      .empty-icon {
        font-size: 32px;
        margin-bottom: 12px;
        opacity: 0.5;
      }
    `,
  ];

  @property({ type: Number })
  historyLimit = 50;

  @state() private _picking = false;
  @state() private _element: ElementInfo | null = null;
  @state() private _selectors: ScoredSelector[] = [];
  @state() private _showAll = false;
  @state() private _favoriteIds = new Set<string>();
  private _pickTimeout: ReturnType<typeof setTimeout> | null = null;

  connectedCallback() {
    super.connectedCallback();
    onElementSelected((element) => this._handleElementSelected(element));
    onPickingCancelled(() => this._resetPick());
    this._loadFavorites();
  }

  private async _loadFavorites() {
    const workspace = await loadWorkspace();
    this._favoriteIds = new Set(workspace.favorites.map((f) => f.selector));
  }

  private async _startPick() {
    this._picking = true;
    this._pickTimeout = setTimeout(() => {
      this._resetPick();
      this.dispatchEvent(new CustomEvent('toast', { detail: 'Picker timed out', bubbles: true, composed: true }));
    }, 30000);

    try {
      await startPicking();
    } catch (e) {
      this._resetPick();
      this.dispatchEvent(new CustomEvent('toast', {
        detail: e instanceof Error ? e.message : 'Cannot activate picker',
        bubbles: true, composed: true,
      }));
    }
  }

  private _resetPick() {
    this._picking = false;
    if (this._pickTimeout) {
      clearTimeout(this._pickTimeout);
      this._pickTimeout = null;
    }
  }

  private async _handleElementSelected(element: ElementInfo) {
    this._resetPick();
    this._element = element;
    this._selectors = generateScoredSelectors(element);
    this._showAll = false;

    // Auto-save top selector to recent
    if (this._selectors.length > 0) {
      const top = this._selectors[0];
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const saved: SavedSelector = {
        id: crypto.randomUUID(),
        selector: top.selector,
        format: top.format,
        score: top.score,
        warnings: top.warnings,
        pageUrl: tab?.url || '',
        elementTag: element.tagName,
        createdAt: Date.now(),
      };
      await addRecent(saved, this.historyLimit);
    }
  }

  private async _handleTest(e: CustomEvent) {
    const scored = e.detail as ScoredSelector;
    const selectorType = scored.format === 'xpath' ? 'xpath' : 'css';

    // Extract testable selector for framework-specific formats
    let testSel = scored.selector;
    if (scored.format === 'playwright') {
      const match = scored.selector.match(/page\.\w+\(['"`](.*?)['"`]/);
      if (match) testSel = match[1];
    } else if (scored.format === 'cypress') {
      const match = scored.selector.match(/cy\.\w+\(['"`](.*?)['"`]/);
      if (match) testSel = match[1];
    } else if (scored.format === 'selenium') {
      const match = scored.selector.match(/By\.\w+\(["'`](.*?)["'`]\)/);
      if (match) testSel = match[1];
    }

    try {
      await testSelector(testSel, selectorType);
      this.dispatchEvent(new CustomEvent('toast', { detail: 'Testing on page!', bubbles: true, composed: true }));
    } catch {
      this.dispatchEvent(new CustomEvent('toast', { detail: 'Cannot test on this page', bubbles: true, composed: true }));
    }
  }

  private async _handleStar(e: CustomEvent) {
    const scored = e.detail as ScoredSelector;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const saved: SavedSelector = {
      id: crypto.randomUUID(),
      selector: scored.selector,
      format: scored.format,
      score: scored.score,
      warnings: scored.warnings,
      pageUrl: tab?.url || '',
      elementTag: this._element?.tagName || '',
      createdAt: Date.now(),
    };
    await addFavorite(saved);
    this._favoriteIds = new Set([...this._favoriteIds, scored.selector]);
    this.dispatchEvent(new CustomEvent('toast', { detail: 'Saved to workspace!', bubbles: true, composed: true }));
  }

  private _handleCopy() {
    this.dispatchEvent(new CustomEvent('toast', { detail: 'Copied!', bubbles: true, composed: true }));
  }

  render() {
    if (!this._element) {
      return html`
        <button class="pick-btn ${this._picking ? 'active' : ''}"
                ?disabled=${this._picking}
                @click=${this._startPick}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M5 3a2 2 0 0 0-2 2m0 0v4m0-4h4m-4 14a2 2 0 0 0 2 2m-2-2v-4m0 4h4M19 3a2 2 0 0 1 2 2m0 0v4m0-4h-4m4 14a2 2 0 0 1-2 2m2-2v-4m0 4h-4"/>
          </svg>
          ${this._picking ? 'Picking...' : 'Pick Element'}
          <span class="pick-shortcut">${this._picking ? 'ESC' : '⌘⇧L'}</span>
        </button>
        <div class="empty-state">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
              <path d="M5 3a2 2 0 0 0-2 2m0 0v4m0-4h4m-4 14a2 2 0 0 0 2 2m-2-2v-4m0 4h4M19 3a2 2 0 0 1 2 2m0 0v4m0-4h-4m4 14a2 2 0 0 1-2 2m2-2v-4m0 4h-4"/>
            </svg>
          </div>
          Click the button or press ⌘⇧L to pick an element
        </div>
      `;
    }

    const attrs = this._element.attributes || {};
    let path = '';
    if (attrs.id) path = `#${attrs.id}`;
    else if (attrs.class) path = `.${attrs.class.split(' ').slice(0, 2).join('.')}`;

    const displayAttrs = Object.entries(attrs)
      .filter(([key]) => !['class', 'id', 'style', 'href', 'src'].includes(key))
      .slice(0, 8);

    const visible = this._showAll ? this._selectors : this._selectors.slice(0, 5);
    const hasMore = this._selectors.length > 5;

    return html`
      <button class="pick-btn ${this._picking ? 'active' : ''}"
              ?disabled=${this._picking}
              @click=${this._startPick}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M5 3a2 2 0 0 0-2 2m0 0v4m0-4h4m-4 14a2 2 0 0 0 2 2m-2-2v-4m0 4h4M19 3a2 2 0 0 1 2 2m0 0v4m0-4h-4m4 14a2 2 0 0 1-2 2m2-2v-4m0 4h-4"/>
        </svg>
        ${this._picking ? 'Picking...' : 'Pick Element'}
        <span class="pick-shortcut">${this._picking ? 'ESC' : '⌘⇧L'}</span>
      </button>

      <div class="element-card">
        <div class="element-header">
          <span class="tag-badge">&lt;${this._element.tagName}&gt;</span>
          <span class="element-selector">${path || 'no id/class'}</span>
        </div>
        ${displayAttrs.length > 0 ? html`
          <div class="attrs">
            ${displayAttrs.map(([key, val]) => html`
              <span class="attr-chip"><span class="key">${key}</span>="${(val as string).substring(0, 30)}"</span>
            `)}
          </div>
        ` : ''}
      </div>

      <div class="results-header">
        <span>${this._selectors.length} selectors ranked by stability</span>
        ${hasMore ? html`
          <button class="show-all" @click=${() => this._showAll = !this._showAll}>
            ${this._showAll ? 'Show less' : `Show all (${this._selectors.length})`}
          </button>
        ` : ''}
      </div>

      <div class="results-list">
        ${visible.map((s) => html`
          <selector-card
            .data=${s}
            .starred=${this._favoriteIds.has(s.selector)}
            @copy=${this._handleCopy}
            @test=${this._handleTest}
            @star=${this._handleStar}
          ></selector-card>
        `)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pick-tab': PickTab;
  }
}
```

- [ ] **Step 2: Wire pick-tab into the app shell**

In `src/entrypoints/sidepanel/app.ts`, add the import and replace the pick tab placeholder:

Add at the top:
```typescript
import './components/pick-tab.js';
```

Replace `${this._activeTab === 'pick' ? html`<div>Pick tab placeholder</div>` : ''}` with:
```typescript
${this._activeTab === 'pick' ? html`<pick-tab .historyLimit=${this._settings.historyLimit} @toast=${(e: CustomEvent) => this._showToast(e.detail)}></pick-tab>` : ''}
```

- [ ] **Step 3: Verify extension builds**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/entrypoints/sidepanel/components/pick-tab.ts src/entrypoints/sidepanel/app.ts
git commit -m "feat: create pick-tab component with ranked selector results and scoring"
```

---

## Phase 3 — Build Tab

### Task 12: Create build-tab component

**Files:**
- Create: `src/entrypoints/sidepanel/components/build-tab.ts`

- [ ] **Step 1: Create the build tab component**

This migrates the freeform/structured Build tab logic from `main.ts` into a Lit component, adding real-time scoring. This is a large component — it contains both freeform and structured modes with all 5 framework generators.

The build-tab component should:
1. Port all freeform input logic (auto-detect type, suggestions, match counting) from `main.ts:1753-1989`
2. Port all structured generator logic (Playwright, CSS, XPath, Cypress, Selenium) from `main.ts:1091-1751`
3. Port chain steps logic from `main.ts:1302-1537`
4. Add real-time `scoreSelector()` call on generated/typed selectors to show stability score
5. Add fragility warnings inline
6. Add "Save to workspace" action on generated results

Since this is the largest component, build it by extracting the existing logic and wrapping it in Lit's reactive template. The structured generators (`generatePlaywrightStructured`, `generateCssStructured`, etc.) should be moved as private methods on the component. The chain step logic should use Lit's `@state` arrays instead of direct DOM manipulation.

Wire into app shell the same way as pick-tab:
```typescript
import './components/build-tab.js';
// and in render():
${this._activeTab === 'build' ? html`<build-tab @toast=${(e: CustomEvent) => this._showToast(e.detail)}></build-tab>` : ''}
```

- [ ] **Step 2: Verify extension builds**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/entrypoints/sidepanel/components/build-tab.ts src/entrypoints/sidepanel/app.ts
git commit -m "feat: create build-tab Lit component with freeform/structured modes and real-time scoring"
```

---

## Phase 4 — Workspace Tab

### Task 13: Create workspace-tab component

**Files:**
- Create: `src/entrypoints/sidepanel/components/workspace-tab.ts`

- [ ] **Step 1: Create workspace tab**

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { sharedStyles } from '../styles/shared.js';
import { loadWorkspace, removeFavorite, clearRecent } from '../services/storage.js';
import { testSelector } from '../services/messaging.js';
import type { SavedSelector, WorkspaceData } from '@/types';
import './selector-card.js';

@customElement('workspace-tab')
export class WorkspaceTab extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host { display: block; }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 8px 0 6px;
        font-size: 11px;
        font-weight: 600;
        color: var(--text-secondary);
      }

      .section-count {
        font-weight: 400;
        color: var(--text-tertiary);
      }

      .clear-btn {
        font-size: 10px;
        color: var(--text-tertiary);
        transition: color 0.15s;
      }

      .clear-btn:hover { color: var(--error); }

      .search-bar {
        width: 100%;
        margin-bottom: 8px;
      }

      .filter-bar {
        display: flex;
        gap: 4px;
        margin-bottom: 8px;
      }

      .filter-chip {
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 500;
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        color: var(--text-tertiary);
        transition: all 0.15s;
      }

      .filter-chip:hover { color: var(--text-primary); }
      .filter-chip.active {
        background: var(--accent);
        color: #fff;
        border-color: var(--accent);
      }

      .list { display: flex; flex-direction: column; gap: 4px; }

      .empty {
        text-align: center;
        padding: 30px 20px;
        color: var(--text-tertiary);
        font-size: 12px;
      }

      .url-text {
        font-size: 9px;
        color: var(--text-tertiary);
        padding: 0 9px 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ];

  @state() private _data: WorkspaceData = { favorites: [], recent: [] };
  @state() private _search = '';
  @state() private _formatFilter: string | null = null;

  async connectedCallback() {
    super.connectedCallback();
    await this._load();
  }

  async _load() {
    this._data = await loadWorkspace();
  }

  private _filter(items: SavedSelector[]): SavedSelector[] {
    let filtered = items;
    if (this._search) {
      const q = this._search.toLowerCase();
      filtered = filtered.filter((s) =>
        s.selector.toLowerCase().includes(q) || s.elementTag.toLowerCase().includes(q)
      );
    }
    if (this._formatFilter) {
      filtered = filtered.filter((s) => s.format === this._formatFilter);
    }
    return filtered;
  }

  private async _handleRemoveFavorite(e: CustomEvent) {
    const selector = e.detail as { selector: string };
    const fav = this._data.favorites.find((f) => f.selector === selector.selector);
    if (fav) {
      this._data = await removeFavorite(fav.id);
    }
  }

  private async _handleClearRecent() {
    this._data = await clearRecent();
  }

  private async _handleTest(e: CustomEvent) {
    const scored = e.detail;
    const selectorType = scored.format === 'xpath' ? 'xpath' : 'css';
    let testSel = scored.selector;
    if (scored.format === 'playwright') {
      const match = scored.selector.match(/page\.\w+\(['"`](.*?)['"`]/);
      if (match) testSel = match[1];
    } else if (scored.format === 'cypress') {
      const match = scored.selector.match(/cy\.\w+\(['"`](.*?)['"`]/);
      if (match) testSel = match[1];
    } else if (scored.format === 'selenium') {
      const match = scored.selector.match(/By\.\w+\(["'`](.*?)["'`]\)/);
      if (match) testSel = match[1];
    }
    try {
      await testSelector(testSel, selectorType);
      this.dispatchEvent(new CustomEvent('toast', { detail: 'Testing on page!', bubbles: true, composed: true }));
    } catch {
      this.dispatchEvent(new CustomEvent('toast', { detail: 'Cannot test on this page', bubbles: true, composed: true }));
    }
  }

  private _handleCopy() {
    this.dispatchEvent(new CustomEvent('toast', { detail: 'Copied!', bubbles: true, composed: true }));
  }

  private _toggleFilter(format: string) {
    this._formatFilter = this._formatFilter === format ? null : format;
  }

  private _getRelativeTime(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  render() {
    const favorites = this._filter(this._data.favorites);
    const recents = this._filter(this._data.recent);
    const formats = ['css', 'xpath', 'playwright', 'cypress', 'selenium'];

    return html`
      <input type="text" class="search-bar" placeholder="Search selectors..."
             .value=${this._search}
             @input=${(e: InputEvent) => this._search = (e.target as HTMLInputElement).value}>

      <div class="filter-bar">
        ${formats.map((f) => html`
          <button class="filter-chip ${this._formatFilter === f ? 'active' : ''}"
                  @click=${() => this._toggleFilter(f)}>
            ${f.toUpperCase()}
          </button>
        `)}
      </div>

      <div class="section-header">
        Favorites <span class="section-count">(${favorites.length})</span>
      </div>

      ${favorites.length > 0 ? html`
        <div class="list">
          ${favorites.map((s) => html`
            <div>
              <selector-card
                .data=${{ selector: s.selector, format: s.format, score: s.score, warnings: s.warnings }}
                .starred=${true}
                @copy=${this._handleCopy}
                @test=${this._handleTest}
                @star=${this._handleRemoveFavorite}
              ></selector-card>
              <div class="url-text">${s.pageUrl ? new URL(s.pageUrl).hostname : ''} · ${this._getRelativeTime(s.createdAt)}</div>
            </div>
          `)}
        </div>
      ` : html`<div class="empty">No favorites yet. Star selectors from Pick or Build to save them here.</div>`}

      <div class="section-header">
        Recent <span class="section-count">(${recents.length})</span>
        ${recents.length > 0 ? html`
          <button class="clear-btn" @click=${this._handleClearRecent}>Clear all</button>
        ` : ''}
      </div>

      ${recents.length > 0 ? html`
        <div class="list">
          ${recents.map((s) => html`
            <div>
              <selector-card
                .data=${{ selector: s.selector, format: s.format, score: s.score, warnings: s.warnings }}
                @copy=${this._handleCopy}
                @test=${this._handleTest}
                @star=${() => {}}
              ></selector-card>
              <div class="url-text">${s.pageUrl ? new URL(s.pageUrl).hostname : ''} · ${this._getRelativeTime(s.createdAt)}</div>
            </div>
          `)}
        </div>
      ` : html`<div class="empty">Pick elements to see recent selectors here.</div>`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'workspace-tab': WorkspaceTab;
  }
}
```

- [ ] **Step 2: Wire into app shell**

In `src/entrypoints/sidepanel/app.ts`, add import and replace workspace placeholder:

```typescript
import './components/workspace-tab.js';
// and in render():
${this._activeTab === 'workspace' ? html`<workspace-tab @toast=${(e: CustomEvent) => this._showToast(e.detail)}></workspace-tab>` : ''}
```

- [ ] **Step 3: Run storage migration on init**

In `src/entrypoints/sidepanel/app.ts` `connectedCallback`, add:

```typescript
import { migrateHistoryToWorkspace } from './services/storage.js';
// in connectedCallback:
await migrateHistoryToWorkspace();
```

- [ ] **Step 4: Verify extension builds**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/entrypoints/sidepanel/components/workspace-tab.ts src/entrypoints/sidepanel/app.ts
git commit -m "feat: create workspace-tab with favorites, recents, search, and format filtering"
```

---

## Phase 5 — Page Change Detection

### Task 14: Add MutationObserver to content script

**Files:**
- Modify: `src/entrypoints/content.ts`

- [ ] **Step 1: Add watcher logic to content script**

Add the following inside the `main()` function of `content.ts`, after the existing message handler:

```typescript
    // --- Selector Watching (DOM Change Detection) ---
    let watchedSelectors: Array<{ id: string; selector: string; type: 'css' | 'xpath' }> = [];
    let selectorCounts: Map<string, number> = new Map();
    let mutationObserver: MutationObserver | null = null;
    let mutationDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    function countSelectorMatches(selector: string, type: 'css' | 'xpath'): number {
      try {
        if (type === 'xpath') {
          const result = document.evaluate(
            selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
          );
          return result.snapshotLength;
        }
        return document.querySelectorAll(selector).length;
      } catch {
        return -1;
      }
    }

    function checkSelectorChanges() {
      for (const watched of watchedSelectors) {
        const newCount = countSelectorMatches(watched.selector, watched.type);
        const oldCount = selectorCounts.get(watched.id) ?? -1;

        if (oldCount !== -1 && newCount !== oldCount) {
          chrome.runtime.sendMessage({
            type: 'SELECTOR_STATUS_CHANGED',
            id: watched.id,
            oldCount,
            newCount,
          }).catch(() => {});
        }

        selectorCounts.set(watched.id, newCount);
      }
    }

    function startObserving() {
      if (mutationObserver) return;
      mutationObserver = new MutationObserver(() => {
        if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
        mutationDebounceTimer = setTimeout(checkSelectorChanges, 500);
      });
      mutationObserver.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true,
      });
    }

    function stopObserving() {
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
      if (mutationDebounceTimer) {
        clearTimeout(mutationDebounceTimer);
        mutationDebounceTimer = null;
      }
    }
```

- [ ] **Step 2: Add message handlers for WATCH/UNWATCH**

Add these cases inside the existing `chrome.runtime.onMessage.addListener` callback in `content.ts`:

```typescript
      } else if (message.type === 'WATCH_SELECTORS') {
        const newSelectors = message.selectors as Array<{ id: string; selector: string; type: 'css' | 'xpath' }>;
        for (const s of newSelectors) {
          if (!watchedSelectors.find((w) => w.id === s.id)) {
            watchedSelectors.push(s);
            selectorCounts.set(s.id, countSelectorMatches(s.selector, s.type));
          }
        }
        if (watchedSelectors.length > 0) startObserving();
        sendResponse({ success: true });
      } else if (message.type === 'UNWATCH_SELECTORS') {
        const ids = new Set(message.ids as string[]);
        watchedSelectors = watchedSelectors.filter((w) => !ids.has(w.id));
        for (const id of ids) selectorCounts.delete(id);
        if (watchedSelectors.length === 0) stopObserving();
        sendResponse({ success: true });
```

- [ ] **Step 3: Verify lint passes**

```bash
npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add src/entrypoints/content.ts
git commit -m "feat: add MutationObserver-based selector watching to content script"
```

---

### Task 15: Create dom-monitor service

**Files:**
- Create: `src/entrypoints/sidepanel/services/dom-monitor.ts`

- [ ] **Step 1: Create the DOM monitor service**

```typescript
import { watchSelectors, unwatchSelectors, onSelectorStatusChanged } from './messaging.js';
import type { ScoredSelector, SelectorStatusChange } from '@/types';

type StatusCallback = (change: SelectorStatusChange) => void;

let currentlyWatched: Map<string, { selector: string; type: 'css' | 'xpath' }> = new Map();
let statusCallbacks: StatusCallback[] = [];

export function onStatusChange(callback: StatusCallback): void {
  statusCallbacks.push(callback);
}

// Initialize listener (call once at app startup)
export function initDomMonitor(): void {
  onSelectorStatusChanged((change) => {
    for (const cb of statusCallbacks) {
      cb(change);
    }
  });
}

export async function watch(selectors: ScoredSelector[]): Promise<void> {
  const toWatch = selectors
    .filter((s) => s.format === 'css' || s.format === 'xpath')
    .map((s) => ({
      id: s.selector, // use selector as ID for dedup
      selector: s.selector,
      type: (s.format === 'xpath' ? 'xpath' : 'css') as 'css' | 'xpath',
    }))
    .filter((s) => !currentlyWatched.has(s.id));

  if (toWatch.length === 0) return;

  for (const s of toWatch) {
    currentlyWatched.set(s.id, { selector: s.selector, type: s.type });
  }

  try {
    await watchSelectors(toWatch);
  } catch {
    // Content script not available — silently ignore
  }
}

export async function unwatch(selectorStrings: string[]): Promise<void> {
  const ids = selectorStrings.filter((s) => currentlyWatched.has(s));
  if (ids.length === 0) return;

  for (const id of ids) currentlyWatched.delete(id);

  try {
    await unwatchSelectors(ids);
  } catch {
    // Content script not available
  }
}

export async function unwatchAll(): Promise<void> {
  const ids = Array.from(currentlyWatched.keys());
  currentlyWatched.clear();
  if (ids.length > 0) {
    try { await unwatchSelectors(ids); } catch {}
  }
}
```

- [ ] **Step 2: Wire into app shell**

In `src/entrypoints/sidepanel/app.ts` `connectedCallback`, add:

```typescript
import { initDomMonitor } from './services/dom-monitor.js';
// in connectedCallback:
initDomMonitor();
```

- [ ] **Step 3: Commit**

```bash
git add src/entrypoints/sidepanel/services/dom-monitor.ts src/entrypoints/sidepanel/app.ts
git commit -m "feat: create dom-monitor service for page change detection coordination"
```

---

## Phase 6 — Polish

### Task 16: Create settings-modal component

**Files:**
- Create: `src/entrypoints/sidepanel/components/settings-modal.ts`

- [ ] **Step 1: Create the settings modal Lit component**

Port the settings modal from `main.ts:668-757`. It should:
- Show default format selector (css/xpath/playwright/cypress/selenium)
- Show history limit selector (25/50/100/200)
- Use Lit reactive properties and emit events for changes
- Include focus trap and escape-to-close
- Emit `settings-changed` event with new settings

Wire into app shell with:
```typescript
import './components/settings-modal.js';
// in render(), wire the settings button @click to toggle a _settingsOpen state
// render <settings-modal ?open=${this._settingsOpen} .settings=${this._settings} @settings-changed=${...} @close=${...}>
```

- [ ] **Step 2: Verify extension builds**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/entrypoints/sidepanel/components/settings-modal.ts src/entrypoints/sidepanel/app.ts
git commit -m "feat: create settings-modal Lit component with format and history limit options"
```

---

### Task 17: Create dom-tree component

**Files:**
- Create: `src/entrypoints/sidepanel/components/dom-tree.ts`

- [ ] **Step 1: Create the DOM tree Lit component**

Port the DOM tree viewer from `main.ts:769-1068`. It should:
- Render collapsible tree nodes with lazy-loading
- Support search/filter
- Support hover-to-highlight (via messaging service)
- Support click to select element (emit `element-selected` event)
- Collapse all / expand all buttons
- Node count display

Wire into pick-tab as an optional expandable section.

- [ ] **Step 2: Verify extension builds**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/entrypoints/sidepanel/components/dom-tree.ts src/entrypoints/sidepanel/components/pick-tab.ts
git commit -m "feat: create dom-tree Lit component with lazy-loading, search, and hover highlight"
```

---

### Task 18: Final cleanup and verification

**Files:**
- Modify: `src/entrypoints/sidepanel/app.ts` (any remaining wiring)
- Delete: old `main.ts` content (should just be `import './app.js'` by now)

- [ ] **Step 1: Verify all tabs work**

```bash
npm run build
```

Load the extension in Chrome (`chrome://extensions`, load unpacked from `output/chrome-mv3`):
- Pick tab: button triggers picker, results show ranked selectors with scores
- Build tab: freeform and structured modes generate selectors with scores
- Workspace tab: favorites and recents display, search and filter work
- Theme toggle cycles dark/light/system
- Settings modal opens and saves

- [ ] **Step 2: Run linter**

```bash
npm run lint
```

Fix any issues.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Selekt overhaul — Lit components, selector intelligence, workspace"
```

---

### Task 19: Add .superpowers to .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add .superpowers directory to gitignore**

Append to `.gitignore`:
```
.superpowers/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .superpowers to gitignore"
```
