// --- Types ---
interface ElementInfo {
  tagName: string;
  text: string;
  attributes: Record<string, string>;
}

interface Locators {
  css: string;
  xpath: string;
  playwright: string;
  cypress: string;
  selenium: string;
}

interface HistoryItem {
  id: string;
  timestamp: number;
  element: ElementInfo;
  locators: Locators;
}

interface Suggestion {
  type: string;
  label: string;
  code: string;
}

interface DomTreeNode {
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

// --- Utilities ---
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(value);
  }
  // Fallback: escape special CSS characters
  return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

function escapeCssAttrValue(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeXPathValue(str: string): string {
  if (!str.includes("'")) return `'${str}'`;
  if (!str.includes('"')) return `"${str}"`;
  // Contains both quote types — use concat()
  const parts = str.split("'").map((p) => `'${p}'`);
  return `concat(${parts.join(',"\'",')})`;
}

function escapeSingleQuoteJs(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function escapeDoubleQuoteJs(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/content.js'],
      });
      await new Promise((r) => setTimeout(r, 150));
      return true;
    } catch {
      return false;
    }
  }
}

async function sendToTab(message: Record<string, unknown>): Promise<any> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');

  if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('about:')) {
    throw new Error('Cannot access Chrome pages');
  }

  const ready = await ensureContentScript(tab.id);
  if (!ready) throw new Error('Cannot inject content script');

  return chrome.tabs.sendMessage(tab.id, message);
}

// --- Theme ---
let currentTheme = 'dark';

function applyTheme(theme: string) {
  currentTheme = theme;
  let effective = theme;
  if (theme === 'system') {
    effective = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', effective);
  localStorage.setItem('selekt-theme', theme);
  updateThemeToggleIcon(effective);
}

function updateThemeToggleIcon(effective: string) {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  if (effective === 'light') {
    // Sun icon for light mode (click to go to next)
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  } else {
    // Moon icon for dark mode
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
  // Update title to show current mode
  const labels: Record<string, string> = { dark: 'Dark', light: 'Light', system: 'System' };
  btn.title = `Theme: ${labels[currentTheme] || 'Dark'} (click to cycle)`;
}

// Listen for system theme changes when in "system" mode
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (currentTheme === 'system') applyTheme('system');
});

// --- State ---
let currentElement: ElementInfo | null = null;
let currentLocators: Locators | null = null;
let activeFormat: keyof Locators = 'xpath';
let locatorHistory: HistoryItem[] = [];
let historyLimit = 50;
let pageSuggestionsCache: Record<string, Suggestion[]> | null = null;
let domTreeData: DomTreeNode | null = null;
let debounceTimer: number | null = null;
let isFreeformMode = true;
let pickTimeout: ReturnType<typeof setTimeout> | null = null;
let historyShowAll = false;

// --- DOM References ---
const tabs = document.querySelectorAll('.tab');
const views = document.querySelectorAll('.view');
const pickBtn = document.getElementById('pickBtn') as HTMLButtonElement;
const elementInfoEl = document.getElementById('elementInfo')!;
const locatorDisplay = document.getElementById('locatorDisplay')!;
const emptyState = document.getElementById('emptyState')!;
const footerActions = document.getElementById('footerActions')!;
const elementCount = document.getElementById('elementCount')!;
const toast = document.getElementById('toast')!;
const domTreeContainer = document.getElementById('domTreeContainer')!;
const domTreeEl = document.getElementById('domTree')!;
const freeformInput = document.getElementById('freeformInput') as HTMLTextAreaElement;
const freeformType = document.getElementById('freeformType') as HTMLSelectElement;
const suggestionsEl = document.getElementById('suggestions')!;
const matchCountEl = document.getElementById('matchCount')!;
const structuredFields = document.getElementById('structuredFields') as HTMLElement;
const freeformFields = document.getElementById('freeformFields') as HTMLElement;
const structuredLabel = document.getElementById('structuredLabel') as HTMLElement;
const freeformLabel = document.getElementById('freeformLabel') as HTMLElement;
const connectionDot = document.getElementById('connectionDot')!;
const connectionStatus = document.getElementById('connectionStatus')!;

// --- Tab Navigation ---
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.getAttribute('data-tab');
    tabs.forEach((t) => t.classList.remove('active'));
    views.forEach((v) => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${target}-view`)?.classList.add('active');
    updateTabAccessibility();
    // Lazy-load page suggestions when Build tab is first opened
    if (target === 'build') ensurePageSuggestions();
  });

  tab.addEventListener('keydown', (e: KeyboardEvent) => {
    const tabArray = Array.from(tabs);
    const currentIndex = tabArray.indexOf(tab);
    let newIndex = currentIndex;

    if (e.key === 'ArrowRight') newIndex = (currentIndex + 1) % tabArray.length;
    else if (e.key === 'ArrowLeft')
      newIndex = (currentIndex - 1 + tabArray.length) % tabArray.length;
    else if (e.key === 'Home') newIndex = 0;
    else if (e.key === 'End') newIndex = tabArray.length - 1;
    else return;

    e.preventDefault();
    const newTab = tabArray[newIndex] as HTMLElement;
    newTab.click();
    newTab.focus();
  });
});

function updateTabAccessibility() {
  tabs.forEach((t) => {
    const tabEl = t as HTMLElement;
    const isActive = tabEl.classList.contains('active');
    tabEl.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tabEl.setAttribute('tabindex', isActive ? '0' : '-1');
  });
}

// --- Element Picking ---
pickBtn.addEventListener('click', async () => {
  pickBtn.disabled = true;
  pickBtn.classList.add('active');
  pickBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 3a2 2 0 0 0-2 2m0 0v4m0-4h4m-4 14a2 2 0 0 0 2 2m-2-2v-4m0 4h4M19 3a2 2 0 0 1 2 2m0 0v4m0-4h-4m4 14a2 2 0 0 1-2 2m2-2v-4m0 4h-4"/></svg>
    Picking...
    <span class="pick-shortcut">ESC</span>
  `;

  // Auto-reset after 30s in case content script never responds
  pickTimeout = setTimeout(() => {
    resetPickButton();
    showToast('Picker timed out');
  }, 30000);

  try {
    await sendToTab({ type: 'START_PICKING' });
  } catch (e) {
    resetPickButton();
    showToast(e instanceof Error ? e.message : 'Cannot activate picker');
  }
});

