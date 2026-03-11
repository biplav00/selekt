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
  depth: number;
  hasChildren: boolean;
  children: DomTreeNode[];
  childCount?: number;
}

// --- Utilities ---
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(value);
  }
  // Fallback: escape special CSS characters
  return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/content.js']
      });
      await new Promise(r => setTimeout(r, 150));
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

// --- State ---
let currentElement: ElementInfo | null = null;
let currentLocators: Locators | null = null;
let activeFormat: keyof Locators = 'xpath';
let locatorHistory: HistoryItem[] = [];
let historyLimit = 50;
let pageSuggestionsCache: Record<string, Suggestion[]> | null = null;
let domTreeData: DomTreeNode | null = null;
let debounceTimer: number | null = null;
let isFreeformMode = false;
let pickTimeout: ReturnType<typeof setTimeout> | null = null;

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
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.getAttribute('data-tab');
    tabs.forEach(t => t.classList.remove('active'));
    views.forEach(v => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${target}-view`)?.classList.add('active');
    updateTabAccessibility();
  });

  tab.addEventListener('keydown', (e: KeyboardEvent) => {
    const tabArray = Array.from(tabs);
    const currentIndex = tabArray.indexOf(tab);
    let newIndex = currentIndex;

    if (e.key === 'ArrowRight') newIndex = (currentIndex + 1) % tabArray.length;
    else if (e.key === 'ArrowLeft') newIndex = (currentIndex - 1 + tabArray.length) % tabArray.length;
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
  tabs.forEach(t => {
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
function handleElementSelected(element: ElementInfo) {
  currentElement = element;
  currentLocators = generateLocators(element);
  saveToHistory(element, currentLocators);
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
    css = `[data-testid="${attrs['data-testid']}"]`;
  } else if (attrs['data-test']) {
    css = `[data-test="${attrs['data-test']}"]`;
  } else if (attrs.name) {
    css = `${tag}[name="${attrs.name}"]`;
  } else if (attrs.class) {
    const first = attrs.class.split(' ').filter(c => c)[0];
    if (first) css = `${tag}.${cssEscape(first)}`;
  } else if (attrs.role) {
    css = `${tag}[role="${attrs.role}"]`;
  }

  // --- XPath ---
  let xpath: string;
  if (attrs.id) {
    xpath = `//${tag}[@id="${attrs.id}"]`;
  } else if (attrs['data-testid']) {
    xpath = `//${tag}[@data-testid="${attrs['data-testid']}"]`;
  } else if (attrs['data-test']) {
    xpath = `//${tag}[@data-test="${attrs['data-test']}"]`;
  } else if (attrs.name) {
    xpath = `//${tag}[@name="${attrs.name}"]`;
  } else if (attrs.class) {
    const first = attrs.class.split(' ').filter(c => c)[0];
    xpath = first ? `//${tag}[contains(@class,"${first}")]` : `//${tag}`;
  } else if (text && text.length <= 30 && !text.includes('\n')) {
    xpath = `//${tag}[text()="${text}"]`;
  } else {
    xpath = `//${tag}`;
  }

  // --- Playwright ---
  let playwright: string;
  if (attrs['data-testid']) {
    playwright = `page.getByTestId('${attrs['data-testid']}')`;
  } else if (attrs.role) {
    const name = attrs['aria-label'] || text;
    playwright = name
      ? `page.getByRole('${attrs.role}', { name: '${name.substring(0, 40)}' })`
      : `page.getByRole('${attrs.role}')`;
  } else if (attrs.placeholder) {
    playwright = `page.getByPlaceholder('${attrs.placeholder}')`;
  } else if (attrs['aria-label']) {
    playwright = `page.getByLabel('${attrs['aria-label']}')`;
  } else if (tag === 'button' || tag === 'a') {
    if (text) {
      playwright = `page.getByRole('${tag === 'button' ? 'button' : 'link'}', { name: '${text.substring(0, 40)}' })`;
    } else {
      playwright = `page.locator('${css}')`;
    }
  } else if (text && text.length <= 30 && !text.includes('\n')) {
    playwright = `page.getByText('${text}')`;
  } else {
    playwright = `page.locator('${css}')`;
  }

  // --- Cypress ---
  let cypress: string;
  if (attrs['data-testid']) {
    cypress = `cy.get('[data-testid="${attrs['data-testid']}"]')`;
  } else if (text && text.length <= 30 && !text.includes('\n') && (tag === 'button' || tag === 'a')) {
    cypress = `cy.contains('${tag}', '${text}')`;
  } else {
    cypress = `cy.get('${css}')`;
  }

  // --- Selenium ---
  let selenium: string;
  if (attrs.id) {
    selenium = `driver.findElement(By.id("${attrs.id.replace(/"/g, '\\"')}"))`;
  } else if (attrs.name) {
    selenium = `driver.findElement(By.name("${attrs.name.replace(/"/g, '\\"')}"))`;
  } else if (attrs.class) {
    const first = attrs.class.split(' ').filter(c => c)[0];
    selenium = first
      ? `driver.findElement(By.className("${first.replace(/"/g, '\\"')}"))`
      : `driver.findElement(By.cssSelector("${css.replace(/"/g, '\\"')}"))`;
  } else {
    selenium = `driver.findElement(By.cssSelector("${css.replace(/"/g, '\\"')}"))`;
  }

  return { css, xpath, playwright, cypress, selenium };
}

