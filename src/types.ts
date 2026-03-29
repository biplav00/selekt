export interface ElementInfo {
  tagName: string;
  text: string;
  attributes: Record<string, string>;
}

export interface Locators {
  css: string;
  xpath: string;
  playwright: string;
  cypress: string;
  selenium: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  element: ElementInfo;
  locators: Locators;
}

export interface Suggestion {
  type: string;
  label: string;
  code: string;
}

export interface DomTreeNode {
  tag: string;
  id: string;
  className: string;
  textContent: string;
  depth: number;
  hasChildren: boolean;
  children: DomTreeNode[];
  childCount: number;
  path: number[];
  loaded: boolean;
  totalChildren: number;
}

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