function resetPickButton() {
  if (pickTimeout) {
    clearTimeout(pickTimeout);
    pickTimeout = null;
  }
  pickBtn.disabled = false;
  pickBtn.classList.remove('active');
  pickBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 3a2 2 0 0 0-2 2m0 0v4m0-4h4m-4 14a2 2 0 0 0 2 2m-2-2v-4m0 4h4M19 3a2 2 0 0 1 2 2m0 0v4m0-4h-4m4 14a2 2 0 0 1-2 2m2-2v-4m0 4h-4"/></svg>
    Pick Element
    <span class="pick-shortcut">&#8984;&#8679;L</span>
  `;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'ELEMENT_SELECTED') {
    resetPickButton();
    handleElementSelected(message.element);
  } else if (message.type === 'PICKING_CANCELLED') {
    resetPickButton();
  }
});

// --- Locator Generation ---
async function handleElementSelected(element: ElementInfo) {
  currentElement = element;
  currentLocators = generateLocators(element);
  await saveToHistory(element, currentLocators);
  updateStats();
  renderElementInfo();
  renderLocators();
}

function generateLocators(element: ElementInfo): Locators {
  const tag = (element.tagName || 'div').toLowerCase();
  const attrs = element.attributes || {};
  const text = element.text?.trim().substring(0, 40) || '';

  // --- CSS ---
  let css = tag;
  if (attrs.id) {
    css = `#${cssEscape(attrs.id)}`;
  } else if (attrs['data-testid']) {
    css = `[data-testid="${escapeCssAttrValue(attrs['data-testid'])}"]`;
  } else if (attrs['data-test']) {
    css = `[data-test="${escapeCssAttrValue(attrs['data-test'])}"]`;
  } else if (attrs.name) {
    css = `${tag}[name="${escapeCssAttrValue(attrs.name)}"]`;
  } else if (attrs.class) {
    const first = attrs.class.split(' ').filter((c) => c)[0];
    if (first) css = `${tag}.${cssEscape(first)}`;
  } else if (attrs.role) {
    css = `${tag}[role="${escapeCssAttrValue(attrs.role)}"]`;
  }

  // --- XPath ---
  let xpath: string;
  if (attrs.id) {
    xpath = `//${tag}[@id=${escapeXPathValue(attrs.id)}]`;
  } else if (attrs['data-testid']) {
    xpath = `//${tag}[@data-testid=${escapeXPathValue(attrs['data-testid'])}]`;
  } else if (attrs['data-test']) {
    xpath = `//${tag}[@data-test=${escapeXPathValue(attrs['data-test'])}]`;
  } else if (attrs.name) {
    xpath = `//${tag}[@name=${escapeXPathValue(attrs.name)}]`;
  } else if (attrs.class) {
    const first = attrs.class.split(' ').filter((c) => c)[0];
    xpath = first ? `//${tag}[contains(@class,${escapeXPathValue(first)})]` : `//${tag}`;
  } else if (text && text.length <= 30 && !text.includes('\n')) {
    xpath = `//${tag}[text()=${escapeXPathValue(text)}]`;
  } else {
    xpath = `//${tag}`;
  }

  // --- Playwright ---
  let playwright: string;
  if (attrs['data-testid']) {
    playwright = `page.getByTestId('${escapeSingleQuoteJs(attrs['data-testid'])}')`;
  } else if (attrs.role) {
    const name = attrs['aria-label'] || text;
    playwright = name
      ? `page.getByRole('${escapeSingleQuoteJs(attrs.role)}', { name: '${escapeSingleQuoteJs(name.substring(0, 40))}' })`
      : `page.getByRole('${escapeSingleQuoteJs(attrs.role)}')`;
  } else if (attrs.placeholder) {
    playwright = `page.getByPlaceholder('${escapeSingleQuoteJs(attrs.placeholder)}')`;
  } else if (attrs['aria-label']) {
    playwright = `page.getByLabel('${escapeSingleQuoteJs(attrs['aria-label'])}')`;
  } else if (tag === 'button' || tag === 'a') {
    if (text) {
      playwright = `page.getByRole('${tag === 'button' ? 'button' : 'link'}', { name: '${escapeSingleQuoteJs(text.substring(0, 40))}' })`;
    } else {
      playwright = `page.locator('${escapeSingleQuoteJs(css)}')`;
    }
  } else if (text && text.length <= 30 && !text.includes('\n')) {
    playwright = `page.getByText('${escapeSingleQuoteJs(text)}')`;
  } else {
    playwright = `page.locator('${escapeSingleQuoteJs(css)}')`;
  }

  // --- Cypress ---
  let cypress: string;
  if (attrs['data-testid']) {
    cypress = `cy.get('[data-testid="${escapeSingleQuoteJs(escapeCssAttrValue(attrs['data-testid']))}"]')`;
  } else if (
    text &&
    text.length <= 30 &&
    !text.includes('\n') &&
    (tag === 'button' || tag === 'a')
  ) {
    cypress = `cy.contains('${escapeSingleQuoteJs(tag)}', '${escapeSingleQuoteJs(text)}')`;
  } else {
    cypress = `cy.get('${escapeSingleQuoteJs(css)}')`;
  }

  // --- Selenium ---
  let selenium: string;
  if (attrs.id) {
    selenium = `driver.findElement(By.id("${escapeDoubleQuoteJs(attrs.id)}"))`;
  } else if (attrs.name) {
    selenium = `driver.findElement(By.name("${escapeDoubleQuoteJs(attrs.name)}"))`;
  } else if (attrs.class) {
    const first = attrs.class.split(' ').filter((c) => c)[0];
    selenium = first
      ? `driver.findElement(By.className("${escapeDoubleQuoteJs(first)}"))`
      : `driver.findElement(By.cssSelector("${escapeDoubleQuoteJs(css)}"))`;
  } else {
    selenium = `driver.findElement(By.cssSelector("${escapeDoubleQuoteJs(css)}"))`;
  }

  return { css, xpath, playwright, cypress, selenium };
}

// --- Rendering ---
const FORMAT_ORDER: Array<{ key: keyof Locators; label: string }> = [
  { key: 'css', label: 'CSS' },
  { key: 'xpath', label: 'XPATH' },
  { key: 'playwright', label: 'PW' },
  { key: 'cypress', label: 'CY' },
  { key: 'selenium', label: 'SE' },
];

function getOrderedFormats(): Array<{ key: keyof Locators; label: string }> {
  // Put active format first
  const preferred = FORMAT_ORDER.find((f) => f.key === activeFormat);
  if (!preferred) return FORMAT_ORDER;
  return [preferred, ...FORMAT_ORDER.filter((f) => f.key !== activeFormat)];
}

function renderElementInfo() {
  if (!currentElement) {
    emptyState.style.display = 'block';
    elementInfoEl.innerHTML = '';
    footerActions.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  footerActions.style.display = 'flex';

  const attrs = currentElement.attributes || {};
  let path = '';
  if (attrs.id) path = `#${attrs.id}`;
  else if (attrs.class) path = `.${attrs.class.split(' ').slice(0, 2).join('.')}`;

  const attrEntries = Object.entries(attrs).filter(
    ([key]) => !['class', 'id', 'style', 'href', 'src'].includes(key)
  );
  const displayAttrs = attrEntries.slice(0, 12);
  const moreCount = attrEntries.length - 12;

  elementInfoEl.innerHTML = `
    <div class="element-card">
      <div class="element-card-header">
        <div class="element-tag-group">
          <span class="element-tag-badge">&lt;${escapeHtml(currentElement.tagName)}&gt;</span>
          <span class="element-selector">${escapeHtml(path || 'no id/class')}</span>
        </div>
        <button type="button" class="copy-all-btn" id="copyAllBtn">Copy All</button>
      </div>
      ${
        displayAttrs.length > 0
          ? `
        <div class="element-attrs">
          ${displayAttrs
            .map(
              ([key, val]) => `
            <span class="attr-chip"><span class="attr-key">${escapeHtml(key)}</span>=<span class="attr-val">"${escapeHtml(String(val).substring(0, 30))}"</span></span>
          `
            )
            .join('')}
          ${moreCount > 0 ? `<span class="attr-chip">+${moreCount} more</span>` : ''}
        </div>
      `
          : ''
      }
    </div>
  `;

  document.getElementById('copyAllBtn')?.addEventListener('click', copyAllLocators);
}

function renderLocatorRows(
  container: HTMLElement,
  locators: Locators,
  formats?: Array<{ key: keyof Locators; label: string }>
) {
  const fmts = formats || getOrderedFormats();

  container.innerHTML = fmts
    .map(
      (f) => `
    <div class="locator-row ${f.key === activeFormat ? 'preferred' : ''}" data-format="${f.key}">
      <span class="locator-badge ${f.key === 'playwright' ? 'pw' : f.key === 'cypress' ? 'cy' : f.key === 'selenium' ? 'se' : f.key}">${f.label}</span>
      <span class="locator-value" title="${escapeAttr(locators[f.key])}">${escapeHtml(locators[f.key])}</span>
      <button type="button" class="copy-btn" data-format="${f.key}">Copy</button>
    </div>
  `
    )
    .join('');

  // Click-to-copy on the entire row
  container.querySelectorAll('.locator-row').forEach((row) => {
    const format = (row as HTMLElement).dataset.format as keyof Locators;
    const copyBtn = row.querySelector('.copy-btn') as HTMLElement;

    const doCopy = () => {
      if (locators[format]) {
        navigator.clipboard.writeText(locators[format]);
        copyBtn.classList.add('copied');
        copyBtn.textContent = 'Done';
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.textContent = 'Copy';
        }, 1500);
      }
    };

    // Copy on row click (but not if clicking the button itself)
    row.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.copy-btn')) return;
      doCopy();
    });

    copyBtn.addEventListener('click', doCopy);
  });
}

function renderLocators() {
  if (!currentLocators) {
    locatorDisplay.innerHTML = '';
    return;
  }
  renderLocatorRows(locatorDisplay, currentLocators);
}

function copyAllLocators() {
  if (currentLocators) {
    const allText = Object.entries(currentLocators)
      .map(([key, val]) => `${key.toUpperCase()}: ${val}`)
      .join('\n');
    navigator.clipboard.writeText(allText);
    showToast('All locators copied!');
  }
}

// --- Stats ---
function updateStats() {
  elementCount.textContent = `${locatorHistory.length}`;
  const historyBadge = document.getElementById('historyBadge');
  if (historyBadge) {
    if (locatorHistory.length > 0) {
      historyBadge.textContent = `${locatorHistory.length}`;
      historyBadge.style.display = 'inline-flex';
    } else {
      historyBadge.style.display = 'none';
    }
  }
}

// --- Toast ---
let toastTimer: ReturnType<typeof setTimeout> | null = null;
function showToast(message: string) {
  if (toastTimer) clearTimeout(toastTimer);
  const toastMessage = document.getElementById('toastMessage');
  if (toastMessage) toastMessage.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

// --- History ---
async function loadHistory() {
  const result = await chrome.storage.local.get('locatorHistory');
  locatorHistory = result.locatorHistory || [];
  updateStats();
  renderHistory();
}

async function saveToHistory(element: ElementInfo, locators: Locators) {
  const item: HistoryItem = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    element,
    locators,
  };
  locatorHistory.unshift(item);
  if (locatorHistory.length > historyLimit) {
    locatorHistory = locatorHistory.slice(0, historyLimit);
  }
  try {
    await chrome.storage.local.set({ locatorHistory });
  } catch (e) {
    showToast('Failed to save history');
  }
}

function getRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const historyListEl = document.getElementById('historyList')!;
const historyEmptyEl = document.getElementById('historyEmpty')!;

// Event delegation for history list — avoids re-attaching listeners on every render
historyListEl.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;

  // Delete button
  const deleteBtn = target.closest('.history-delete') as HTMLElement | null;
  if (deleteBtn) {
    const id = deleteBtn.dataset.id;
    locatorHistory = locatorHistory.filter((h) => h.id !== id);
    try {
      await chrome.storage.local.set({ locatorHistory });
      showToast('Item removed');
    } catch {
      showToast('Failed to delete item');
    }
    updateStats();
    renderHistory();
    return;
  }

  // Show more / Show less toggle
  if (target.closest('.history-toggle')) {
    historyShowAll = !historyShowAll;
    renderHistory();
    return;
  }

  // Click item to restore locators
  const historyItem = target.closest('.history-item') as HTMLElement | null;
  if (historyItem) {
    const id = historyItem.dataset.id;
    const item = locatorHistory.find((h) => h.id === id);
    if (item) {
      currentElement = item.element;
      currentLocators = item.locators;
      renderElementInfo();
      renderLocators();
      (tabs[0] as HTMLElement).click();
    }
  }
});

function renderHistory() {
  if (locatorHistory.length === 0) {
    historyEmptyEl.style.display = 'block';
    historyListEl.innerHTML = '';
    return;
  }

  historyEmptyEl.style.display = 'none';
  const displayLimit = 15;
  const itemsToShow = historyShowAll ? locatorHistory : locatorHistory.slice(0, displayLimit);

  const fragment = document.createDocumentFragment();
  for (const item of itemsToShow) {
    const row = document.createElement('div');
    row.className = 'history-item';
    row.dataset.id = item.id;
    row.tabIndex = 0;
    row.innerHTML = `
      <span class="history-tag">&lt;${escapeHtml(item.element.tagName)}&gt;</span>
      <div class="history-info">
        <div class="history-selector">${escapeHtml(item.locators.css)}</div>
        <div class="history-meta">${escapeHtml(getRelativeTime(item.timestamp))} &middot; 5 locators</div>
      </div>
      <button type="button" class="history-delete" data-id="${escapeAttr(item.id)}" aria-label="Delete" title="Delete">&times;</button>
    `;
    fragment.appendChild(row);
  }

  // Show more / Show less toggle
  if (locatorHistory.length > displayLimit) {
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'history-toggle';
    toggleBtn.textContent = historyShowAll ? 'Show less' : `Show all (${locatorHistory.length})`;
    toggleBtn.style.cssText =
      'width:100%;padding:8px;background:none;border:1px solid var(--border,#334155);border-radius:6px;color:var(--text-muted,#94a3b8);cursor:pointer;font-size:12px;margin-top:4px;';
    fragment.appendChild(toggleBtn);
  }

  historyListEl.innerHTML = '';
  historyListEl.appendChild(fragment);
}

document.getElementById('clearHistoryBtn')?.addEventListener('click', async () => {
  if (locatorHistory.length === 0) return;
  locatorHistory = [];
  try {
    await chrome.storage.local.set({ locatorHistory: [] });
    showToast('History cleared');
  } catch {
    showToast('Failed to clear history');
  }
  updateStats();
  renderHistory();
});

// --- Export ---
document.getElementById('exportBtn')?.addEventListener('click', () => {
  if (!currentLocators) {
    showToast('No locators to export');
    return;
  }

  const data = {
    element: currentElement,
    locators: currentLocators,
    exportedAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `locators-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  showToast('Exported!');
});

// --- Test Selector ---
document.getElementById('testBtn')?.addEventListener('click', async () => {
  if (!currentLocators) return;

  try {
    await sendToTab({
      type: 'TEST_SELECTOR',
      selector: currentLocators.css,
    });
    showToast('Testing on page!');
  } catch {
    showToast('Cannot test on this page');
  }
});

// --- Settings ---
async function loadSettings() {
  const result = await chrome.storage.local.get(['defaultFormat', 'historyLimit', 'theme']);

  if (result.defaultFormat) {
    const formatSelect = document.getElementById('defaultFormat') as HTMLSelectElement;
    if (formatSelect) formatSelect.value = result.defaultFormat;
    activeFormat = result.defaultFormat as keyof Locators;
  }
  if (result.historyLimit) {
    historyLimit = result.historyLimit;
    const limitSelect = document.getElementById('historyLimitSelect') as HTMLSelectElement;
    if (limitSelect) limitSelect.value = result.historyLimit.toString();
  }
  if (result.theme) {
    applyTheme(result.theme);
  }
}

async function saveSettings() {
  const formatSelect = document.getElementById('defaultFormat') as HTMLSelectElement;
  const limitSelect = document.getElementById('historyLimitSelect') as HTMLSelectElement;
  const defaultFormat = formatSelect?.value || 'xpath';
  const newLimit = Number.parseInt(limitSelect?.value || '50', 10);

  activeFormat = defaultFormat as keyof Locators;
  historyLimit = newLimit;

  const storageUpdate: Record<string, unknown> = { defaultFormat, historyLimit: newLimit };

  // Trim history if new limit is smaller
  if (locatorHistory.length > historyLimit) {
    locatorHistory = locatorHistory.slice(0, historyLimit);
    storageUpdate.locatorHistory = locatorHistory;
    renderHistory();
  }

  try {
    await chrome.storage.local.set(storageUpdate);
    showToast('Settings saved');
  } catch {
    showToast('Failed to save settings');
  }

  // Re-render locators with new preferred format order
  if (currentLocators) renderLocators();
}

document.getElementById('settingsBtn')?.addEventListener('click', () => {
  document.getElementById('settingsModal')?.classList.add('open');
});

document.getElementById('closeSettings')?.addEventListener('click', () => {
  saveSettings();
  document.getElementById('settingsModal')?.classList.remove('open');
});

document.getElementById('settingsModal')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('settingsModal')) {
    saveSettings();
    document.getElementById('settingsModal')?.classList.remove('open');
  }
});

// Focus trap for settings modal
document.getElementById('settingsModal')?.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    saveSettings();
    document.getElementById('settingsModal')?.classList.remove('open');
    return;
  }
  if (e.key !== 'Tab') return;
  const modal = document.getElementById('settingsModal')!;
  const focusable = modal.querySelectorAll<HTMLElement>(
    'button, select, input, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

// --- Theme Toggle ---
document.getElementById('themeToggle')?.addEventListener('click', () => {
  const order = ['dark', 'light', 'system'];
  const nextIndex = (order.indexOf(currentTheme) + 1) % order.length;
  const nextTheme = order[nextIndex];
  applyTheme(nextTheme);
  chrome.storage.local.set({ theme: nextTheme });
  showToast(`Theme: ${nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1)}`);
});

// --- DOM Tree ---
document.getElementById('domTreeBtn')?.addEventListener('click', async () => {
  const isVisible = domTreeContainer.style.display !== 'none';
  if (isVisible) {
    domTreeContainer.style.display = 'none';
  } else {
    domTreeContainer.style.display = 'flex';
    await loadDomTree();
  }
});

document.getElementById('refreshDomTree')?.addEventListener('click', async () => {
  await loadDomTree();
});

async function loadDomTree() {
  domTreeEl.innerHTML = '<div class="dom-node">Loading...</div>';

  try {
    const response = await sendToTab({ type: 'GET_DOM_TREE' });

    if (response?.tree) {
      domTreeData = response.tree;
      domTreeEl.innerHTML = buildDomTreeHtml(domTreeData!);
      updateDomTreeCount();
    } else {
      domTreeEl.innerHTML = '<div class="dom-node">No DOM tree returned</div>';
    }
  } catch (e) {
    domTreeEl.innerHTML = `<div class="dom-node">${escapeHtml(e instanceof Error ? e.message : 'Error loading tree')}</div>`;
  }
}

function countNodes(node: DomTreeNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countNodes(child);
  }
  return count;
}

function updateDomTreeCount() {
  const countEl = document.getElementById('domTreeCount');
  if (!countEl) return;
  if (domTreeData) {
    countEl.textContent = `${countNodes(domTreeData)} nodes`;
  } else {
    countEl.textContent = '';
  }
}

async function loadChildren(stubEl: HTMLElement, path: number[]) {
  if (stubEl.dataset.loading === 'true') return;
  stubEl.dataset.loading = 'true';
  const originalText = stubEl.textContent;
  stubEl.textContent = 'Loading...';

  try {
    const response = await sendToTab({ type: 'GET_DOM_CHILDREN', path });
    if (response?.children?.length > 0) {
      let html = '';
      for (const child of response.children as DomTreeNode[]) {
        html += buildDomTreeHtml(child, false);
      }
      const parentChildren = stubEl.closest('.dom-children');
      if (parentChildren) {
        stubEl.remove();
        parentChildren.insertAdjacentHTML('beforeend', html);
      }
      updateDomTreeCount();
    } else {
      stubEl.textContent = '(empty)';
    }
  } catch {
    stubEl.textContent = originalText;
    stubEl.dataset.loading = 'false';
  }
}

let highlightedNodePath: string | null = null;
let highlightDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function buildDomTreeHtml(node: DomTreeNode, isRoot = true): string {
  const pathStr = node.path.join(',');
  const expandSymbol = node.hasChildren ? '&#9660;' : '&middot;';

  let html = `<div class="dom-node" data-tag="${escapeAttr(node.tag)}" data-id="${escapeAttr(node.id || '')}" data-class="${escapeAttr(node.className || '')}" data-path="${escapeAttr(pathStr)}" data-text="${escapeAttr(node.textContent || '')}" data-loaded="${node.loaded}">`;
  html += `<span class="dom-expand">${expandSymbol}</span>`;
  html += `<span class="dom-tag">${escapeHtml(node.tag)}</span>`;
  if (node.id) html += `<span class="dom-attr">#${escapeHtml(node.id)}</span>`;
  if (node.className)
    html += `<span class="dom-attr">.${escapeHtml(node.className.split(' ')[0])}</span>`;
  if (node.textContent) html += `<span class="dom-text">"${escapeHtml(node.textContent)}"</span>`;
  html += `</div>`;

  if (node.hasChildren) {
    html += '<div class="dom-children">';
    if (node.loaded) {
      for (const child of node.children) {
        html += buildDomTreeHtml(child, false);
      }
      if (node.totalChildren > node.children.length) {
        const remaining = node.totalChildren - node.children.length;
        html += `<div class="dom-more" data-path="${escapeAttr(pathStr)}">... and ${remaining} more</div>`;
      }
    } else {
      html += `<div class="dom-depth-stub" data-path="${escapeAttr(pathStr)}">&#8943; ${node.totalChildren} children</div>`;
    }
    html += '</div>';
  }

  return html;
}

domTreeEl.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;

  // Handle lazy-load stubs
  if (target.classList.contains('dom-depth-stub') || target.classList.contains('dom-more')) {
    const pathStr = target.dataset.path;
    if (pathStr) {
      const path = pathStr.split(',').map(Number);
      loadChildren(target, path);
    }
    return;
  }

  // Handle collapse/expand toggle
  if (target.classList.contains('dom-expand')) {
    const nodeEl = target.closest('.dom-node') as HTMLElement;
    if (!nodeEl) return;

    // If node is unloaded, lazy-load instead of toggling
    if (nodeEl.dataset.loaded === 'false') {
      const pathStr = nodeEl.dataset.path;
      if (pathStr) {
        const childrenEl = nodeEl.nextElementSibling;
        const stub = childrenEl?.querySelector('.dom-depth-stub') as HTMLElement;
        if (stub) {
          const path = pathStr.split(',').map(Number);
          loadChildren(stub, path);
        }
      }
      return;
    }

    const childrenEl = nodeEl.nextElementSibling;
    if (childrenEl?.classList.contains('dom-children')) {
      const isCollapsed = childrenEl.classList.contains('collapsed');
      if (isCollapsed) {
        childrenEl.classList.remove('collapsed');
        (childrenEl as HTMLElement).style.display = '';
        target.innerHTML = '&#9660;'; // ▼
      } else {
        childrenEl.classList.add('collapsed');
        (childrenEl as HTMLElement).style.display = 'none';
        target.innerHTML = '&#9654;'; // ▶
      }
    }
    return;
  }

  const nodeEl = target.closest('.dom-node') as HTMLElement;
  if (!nodeEl) return;

  const tag = nodeEl.dataset.tag || 'div';
  const id = nodeEl.dataset.id;
  const className = nodeEl.dataset.class;

  domTreeEl.querySelectorAll('.dom-node').forEach((n) => n.classList.remove('selected'));
  nodeEl.classList.add('selected');

  const info: ElementInfo = {
    tagName: tag,
    text: '',
    attributes: {},
  };
  if (id) info.attributes.id = id;
  if (className) info.attributes.class = className;

  handleElementSelected(info);
  showToast(`Selected: <${tag}>`);
});

