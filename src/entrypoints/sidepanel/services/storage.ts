import type { SavedSelector, SelectorFormat, WorkspaceData } from '@/types';

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

export async function addRecent(selector: SavedSelector, limit: number): Promise<WorkspaceData> {
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
      score: 0,
      warnings: [],
      pageUrl: '',
      elementTag: item.element.tagName,
      createdAt: item.timestamp,
    }));

    const workspace: WorkspaceData = { favorites: [], recent };
    await chrome.storage.local.set({ workspace });
  }
}
