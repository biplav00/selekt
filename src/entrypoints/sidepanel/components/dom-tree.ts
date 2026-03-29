import type { DomTreeNode, ElementInfo } from '@/types';
import { LitElement, css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  clearHighlight,
  getDomChildren,
  getDomTree,
  highlightElement,
} from '../services/messaging.js';
import { sharedStyles } from '../styles/shared.js';

@customElement('dom-tree')
export class DomTree extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }

      /* ── Toolbar ── */
      .toolbar {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        flex-wrap: wrap;
      }

      .toolbar-search {
        flex: 1;
        min-width: 120px;
        padding: 5px 8px;
        font-size: 11px;
      }

      .toolbar-btn {
        padding: 5px 9px;
        font-size: 11px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        border-radius: 6px;
        color: var(--text-secondary);
        transition: background 0.15s, color 0.15s;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .toolbar-btn:hover {
        background: var(--border);
        color: var(--text-primary);
      }

      .toolbar-btn.refresh {
        color: var(--accent);
        border-color: color-mix(in srgb, var(--accent) 40%, transparent);
      }

      .toolbar-btn.refresh:hover {
        background: color-mix(in srgb, var(--accent) 10%, transparent);
      }

      .node-count {
        font-size: 10px;
        color: var(--text-tertiary);
        white-space: nowrap;
        flex-shrink: 0;
      }

      /* ── Loading / empty ── */
      .loading-state,
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 24px 16px;
        color: var(--text-tertiary);
        font-size: 12px;
        text-align: center;
      }

      /* ── Tree container ── */
      .tree-container {
        overflow-x: auto;
        overflow-y: auto;
        max-height: 480px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--bg-secondary);
      }

      .tree-inner {
        padding: 6px 0;
        min-width: max-content;
      }

      /* ── Tree node ── */
      .tree-node {
        display: flex;
        flex-direction: column;
      }

      .node-row {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px 2px 0;
        cursor: pointer;
        border-radius: 4px;
        transition: background 0.1s;
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        font-size: 11px;
        white-space: nowrap;
        position: relative;
      }

      .node-row:hover {
        background: color-mix(in srgb, var(--accent) 8%, transparent);
      }

      .node-row.selected {
        background: color-mix(in srgb, var(--accent) 15%, transparent);
        outline: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
        outline-offset: -1px;
        border-radius: 4px;
      }

      .node-row.search-match {
        background: color-mix(in srgb, var(--warning) 12%, transparent);
      }

      .node-row.search-hidden {
        display: none;
      }

      .expand-arrow {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        color: var(--text-tertiary);
        font-size: 9px;
        transition: transform 0.1s;
        user-select: none;
      }

      .expand-arrow.no-children {
        opacity: 0;
        pointer-events: none;
      }

      .node-tag {
        color: var(--accent);
        font-weight: 600;
      }

      .node-id {
        color: #4ade80;
      }

      .node-class {
        color: #c084fc;
      }

      .node-text {
        color: var(--text-tertiary);
        font-style: italic;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .node-children {
        /* indented by the parent's margin-left */
      }

      /* ── Stub (lazy-load placeholder) ── */
      .stub-row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 2px 8px;
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        font-size: 10px;
        color: var(--text-tertiary);
        cursor: pointer;
        border-radius: 4px;
        transition: color 0.1s, background 0.1s;
        white-space: nowrap;
      }

      .stub-row:hover {
        color: var(--accent);
        background: color-mix(in srgb, var(--accent) 8%, transparent);
      }
    `,
  ];

  @state() private _tree: DomTreeNode | null = null;
  @state() private _loading = false;
  @state() private _searchQuery = '';
  @state() private _selectedPath: string | null = null;
  @state() private _collapsed = new Set<string>();
  @state() private _nodeCount = 0;

  private _hoverTimer: ReturnType<typeof setTimeout> | null = null;

  override connectedCallback() {
    super.connectedCallback();
    this._loadTree();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (this._hoverTimer !== null) {
      clearTimeout(this._hoverTimer);
    }
    clearHighlight().catch(() => {});
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  private async _loadTree() {
    this._loading = true;
    try {
      const tree = await getDomTree();
      this._tree = tree;
      this._nodeCount = tree ? this._countNodes(tree) : 0;
    } catch {
      this._emitToast('Could not load DOM tree. Make sure a page is open.');
    } finally {
      this._loading = false;
    }
  }

  private _countNodes(node: DomTreeNode): number {
    let count = 1;
    for (const child of node.children) {
      count += this._countNodes(child);
    }
    return count;
  }

  private _pathKey(path: number[]): string {
    return path.join('-');
  }

  private _isCollapsed(path: number[]): boolean {
    return this._collapsed.has(this._pathKey(path));
  }

  private _toggleCollapse(path: number[]) {
    const key = this._pathKey(path);
    const next = new Set(this._collapsed);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this._collapsed = next;
  }

  private _collapseAll() {
    if (!this._tree) return;
    const keys = new Set<string>();
    const collect = (node: DomTreeNode) => {
      if (node.hasChildren) keys.add(this._pathKey(node.path));
      for (const child of node.children) collect(child);
    };
    collect(this._tree);
    this._collapsed = keys;
  }

  private _expandAll() {
    this._collapsed = new Set();
  }

  private async _loadStub(node: DomTreeNode) {
    try {
      const children = await getDomChildren(node.path);
      // Merge loaded children into the tree
      if (this._tree) {
        this._tree = this._mergeChildren(this._tree, node.path, children);
        this._nodeCount = this._countNodes(this._tree);
      }
    } catch {
      this._emitToast('Could not load children.');
    }
  }

  private _mergeChildren(
    current: DomTreeNode,
    targetPath: number[],
    children: DomTreeNode[]
  ): DomTreeNode {
    if (current.path.join(',') === targetPath.join(',')) {
      return { ...current, children, loaded: true };
    }
    return {
      ...current,
      children: current.children.map((c) => this._mergeChildren(c, targetPath, children)),
    };
  }

  // ── Hover highlight ──────────────────────────────────────────────────────────

  private _onNodeMouseEnter(path: number[]) {
    if (this._hoverTimer !== null) clearTimeout(this._hoverTimer);
    this._hoverTimer = setTimeout(() => {
      highlightElement(path).catch(() => {});
    }, 50);
  }

  private _onNodeMouseLeave() {
    if (this._hoverTimer !== null) {
      clearTimeout(this._hoverTimer);
      this._hoverTimer = null;
    }
    clearHighlight().catch(() => {});
  }

  // ── Node click (select) ─────────────────────────────────────────────────────

  private _onNodeClick(node: DomTreeNode, e: Event) {
    e.stopPropagation();
    const key = this._pathKey(node.path);
    this._selectedPath = key;

    // Build a minimal ElementInfo from the node
    const attrs: Record<string, string> = {};
    if (node.id) attrs.id = node.id;
    if (node.className) attrs.class = node.className;

    const info: ElementInfo = {
      tagName: node.tag,
      text: node.textContent,
      attributes: attrs,
    };

    this.dispatchEvent(
      new CustomEvent('element-selected', { detail: info, bubbles: true, composed: true })
    );
  }

  // ── Search ───────────────────────────────────────────────────────────────────

  private _nodeMatchesSearch(node: DomTreeNode, query: string): boolean {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      node.tag.toLowerCase().includes(q) ||
      node.id.toLowerCase().includes(q) ||
      node.className.toLowerCase().includes(q) ||
      node.textContent.toLowerCase().includes(q)
    );
  }

  private _emitToast(message: string) {
    this.dispatchEvent(
      new CustomEvent('toast', { detail: message, bubbles: true, composed: true })
    );
  }

  // ── Rendering ────────────────────────────────────────────────────────────────

  private _renderNode(node: DomTreeNode, depth: number) {
    const isCollapsed = this._isCollapsed(node.path);
    const key = this._pathKey(node.path);
    const isSelected = this._selectedPath === key;
    const query = this._searchQuery.trim();
    const matchesSearch = this._nodeMatchesSearch(node, query);
    const searchHidden = query && !matchesSearch;

    const indentPx = depth * 16 + 4;

    // Build label parts
    const tagPart = html`<span class="node-tag">${node.tag}</span>`;
    const idPart = node.id ? html`<span class="node-id">#${node.id}</span>` : nothing;
    const classPart = node.className
      ? html`<span class="node-class"
          >.${node.className.trim().split(/\s+/).slice(0, 3).join('.')}</span
        >`
      : nothing;
    const textPart =
      node.textContent && !node.hasChildren
        ? html`<span class="node-text">"${node.textContent.slice(0, 40)}"</span>`
        : nothing;

    const arrowChar = isCollapsed ? '▶' : '▼';
    const arrowClass = node.hasChildren ? 'expand-arrow' : 'expand-arrow no-children';

    const rowClass = [
      'node-row',
      isSelected ? 'selected' : '',
      query && matchesSearch ? 'search-match' : '',
      searchHidden ? 'search-hidden' : '',
    ]
      .filter(Boolean)
      .join(' ');

    // Determine if we need a stub (children exist but not all loaded)
    const hasStub =
      !isCollapsed && node.hasChildren && node.loaded && node.children.length < node.totalChildren;

    // Determine if we need a "load children" stub when children array is empty but node has children
    const needsInitialLoad = !isCollapsed && node.hasChildren && !node.loaded;

    return html`
      <div class="tree-node">
        <div
          class="${rowClass}"
          style="padding-left: ${indentPx}px"
          @click=${(e: Event) => this._onNodeClick(node, e)}
          @mouseenter=${() => this._onNodeMouseEnter(node.path)}
          @mouseleave=${() => this._onNodeMouseLeave()}
        >
          <span
            class="${arrowClass}"
            @click=${(e: Event) => {
              e.stopPropagation();
              if (node.hasChildren) this._toggleCollapse(node.path);
            }}
          >${node.hasChildren ? arrowChar : ''}</span>
          ${tagPart}${idPart}${classPart}${textPart}
        </div>

        ${
          !isCollapsed && node.children.length > 0
            ? html`<div class="node-children">
                ${node.children.map((child) => this._renderNode(child, depth + 1))}
              </div>`
            : nothing
        }

        ${
          needsInitialLoad
            ? html`<div
                class="stub-row"
                style="padding-left: ${indentPx + 20}px"
                @click=${(e: Event) => {
                  e.stopPropagation();
                  this._loadStub(node);
                }}
              >⋯ ${node.totalChildren} children</div>`
            : nothing
        }

        ${
          hasStub
            ? html`<div
                class="stub-row"
                style="padding-left: ${indentPx + 20}px"
                @click=${(e: Event) => {
                  e.stopPropagation();
                  this._loadStub(node);
                }}
              >⋯ ${node.totalChildren - node.children.length} more children</div>`
            : nothing
        }
      </div>
    `;
  }

  override render() {
    return html`
      <div class="toolbar">
        <input
          type="text"
          class="toolbar-search"
          placeholder="Search nodes…"
          .value=${this._searchQuery}
          @input=${(e: Event) => {
            this._searchQuery = (e.target as HTMLInputElement).value;
          }}
        />
        <button class="toolbar-btn" type="button" @click=${this._collapseAll}>Collapse All</button>
        <button class="toolbar-btn" type="button" @click=${this._expandAll}>Expand All</button>
        <button
          class="toolbar-btn refresh"
          type="button"
          title="Reload DOM tree"
          @click=${this._loadTree}
        >↻</button>
        ${this._tree ? html`<span class="node-count">${this._nodeCount} nodes</span>` : nothing}
      </div>

      ${
        this._loading
          ? html`<div class="loading-state">Loading DOM tree…</div>`
          : !this._tree
            ? html`<div class="empty-state">No DOM tree loaded. Make sure a page is open.</div>`
            : html`
              <div class="tree-container">
                <div class="tree-inner">
                  ${this._renderNode(this._tree, 0)}
                </div>
              </div>
            `
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dom-tree': DomTree;
  }
}