// --- DOM Tree Hover-to-Highlight ---
domTreeEl.addEventListener('mouseover', (e) => {
  const target = e.target as HTMLElement;
  const nodeEl = target.closest('.dom-node') as HTMLElement;
  if (!nodeEl) return;

  const pathStr = nodeEl.dataset.path || '';
  if (!pathStr || pathStr === highlightedNodePath) return;

  if (highlightDebounceTimer) clearTimeout(highlightDebounceTimer);
  highlightDebounceTimer = setTimeout(() => {
    highlightedNodePath = pathStr;
    const path = pathStr.split(',').map(Number);
    sendToTab({ type: 'HIGHLIGHT_ELEMENT', path }).catch(() => {});
  }, 50);
});

domTreeEl.addEventListener('mouseleave', () => {
  if (highlightDebounceTimer) clearTimeout(highlightDebounceTimer);
  highlightedNodePath = null;
  sendToTab({ type: 'CLEAR_HIGHLIGHT' }).catch(() => {});
});

// --- DOM Tree Toolbar ---
document.getElementById('collapseAllDom')?.addEventListener('click', () => {
  domTreeEl.querySelectorAll('.dom-children').forEach((el) => {
    el.classList.add('collapsed');
    (el as HTMLElement).style.display = 'none';
  });
  domTreeEl.querySelectorAll('.dom-expand').forEach((el) => {
    if (el.innerHTML.includes('▼') || el.innerHTML.includes('9660')) {
      el.innerHTML = '&#9654;';
    }
  });
});

document.getElementById('expandAllDom')?.addEventListener('click', () => {
  domTreeEl.querySelectorAll('.dom-children').forEach((el) => {
    // Only expand loaded nodes (no stubs inside)
    if (!el.querySelector('.dom-depth-stub')) {
      el.classList.remove('collapsed');
      (el as HTMLElement).style.display = '';
    }
  });
  domTreeEl.querySelectorAll('.dom-expand').forEach((el) => {
    const nodeEl = el.closest('.dom-node') as HTMLElement;
    if (nodeEl?.dataset.loaded !== 'false') {
      el.innerHTML = '&#9660;';
    }
  });
});

// --- DOM Tree Search ---
let domSearchTimer: ReturnType<typeof setTimeout> | null = null;

document.getElementById('domTreeSearch')?.addEventListener('input', (e) => {
  const query = (e.target as HTMLInputElement).value.trim().toLowerCase();
  if (domSearchTimer) clearTimeout(domSearchTimer);
  domSearchTimer = setTimeout(() => filterDomTree(query), 150);
});

function filterDomTree(query: string) {
  const allNodes = domTreeEl.querySelectorAll('.dom-node');
  const countEl = document.getElementById('domTreeCount');

  if (!query) {
    allNodes.forEach((n) => {
      n.classList.remove('filtered-out', 'search-match');
    });
    updateDomTreeCount();
    return;
  }

  let matchCount = 0;

  allNodes.forEach((n) => {
    const el = n as HTMLElement;
    const tag = el.dataset.tag || '';
    const id = el.dataset.id || '';
    const cls = el.dataset.class || '';
    const text = el.dataset.text || '';
    const haystack = `${tag} ${id} ${cls} ${text}`.toLowerCase();

    if (haystack.includes(query)) {
      el.classList.remove('filtered-out');
      el.classList.add('search-match');
      matchCount++;
      // Expand parent chain
      let parent = el.parentElement;
      while (parent && parent !== domTreeEl) {
        if (parent.classList.contains('dom-children')) {
          parent.classList.remove('collapsed');
          parent.style.display = '';
          const prevNode = parent.previousElementSibling;
          if (prevNode?.classList.contains('dom-node')) {
            const expandEl = prevNode.querySelector('.dom-expand');
            if (expandEl) expandEl.innerHTML = '&#9660;';
          }
        }
        if (parent.classList.contains('dom-node')) {
          parent.classList.remove('filtered-out');
        }
        parent = parent.parentElement;
      }
    } else {
      el.classList.add('filtered-out');
      el.classList.remove('search-match');
    }
  });

  if (countEl) {
    countEl.textContent = `${matchCount} matches`;
  }
}

// --- Build Mode Toggle ---
structuredLabel?.addEventListener('click', () => {
  isFreeformMode = false;
  structuredLabel.classList.add('active');
  structuredLabel.setAttribute('aria-pressed', 'true');
  freeformLabel?.classList.remove('active');
  freeformLabel?.setAttribute('aria-pressed', 'false');
  structuredFields.style.display = 'block';
  freeformFields.style.display = 'none';
});

