# Locator Extension Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship V1 side-panel locator inspector (picker toggle → hover highlight → click lock → ranked Playwright locators + copy) as an incremental WXT extension, borrowing selector ideas from `playwright-crx` (Apache-2.0).

**Architecture:** WXT file-based entrypoints. `background.ts` manages `sidePanel` & message relay. `content.ts` owns picker overlay & calls `utils/locators.ts` (Playwright-first ranking). `sidepanel/main.tsx` React UI renders results. Messaging via `browser.runtime`. State via `wxt/storage`.

**Tech Stack:** WXT 0.19+, React 19, TypeScript, Vite, Tailwind, `chrome.sidePanel`/`storage`/`activeTab`/`scripting`, `CSS.escape`.

---

### Task 1: Scaffold WXT + React-TS Project (V0)

**Files:**

- Create: `package.json`, `wxt.config.ts`, `tsconfig.json`, `entrypoints/*`, `public/icon/*`
- Modify: none
- Test: `ls .output && npm run build` succeeds

**Step 1: Initialize WXT project non-interactively**

Run: `npm create wxt@latest -- --template react --yes` is interactive — instead run manual scaffold via npx (see Step 3 alternative).

If `npm create` prompts hang, fallback to manual `npm init` + install (next step handles it). For this codebase (empty `crx/`), use:

```bash
workdir=/Users/biplav00/Documents/personal/crx
npm create wxt@latest . -- --template react-ts --yes
# if fails due to non-empty dir, use temp dir then copy
```

Expected: creates `wxt.config.ts`, `package.json` with `wxt` dep, `entrypoints/background.ts`.

**Step 2: If scaffold fails due to non-empty docs/, use temp scaffold**

Run:

```bash
mkdir -p /tmp/wxt-scaffold && cd /tmp/wxt-scaffold && npm create wxt@latest locator -- --template react-ts
cp -r locator/* /Users/biplav00/Documents/personal/crx/ && cp -r locator/.* /Users/biplav00/Documents/personal/crx/ 2>/dev/null || true
```

Expected: `crx/package.json` exists.

**Step 3: Install deps**

Run: `npm install`
Expected: `node_modules/` exists, no errors.

**Step 4: Install Tailwind + React module**

Run: `npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p && npm install @wxt-dev/module-react`
Then add to `wxt.config.ts`: `modules: ['@wxt-dev/module-react']`

Expected: `tailwind.config.js` exists.

**Step 5: Verify dev build**

Run: `npm run build`
Expected: `PASS` with `.output/chrome-mv3` dir.

**Step 6: Commit**

```bash
git init 2>/dev/null || true
git add package.json wxt.config.ts tsconfig.json entrypoints/ public/ tailwind.config.js postcss.config.js
git commit -m "feat: scaffold WXT React-TS project (V0)"
```

---

### Task 2: Configure Manifest & Icons (wxt.config.ts)

**Files:**

- Modify: `wxt.config.ts:1-30`
- Create: `public/icon/16.png`, `public/icon/32.png`, `public/icon/48.png`, `public/icon/128.png`
- Test: `npm run build && cat .output/chrome-mv3/manifest.json | grep sidePanel`

**Step 1: Write failing test — manifest must contain sidePanel**

Create `tests/manifest.test.ts`:

```ts
import fs from 'fs';
test('manifest has sidePanel permission', () => {
  const m = JSON.parse(fs.readFileSync('.output/chrome-mv3/manifest.json', 'utf8'));
  expect(m.permissions).toContain('sidePanel');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test 2>&1 | grep FAIL`
Expected: FAIL (manifest not built yet)

**Step 3: Write minimal wxt.config.ts**

```ts
import { defineConfig } from 'wxt';
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Locator Inspector',
    description: 'Playwright-first locator helper with side panel picker',
    version: '0.1.0',
    permissions: ['storage', 'sidePanel', 'activeTab', 'scripting'],
    action: {},
    side_panel: { default_path: 'sidepanel.html' },
    commands: {
      'toggle-picker': { suggested_key: { default: 'Alt+Shift+C' }, description: 'Toggle picker' },
    },
  },
});
```

Also add simple placeholder PNGs (1x1) to `public/icon/` or copy from WXT template.

**Step 4: Run build & test to verify it passes**