// --- Rendering ---
const FORMAT_ORDER: Array<{ key: keyof Locators; label: string }> = [
  { key: 'css', label: 'CSS' },
  { key: 'xpath', label: 'XPATH' },
  { key: 'playwright', label: 'PW' },
  { key: 'cypress', label: 'CY' },
  { key: 'selenium', label: 'SE' }
];

function getOrderedFormats(): Array<{ key: keyof Locators; label: string }> {
  // Put active format first
  const preferred = FORMAT_ORDER.find(f => f.key === activeFormat);
  if (!preferred) return FORMAT_ORDER;
  return [preferred, ...FORMAT_ORDER.filter(f => f.key !== activeFormat)];
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

  const attrEntries = Object.entries(attrs).filter(([key]) =>
    !['class', 'id', 'style', 'href', 'src'].includes(key)
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
      ${displayAttrs.length > 0 ? `
        <div class="element-attrs">
          ${displayAttrs.map(([key, val]) => `
            <span class="attr-chip"><span class="attr-key">${escapeHtml(key)}</span>=<span class="attr-val">"${escapeHtml(String(val).substring(0, 30))}"</span></span>
          `).join('')}
          ${moreCount > 0 ? `<span class="attr-chip">+${moreCount} more</span>` : ''}
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('copyAllBtn')?.addEventListener('click', copyAllLocators);
}

function renderLocatorRows(container: HTMLElement, locators: Locators, formats?: Array<{ key: keyof Locators; label: string }>) {
  const fmts = formats || getOrderedFormats();

  container.innerHTML = fmts.map(f => `
    <div class="locator-row ${f.key === activeFormat ? 'preferred' : ''}" data-format="${f.key}">
      <span class="locator-badge ${f.key === 'playwright' ? 'pw' : f.key === 'cypress' ? 'cy' : f.key === 'selenium' ? 'se' : f.key}">${f.label}</span>
      <span class="locator-value" title="${escapeAttr(locators[f.key])}">${escapeHtml(locators[f.key])}</span>
      <button type="button" class="copy-btn" data-format="${f.key}">Copy</button>
    </div>
  `).join('');

  // Click-to-copy on the entire row
  container.querySelectorAll('.locator-row').forEach(row => {
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

function saveToHistory(element: ElementInfo, locators: Locators) {
  const item: HistoryItem = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    element,
    locators
  };
  locatorHistory.unshift(item);
  if (locatorHistory.length > historyLimit) {
    locatorHistory = locatorHistory.slice(0, historyLimit);
  }
  chrome.storage.local.set({ locatorHistory });
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

function renderHistory() {
  const list = document.getElementById('historyList')!;
  const empty = document.getElementById('historyEmpty')!;

  if (locatorHistory.length === 0) {
    empty.style.display = 'block';
    list.innerHTML = '';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = locatorHistory.slice(0, 15).map(item => `
    <div class="history-item" data-id="${escapeAttr(item.id)}" tabindex="0">
      <span class="history-tag">&lt;${escapeHtml(item.element.tagName)}&gt;</span>
      <div class="history-info">
        <div class="history-selector">${escapeHtml(item.locators.css)}</div>
        <div class="history-meta">${escapeHtml(getRelativeTime(item.timestamp))} &middot; 5 locators</div>
      </div>
      <button type="button" class="history-delete" data-id="${escapeAttr(item.id)}" aria-label="Delete" title="Delete">&times;</button>
    </div>
  `).join('');

  // Click item to restore locators
  list.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', (e) => {
      // Don't restore if clicking delete button
      if ((e.target as HTMLElement).closest('.history-delete')) return;
      const id = el.getAttribute('data-id');
      const item = locatorHistory.find(h => h.id === id);
      if (item) {
        currentElement = item.element;
        currentLocators = item.locators;
        renderElementInfo();
        renderLocators();
        (tabs[0] as HTMLElement).click();
      }
    });
  });

  // Delete single item
  list.querySelectorAll('.history-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.id;
      locatorHistory = locatorHistory.filter(h => h.id !== id);
      await chrome.storage.local.set({ locatorHistory });
      updateStats();
      renderHistory();
      showToast('Item removed');
    });
  });
}

document.getElementById('clearHistoryBtn')?.addEventListener('click', async () => {
  if (locatorHistory.length === 0) return;
  locatorHistory = [];
  await chrome.storage.local.set({ locatorHistory: [] });
  updateStats();
  renderHistory();
  showToast('History cleared');
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
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `locators-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('Exported!');
});

// --- Test Selector ---
document.getElementById('testBtn')?.addEventListener('click', async () => {
  if (!currentLocators) return;

  try {
    await sendToTab({
      type: 'TEST_SELECTOR',
      selector: currentLocators.css
    });
    showToast('Testing on page!');
  } catch {
    showToast('Cannot test on this page');
  }
});

// --- Settings ---
async function loadSettings() {
  const result = await chrome.storage.local.get(['defaultFormat', 'historyLimit']);

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
}

function saveSettings() {
  const formatSelect = document.getElementById('defaultFormat') as HTMLSelectElement;
  const limitSelect = document.getElementById('historyLimitSelect') as HTMLSelectElement;
  const defaultFormat = formatSelect?.value || 'xpath';
  const newLimit = parseInt(limitSelect?.value || '50', 10);

  chrome.storage.local.set({ defaultFormat, historyLimit: newLimit });
  activeFormat = defaultFormat as keyof Locators;
  historyLimit = newLimit;

  // Trim history if new limit is smaller
  if (locatorHistory.length > historyLimit) {
    locatorHistory = locatorHistory.slice(0, historyLimit);
    chrome.storage.local.set({ locatorHistory });
    renderHistory();
  }

  // Re-render locators with new preferred format order
  if (currentLocators) renderLocators();

  showToast('Settings saved');
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
    } else {
      domTreeEl.innerHTML = '<div class="dom-node">No DOM tree returned</div>';
    }
  } catch (e) {
    domTreeEl.innerHTML = `<div class="dom-node">${escapeHtml(e instanceof Error ? e.message : 'Error loading tree')}</div>`;
  }
}