freeformLabel?.addEventListener('click', () => {
  isFreeformMode = true;
  freeformLabel.classList.add('active');
  freeformLabel.setAttribute('aria-pressed', 'true');
  structuredLabel?.classList.remove('active');
  structuredLabel?.setAttribute('aria-pressed', 'false');
  structuredFields.style.display = 'none';
  freeformFields.style.display = 'block';
});

// --- Structured Build: DOM References ---
const structuredType = document.getElementById('structuredType') as HTMLSelectElement;
const pwMethod = document.getElementById('pwMethod') as HTMLSelectElement;
const cyMethod = document.getElementById('cyMethod') as HTMLSelectElement;
const structuredChainStepsEl = document.getElementById('structuredChainSteps')!;
let structuredChainCounter = 0;

// --- Structured: Framework visibility switching ---
structuredType?.addEventListener('change', () => {
  for (const el of document.querySelectorAll('.structured-framework-fields')) {
    (el as HTMLElement).style.display = 'none';
  }
  const target = document.getElementById(`sf-${structuredType.value}`);
  if (target) target.style.display = 'block';
  structuredChainStepsEl.innerHTML = '';
});

// --- Structured: Playwright method switching ---
pwMethod?.addEventListener('change', () => {
  for (const el of document.querySelectorAll('.pw-method-fields')) {
    (el as HTMLElement).style.display = 'none';
  }
  const target = document.getElementById(`pw-${pwMethod.value}-fields`);
  if (target) target.style.display = 'block';
});

// --- Structured: Cypress method switching ---
cyMethod?.addEventListener('change', () => {
  for (const el of document.querySelectorAll('.cy-method-fields')) {
    (el as HTMLElement).style.display = 'none';
  }
  const id = `cy-${cyMethod.value.replace('cy.', '')}-fields`;
  const target = document.getElementById(id);
  if (target) target.style.display = 'block';
});

// --- Structured: Per-framework generation ---
function generatePlaywrightStructured(): string {
  const method = pwMethod.value;
  switch (method) {
    case 'getByRole': {
      const role = (document.getElementById('pwRole') as HTMLSelectElement).value;
      if (!role) return '';
      const name = (document.getElementById('pwRoleName') as HTMLInputElement).value.trim();
      const exact = (document.getElementById('pwRoleExact') as HTMLInputElement).checked;
      if (name) {
        const opts = exact
          ? `{ name: '${escapeSingleQuoteJs(name)}', exact: true }`
          : `{ name: '${escapeSingleQuoteJs(name)}' }`;
        return `page.getByRole('${role}', ${opts})`;
      }
      return `page.getByRole('${role}')`;
    }
    case 'getByText': {
      const text = (document.getElementById('pwText') as HTMLInputElement).value.trim();
      if (!text) return '';
      const exact = (document.getElementById('pwTextExact') as HTMLInputElement).checked;
      return exact
        ? `page.getByText('${escapeSingleQuoteJs(text)}', { exact: true })`
        : `page.getByText('${escapeSingleQuoteJs(text)}')`;
    }
    case 'getByTestId': {
      const tid = (document.getElementById('pwTestId') as HTMLInputElement).value.trim();
      return tid ? `page.getByTestId('${escapeSingleQuoteJs(tid)}')` : '';
    }
    case 'getByLabel': {
      const label = (document.getElementById('pwLabel') as HTMLInputElement).value.trim();
      if (!label) return '';
      const exact = (document.getElementById('pwLabelExact') as HTMLInputElement).checked;
      return exact
        ? `page.getByLabel('${escapeSingleQuoteJs(label)}', { exact: true })`
        : `page.getByLabel('${escapeSingleQuoteJs(label)}')`;
    }
    case 'getByPlaceholder': {
      const ph = (document.getElementById('pwPlaceholder') as HTMLInputElement).value.trim();
      if (!ph) return '';
      const exact = (document.getElementById('pwPlaceholderExact') as HTMLInputElement).checked;
      return exact
        ? `page.getByPlaceholder('${escapeSingleQuoteJs(ph)}', { exact: true })`
        : `page.getByPlaceholder('${escapeSingleQuoteJs(ph)}')`;
    }
    case 'getByAltText': {
      const alt = (document.getElementById('pwAltText') as HTMLInputElement).value.trim();
      if (!alt) return '';
      const exact = (document.getElementById('pwAltTextExact') as HTMLInputElement).checked;
      return exact
        ? `page.getByAltText('${escapeSingleQuoteJs(alt)}', { exact: true })`
        : `page.getByAltText('${escapeSingleQuoteJs(alt)}')`;
    }
    case 'getByTitle': {
      const title = (document.getElementById('pwTitle') as HTMLInputElement).value.trim();
      if (!title) return '';
      const exact = (document.getElementById('pwTitleExact') as HTMLInputElement).checked;
      return exact
        ? `page.getByTitle('${escapeSingleQuoteJs(title)}', { exact: true })`
        : `page.getByTitle('${escapeSingleQuoteJs(title)}')`;
    }
    case 'locator': {
      const sel = (document.getElementById('pwLocatorSelector') as HTMLInputElement).value.trim();
      return sel ? `page.locator('${escapeSingleQuoteJs(sel)}')` : '';
    }
    default:
      return '';
  }
}

function generateCssStructured(): string {
  const tag = (document.getElementById('cssTag') as HTMLSelectElement).value;
  const id = (document.getElementById('cssId') as HTMLInputElement).value.trim();
  const cls = (document.getElementById('cssClass') as HTMLInputElement).value.trim();
  const attrName = (document.getElementById('cssAttrName') as HTMLInputElement).value.trim();
  const attrValue = (document.getElementById('cssAttrValue') as HTMLInputElement).value.trim();

  let result = tag || '';
  if (id) {
    result = `${result}#${cssEscape(id)}`;
  }
  if (cls) {
    const classes = cls.split(/\s+/).filter(Boolean);
    for (const c of classes) {
      result += `.${cssEscape(c)}`;
    }
  }
  if (attrName) {
    if (attrValue) {
      result += `[${attrName}="${escapeCssAttrValue(attrValue)}"]`;
    } else {
      result += `[${attrName}]`;
    }
  }
  return result || '';
}

function generateXpathStructured(): string {
  const axis = (document.getElementById('xpathAxis') as HTMLSelectElement).value;
  const tag = (document.getElementById('xpathTag') as HTMLInputElement).value.trim() || '*';
  const predicate = (document.getElementById('xpathPredicate') as HTMLInputElement).value.trim();

  let result = `${axis}${tag}`;
  if (predicate) {
    result += `[${predicate}]`;
  }
  return result;
}

function generateCypressStructured(): string {
  const method = cyMethod.value;
  switch (method) {
    case 'cy.get': {
      const sel = (document.getElementById('cyGetSelector') as HTMLInputElement).value.trim();
      return sel ? `cy.get('${escapeSingleQuoteJs(sel)}')` : '';
    }
    case 'cy.contains': {
      const tag = (document.getElementById('cyContainsTag') as HTMLInputElement).value.trim();
      const text = (document.getElementById('cyContainsText') as HTMLInputElement).value.trim();
      if (!text) return '';
      return tag
        ? `cy.contains('${escapeSingleQuoteJs(tag)}', '${escapeSingleQuoteJs(text)}')`
        : `cy.contains('${escapeSingleQuoteJs(text)}')`;
    }
    case 'cy.findByRole': {
      const role = (document.getElementById('cyFindByRoleRole') as HTMLInputElement).value.trim();
      if (!role) return '';
      const name = (document.getElementById('cyFindByRoleName') as HTMLInputElement).value.trim();
      return name
        ? `cy.findByRole('${escapeSingleQuoteJs(role)}', { name: '${escapeSingleQuoteJs(name)}' })`
        : `cy.findByRole('${escapeSingleQuoteJs(role)}')`;
    }
    case 'cy.findByText': {
      const text = (document.getElementById('cyFindByTextText') as HTMLInputElement).value.trim();
      return text ? `cy.findByText('${escapeSingleQuoteJs(text)}')` : '';
    }
    case 'cy.findByTestId': {
      const tid = (document.getElementById('cyFindByTestIdValue') as HTMLInputElement).value.trim();
      return tid ? `cy.findByTestId('${escapeSingleQuoteJs(tid)}')` : '';
    }
    default:
      return '';
  }
}

function generateSeleniumStructured(): string {
  const strategy = (document.getElementById('seStrategy') as HTMLSelectElement).value;
  const value = (document.getElementById('seValue') as HTMLInputElement).value.trim();
  if (!value) return '';
  return `driver.findElement(${strategy}("${escapeDoubleQuoteJs(value)}"))`;
}

function generateStructuredLocator(): { locator: string; framework: string } {
  const framework = structuredType.value;
  let locator = '';
  switch (framework) {
    case 'playwright':
      locator = generatePlaywrightStructured();
      break;
    case 'css':
      locator = generateCssStructured();
      break;
    case 'xpath':
      locator = generateXpathStructured();
      break;
    case 'cypress':
      locator = generateCypressStructured();
      break;
    case 'selenium':
      locator = generateSeleniumStructured();
      break;
  }
  return { locator, framework };
}