Run: `npm run build && npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add wxt.config.ts public/icon/
git commit -m "feat: configure manifest with sidePanel permissions"
```

---

### Task 3: Background Service Worker

**Files:**

- Modify: `entrypoints/background.ts:1-40`
- Test: `tests/background.test.ts` (unit, mock browser)

**Step 1: Write failing test**

```ts
// tests/background.test.ts — expects background to expose onClicked handler
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL

**Step 3: Write minimal implementation**

`entrypoints/background.ts`:

```ts
export default defineBackground(() => {
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id) await browser.sidePanel.open({ tabId: tab.id });
  });
  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'picker:on' || msg.type === 'picker:off' || msg.type === 'locators') {
      // relay to sidePanel or content
    }
    return true;
  });
  browser.commands.onCommand.addListener((cmd, tab) => {
    if (cmd === 'toggle-picker' && tab?.id)
      browser.tabs.sendMessage(tab.id, { type: 'picker:toggle' });
  });
});
```

**Step 4: Run build**

Run: `npm run build`
Expected: PASS, no TS errors.

**Step 5: Commit**

```bash
git add entrypoints/background.ts
git commit -m "feat: add background with sidePanel open & picker relay"
```

---

### Task 4: Locator Generation Utils (Playwright-first)

**Files:**

- Create: `utils/locators.ts`
- Create: `tests/locators.test.ts`
- Test: `tests/locators.test.ts`

**Step 1: Write failing tests**

```ts
import { generateLocators } from '../utils/locators';
test('prefers data-testid', () => {
  const el = document.createElement('button'); el.setAttribute('data-testid','submit'); el.textContent='Submit';
  const locs = generateLocators(el);
  expect(locs[0].value).toBe("getByTestId('submit')");
});
test('falls back to role', () => {...});
test('escapes CSS', () => {...});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL "generateLocators not defined"

**Step 3: Write minimal implementation**

`utils/locators.ts`:

```ts
export interface Locator {
  kind: string;
  value: string;
  score: number;
}
export function generateLocators(el: Element): Locator[] {
  const locs: Locator[] = [];
  const testId = el.getAttribute('data-testid');
  if (testId) locs.push({ kind: 'testId', value: `getByTestId('${testId}')`, score: 100 });
  const role =
    el.getAttribute('role') ||
    ({ BUTTON: 'button', A: 'link', INPUT: 'textbox' } as any)[el.tagName];
  if (role) {
    const name =
      (el as HTMLElement).innerText?.trim() ||
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder');
    if (name)
      locs.push({ kind: 'role', value: `getByRole('${role}', { name: '${name}' })`, score: 90 });
  }
  // label/placeholder
  const ph = el.getAttribute('placeholder');
  if (ph) locs.push({ kind: 'placeholder', value: `getByPlaceholder('${ph}')`, score: 85 });
  const text = (el as HTMLElement).innerText?.trim();
  if (text && text.length < 80)
    locs.push({ kind: 'text', value: `getByText('${text}')`, score: 70 });
  // CSS fallback
  const css = cssSelector(el);
  locs.push({ kind: 'css', value: css, score: 50 });
  // XPath fallback
  locs.push({ kind: 'xpath', value: `xpath=//${el.tagName.toLowerCase()}[...]`, score: 40 });
  return locs.sort((a, b) => b.score - a.score);
}
function cssSelector(el: Element): string {
  /* id > data-testid > nth-of-type chain with CSS.escape */
}
```

Add real `cssSelector` that walks up, uses `CSS.escape`, prefers `#id`, adds `:nth-of-type` if needed.