function buildDomTreeHtml(node: DomTreeNode): string {
  let html = '';
  const indent = node.depth * 14;
  const expandSymbol = node.hasChildren ? '&#9660;' : '&middot;';
  const childInfo = node.childCount && node.childCount > 0 ? ` <span style="color:var(--text-muted);font-size:9px">(${node.childCount})</span>` : '';

  html += `<div class="dom-node" data-tag="${escapeAttr(node.tag)}" data-id="${escapeAttr(node.id || '')}" data-class="${escapeAttr(node.className || '')}" style="padding-left: ${indent}px">`;
  html += `<span class="dom-expand">${expandSymbol}</span>`;
  html += `<span class="dom-tag">${escapeHtml(node.tag)}</span>`;
  if (node.id) html += `<span class="dom-attr">#${escapeHtml(node.id)}</span>`;
  if (node.className) html += `<span class="dom-attr">.${escapeHtml(node.className.split(' ')[0])}</span>`;
  html += childInfo;
  html += `</div>`;

  if (node.hasChildren) {
    for (const child of node.children) {
      html += buildDomTreeHtml(child);
    }
  }

  return html;
}

domTreeEl.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const nodeEl = target.closest('.dom-node') as HTMLElement;
  if (!nodeEl) return;

  const tag = nodeEl.dataset.tag || 'div';
  const id = nodeEl.dataset.id;
  const className = nodeEl.dataset.class;

  domTreeEl.querySelectorAll('.dom-node').forEach(n => n.classList.remove('selected'));
  nodeEl.classList.add('selected');

  const info: ElementInfo = {
    tagName: tag,
    text: '',
    attributes: {}
  };
  if (id) info.attributes.id = id;
  if (className) info.attributes.class = className;

  handleElementSelected(info);
  showToast(`Selected: <${tag}>`);
});

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