// --- Structured: Chain steps ---
function getStructuredChainOptions(framework: string): string {
  switch (framework) {
    case 'playwright':
      return `
        <option value="locator">.locator()</option>
        <option value="filter-text">.filter({ hasText })</option>
        <option value="filter-has">.filter({ has })</option>
        <option value="nth">.nth()</option>
        <option value="first">.first()</option>
        <option value="last">.last()</option>
        <option value="and">.and()</option>
        <option value="getByRole">getByRole()</option>
        <option value="getByText">getByText()</option>
        <option value="getByTestId">getByTestId()</option>
        <option value="getByLabel">getByLabel()</option>
        <option value="getByPlaceholder">getByPlaceholder()</option>
      `;
    case 'css':
      return `
        <option value="descendant">descendant</option>
        <option value="child">&gt; child</option>
        <option value="sibling">~ sibling</option>
        <option value="adjacent">+ adjacent</option>
        <option value="pseudo">:pseudo</option>
        <option value="nth">:nth-child()</option>
      `;
    case 'xpath':
      return `
        <option value="descendant">//descendant</option>
        <option value="child">/child</option>
        <option value="predicate">[predicate]</option>
        <option value="position">[position]</option>
        <option value="ancestor">//ancestor</option>
        <option value="following">//following</option>
      `;
    case 'cypress':
      return `
        <option value="find">.find()</option>
        <option value="children">.children()</option>
        <option value="filter">.filter()</option>
        <option value="contains">.contains()</option>
        <option value="eq">.eq()</option>
        <option value="first">.first()</option>
        <option value="last">.last()</option>
        <option value="parent">.parent()</option>
      `;
    case 'selenium':
      return `
        <option value="findElement">.findElement()</option>
        <option value="findElements">.findElements()</option>
        <option value="get">.get(index)</option>
      `;
    default:
      return '';
  }
}

function addStructuredChainStep() {
  const framework = structuredType.value;
  const stepId = `sc-chain-${structuredChainCounter++}`;
  const options = getStructuredChainOptions(framework);

  const stepHtml = `<div class="chain-step" id="${stepId}">
    <select class="chain-method" title="Method">${options}</select>
    <input type="text" class="chain-value" placeholder="value" autocomplete="off" spellcheck="false">
    <button type="button" class="chain-step-remove" title="Remove">&times;</button>
  </div>`;
  structuredChainStepsEl.insertAdjacentHTML('beforeend', stepHtml);

  const step = document.getElementById(stepId)!;
  step.querySelector('.chain-step-remove')!.addEventListener('click', () => step.remove());

  const methodSelect = step.querySelector('.chain-method') as HTMLSelectElement;
  const valueInput = step.querySelector('.chain-value') as HTMLInputElement;
  methodSelect.addEventListener('change', () => {
    const noArgs = ['first', 'last'];
    if (noArgs.includes(methodSelect.value)) {
      valueInput.value = '';
      valueInput.placeholder = '(no value)';
      valueInput.disabled = true;
    } else {
      valueInput.disabled = false;
      valueInput.placeholder = 'value';
    }
  });
}

document.getElementById('addStructuredChainStep')?.addEventListener('click', () => {
  addStructuredChainStep();
});

function applyStructuredChain(base: string, framework: string): string {
  const steps: { method: string; value: string }[] = [];
  structuredChainStepsEl.querySelectorAll('.chain-step').forEach((step) => {
    const method = (step.querySelector('.chain-method') as HTMLSelectElement).value;
    const value = (step.querySelector('.chain-value') as HTMLInputElement).value.trim();
    steps.push({ method, value });
  });

  if (steps.length === 0) return base;

  let result = base;
  for (const { method, value } of steps) {
    if (framework === 'playwright') {
      switch (method) {
        case 'locator':
          result += `.locator('${escapeSingleQuoteJs(value)}')`;
          break;
        case 'filter-text':
          result += `.filter({ hasText: '${escapeSingleQuoteJs(value)}' })`;
          break;
        case 'filter-has':
          result += `.filter({ has: page.locator('${escapeSingleQuoteJs(value)}') })`;
          break;
        case 'nth':
          result += `.nth(${value})`;
          break;
        case 'first':
          result += '.first()';
          break;
        case 'last':
          result += '.last()';
          break;
        case 'and':
          result += `.and(page.locator('${escapeSingleQuoteJs(value)}'))`;
          break;
        case 'getByRole':
          result += value.includes(',')
            ? `.getByRole('${value.split(',')[0].trim()}', { name: '${value.split(',').slice(1).join(',').trim()}' })`
            : `.getByRole('${escapeSingleQuoteJs(value)}')`;
          break;
        case 'getByText':
          result += `.getByText('${escapeSingleQuoteJs(value)}')`;
          break;
        case 'getByTestId':
          result += `.getByTestId('${escapeSingleQuoteJs(value)}')`;
          break;
        case 'getByLabel':
          result += `.getByLabel('${escapeSingleQuoteJs(value)}')`;
          break;
        case 'getByPlaceholder':
          result += `.getByPlaceholder('${escapeSingleQuoteJs(value)}')`;
          break;
      }
    } else if (framework === 'cypress') {
      switch (method) {
        case 'find':
          result += `.find('${escapeSingleQuoteJs(value)}')`;
          break;
        case 'children':
          result += value ? `.children('${escapeSingleQuoteJs(value)}')` : '.children()';
          break;
        case 'filter':
          result += `.filter('${escapeSingleQuoteJs(value)}')`;
          break;
        case 'contains':
          result += `.contains('${escapeSingleQuoteJs(value)}')`;
          break;
        case 'eq':
          result += `.eq(${value})`;
          break;
        case 'first':
          result += '.first()';
          break;
        case 'last':
          result += '.last()';
          break;
        case 'parent':
          result += value ? `.parent('${escapeSingleQuoteJs(value)}')` : '.parent()';
          break;
      }
    } else if (framework === 'xpath') {
      switch (method) {
        case 'descendant':
          result += `//${value}`;
          break;
        case 'child':
          result += `/${value}`;
          break;
        case 'predicate':
          result += `[${value}]`;
          break;
        case 'position':
          result += `[${value}]`;
          break;
        case 'ancestor':
          result += `/ancestor::${value}`;
          break;
        case 'following':
          result += `/following-sibling::${value}`;
          break;
      }
    } else if (framework === 'selenium') {
      switch (method) {
        case 'findElement':
          result = `${result.slice(0, -1)}.findElement(By.cssSelector("${escapeDoubleQuoteJs(value)}"))`;
          break;
        case 'findElements':
          result = `${result.slice(0, -1)}.findElements(By.cssSelector("${escapeDoubleQuoteJs(value)}"))`;
          break;
        case 'get':
          result += `.get(${value})`;
          break;
      }
    } else {
      // CSS
      switch (method) {
        case 'descendant':
          result += ` ${value}`;
          break;
        case 'child':
          result += ` > ${value}`;
          break;
        case 'sibling':
          result += ` ~ ${value}`;
          break;
        case 'adjacent':
          result += ` + ${value}`;
          break;
        case 'pseudo':
          result += `:${value}`;
          break;
        case 'nth':
          result += `:nth-child(${value})`;
          break;
      }
    }
  }

  return result;
}

