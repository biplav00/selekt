# Locator Extension — Side Panel Inspector Design

> **Status:** Approved 2026-09-05 (incremental, WXT greenfield + borrowed logic)
> **Context:** `crx/` was empty greenfield. Target: Playwright-first locator helper for QA. Reference: `ruifigueira/playwright-crx` (Apache-2.0) — reuse selector-engine ideas, not the `chrome.debugger` recorder flow.

**Goal:** Side-panel inspector with Picker toggle: hoverHighlights → clickLocks → panel shows ranked Playwright locators + copy.

**Architecture:** WXT MV3 (file-based `entrypoints/`). Background service worker owns sidePanel & dispatches picker state. Content script handles overlay/highlight + locator generation (trimmed Playwright injected engine). Side panel React UI renders results. Messaging via `browser.runtime.onMessage`. Storage via `wxt/storage` for options (`testIdAttributeName`).

**Tech Stack:** WXT + React 19 + TypeScript + Vite + Tailwind, `chrome.sidePanel` (114+), `storage`, `activeTab`, `scripting`.

---

## 1. Project Structure

```
crx/
├── wxt.config.ts              // defineConfig { modules:['@wxt-dev/module-react'], manifest:{ name, permissions, host_permissions } }
├── entrypoints/
│   ├── background.ts          // defineBackground: sidePanel open, picker toggle relay
│   ├── content.ts             // defineContentScript: matches <all_urls>, picker overlay, locators
│   └── sidepanel/
│       ├── index.html
│       └── main.tsx           // React root
├── components/                // LocatorRow, CopyButton, HighlightOverlay (if shared)
├── utils/
│   ├── locators.ts            // Playwright ranking: getByTestId > getByRole > getByLabel/Placeholder > getByText > CSS > XPath fallback
│   └── storage.ts             // wxt/storage helper
├── public/icon/               // 16/32/48/128
├── LICENSE + NOTICE           // Apache-2.0 copies (required)
└── package.json
```

## 2. Components & Responsibilities

- **background.ts:** `browser.action.onClicked` → `browser.sidePanel.open({tabId})`; `runtime.onMessage` relay for `picker:on/off`, `element:locked`; `commands` shortcut `Alt+Shift+C` to toggle inspect.
- **content.ts:** On `picker:on`, attach `mouseover/mouseout/click` (capture), draw `position:fixed` outline div, suppress page click via `preventDefault/stopPropagation`. On lock, compute locators via `utils/locators.ts`, send to sidePanel, keep highlight pinned. On `picker:off` or `Escape`, tear down.
- **sidepanel/main.tsx:** Shows state: idle / inspecting / locked. Locked view: ranked list with Copy buttons, best-badge, count/uniqueness (V1.1), element meta (tag, text, attributes). Uses Tailwind + shadcn-style cards.
- **locators.ts:** Exports `generateLocators(el: Element): Locator[]` where `Locator = { kind: 'role'|'testId'|'text'|'css'|'xpath', value: string, score, count }`. Scoring prefers stable attrs; dedup + escape CSS via `CSS.escape`.
- **storage.ts:** Typed helpers `get<T>(key)`, `set`, `watch` over `local:` prefix; options stored: `testIdAttr` (default `data-testid`), theme.

## 3. Data Flow

1. Click extension icon → background opens sidePanel.
2. SidePanel “Inspect” click → `runtime.sendMessage({type:'picker:on'})` → tabs.query → `tabs.sendMessage(tabId, {type:'picker:on'})`.
3. Content script highlights hover, click locks → `generateLocators(target)` → `runtime.sendMessage({type:'locators', payload})` → sidePanel renders → `storage.setItem('local:lastLocators', payload)`.
4. Copy button → `navigator.clipboard.writeText` + toast.
5. Escape or “Stop” → `picker:off` tears down listeners & overlay.

## 4. Incremental Roadmap

- **V0 — Scaffolding:** `npm create wxt@latest -- --template react-ts`, add Tailwind, icons, `wxt.config.ts` manifest, verify `npm run dev` / `npm run build` / `npm run zip`.
- **V1 — MVP Side Panel + Picker + Playwright locators:** Foreground overlay, locator ranking, copy buttons. No `debugger` permission.
- **V1.1 — Validation:** uniqueness count via `querySelectorAll/css` or injected Playwright query, highlight-all matches toggle, best-locator badge.
- **V1.2 — Polish:** shadowDOM/iframe traversal, options page (`testIdAttr`), keyboard shortcut, Element info panel.
- **V2 — History & Export:** last-20 history, search, export `page.getBy...` snippet, `storage.sync`.
- **V3 — Recorder (optional):** Add `playwright-crx` npm lib, `chrome.debugger` permission, JSONL recorder/player — only when needed.

## 5. Permissions

Least privilege: `storage`, `sidePanel`, `activeTab`, `scripting`. No `<all_urls>` host_permissions in V1 — use activeTab. Add later only for “auto-inspect on all sites” option.

## 6. Security, License, Error Handling

- CSP default, no remote code, no cross-origin fetch, `web_accessible_resources` only for overlay styles.
- Copy Apache-2.0 LICENSE + NOTICE, retain `Portions Copyright (c) Rui Figueira / Microsoft / Google`, add change notices per §4(b).
- Content guards for null `document`, iframe access try/catch, sidePanel fallback to popup if API missing, suppress page navigation on picker click.

## 7. Testing

- Unit tests for `utils/locators.ts` ranking & escaping.
- Manual matrix: todoMVC, GitHub, shadowDOM demo, iframe page, RTL page.
- Future Playwright E2E in `tests/` for sidePanel flow.

---

> Next: `docs/plans/2026-09-05-locator-extension-impl.md` (writing-plans, bite-sized TDD tasks).