**Step 4: Run tests**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add utils/locators.ts tests/locators.test.ts
git commit -m "feat: add Playwright-first locator generation with ranking"
```

---

### Task 5: Content Script Picker Overlay

**Files:**

- Modify: `entrypoints/content.ts:1-120`
- Create: `entrypoints/content.style.css` (if needed)
- Test: manual `npm run dev` + load unpacked, hover test

**Step 1: Write failing test (happy path via jsdom simulation)**

Simulate `mouseover` sets highlight rect.

**Step 2: Run test**

Run: `npm test`
Expected: FAIL

**Step 3: Write minimal implementation**

```ts
export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main(ctx) {
    let active = false;
    let overlay: HTMLDivElement | null = null;
    let lastEl: Element | null = null;
    const style = document.createElement('style');
    style.textContent = `...outline 2px dashed #3b82f6...`;
    function ensureOverlay() {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.style.cssText =
          'position:fixed;pointer-events:none;z-index:2147483647;border:2px dashed #3b82f6;background:rgba(59,130,246,0.15);';
        document.documentElement.appendChild(overlay);
      }
      return overlay;
    }
    function highlight(el: Element) {
      const r = el.getBoundingClientRect();
      const o = ensureOverlay();
      o.style.left = r.left + 'px';
      o.style.top = r.top + 'px';
      o.style.width = r.width + 'px';
      o.style.height = r.height + 'px';
      o.style.display = 'block';
    }
    browser.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'picker:on') {
        active = true;
        document.addEventListener('mouseover', onOver, true);
        document.addEventListener('click', onClick, true);
      }
      if (msg.type === 'picker:off') {
        teardown();
      }
    });
    function onOver(e: MouseEvent) {
      if (!active) return;
      const t = e.target as Element;
      if (t === overlay) return;
      lastEl = t;
      highlight(t);
    }
    function onClick(e: MouseEvent) {
      if (!active) return;
      e.preventDefault();
      e.stopPropagation();
      if (lastEl) {
        const locs = generateLocators(lastEl);
        browser.runtime.sendMessage({
          type: 'locators',
          payload: {
            locs,
            tag: lastEl.tagName,
            text: (lastEl as HTMLElement).innerText?.slice(0, 100),
          },
        });
        teardown(false);
      }
    }
    function teardown(removeOverlay = true) {
      active = false;
      document.removeEventListener('mouseover', onOver, true);
      document.removeEventListener('click', onClick, true);
      if (removeOverlay && overlay) overlay.style.display = 'none';
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && active) teardown();
    });
  },
});
```

Import `generateLocators` from `../utils/locators`.

**Step 4: Verify build**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add entrypoints/content.ts
git commit -m "feat: add content picker overlay with highlight"
```

---

### Task 6: Side Panel React UI

**Files:**

- Create: `entrypoints/sidepanel/index.html`
- Create: `entrypoints/sidepanel/main.tsx`
- Create: `entrypoints/sidepanel/App.tsx`
- Create: `entrypoints/sidepanel/style.css` (Tailwind)

**Step 1: Write failing test — App renders Inspect button**

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**

`entrypoints/sidepanel/index.html`:

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Locator Inspector</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`entrypoints/sidepanel/main.tsx` mounts `<App />` with `ReactDOM.createRoot`.

`entrypoints/sidepanel/App.tsx`:

- State: `isInspecting`, `locators`, `meta`
- Buttons: `Inspect` / `Stop` → `browser.tabs.query` + `tabs.sendMessage(tabId, {type:'picker:on/off'})`
- Listens: `browser.runtime.onMessage` for `locators` payload → set state
- Renders ranked locators with Copy buttons (`navigator.clipboard.writeText`) + best badge + empty state.
- Tailwind cards, monospace code blocks.

**Step 4: Run build**

Run: `npm run build`
Expected: PASS, `.output/chrome-mv3/sidepanel.html` exists.

**Step 5: Commit**

```bash
git add entrypoints/sidepanel/
git commit -m "feat: add sidepanel React UI with inspect toggle & copy"
```

---

### Task 7: Wiring & Options Polish

**Files:**

- Modify: `entrypoints/sidepanel/App.tsx`, `utils/storage.ts`, `entrypoints/background.ts`
- Create: `entrypoints/options.html` (optional)

Add `utils/storage.ts` helpers, persist `testIdAttr`, highlight-all toggle (querySelectorAll), uniqueness count.

Verify `npm run build` passes.

---

### Task 8: Verify Package

**Files:** none

**Steps:**

Run: `npm run build`
Expected: `.output/chrome-mv3` with manifest + background + content + sidepanel

Run: `npm run zip`
Expected: `.output/locator-inspector-0.1.0-chrome.zip` exists

Manual QA: Load unpacked in `chrome://extensions`, test on 3 sites, verify picker → lock → copy flow, Escape to cancel, sidePanel persists.

Commit final: `git add -A && git commit -m "chore: verify build & zip"`

---