// --- Structured Build ---
document.getElementById('buildGenerateBtn')?.addEventListener('click', () => {
  const tag = (document.getElementById('buildTag') as HTMLSelectElement).value || 'div';
  const id = (document.getElementById('buildId') as HTMLInputElement).value.trim();
  const className = (document.getElementById('buildClass') as HTMLInputElement).value.trim();
  const attrName = (document.getElementById('buildAttrName') as HTMLInputElement).value.trim();
  const attrValue = (document.getElementById('buildAttrValue') as HTMLInputElement).value.trim();

  if (!tag && !id && !className && !attrName) {
    showToast('Fill in at least one field');
    return;
  }

  // Build an ElementInfo from form data
  const element: ElementInfo = {
    tagName: tag,
    text: '',
    attributes: {}
  };
  if (id) element.attributes.id = id;
  if (className) element.attributes.class = className;
  if (attrName && attrValue) element.attributes[attrName] = attrValue;

  const locators = generateLocators(element);

  // Save to history like Pick mode
  saveToHistory(element, locators);
  updateStats();

  const buildResult = document.getElementById('buildResult')!;
  renderLocatorRows(buildResult, locators);

  showToast('Locators generated!');
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
    { type: 'role', label: "getByRole('button', { name: '' })", code: "page.getByRole('button', { name: '' })" },
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
    { type: 'get', label: "cy.get('[data-testid=\"\"]')", code: "cy.get('[data-testid=\"\"]')" },
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
    results = baseSuggestions.filter(s =>
      s.label.toLowerCase().includes(lower) ||
      s.code.toLowerCase().includes(lower)
    ).slice(0, 8);
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
          .filter(s => s.code.toLowerCase().includes(lower))
          .slice(0, limit)
          .forEach(s => pageSuggestions.push({ ...s, type: `page` }));
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

  suggestionsEl.innerHTML = items.map(item => `
    <div class="suggestion-item" data-code="${escapeAttr(item.code)}">
      <span class="suggestion-type">${escapeHtml(item.type)}</span> ${escapeHtml(item.label)}
    </div>
  `).join('');

  suggestionsEl.style.display = 'block';

  suggestionsEl.querySelectorAll('.suggestion-item').forEach(el => {
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

// --- Freeform Test ---
async function testFreeformLocator() {
  const selector = freeformInput.value.trim();
  const type = freeformType.value;

  if (!selector) {
    matchCountEl.style.display = 'none';
    return;
  }

  let cssSelector = selector;

  if (type === 'playwright') {
    const match = selector.match(/page\.(locator|getBy\w+)\(['"`](.*?)['"`]/);
    if (match) cssSelector = match[2];
    else {
      matchCountEl.textContent = 'Cannot extract selector from Playwright syntax';
      matchCountEl.classList.add('error');
      matchCountEl.style.display = 'block';
      return;
    }
  } else if (type === 'cypress') {
    const match = selector.match(/cy\.(get|contains)\(['"`](.*?)['"`]/);
    if (match) cssSelector = match[2];
  } else if (type === 'selenium') {
    const match = selector.match(/By\.\w+\(['"`](.*?)['"`]\)/);
    if (match) cssSelector = match[1];
    else {
      const match2 = selector.match(/findElement\(By\.\w+\(['"`](.*?)['"`]\)\)/);
      if (match2) cssSelector = match2[1];
    }
  } else if (type === 'xpath') {
    matchCountEl.textContent = 'XPath testing not supported in browser';
    matchCountEl.classList.add('error');
    matchCountEl.style.display = 'block';
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    await sendToTab({ type: 'TEST_SELECTOR', selector: cssSelector });

    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (sel: string) => {
        try { return document.querySelectorAll(sel).length; }
        catch { return -1; }
      },
      args: [cssSelector]
    });

    const count = result[0].result;
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
          id: [], class: [], testid: [], role: []
        };

        document.querySelectorAll('[id]').forEach(el => {
          if (el.id && !el.id.includes(' ') && el.id.length < 50) {
            suggestions.id.push({ type: 'ID', label: `#${el.id}`, code: `#${el.id}` });
          }
        });

        document.querySelectorAll('[data-testid]').forEach(el => {
          const val = el.getAttribute('data-testid');
          if (val) suggestions.testid.push({ type: 'testid', label: `[data-testid="${val}"]`, code: `[data-testid="${val}"]` });
        });
        document.querySelectorAll('[data-test]').forEach(el => {
          const val = el.getAttribute('data-test');
          if (val) suggestions.testid.push({ type: 'testid', label: `[data-test="${val}"]`, code: `[data-test="${val}"]` });
        });

        const seen = new Set<string>();
        document.querySelectorAll('[class]').forEach(el => {
          const cn = el.className;
          if (typeof cn === 'string') {
            cn.split(' ').filter(c => c && c.length < 30 && !seen.has(c)).slice(0, 2).forEach(c => {
              seen.add(c);
              suggestions.class.push({ type: 'class', label: `.${c}`, code: `.${c}` });
            });
          }
        });

        const roles = new Set<string>();
        document.querySelectorAll('[role]').forEach(el => {
          const role = el.getAttribute('role');
          if (role && !roles.has(role)) {
            roles.add(role);
            suggestions.role.push({ type: 'role', label: `[role="${role}"]`, code: `[role="${role}"]` });
          }
        });

        return suggestions;
      }
    });

    return result[0].result;
  } catch {
    return null;
  }
}

document.addEventListener('visibilitychange', async () => {
  if (!document.hidden) {
    pageSuggestionsCache = await fetchPageSuggestions();
  }
});

fetchPageSuggestions().then(s => { pageSuggestionsCache = s; });

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
loadHistory();
loadSettings();

chrome.tabs.onActivated.addListener(checkConnection);
chrome.tabs.onUpdated.addListener(checkConnection);
