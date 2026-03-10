# Locator Generator UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Chrome sidebar extension UI with Pick mode, Build mode (locator builder), and History panel.

**Architecture:** Convert from popup to Chrome SidePanel API. Use vanilla TypeScript for simplicity (avoiding React complexity). Store history in chrome.storage.local.

**Tech Stack:** WXT, TypeScript, Chrome SidePanel API, Tailwind CSS (optional, inline styles preferred for simplicity)

---

## Phase 1: Convert to Sidebar

### Task 1: Update Manifest for SidePanel

**Files:**
- Modify: `selector/wxt.config.ts`

**Step 1: Update manifest config**

```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  outDir: 'output',
  manifest: {
    manifest_version: 3,
    name: 'Locator Generator',
    description: 'Test automation locator generation tool',
    version: '1.0.0',
    permissions: ['activeTab', 'scripting', 'tabs', 'storage', 'sidePanel'],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    action: {
      default_title: 'Locator Generator',
    },
  },
});
```

**Step 2: Build and verify**

```bash
cd selector && npm run build
```

Expected: Build succeeds, check output/chrome-mv3/manifest.json has side_panel config

---

### Task 2: Create Sidepanel HTML

**Files:**
- Create: `selector/entrypoints/sidepanel/index.html`

**Step 1: Create HTML structure**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Locator Generator</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 360px;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      flex-direction: column;
    }
    /* Tabs */
    .tabs { display: flex; border-bottom: 1px solid #334155; }
    .tab {
      flex: 1;
      padding: 12px;
      text-align: center;
      cursor: pointer;
      color: #94a3b8;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }
    .tab.active { color: #3b82f6; border-bottom-color: #3b82f6; }
    .tab:hover { color: #f8fafc; }
    /* Content */
    .content { flex: 1; overflow-y: auto; padding: 16px; }
    .view { display: none; }
    .view.active { display: block; }
    /* Pick Button */
    .pick-btn {
      width: 100%;
      padding: 14px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }
    .pick-btn:hover { background: #2563eb; }
    .pick-btn:disabled { background: #475569; cursor: not-allowed; }
    /* Element Info */
    .element-info {
      background: #1e293b;
      padding: 12px;
      border-radius: 8px;
      margin-top: 12px;
    }
    .element-info .tag { color: #10b981; font-family: monospace; }
    .element-info .text { color: #94a3b8; font-size: 12px; margin-top: 4px; }
    /* Locator Display */
    .locator-box {
      background: #1e293b;
      border-radius: 8px;
      margin-top: 12px;
      overflow: hidden;
    }
    .locator-tabs {
      display: flex;
      background: #0f172a;
      overflow-x: auto;
    }
    .locator-tab {
      padding: 8px 12px;
      font-size: 12px;
      color: #94a3b8;
      cursor: pointer;
      border-bottom: 1px solid transparent;
      white-space: nowrap;
    }
    .locator-tab.active { color: #3b82f6; border-bottom-color: #3b82f6; }
    .locator-content {
      padding: 12px;
    }
    .locator-code {
      font-family: 'Fira Code', monospace;
      font-size: 12px;
      word-break: break-all;
      color: #e2e8f0;
      background: #0f172a;
      padding: 8px;
      border-radius: 4px;
      margin-bottom: 8px;
    }
    .copy-btn {
      background: #334155;
      color: #f8fafc;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    .copy-btn:hover { background: #475569; }
    /* History */
    .history-section { margin-top: 16px; }
    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      padding: 8px 0;
    }
    .history-list { display: none; }
    .history-list.open { display: block; }
    .history-item {
      padding: 8px;
      background: #1e293b;
      border-radius: 4px;
      margin-bottom: 4px;
      font-size: 12px;
      cursor: pointer;
    }
    .history-item:hover { background: #334155; }
    /* Build Mode */
    .build-field { margin-bottom: 12px; }
    .build-field label { display: block; font-size: 12px; color: #94a3b8; margin-bottom: 4px; }
    .build-field input, .build-field select {
      width: 100%;
      padding: 8px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 4px;
      color: #f8fafc;
      font-size: 13px;
    }
    .build-field input:focus { outline: none; border-color: #3b82f6; }
    /* Export */
    .export-btn {
      width: 100%;
      padding: 12px;
      background: #1e293b;
      color: #f8fafc;
      border: 1px solid #334155;
      border-radius: 8px;
      cursor: pointer;
      margin-top: 16px;
    }
    .export-btn:hover { background: #334155; }
    /* Toast */
    .toast {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: #10b981;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .toast.show { opacity: 1; }
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #334155;
    }
    .header h1 { font-size: 14px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔧 Locator Generator</h1>
    <button class="settings-btn" title="Settings">⚙️</button>
  </div>
  
  <div class="tabs">
    <div class="tab active" data-tab="pick">Pick</div>
    <div class="tab" data-tab="build">Build</div>
    <div class="tab" data-tab="history">History</div>
  </div>
  
  <div class="content">
    <!-- Pick View -->
    <div class="view active" id="pick-view">
      <button class="pick-btn" id="pickBtn">🎯 Pick Element</button>
      <div id="elementInfo"></div>
      <div id="locatorDisplay"></div>
      <button class="export-btn" id="exportBtn">📥 Export JSON</button>
    </div>
    
    <!-- Build View -->
    <div class="view" id="build-view">
      <div class="build-field">
        <label>Tag</label>
        <select id="buildTag">
          <option value="">Select tag...</option>
          <option value="*">Any (*)</option>
          <option value="a">a (link)</option>
          <option value="button">button</option>
          <option value="div">div</option>
          <option value="form">form</option>
          <option value="h1">h1</option>
          <option value="h2">h2</option>
          <option value="h3">h3</option>
          <option value="img">img</option>
          <option value="input">input</option>
          <option value="label">label</option>
          <option value="li">li</option>
          <option value="p">p</option>
          <option value="select">select</option>
          <option value="span">span</option>
          <option value="table">table</option>
          <option value="td">td</option>
          <option value="th">th</option>
          <option value="tr">tr</option>
          <option value="ul">ul</option>
        </select>
      </div>
      <div class="build-field">
        <label>ID</label>
        <input type="text" id="buildId" placeholder="e.g., submit-btn">
      </div>
      <div class="build-field">
        <label>Class</label>
        <input type="text" id="buildClass" placeholder="e.g., btn primary">
      </div>
      <div class="build-field">
        <label>Text Content</label>
        <input type="text" id="buildText" placeholder="e.g., Submit">
      </div>
      <div class="build-field">
        <label>Custom Attribute (name)</label>
        <input type="text" id="buildAttrName" placeholder="e.g., data-testid">
      </div>
      <div class="build-field">
        <label>Custom Attribute (value)</label>
        <input type="text" id="buildAttrValue" placeholder="e.g., submit">
      </div>
      <button class="pick-btn" id="testLocBtn">🧪 Test on Page</button>
      <div id="buildResult"></div>
    </div>
    
    <!-- History View -->
    <div class="view" id="history-view">
      <div id="historyEmpty" style="text-align: center; color: #64748b; padding: 20px;">
        No history yet. Pick some elements!
      </div>
      <div id="historyList"></div>
      <button class="export-btn" id="clearHistoryBtn">🗑️ Clear History</button>
    </div>
  </div>
  
  <div class="toast" id="toast">Copied!</div>
  
  <script type="module" src="main.ts"></script>
</body>
</html>
```

**Step 2: Remove old popup and create sidepanel entrypoint**

```bash
rm selector/entrypoints/popup/index.html
mkdir -p selector/entrypoints/sidepanel
mv selector/entrypoints/popup/index.html selector/entrypoints/sidepanel/ 2>/dev/null || true
```

**Step 3: Build and verify**

```bash
cd selector && npm run build
```

Expected: Build succeeds with sidepanel.html in output

---

### Task 3: Create Sidepanel Main Script

**Files:**
- Create: `selector/entrypoints/sidepanel/main.ts`

**Step 1: Write the main script**

```typescript
// State
let currentElement: any = null;
let currentLocators: any = null;
let activeFormat = 'xpath';
let history: any[] = [];

// DOM Elements
const tabs = document.querySelectorAll('.tab');
const views = document.querySelectorAll('.view');
const pickBtn = document.getElementById('pickBtn') as HTMLButtonElement;
const elementInfo = document.getElementById('elementInfo')!;
const locatorDisplay = document.getElementById('locatorDisplay')!;
const toast = document.getElementById('toast')!;

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.getAttribute('data-tab');
    tabs.forEach(t => t.classList.remove('active'));
    views.forEach(v => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${target}-view`)?.classList.add('active');
  });
});

// Pick Element
pickBtn.addEventListener('click', async () => {
  pickBtn.disabled = true;
  pickBtn.textContent = 'Click element on page...';
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) return;
  
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'START_PICKING' });
  } catch (e) {
    showToast('Error: Could not activate picker');
  }
  
  pickBtn.disabled = false;
  pickBtn.textContent = '🎯 Pick Element';
});

// Listen for element selection
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'ELEMENT_SELECTED') {
    handleElementSelected(message.element);
  }
});

function handleElementSelected(element: any) {
  currentElement = element;
  currentLocators = generateLocators(element);
  saveToHistory(element, currentLocators);
  renderElementInfo();
  renderLocators();
}

function generateLocators(element: any): any {
  const tag = element.tagName;
  const attrs = element.attributes || {};
  
  // Generate various locator formats
  const locators: any = {};
  
  // CSS Selector
  let css = tag;
  if (attrs.id) css = `#${attrs.id}`;
  else if (attrs['data-testid']) css = `[data-testid="${attrs['data-testid']}"]`;
  else if (attrs.class) css = `${tag}.${attrs.class.split(' ')[0]}`;
  locators.css = css;
  
  // XPath
  if (attrs.id) locators.xpath = `//${tag}[@id="${attrs.id}"]`;
  else if (attrs['data-testid']) locators.xpath = `//${tag}[@data-testid="${attrs['data-testid']}"]`;
  else locators.xpath = `//${tag}`;
  
  // Playwright
  locators.playwright = `page.locator('${css}')`;
  
  // Cypress
  locators.cypress = `cy.get('${css}')`;
  
  // Selenium
  locators.selenium = `By.css("${css.replace(/"/g, '\\"')}")`;
  
  return locators;
}

function renderElementInfo() {
  if (!currentElement) return;
  
  elementInfo.innerHTML = `
    <div class="element-info">
      <span class="tag">&lt;${currentElement.tagName}&gt;</span>
      ${currentElement.text ? `<div class="text">${currentElement.text.substring(0, 50)}</div>` : ''}
    </div>
  `;
}

function renderLocators() {
  if (!currentLocators) {
    locatorDisplay.innerHTML = '';
    return;
  }
  
  const formats = ['xpath', 'css', 'playwright', 'cypress', 'selenium'];
  
  let html = `
    <div class="locator-box">
      <div class="locator-tabs">
        ${formats.map(f => `
          <div class="locator-tab ${f === activeFormat ? 'active' : ''}" data-format="${f}">
            ${f.charAt(0).toUpperCase() + f.slice(1)}
          </div>
        `).join('')}
      </div>
      <div class="locator-content">
        <div class="locator-code">${currentLocators[activeFormat] || ''}</div>
        <button class="copy-btn" id="copyBtn">📋 Copy</button>
      </div>
    </div>
  `;
  
  locatorDisplay.innerHTML = html;
  
  // Add event listeners
  document.querySelectorAll('.locator-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeFormat = tab.getAttribute('data-format') || 'xpath';
      renderLocators();
    });
  });
  
  document.getElementById('copyBtn')?.addEventListener('click', () => {
    if (currentLocators && currentLocators[activeFormat]) {
      navigator.clipboard.writeText(currentLocators[activeFormat]);
      showToast('Copied to clipboard!');
    }
  });
}

// History functions
async function loadHistory() {
  const result = await chrome.storage.local.get('locatorHistory');
  history = result.locatorHistory || [];
  renderHistory();
}

function saveToHistory(element: any, locators: any) {
  const item = {
    id: Date.now().toString(),
    timestamp: Date.now(),
    element,
    locators
  };
  history.unshift(item);
  if (history.length > 50) history = history.slice(0, 50);
  chrome.storage.local.set({ locatorHistory: history });
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('historyList')!;
  const empty = document.getElementById('historyEmpty')!;
  
  if (history.length === 0) {
    empty.style.display = 'block';
    list.innerHTML = '';
    return;
  }
  
  empty.style.display = 'none';
  list.innerHTML = history.slice(0, 10).map(item => `
    <div class="history-item" data-id="${item.id}">
      &lt;${item.element.tagName}&gt; - ${item.locators.css}
    </div>
  `).join('');
  
  // Add click handlers
  list.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-id');
      const item = history.find(h => h.id === id);
      if (item) {
        currentElement = item.element;
        currentLocators = item.locators;
        renderElementInfo();
        renderLocators();
        // Switch to pick tab
        tabs[0].click();
      }
    });
  });
}

// Clear history
document.getElementById('clearHistoryBtn')?.addEventListener('click', async () => {
  history = [];
  await chrome.storage.local.set({ locatorHistory: [] });
  renderHistory();
  showToast('History cleared!');
});

// Export
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

// Toast
function showToast(message: string) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// Build mode - Test on Page
document.getElementById('testLocBtn')?.addEventListener('click', async () => {
  const tag = (document.getElementById('buildTag') as HTMLSelectElement).value || '*';
  const id = (document.getElementById('buildId') as HTMLInputElement).value;
  const cls = (document.getElementById('buildClass') as HTMLInputElement).value;
  const text = (document.getElementById('buildText') as HTMLInputElement).value;
  const attrName = (document.getElementById('buildAttrName') as HTMLInputElement).value;
  const attrValue = (document.getElementById('buildAttrValue') as HTMLInputElement).value;
  
  let selector = tag;
  if (id) selector = `#${id}`;
  else if (cls) selector = `${tag}.${cls.split(' ')[0]}`;
  
  if (attrName && attrValue) {
    selector = `${tag}[${attrName}="${attrValue}"]`;
  }
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) return;
  
  try {
    await chrome.tabs.sendMessage(tab.id, { 
      type: 'TEST_SELECTOR', 
      selector 
    });
    
    const result = document.getElementById('buildResult')!;
    result.innerHTML = `
      <div class="locator-box" style="margin-top: 12px;">
        <div class="locator-content">
          <div class="locator-code">${selector}</div>
          <button class="copy-btn" id="copyBuildBtn">📋 Copy</button>
        </div>
      </div>
    `;
    
    document.getElementById('copyBuildBtn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(selector);
      showToast('Copied!');
    });
  } catch (e) {
    showToast('Error testing selector');
  }
});

// Load history on init
loadHistory();
```

**Step 2: Build and verify**

```bash
cd selector && npm run build
```

Expected: Build succeeds, check output has sidepanel.html

---

### Task 4: Update Content Script for New Features

**Files:**
- Modify: `selector/entrypoints/content/index.ts`

**Step 1: Add TEST_SELECTOR handler**

```typescript
import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    let isPicking = false;
    let highlightedElements: Element[] = [];
    
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'START_PICKING') {
        startElementPicker();
        sendResponse({ success: true });
      } else if (message.type === 'STOP_PICKING') {
        stopElementPicker();
        sendResponse({ success: true });
      } else if (message.type === 'TEST_SELECTOR') {
        testSelector(message.selector);
        sendResponse({ success: true });
      }
      return true;
    });

    function startElementPicker() {
      isPicking = true;
      document.addEventListener('mouseover', handleMouseOver, true);
      document.addEventListener('click', handleClick, true);
      document.addEventListener('keydown', handleKeyDown, true);
    }

    function stopElementPicker() {
      isPicking = false;
      cleanup();
    }

    function handleMouseOver(e: MouseEvent) {
      if (!isPicking) return;
      const target = e.target as HTMLElement;
      target.style.outline = '2px solid #3B82F6';
      target.style.outlineOffset = '2px';
      highlightedElements.push(target);
    }

    function handleClick(e: MouseEvent) {
      if (!isPicking) return;
      e.preventDefault();
      e.stopPropagation();
      
      const target = e.target as HTMLElement;
      const elementInfo = {
        tagName: target.tagName.toLowerCase(),
        text: target.innerText?.substring(0, 100) || '',
        attributes: {} as Record<string, string>,
      };
      
      for (const attr of target.attributes) {
        elementInfo.attributes[attr.name] = attr.value;
      }
      
      stopElementPicker();
      
      chrome.runtime.sendMessage({
        type: 'ELEMENT_SELECTED',
        element: elementInfo,
      });
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isPicking) {
        stopElementPicker();
      }
    }

    function cleanup() {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      
      highlightedElements.forEach(el => {
        (el as HTMLElement).style.outline = '';
        (el as HTMLElement).style.outlineOffset = '';
      });
      highlightedElements = [];
    }
    
    function testSelector(selector: string) {
      // Clear previous highlights
      document.querySelectorAll('[data-locator-highlight]').forEach(el => {
        el.removeAttribute('data-locator-highlight');
        (el as HTMLElement).style.outline = '';
      });
      
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          (el as HTMLElement).style.outline = '2px solid #10B981';
          (el as HTMLElement).style.outlineOffset = '2px';
          el.setAttribute('data-locator-highlight', 'true');
        });
        
        chrome.runtime.sendMessage({
          type: 'SELECTOR_TESTED',
          count: elements.length
        });
      } catch (e) {
        console.error('Invalid selector:', selector);
      }
    }
  },
});
```

**Step 2: Build**

```bash
cd selector && npm run build
```

---

## Phase 2: Testing & Loading

### Task 5: Load and Test Extension

**Step 1: Open Chrome and load extension**

```
chrome://extensions → Load unpacked → selector/output/chrome-mv3
```

**Step 2: Open sidebar**

Click the extension icon → Should open sidebar on right side

**Step 3: Test Pick mode**

1. Click "Pick Element"
2. Navigate to any webpage
3. Click an element
4. Should see element info and locators

**Step 4: Test Build mode**

1. Click "Build" tab
2. Select tag, enter ID/class
3. Click "Test on Page"
4. Should see matching elements highlighted

**Step 5: Test History**

1. Pick a few elements
2. Click "History" tab
3. Should see recent selections
4. Click item to load its locators

---

## Completion Checklist

- [ ] Sidebar opens instead of popup
- [ ] Pick mode generates locators for clicked element
- [ ] All 5 locator formats (XPath, CSS, Playwright, Cypress, Selenium) display correctly
- [ ] Copy button works
- [ ] Export JSON works
- [ ] Build mode generates locators from attributes
- [ ] Test on Page highlights matching elements
- [ ] History saves and loads correctly
- [ ] Clear history works

---

**Plan complete! Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks
2. **Parallel Session (separate)** - Open new session with executing-plans

**Which approach?**