// --- Structured: Extract testable selector from generated locator ---
function extractTestableSelector(
  locator: string,
  framework: string
): { selector: string; selectorType: string } | null {
  if (framework === 'css') {
    return { selector: locator, selectorType: 'css' };
  }
  if (framework === 'xpath') {
    return { selector: locator, selectorType: 'xpath' };
  }
  if (framework === 'playwright') {
    // Try to extract the inner selector for page testing
    const match = locator.match(/page\.(locator|getBy\w+)\((['"`])(.*?)\2/);
    if (match) return { selector: match[3], selectorType: 'css' };
    return null;
  }
  if (framework === 'cypress') {
    const match = locator.match(/cy\.(get|contains)\((['"`])(.*?)\2/);
    if (match) return { selector: match[3], selectorType: 'css' };
    return null;
  }
  if (framework === 'selenium') {
    const match = locator.match(/By\.\w+\((['"`])(.*?)\1\)/);
    if (match) return { selector: match[2], selectorType: 'css' };
    return null;
  }
  return null;
}

// --- Structured: Test on page helper ---
async function testStructuredOnPage(
  selector: string,
  selectorType: string,
  matchCountEl: HTMLElement
) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    await sendToTab({ type: 'TEST_SELECTOR', selector, selectorType });

    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (sel: string, selType: string) => {
        try {
          if (selType === 'xpath') {
            const xpathResult = document.evaluate(
              sel,
              document,
              null,
              XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
              null
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

    const count = result?.[0]?.result;
    if (count !== undefined && count >= 0) {
      matchCountEl.innerHTML = `<span class="match-dot"></span>${count} element${count !== 1 ? 's' : ''} found`;
      matchCountEl.classList.remove('error');
    } else {
      matchCountEl.textContent = 'Invalid selector';
      matchCountEl.classList.add('error');
    }
    matchCountEl.style.display = 'inline-flex';
  } catch {
    matchCountEl.textContent = 'Cannot test on this page';
    matchCountEl.classList.add('error');
    matchCountEl.style.display = 'inline-flex';
  }
}

// --- Structured: Render single locator result ---
function renderSingleLocatorRow(container: HTMLElement, locator: string, framework: string) {
  const badgeMap: Record<string, { label: string; cls: string }> = {
    playwright: { label: 'PW', cls: 'pw' },
    css: { label: 'CSS', cls: 'css' },
    xpath: { label: 'XPATH', cls: 'xpath' },
    cypress: { label: 'CY', cls: 'cy' },
    selenium: { label: 'SE', cls: 'se' },
  };
  const badge = badgeMap[framework] || { label: framework.toUpperCase(), cls: framework };

  container.innerHTML = `
    <div class="locator-row preferred" data-locator="${escapeAttr(locator)}">
      <span class="locator-badge ${badge.cls}">${badge.label}</span>
      <span class="locator-value" title="${escapeAttr(locator)}">${escapeHtml(locator)}</span>
      <button type="button" class="copy-btn">Copy</button>
    </div>
  `;

  const row = container.querySelector('.locator-row')!;
  const copyBtn = row.querySelector('.copy-btn') as HTMLElement;
  const doCopy = () => {
    navigator.clipboard.writeText(locator);
    copyBtn.classList.add('copied');
    copyBtn.textContent = 'Done';
    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyBtn.textContent = 'Copy';
    }, 1500);
  };
  row.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.copy-btn')) return;
    doCopy();
  });
  copyBtn.addEventListener('click', doCopy);
}

// --- Structured: Generate button ---
document.getElementById('structuredGenerateBtn')?.addEventListener('click', async () => {
  const { locator, framework } = generateStructuredLocator();
  if (!locator) {
    showToast('Fill in at least one field');
    return;
  }

  const finalLocator = applyStructuredChain(locator, framework);
  const resultEl = document.getElementById('structuredResult')!;
  const matchEl = document.getElementById('structuredMatchCount')!;

  renderSingleLocatorRow(resultEl, finalLocator, framework);

  // Test on page
  const testable = extractTestableSelector(finalLocator, framework);
  if (testable) {
    await testStructuredOnPage(testable.selector, testable.selectorType, matchEl);
  } else {
    matchEl.style.display = 'none';
  }

  showToast('Locator generated!');
});

// --- Structured: Generate All Formats button ---
document.getElementById('structuredGenerateAllBtn')?.addEventListener('click', async () => {
  // Reverse-map to ElementInfo from current framework fields
  const framework = structuredType.value;
  let element: ElementInfo;

  if (framework === 'css') {
    const tag = (document.getElementById('cssTag') as HTMLSelectElement).value || 'div';
    const id = (document.getElementById('cssId') as HTMLInputElement).value.trim();
    const cls = (document.getElementById('cssClass') as HTMLInputElement).value.trim();
    const attrName = (document.getElementById('cssAttrName') as HTMLInputElement).value.trim();
    const attrValue = (document.getElementById('cssAttrValue') as HTMLInputElement).value.trim();
    element = { tagName: tag, text: '', attributes: {} };
    if (id) element.attributes.id = id;
    if (cls) element.attributes.class = cls;
    if (attrName && attrValue) element.attributes[attrName] = attrValue;
  } else if (framework === 'xpath') {
    const tag = (document.getElementById('xpathTag') as HTMLInputElement).value.trim() || 'div';
    element = { tagName: tag, text: '', attributes: {} };
  } else if (framework === 'playwright') {
    // Extract what we can from PW fields
    const method = pwMethod.value;
    element = { tagName: 'div', text: '', attributes: {} };
    if (method === 'getByRole') {
      const role = (document.getElementById('pwRole') as HTMLSelectElement).value;
      if (role) element.attributes.role = role;
      const name = (document.getElementById('pwRoleName') as HTMLInputElement).value.trim();
      if (name) element.attributes['aria-label'] = name;
    } else if (method === 'getByTestId') {
      const tid = (document.getElementById('pwTestId') as HTMLInputElement).value.trim();
      if (tid) element.attributes['data-testid'] = tid;
    } else if (method === 'getByLabel') {
      const label = (document.getElementById('pwLabel') as HTMLInputElement).value.trim();
      if (label) element.attributes['aria-label'] = label;
    } else if (method === 'getByPlaceholder') {
      const ph = (document.getElementById('pwPlaceholder') as HTMLInputElement).value.trim();
      if (ph) element.attributes.placeholder = ph;
    } else if (method === 'getByText') {
      const text = (document.getElementById('pwText') as HTMLInputElement).value.trim();
      if (text) element.text = text;
    }
  } else if (framework === 'cypress') {
    const method = cyMethod.value;
    element = { tagName: 'div', text: '', attributes: {} };
    if (method === 'cy.findByTestId') {
      const tid = (document.getElementById('cyFindByTestIdValue') as HTMLInputElement).value.trim();
      if (tid) element.attributes['data-testid'] = tid;
    } else if (method === 'cy.findByRole') {
      const role = (document.getElementById('cyFindByRoleRole') as HTMLInputElement).value.trim();
      if (role) element.attributes.role = role;
    }
  } else if (framework === 'selenium') {
    const strategy = (document.getElementById('seStrategy') as HTMLSelectElement).value;
    const value = (document.getElementById('seValue') as HTMLInputElement).value.trim();
    element = { tagName: 'div', text: '', attributes: {} };
    if (strategy === 'By.id' && value) element.attributes.id = value;
    else if (strategy === 'By.name' && value) element.attributes.name = value;
    else if (strategy === 'By.className' && value) element.attributes.class = value;
  } else {
    element = { tagName: 'div', text: '', attributes: {} };
  }

  const locators = generateLocators(element);
  const resultEl = document.getElementById('structuredResult')!;
  renderLocatorRows(resultEl, locators);

  await saveToHistory(element, locators);
  updateStats();

  showToast('All formats generated!');
});

// --- Freeform Suggestions ---
const suggestionsByType: Record<string, Suggestion[]> = {
  css: [
    { type: 'ID', label: '#element-id', code: '#' },
    { type: 'Class', label: 'tag.class-name', code: '.' },
    { type: 'Attr', label: '[data-testid="value"]', code: '[data-testid="' },
    { type: 'Attr', label: '[name="value"]', code: '[name="' },
    { type: 'Tag', label: 'div', code: 'div' },
    { type: 'Tag', label: 'button', code: 'button' },
    { type: 'Tag', label: 'input', code: 'input' },
    { type: 'Tag', label: 'a', code: 'a' },
  ],
  xpath: [
    { type: 'Attr', label: '//*[@id=""]', code: '//*[@id="' },
    { type: 'Attr', label: '//*[@class=""]', code: '//*[@class="' },
    { type: 'Attr', label: '//*[@data-testid=""]', code: '//*[@data-testid="' },
    { type: 'Text', label: '//*[text()=""]', code: '//*[text()="' },
    { type: 'Contains', label: '//*[contains(text(),"")]', code: '//*[contains(text(),"' },
    { type: 'Tag', label: '//button', code: '//button' },
    { type: 'Tag', label: '//input', code: '//input' },
    { type: 'Tag', label: '//a', code: '//a' },
  ],
  playwright: [
    { type: 'locator', label: "page.locator('')", code: "page.locator('')" },
    {
      type: 'role',
      label: "getByRole('button', { name: '' })",
      code: "page.getByRole('button', { name: '' })",
    },
    { type: 'label', label: "getByLabel('')", code: "page.getByLabel('')" },
    { type: 'placeholder', label: "getByPlaceholder('')", code: "page.getByPlaceholder('')" },
    { type: 'text', label: "getByText('')", code: "page.getByText('')" },
    { type: 'testid', label: "getByTestId('')", code: "page.getByTestId('')" },
    { type: 'alt', label: "getByAltText('')", code: "page.getByAltText('')" },
    { type: 'title', label: "getByTitle('')", code: "page.getByTitle('')" },
  ],
  cypress: [
    { type: 'get', label: "cy.get('')", code: "cy.get('')" },
    { type: 'contains', label: "cy.contains('')", code: "cy.contains('')" },
    { type: 'get', label: 'cy.get(\'[data-testid=""]\')', code: 'cy.get(\'[data-testid=""]\')' },
  ],
  selenium: [
    { type: 'css', label: 'By.cssSelector("")', code: 'driver.findElement(By.cssSelector(""))' },
    { type: 'xpath', label: 'By.xpath("")', code: 'driver.findElement(By.xpath(""))' },
    { type: 'id', label: 'By.id("")', code: 'driver.findElement(By.id(""))' },
    { type: 'name', label: 'By.name("")', code: 'driver.findElement(By.name(""))' },
    { type: 'class', label: 'By.className("")', code: 'driver.findElement(By.className(""))' },
  ],
};

function getSuggestions(input: string, type: string): Suggestion[] {
  const baseSuggestions = suggestionsByType[type] || suggestionsByType.css;

  let results: Suggestion[];
  if (!input) {
    results = baseSuggestions.slice(0, 8);
  } else {
    const lower = input.toLowerCase();
    results = baseSuggestions
      .filter((s) => s.label.toLowerCase().includes(lower) || s.code.toLowerCase().includes(lower))
      .slice(0, 8);
  }

  // Merge page-aware suggestions
  if (pageSuggestionsCache && input.length > 0 && (type === 'css' || type === 'xpath')) {
    const lower = input.toLowerCase();
    const pageSuggestions: Suggestion[] = [];

    for (const category of ['id', 'testid', 'class', 'role']) {
      const limit = category === 'role' ? 2 : 3;
      const items = pageSuggestionsCache[category];
      if (items) {
        items
          .filter((s) => s.code.toLowerCase().includes(lower))
          .slice(0, limit)
          .forEach((s) => pageSuggestions.push({ ...s, type: `page` }));
      }
    }

    if (pageSuggestions.length > 0) {
      results = [...pageSuggestions, ...results];
    }
  }

  return results.slice(0, 10);
}

function renderSuggestions(items: Suggestion[]) {
  if (items.length === 0) {
    suggestionsEl.style.display = 'none';
    return;
  }

  suggestionsEl.innerHTML = items
    .map(
      (item) => `
    <div class="suggestion-item" data-code="${escapeAttr(item.code)}">
      <span class="suggestion-type">${escapeHtml(item.type)}</span> ${escapeHtml(item.label)}
    </div>
  `
    )
    .join('');

  suggestionsEl.style.display = 'block';

  suggestionsEl.querySelectorAll('.suggestion-item').forEach((el) => {
    el.addEventListener('click', () => {
      const code = (el as HTMLElement).dataset.code || '';
      freeformInput.value = code;
      suggestionsEl.style.display = 'none';
      freeformInput.focus();
      testFreeformLocator();
    });
  });
}

freeformInput?.addEventListener('input', () => {
  const input = freeformInput.value;

  // Auto-detect locator type and sync dropdown
  const detected = detectLocatorType(input.trim());
  if (freeformType.value !== detected) {
    freeformType.value = detected;
  }

  const type = freeformType.value;
  renderSuggestions(getSuggestions(input, type));

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    testFreeformLocator();
  }, 300);
});

freeformInput?.addEventListener('focus', () => {
  const input = freeformInput.value;
  const type = freeformType.value;
  renderSuggestions(getSuggestions(input, type));
});

freeformType?.addEventListener('change', () => {
  renderSuggestions(getSuggestions(freeformInput.value, freeformType.value));
  testFreeformLocator();
});

document.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('.freeform-field')) {
    suggestionsEl.style.display = 'none';
  }
});

// --- Freeform: Auto-detect type ---
function detectLocatorType(input: string): string {
  if (input.startsWith('//') || input.startsWith('(/')) return 'xpath';
  if (input.startsWith('page.')) return 'playwright';
  if (input.startsWith('cy.')) return 'cypress';
  if (input.startsWith('driver.')) return 'selenium';
  return 'css';
}

// --- Freeform Test ---
async function testFreeformLocator() {
  const selector = freeformInput.value.trim();
  const type = freeformType.value;

  if (!selector) {
    matchCountEl.style.display = 'none';
    return;
  }

  let cssSelector = selector;
  const selectorType = type === 'xpath' ? 'xpath' : 'css';

  if (type === 'playwright') {
    const match = selector.match(/page\.(locator|getBy\w+)\((['"`])(.*?)\2/);
    if (match) cssSelector = match[3];
    else {
      matchCountEl.textContent = 'Cannot extract selector from Playwright syntax';
      matchCountEl.classList.add('error');
      matchCountEl.style.display = 'block';
      return;
    }
  } else if (type === 'cypress') {
    const match = selector.match(/cy\.(get|contains)\((['"`])(.*?)\2/);
    if (match) cssSelector = match[3];
  } else if (type === 'selenium') {
    const match = selector.match(/By\.\w+\((['"`])(.*?)\1\)/);
    if (match) cssSelector = match[2];
    else {
      const match2 = selector.match(/findElement\(By\.\w+\((['"`])(.*?)\1\)\)/);
      if (match2) cssSelector = match2[2];
    }
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    await sendToTab({ type: 'TEST_SELECTOR', selector: cssSelector, selectorType });

    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (sel: string, selType: string) => {
        try {
          if (selType === 'xpath') {
            const xpathResult = document.evaluate(
              sel,
              document,
              null,
              XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
              null
            );
            return xpathResult.snapshotLength;
          }
          return document.querySelectorAll(sel).length;
        } catch {
          return -1;
        }
      },
      args: [cssSelector, selectorType],
    });

    const count = result?.[0]?.result;
    if (count !== undefined && count >= 0) {
      matchCountEl.textContent = `${count} element${count !== 1 ? 's' : ''} found`;
      matchCountEl.classList.remove('error');
    } else {
      matchCountEl.textContent = 'Invalid selector';
      matchCountEl.classList.add('error');
    }
    matchCountEl.style.display = 'block';
  } catch {
    matchCountEl.textContent = 'Cannot test on this page';
    matchCountEl.classList.add('error');
    matchCountEl.style.display = 'block';
  }
}

document.getElementById('testFreeformBtn')?.addEventListener('click', () => {
  testFreeformLocator();
});

// --- Page-Aware Suggestions ---
async function fetchPageSuggestions(): Promise<Record<string, Suggestion[]> | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('about:')) return null;

    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const suggestions: Record<string, Array<{ type: string; label: string; code: string }>> = {
          id: [],
          class: [],
          testid: [],
          role: [],
        };

        document.querySelectorAll('[id]').forEach((el) => {
          if (el.id && !el.id.includes(' ') && el.id.length < 50) {
            suggestions.id.push({ type: 'ID', label: `#${el.id}`, code: `#${el.id}` });
          }
        });

        document.querySelectorAll('[data-testid]').forEach((el) => {
          const val = el.getAttribute('data-testid');
          if (val)
            suggestions.testid.push({
              type: 'testid',
              label: `[data-testid="${val}"]`,
              code: `[data-testid="${val}"]`,
            });
        });
        document.querySelectorAll('[data-test]').forEach((el) => {
          const val = el.getAttribute('data-test');
          if (val)
            suggestions.testid.push({
              type: 'testid',
              label: `[data-test="${val}"]`,
              code: `[data-test="${val}"]`,
            });
        });

        const seen = new Set<string>();
        document.querySelectorAll('[class]').forEach((el) => {
          const cn = el.className;
          if (typeof cn === 'string') {
            cn.split(' ')
              .filter((c) => c && c.length < 30 && !seen.has(c))
              .slice(0, 2)
              .forEach((c) => {
                seen.add(c);
                suggestions.class.push({ type: 'class', label: `.${c}`, code: `.${c}` });
              });
          }
        });

        const roles = new Set<string>();
        document.querySelectorAll('[role]').forEach((el) => {
          const role = el.getAttribute('role');
          if (role && !roles.has(role)) {
            roles.add(role);
            suggestions.role.push({
              type: 'role',
              label: `[role="${role}"]`,
              code: `[role="${role}"]`,
            });
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

document.addEventListener('visibilitychange', async () => {
  if (!document.hidden) {
    pageSuggestionsCache = null; // Invalidate cache on tab switch
  }
});

async function ensurePageSuggestions() {
  if (!pageSuggestionsCache) {
    pageSuggestionsCache = await fetchPageSuggestions();
  }
}

// --- Keyboard Shortcuts Info ---
document.getElementById('shortcutsBtn')?.addEventListener('click', () => {
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const mod = isMac ? '⌘' : 'Ctrl';
  showToast(`${mod}+Shift+L: Toggle picker`);
});

// --- Init ---
async function checkConnection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('about:')) {
      connectionDot.classList.remove('warn', 'off');
      connectionStatus.textContent = 'Connected';
    } else {
      connectionDot.classList.add('off');
      connectionDot.classList.remove('warn');
      connectionStatus.textContent = 'No page';
    }
  } catch {
    connectionDot.classList.add('off');
    connectionDot.classList.remove('warn');
    connectionStatus.textContent = 'No page';
  }
}

checkConnection();
(async () => {
  await loadSettings();
  await loadHistory();
})();

chrome.tabs.onActivated.addListener(checkConnection);
chrome.tabs.onUpdated.addListener(checkConnection);
