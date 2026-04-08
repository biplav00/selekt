# Live DOM-Aware Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the suggestion system from static pre-scraped data to live DOM-aware, SelectorHub-style suggestions with real-time match counts, scoped alternatives, attribute value completion, and highlight-on-hover.

**Architecture:** Pre-cache rich DOM data (`RichPageData`) on page load for instant suggestions. Batch-query the live DOM for match counts on visible suggestions. Show scoped alternatives inline when selectors are ambiguous. Highlight page elements on suggestion hover (debounced 100ms, persist last). Support chained locator testing for Playwright/Cypress/Selenium chains.

**Tech Stack:** TypeScript, Chrome Extension Messaging, Lit Web Components, Vitest

**Spec:** `docs/superpowers/specs/2026-04-08-live-suggestions-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/specialists/helpers/page-data.ts` | `scrapePageData()` function that runs in content script context, collects all IDs, classes, testids, roles, etc. from the full DOM |
| `src/entrypoints/sidepanel/services/page-cache.ts` | Sidepanel-side cache — triggers scrape via messaging, stores `RichPageData`, refreshes on tab change / DOM mutation (debounced 2s) |
| `tests/specialists/helpers/page-data.test.ts` | Tests for page data scraping logic |

### Modified Files

| File | Changes |
|------|---------|
| `src/specialists/types.ts` | Add `RichPageData` interface, add `matchCount?` and `selectorType?` to `Suggestion`, update `SelectorSpecialist` interface (suggest/didYouMean signatures) |
| `src/types.ts` | Add `SCRAPE_PAGE_DATA`, `QUERY_SELECTOR_BATCH`, `TEST_SELECTOR_SCOPED` to `MessageType` union |
| `src/entrypoints/content.ts` | Handle 3 new message types |
| `src/entrypoints/sidepanel/services/messaging.ts` | Add `scrapePageData()`, `batchQuerySelectors()`, `testSelectorScoped()` functions |
| `src/shared/selector-core.ts` | Update `extractTestable()` to handle chained locators |
| `src/specialists/css.ts` | Update `suggest()` and `didYouMean()` to use `RichPageData` |
| `src/specialists/xpath.ts` | Same |
| `src/specialists/playwright.ts` | Same + add chain parsing |
| `src/specialists/cypress.ts` | Same + add chain parsing |
| `src/specialists/selenium.ts` | Same + add chain parsing |
| `src/specialists/helpers/suggestions.ts` | Update `findAttributeElsewhere` to accept `RichPageData` |
| `src/entrypoints/sidepanel/components/build-tab.ts` | Page cache integration, batch counts, hover highlights, scoped suggestions, enhanced dropdown |
| `tests/specialists/css.test.ts` | Update tests for new `suggest()`/`didYouMean()` signatures |
| `tests/specialists/xpath.test.ts` | Same |
| `tests/specialists/playwright.test.ts` | Same |
| `tests/specialists/cypress.test.ts` | Same |
| `tests/specialists/selenium.test.ts` | Same |

---

### Task 1: Types and Interfaces Update

**Files:**
- Modify: `src/specialists/types.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Update `Suggestion` type**

In `src/specialists/types.ts`, add `matchCount` and `selectorType` fields to the `Suggestion` interface:

```typescript
export interface Suggestion {
  selector: string;
  label: string;
  description: string;
  score: number;
  kind: 'autocomplete' | 'alternative' | 'fix' | 'scoped';
  matchCount?: number;
  selectorType?: 'css' | 'xpath' | 'role';
}
```

- [ ] **Step 2: Add `RichPageData` interface**

In `src/specialists/types.ts`, add after the existing interfaces:

```typescript
export interface RichPageData {
  ids: string[];
  classes: string[];
  testIds: string[];
  roles: string[];
  ariaLabels: string[];
  names: string[];
  placeholders: string[];
  texts: string[];
  tags: Record<string, number>;
  elements: PageElement[];
}
```

- [ ] **Step 3: Update `SelectorSpecialist` interface**

Change the `suggest` and `didYouMean` signatures:

```typescript
suggest(partial: string, pageData: RichPageData): Suggestion[];
didYouMean(selector: string, pageData: RichPageData): Suggestion[];
```

- [ ] **Step 4: Add new message types**

In `src/types.ts`, add to the `MessageType` union:

```typescript
| 'SCRAPE_PAGE_DATA'
| 'QUERY_SELECTOR_BATCH'
| 'TEST_SELECTOR_SCOPED'
```

- [ ] **Step 5: Build to verify types compile**

Run: `npm run build`
Expected: FAIL — specialists don't match the updated interface yet. That's expected; we'll fix them in subsequent tasks.

Actually, build may still succeed if TypeScript doesn't enforce interface compliance on the exported objects. Check — if it fails, that's fine, we'll fix in Task 3.

- [ ] **Step 6: Commit**

```bash
git add src/specialists/types.ts src/types.ts
git commit -m "feat: add RichPageData type, update Suggestion and SelectorSpecialist interfaces"
```

---

### Task 2: Page Data Scraper

**Files:**
- Create: `src/specialists/helpers/page-data.ts`
- Create: `tests/specialists/helpers/page-data.test.ts`

- [ ] **Step 1: Write the tests**

Create `tests/specialists/helpers/page-data.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { buildRichPageData } from '@/specialists/helpers/page-data';
import type { PageElement } from '@/types';

describe('buildRichPageData', () => {
  const elements: PageElement[] = [
    { tag: 'button', id: 'submit', classes: ['btn', 'btn-primary'], testId: 'submit-btn', role: 'button', ariaLabel: 'Submit form', name: '', placeholder: '', title: '', altText: '', text: 'Submit', matchCount: 1 },
    { tag: 'input', id: 'email', classes: ['form-input'], testId: '', role: 'textbox', ariaLabel: 'Email', name: 'email', placeholder: 'Enter email', title: '', altText: '', text: '', matchCount: 1 },
    { tag: 'a', id: '', classes: ['nav-link'], testId: '', role: 'link', ariaLabel: '', name: '', placeholder: '', title: 'Go home', altText: '', text: 'Home', matchCount: 3 },
    { tag: 'img', id: '', classes: [], testId: '', role: 'img', ariaLabel: '', name: '', placeholder: '', title: '', altText: 'Logo', text: '', matchCount: 1 },
  ];

  it('collects all unique IDs', () => {
    const data = buildRichPageData(elements);
    expect(data.ids).toContain('submit');
    expect(data.ids).toContain('email');
    expect(data.ids).toHaveLength(2);
  });

  it('collects all unique classes', () => {
    const data = buildRichPageData(elements);
    expect(data.classes).toContain('btn');
    expect(data.classes).toContain('btn-primary');
    expect(data.classes).toContain('form-input');
    expect(data.classes).toContain('nav-link');
  });

  it('collects all unique testIds', () => {
    const data = buildRichPageData(elements);
    expect(data.testIds).toEqual(['submit-btn']);
  });

  it('collects all unique roles', () => {
    const data = buildRichPageData(elements);
    expect(data.roles).toContain('button');
    expect(data.roles).toContain('textbox');
    expect(data.roles).toContain('link');
    expect(data.roles).toContain('img');
  });

  it('collects ariaLabels', () => {
    const data = buildRichPageData(elements);
    expect(data.ariaLabels).toContain('Submit form');
    expect(data.ariaLabels).toContain('Email');
  });

  it('collects names', () => {
    const data = buildRichPageData(elements);
    expect(data.names).toEqual(['email']);
  });

  it('collects placeholders', () => {
    const data = buildRichPageData(elements);
    expect(data.placeholders).toEqual(['Enter email']);
  });

  it('collects texts', () => {
    const data = buildRichPageData(elements);
    expect(data.texts).toContain('Submit');
    expect(data.texts).toContain('Home');
  });

  it('counts tags', () => {
    const data = buildRichPageData(elements);
    expect(data.tags.button).toBe(1);
    expect(data.tags.input).toBe(1);
    expect(data.tags.a).toBe(3); // matchCount 3
    expect(data.tags.img).toBe(1);
  });

  it('preserves elements array', () => {
    const data = buildRichPageData(elements);
    expect(data.elements).toBe(elements);
  });

  it('handles empty input', () => {
    const data = buildRichPageData([]);
    expect(data.ids).toHaveLength(0);
    expect(data.classes).toHaveLength(0);
    expect(data.elements).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/specialists/helpers/page-data.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the page-data helper**

Create `src/specialists/helpers/page-data.ts`:

```typescript
import type { PageElement } from '@/types';
import type { RichPageData } from '../types';

/**
 * Build RichPageData from a list of PageElements.
 * Extracts all unique attribute values for fast autocomplete.
 * This function runs in the sidepanel after receiving scraped elements.
 */
export function buildRichPageData(elements: PageElement[]): RichPageData {
  const ids = new Set<string>();
  const classes = new Set<string>();
  const testIds = new Set<string>();
  const roles = new Set<string>();
  const ariaLabels = new Set<string>();
  const names = new Set<string>();
  const placeholders = new Set<string>();
  const texts = new Set<string>();
  const tags: Record<string, number> = {};

  for (const el of elements) {
    if (el.id) ids.add(el.id);
    for (const cls of el.classes) {
      if (cls) classes.add(cls);
    }
    if (el.testId) testIds.add(el.testId);
    if (el.role) roles.add(el.role);
    if (el.ariaLabel) ariaLabels.add(el.ariaLabel);
    if (el.name) names.add(el.name);
    if (el.placeholder) placeholders.add(el.placeholder);
    if (el.text) texts.add(el.text);
    tags[el.tag] = (tags[el.tag] || 0) + (el.matchCount || 1);
  }

  return {
    ids: Array.from(ids),
    classes: Array.from(classes),
    testIds: Array.from(testIds),
    roles: Array.from(roles),
    ariaLabels: Array.from(ariaLabels),
    names: Array.from(names),
    placeholders: Array.from(placeholders),
    texts: Array.from(texts),
    tags,
    elements,
  };
}

/** Create an empty RichPageData (for initial state / fallback). */
export function emptyPageData(): RichPageData {
  return {
    ids: [],
    classes: [],
    testIds: [],
    roles: [],
    ariaLabels: [],
    names: [],
    placeholders: [],
    texts: [],
    tags: {},
    elements: [],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/specialists/helpers/page-data.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/specialists/helpers/page-data.ts tests/specialists/helpers/page-data.test.ts
git commit -m "feat: add page data scraper helper for RichPageData"
```

---

### Task 3: Update All Specialists — suggest() and didYouMean() Signatures

Update all 5 specialists to accept `RichPageData` instead of `PageElement[]`. Use `pageData.elements` internally where needed, and use the richer cached arrays (ids, classes, testIds, roles, etc.) for faster completions.

**Files:**
- Modify: `src/specialists/css.ts`
- Modify: `src/specialists/xpath.ts`
- Modify: `src/specialists/playwright.ts`
- Modify: `src/specialists/cypress.ts`
- Modify: `src/specialists/selenium.ts`
- Modify: `src/specialists/helpers/suggestions.ts`
- Modify: `tests/specialists/css.test.ts`
- Modify: `tests/specialists/xpath.test.ts`
- Modify: `tests/specialists/playwright.test.ts`
- Modify: `tests/specialists/cypress.test.ts`
- Modify: `tests/specialists/selenium.test.ts`

- [ ] **Step 1: Update suggestion helpers**

In `src/specialists/helpers/suggestions.ts`, update `findAttributeElsewhere` to accept `RichPageData`:

```typescript
import type { RichPageData } from '../types';

// Keep the old PageElement-based function but rename it
// Add a new overload that accepts RichPageData
export function findAttributeElsewhere(
  value: string,
  pageData: RichPageData
): Array<{ element: PageElement; attribute: string }> {
  return findAttributeElsewhereInElements(value, pageData.elements);
}
```

Rename the old function to `findAttributeElsewhereInElements` (internal) and have `findAttributeElsewhere` delegate to it via `pageData.elements`.

- [ ] **Step 2: Update each specialist's suggest() and didYouMean()**

For each specialist file, change the `suggest` and `didYouMean` method signatures from `pageElements: PageElement[]` to `pageData: RichPageData`. Then update the internal references:

- Where the specialist iterated over `pageElements`, use `pageData.elements`
- Where the specialist searched for IDs, use `pageData.ids` instead of filtering `pageElements.filter(el => el.id)`
- Where it searched for testIds, use `pageData.testIds`
- Where it searched for classes, use `pageData.classes`
- Where it searched for roles, use `pageData.roles`

Import `RichPageData` from `../types` in each specialist.

Add `selectorType` to each returned `Suggestion` object (e.g., `selectorType: 'css'` for CSS specialist, `selectorType: 'xpath'` for XPath, etc.).

- [ ] **Step 3: Update all specialist tests**

In each test file, update the `suggest()` and `didYouMean()` test calls. Where they currently pass `PageElement[]`, wrap it in a `RichPageData` object using `buildRichPageData()` from `@/specialists/helpers/page-data`:

```typescript
import { buildRichPageData } from '@/specialists/helpers/page-data';

// Old:
specialist.suggest('#sub', elements)
// New:
specialist.suggest('#sub', buildRichPageData(elements))

// Old:
specialist.didYouMean('[data-testid="x"]', elements)
// New:
specialist.didYouMean('[data-testid="x"]', buildRichPageData(elements))
```

For tests that pass empty arrays, use `emptyPageData()`:
```typescript
import { emptyPageData } from '@/specialists/helpers/page-data';

specialist.suggest('', emptyPageData())
specialist.didYouMean("...", emptyPageData())
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 5: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/specialists/ tests/specialists/ src/specialists/helpers/suggestions.ts
git commit -m "refactor: update all specialists to use RichPageData for suggestions"
```

---

### Task 4: Content Script — New Message Handlers

**Files:**
- Modify: `src/entrypoints/content.ts`

- [ ] **Step 1: Add SCRAPE_PAGE_DATA handler**

In the content script's message listener (around line 45), add a new handler:

```typescript
} else if (message.type === 'SCRAPE_PAGE_DATA') {
  const data = scrapePageDataFromDom();
  sendResponse({ data });
```

Add the `scrapePageDataFromDom` function in content.ts (before the message listener):

```typescript
function scrapePageDataFromDom() {
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'LINK', 'META', 'SVG', 'HEAD']);
  const MAX_ELEMENTS = 500;
  const TEXT_MAX = 50;

  const ids: string[] = [];
  const classes: string[] = [];
  const testIds: string[] = [];
  const roles: string[] = [];
  const ariaLabels: string[] = [];
  const names: string[] = [];
  const placeholders: string[] = [];
  const texts: string[] = [];
  const tags: Record<string, number> = {};

  const seenIds = new Set<string>();
  const seenClasses = new Set<string>();
  const seenTestIds = new Set<string>();
  const seenRoles = new Set<string>();
  const seenAriaLabels = new Set<string>();
  const seenNames = new Set<string>();
  const seenPlaceholders = new Set<string>();
  const seenTexts = new Set<string>();

  const elements: Array<{
    tag: string; id: string; classes: string[]; testId: string;
    role: string; ariaLabel: string; name: string; placeholder: string;
    title: string; altText: string; text: string; matchCount: number;
  }> = [];
  const dedupMap = new Map<string, number>();

  const all = document.querySelectorAll('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i] as HTMLElement;
    if (SKIP_TAGS.has(el.tagName)) continue;
    const tag = el.tagName.toLowerCase();
    tags[tag] = (tags[tag] || 0) + 1;

    const id = el.id || '';
    const testId = el.getAttribute('data-testid') || el.getAttribute('data-test') || '';
    const role = el.getAttribute('role') || '';
    const ariaLabel = el.getAttribute('aria-label') || '';
    const name = (el as HTMLInputElement).name || el.getAttribute('name') || '';
    const placeholder = el.getAttribute('placeholder') || '';
    const title = el.getAttribute('title') || '';
    const altText = el.getAttribute('alt') || '';

    let text = '';
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) text += (n as Text).textContent || '';
    }
    text = text.trim().slice(0, TEXT_MAX);

    // Collect unique values
    if (id && !seenIds.has(id)) { seenIds.add(id); ids.push(id); }
    if (testId && !seenTestIds.has(testId)) { seenTestIds.add(testId); testIds.push(testId); }
    if (role && !seenRoles.has(role)) { seenRoles.add(role); roles.push(role); }
    if (ariaLabel && !seenAriaLabels.has(ariaLabel)) { seenAriaLabels.add(ariaLabel); ariaLabels.push(ariaLabel); }
    if (name && !seenNames.has(name)) { seenNames.add(name); names.push(name); }
    if (placeholder && !seenPlaceholders.has(placeholder)) { seenPlaceholders.add(placeholder); placeholders.push(placeholder); }
    if (text && !seenTexts.has(text)) { seenTexts.add(text); texts.push(text); }
    if (el.classList) {
      for (let c = 0; c < el.classList.length; c++) {
        const cls = el.classList[c];
        if (cls && !seenClasses.has(cls)) { seenClasses.add(cls); classes.push(cls); }
      }
    }

    // Build elements array (deduped, capped)
    if (elements.length < MAX_ELEMENTS) {
      if (!id && !testId && !role && !ariaLabel && !name && !text && (!el.classList || el.classList.length === 0)) continue;
      const classArr = el.classList ? Array.from(el.classList).slice(0, 5) : [];
      const dedupKey = `${tag}|${id}|${testId}|${role}|${ariaLabel}|${name}`;
      if (dedupMap.has(dedupKey)) {
        elements[dedupMap.get(dedupKey)!].matchCount++;
      } else {
        dedupMap.set(dedupKey, elements.length);
        elements.push({ tag, id, classes: classArr, testId, role, ariaLabel, name, placeholder, title, altText, text, matchCount: 1 });
      }
    }
  }

  return { ids, classes, testIds, roles, ariaLabels, names, placeholders, texts, tags, elements };
}
```

- [ ] **Step 2: Add QUERY_SELECTOR_BATCH handler**

```typescript
} else if (message.type === 'QUERY_SELECTOR_BATCH') {
  const selectors = message.selectors as Array<{ id: string; selector: string; selectorType: string }>;
  const counts: Record<string, number> = {};
  for (const s of selectors) {
    counts[s.id] = countSelectorMatchesWithType(s.selector, s.selectorType);
  }
  sendResponse({ counts });
```

Add helper function `countSelectorMatchesWithType` that uses the existing `runSelectorTest` from selector-core:

```typescript
import { runSelectorTest } from '@/shared/selector-core';

function countSelectorMatchesWithType(selector: string, selectorType: string): number {
  const type = (selectorType as 'css' | 'xpath' | 'role') || 'css';
  const result = runSelectorTest(selector, type);
  return result.count;
}
```

- [ ] **Step 3: Add TEST_SELECTOR_SCOPED handler**

```typescript
} else if (message.type === 'TEST_SELECTOR_SCOPED') {
  const chain = message.chain as Array<{ selector: string; selectorType: string }>;
  const count = testSelectorChain(chain);
  sendResponse({ count });
```

Add helper:

```typescript
function testSelectorChain(chain: Array<{ selector: string; selectorType: string }>): number {
  if (chain.length === 0) return 0;

  let currentElements: Element[] = Array.from(document.querySelectorAll('*'));

  for (const segment of chain) {
    const type = (segment.selectorType as 'css' | 'xpath' | 'role') || 'css';
    const nextElements: Element[] = [];

    for (const parent of currentElements) {
      try {
        if (type === 'css') {
          nextElements.push(...Array.from(parent.querySelectorAll(segment.selector)));
        } else if (type === 'xpath') {
          const xr = document.evaluate(
            segment.selector, parent, null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
          );
          for (let i = 0; i < xr.snapshotLength; i++) {
            const n = xr.snapshotItem(i);
            if (n instanceof Element) nextElements.push(n);
          }
        } else if (type === 'role') {
          // Role-based: match role attribute and implicit roles within parent
          const parts = segment.selector.split('::');
          const role = parts[0];
          const nameFilter = parts[1];
          const candidates = Array.from(parent.querySelectorAll(`[role="${role}"]`));
          // Also check implicit roles
          const implicitTags: Record<string, string[]> = {
            button: ['button', 'summary'], link: ['a'], textbox: ['input', 'textarea'],
            combobox: ['select'], navigation: ['nav'], main: ['main'],
            banner: ['header'], contentinfo: ['footer'],
          };
          for (const tag of implicitTags[role] || []) {
            for (const el of parent.querySelectorAll(tag)) {
              if (!el.hasAttribute('role')) candidates.push(el);
            }
          }
          if (nameFilter) {
            const lower = nameFilter.toLowerCase();
            nextElements.push(...candidates.filter(el => {
              const label = el.getAttribute('aria-label')?.toLowerCase() || '';
              const text = el.textContent?.trim().toLowerCase() || '';
              return label.includes(lower) || text.includes(lower);
            }));
          } else {
            nextElements.push(...candidates);
          }
        }
      } catch { /* skip invalid selectors */ }
    }

    if (nextElements.length === 0) return 0;
    currentElements = nextElements;
  }

  return currentElements.length;
}
```

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/entrypoints/content.ts
git commit -m "feat: add SCRAPE_PAGE_DATA, QUERY_SELECTOR_BATCH, TEST_SELECTOR_SCOPED handlers"
```

---

### Task 5: Messaging Functions

**Files:**
- Modify: `src/entrypoints/sidepanel/services/messaging.ts`

- [ ] **Step 1: Add new messaging functions**

Add to `src/entrypoints/sidepanel/services/messaging.ts`:

```typescript
import type { RichPageData } from '@/specialists/types';

export async function scrapePageData(): Promise<RichPageData> {
  const response = await sendToTab({ type: 'SCRAPE_PAGE_DATA' });
  return response?.data ?? {
    ids: [], classes: [], testIds: [], roles: [], ariaLabels: [],
    names: [], placeholders: [], texts: [], tags: {}, elements: [],
  };
}

export async function batchQuerySelectors(
  selectors: Array<{ id: string; selector: string; selectorType: string }>
): Promise<Record<string, number>> {
  const response = await sendToTab({ type: 'QUERY_SELECTOR_BATCH', selectors });
  return response?.counts ?? {};
}

export async function testSelectorScoped(
  chain: Array<{ selector: string; selectorType: string }>
): Promise<number> {
  const response = await sendToTab({ type: 'TEST_SELECTOR_SCOPED', chain });
  return response?.count ?? 0;
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/entrypoints/sidepanel/services/messaging.ts
git commit -m "feat: add scrapePageData, batchQuerySelectors, testSelectorScoped messaging"
```

---

### Task 6: Page Cache Service

**Files:**
- Create: `src/entrypoints/sidepanel/services/page-cache.ts`

- [ ] **Step 1: Create the page cache service**

Create `src/entrypoints/sidepanel/services/page-cache.ts`:

```typescript
import type { RichPageData } from '@/specialists/types';
import { emptyPageData } from '@/specialists/helpers/page-data';
import { scrapePageData } from './messaging';

let cache: RichPageData = emptyPageData();
let lastScrapeTime = 0;
let scrapeTimer: ReturnType<typeof setTimeout> | null = null;
const MIN_SCRAPE_INTERVAL = 2000; // 2s debounce

/** Get the current cached page data. */
export function getPageData(): RichPageData {
  return cache;
}

/** Request a fresh scrape from the content script. Debounced to 2s. */
export function requestScrape(): void {
  const now = Date.now();
  if (now - lastScrapeTime < MIN_SCRAPE_INTERVAL) {
    // Debounce: schedule for later
    if (!scrapeTimer) {
      scrapeTimer = setTimeout(() => {
        scrapeTimer = null;
        doScrape();
      }, MIN_SCRAPE_INTERVAL - (now - lastScrapeTime));
    }
    return;
  }
  doScrape();
}

async function doScrape(): Promise<void> {
  try {
    cache = await scrapePageData();
    lastScrapeTime = Date.now();
  } catch {
    // Content script not available — keep existing cache
  }
}

/** Reset cache (e.g., on tab change). */
export function resetCache(): void {
  cache = emptyPageData();
  lastScrapeTime = 0;
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/entrypoints/sidepanel/services/page-cache.ts
git commit -m "feat: add page cache service for RichPageData"
```

---

### Task 7: extractTestable() — Chained Locator Support

**Files:**
- Modify: `src/shared/selector-core.ts`

- [ ] **Step 1: Update extractTestable return type**

In `src/shared/selector-core.ts`, update the `extractTestable` function to detect chained selectors and return `{ chain: [...] }`:

```typescript
type TestableResult =
  | { selector: string; selectorType: 'css' | 'xpath' | 'role' }
  | { chain: Array<{ selector: string; selectorType: 'css' | 'xpath' | 'role' }> };

export function extractTestable(
  locator: string,
  format: SelectorFormat
): TestableResult | null {
```

- [ ] **Step 2: Add chain detection for Playwright**

In the Playwright section of `extractTestable`, before the existing single-method parsing, check if the locator contains chained calls:

```typescript
if (format === 'playwright') {
  // Detect chaining: multiple method calls like page.getByRole(...).getByRole(...)
  const chainParts = locator.match(/\.(getBy\w+|locator|filter|nth|first|last)\(/g);
  if (chainParts && chainParts.length > 1) {
    // Split into segments and extract each
    const segments = splitPlaywrightChain(locator);
    if (segments.length > 1) {
      const chain = segments.map(seg => extractSingleTestable(seg, 'playwright')).filter(Boolean);
      if (chain.length > 1) return { chain: chain as Array<{ selector: string; selectorType: 'css' | 'xpath' | 'role' }> };
    }
  }
  // Fall through to single-method parsing...
```

Add `splitPlaywrightChain` helper:

```typescript
function splitPlaywrightChain(locator: string): string[] {
  // Split page.getByRole('nav').getByRole('link', { name: 'Home' }) into
  // ['page.getByRole(\'nav\')', '.getByRole(\'link\', { name: \'Home\' })']
  const segments: string[] = [];
  const re = /(?:page)?\.(getBy\w+|locator|filter|nth|first|last)\([^)]*(?:\{[^}]*\}[^)]*)*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(locator)) !== null) {
    segments.push(match[0].startsWith('page') ? match[0] : `page${match[0]}`);
  }
  return segments;
}

function extractSingleTestable(
  segment: string,
  format: SelectorFormat
): { selector: string; selectorType: 'css' | 'xpath' | 'role' } | null {
  // Reuse existing single-method extraction logic
  // This is the current extractTestable logic for a single segment
}
```

Actually, the cleanest approach: refactor the existing Playwright parsing into a `extractSinglePlaywright` helper, then the chain logic calls it per segment. The single-method path also calls it.

- [ ] **Step 3: Add chain detection for Cypress**

Similarly detect `.find(`, `.contains(`, `.within(` chains in Cypress selectors:

```typescript
if (format === 'cypress') {
  const chainParts = locator.match(/\.(find|contains|within|eq|first|last)\(/g);
  if (chainParts && chainParts.length >= 1 && locator.match(/^cy\.\w+\(.*?\)\./)) {
    const segments = splitCypressChain(locator);
    if (segments.length > 1) {
      const chain = segments.map(seg => extractSingleTestable(seg, 'cypress')).filter(Boolean);
      if (chain.length > 1) return { chain: chain as Array<{ selector: string; selectorType: 'css' | 'xpath' | 'role' }> };
    }
  }
  // Fall through to single-method parsing...
```

- [ ] **Step 4: Add chain detection for Selenium**

Detect nested `.findElement(` chains:

```typescript
if (format === 'selenium') {
  const findCount = (locator.match(/\.findElement\(/g) || []).length;
  if (findCount > 1) {
    // Split: driver.findElement(By.id('form')).findElement(By.name('email'))
    const segments = locator.split(/\)\.findElement\(/).map((s, i, arr) => {
      if (i === 0) return `driver.findElement(${s})`;
      if (i === arr.length - 1) return `driver.findElement(${s}`;
      return `driver.findElement(${s})`;
    });
    const chain = segments.map(seg => extractSingleTestable(seg, 'selenium')).filter(Boolean);
    if (chain.length > 1) return { chain: chain as Array<{ selector: string; selectorType: 'css' | 'xpath' | 'role' }> };
  }
  // Fall through...
```

- [ ] **Step 5: Run tests and build**

Run: `npm test && npm run build`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/shared/selector-core.ts
git commit -m "feat: support chained locator parsing in extractTestable"
```

---

### Task 8: Build Tab — Live Suggestions Integration

This is the main UI task. Update the build tab to use page cache, batch-query for match counts, show scoped suggestions, and highlight on hover.

**Files:**
- Modify: `src/entrypoints/sidepanel/components/build-tab.ts`

- [ ] **Step 1: Integrate page cache**

Add imports:

```typescript
import { getPageData, requestScrape } from '../services/page-cache';
import { batchQuerySelectors, testSelector, clearHighlights } from '../services/messaging';
```

In the component's `connectedCallback` (or wherever initialization happens), trigger initial scrape:

```typescript
requestScrape();
```

Listen for `SELECTOR_STATUS_CHANGED` to trigger re-scrape:

```typescript
// In connectedCallback or init
onSelectorStatusChanged(() => {
  requestScrape();
});
```

- [ ] **Step 2: Update _fetchSuggestions to use RichPageData**

Replace the current `_fetchSuggestions`:

```typescript
private _fetchSuggestions() {
  const val = this._freeformSelector.trim();
  if (!val) {
    this._autocompleteSuggestions = [];
    this._autocompleteIndex = -1;
    return;
  }

  const format = detectFormat(val);
  try {
    const specialist = getSpecialist(format);
    const pageData = getPageData();
    const suggestions = specialist.suggest(val, pageData).slice(0, 8);
    // Add selectorType if not set
    for (const s of suggestions) {
      if (!s.selectorType) s.selectorType = format === 'xpath' ? 'xpath' : 'css';
    }
    this._autocompleteSuggestions = suggestions;
    this._batchFetchCounts(suggestions);
  } catch {
    this._autocompleteSuggestions = [];
  }
  this._autocompleteIndex = -1;
}
```

- [ ] **Step 3: Add batch count fetching**

```typescript
private async _batchFetchCounts(suggestions: SpecialistSuggestion[]) {
  if (suggestions.length === 0) return;

  const selectors = suggestions.map((s, i) => ({
    id: String(i),
    selector: s.selector,
    selectorType: s.selectorType || 'css',
  }));

  // Also check the typed selector for scoped suggestions
  try {
    const counts = await batchQuerySelectors(selectors);
    // Update match counts on existing suggestions
    const updated = this._autocompleteSuggestions.map((s, i) => ({
      ...s,
      matchCount: counts[String(i)] ?? undefined,
    }));

    // Check if typed selector is ambiguous (>1 match)
    const typedVal = this._freeformSelector.trim();
    if (typedVal) {
      const typedCount = await batchQuerySelectors([{
        id: 'typed',
        selector: typedVal,
        selectorType: this._freeformFormat === 'xpath' ? 'xpath' : 'css',
      }]);
      const count = typedCount.typed ?? 0;
      if (count > 1) {
        await this._fetchScopedSuggestions(count);
      } else {
        this._scopedSuggestions = [];
      }
    }

    this._autocompleteSuggestions = updated;
  } catch {
    // Counts unavailable — suggestions still show without counts
  }
}
```

- [ ] **Step 4: Add scoped suggestions state and fetching**

Add state:

```typescript
@state() private _scopedSuggestions: SpecialistSuggestion[] = [];
```

Add method:

```typescript
private async _fetchScopedSuggestions(matchCount: number) {
  const format = this._freeformFormat;
  const specialist = getSpecialist(format);
  const pageData = getPageData();

  // Build a minimal RichElementData from typed selector for chaining
  // Use the first matching element's data if possible
  const richElement: RichElementData = {
    tagName: 'div',
    text: '',
    attributes: {},
    parentChain: [],
    siblingTags: [],
    accessibleName: '',
  };

  const scoped = specialist.chain(richElement, matchCount);
  if (scoped.length === 0) {
    this._scopedSuggestions = [];
    return;
  }

  // Batch test scoped selectors
  const selectors = scoped.map((s, i) => ({
    id: `scoped-${i}`,
    selector: s.selector,
    selectorType: format === 'xpath' ? 'xpath' : 'css',
  }));

  try {
    const counts = await batchQuerySelectors(selectors);
    this._scopedSuggestions = scoped
      .map((s, i) => ({
        selector: s.selector,
        label: s.selector,
        description: 'Scoped selector',
        score: s.score,
        kind: 'scoped' as const,
        matchCount: counts[`scoped-${i}`] ?? undefined,
        selectorType: (format === 'xpath' ? 'xpath' : 'css') as 'css' | 'xpath' | 'role',
      }))
      .filter((s) => s.matchCount === 1); // Only show unique scoped
  } catch {
    this._scopedSuggestions = [];
  }
}
```

- [ ] **Step 5: Add highlight on hover**

Add state:

```typescript
private _highlightTimer: ReturnType<typeof setTimeout> | null = null;
```

Add handler:

```typescript
private _onSuggestionHover(suggestion: SpecialistSuggestion) {
  if (this._highlightTimer) clearTimeout(this._highlightTimer);
  this._highlightTimer = setTimeout(async () => {
    try {
      await testSelector(suggestion.selector, suggestion.selectorType || 'css');
    } catch { /* ignore */ }
  }, 100);
}

private _onDropdownClose() {
  if (this._highlightTimer) {
    clearTimeout(this._highlightTimer);
    this._highlightTimer = null;
  }
  clearHighlights().catch(() => {});
  this._autocompleteSuggestions = [];
  this._scopedSuggestions = [];
  this._autocompleteIndex = -1;
}
```

- [ ] **Step 6: Update dropdown template**

Replace the autocomplete dropdown rendering with the enhanced version:

```typescript
${this._autocompleteSuggestions.length > 0 || this._scopedSuggestions.length > 0
  ? html`
      <div class="autocomplete-dropdown">
        ${this._autocompleteSuggestions.map(
          (s, i) => html`
            <button
              class="autocomplete-item ${i === this._autocompleteIndex ? 'selected' : ''}"
              @mousedown=${(e: Event) => { e.preventDefault(); this._applySuggestion(s); }}
              @mouseenter=${() => this._onSuggestionHover(s)}
            >
              <span class="autocomplete-selector">${s.selector}</span>
              <span class="match-badge ${this._matchBadgeClass(s.matchCount)}">${s.matchCount ?? '...'}</span>
            </button>
          `
        )}
        ${this._scopedSuggestions.length > 0
          ? html`
              <div class="scoped-divider">Scoped (unique)</div>
              ${this._scopedSuggestions.map(
                (s) => html`
                  <button
                    class="autocomplete-item scoped"
                    @mousedown=${(e: Event) => { e.preventDefault(); this._applySuggestion(s); }}
                    @mouseenter=${() => this._onSuggestionHover(s)}
                  >
                    <span class="autocomplete-selector">${s.selector}</span>
                    <span class="match-badge match-unique">${s.matchCount ?? '...'}</span>
                  </button>
                `
              )}
            `
          : nothing}
      </div>
    `
  : nothing}
```

Add helper:

```typescript
private _matchBadgeClass(count?: number): string {
  if (count === undefined) return 'match-loading';
  if (count === 0) return 'match-none';
  if (count === 1) return 'match-unique';
  return 'match-ambiguous';
}
```

- [ ] **Step 7: Add CSS for match badges and scoped divider**

```css
.match-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 8px;
  white-space: nowrap;
  flex-shrink: 0;
}
.match-unique { background: rgba(34,197,94,0.15); color: #22c55e; }
.match-ambiguous { background: rgba(234,179,8,0.15); color: #eab308; }
.match-none { background: rgba(239,68,68,0.15); color: #ef4444; }
.match-loading { background: var(--bg-secondary); color: var(--text-secondary); }
.scoped-divider {
  padding: 4px 10px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.autocomplete-item.scoped {
  background: color-mix(in srgb, var(--accent) 3%, transparent);
}
```

- [ ] **Step 8: Update didYouMean to use page cache**

In `_runMatchCount`, replace the didYouMean call:

```typescript
// Old:
this._didYouMean = specialist.didYouMean(sel, this._pageElements || []).slice(0, 3);
// New:
this._didYouMean = specialist.didYouMean(sel, getPageData()).slice(0, 3);
```

- [ ] **Step 9: Update blur handler to clear highlights**

Wire `_onDropdownClose` to blur and escape:

```typescript
// On blur of freeform input:
this._onDropdownClose();

// On Escape in keydown:
this._onDropdownClose();
```

- [ ] **Step 10: Build and lint**

Run: `npm run lint:fix && npm run build`
Expected: Build succeeds.

- [ ] **Step 11: Commit**

```bash
git add src/entrypoints/sidepanel/components/build-tab.ts
git commit -m "feat: live DOM-aware suggestions with match counts, scoped alternatives, hover highlight"
```

---

### Task 9: Final Integration and Cleanup

**Files:**
- Various cleanup

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Lint fix**

Run: `npm run lint:fix`
Expected: Clean.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: final cleanup for live suggestions feature"
```

---

## Task Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Types and interfaces update | None |
| 2 | Page data scraper helper | 1 |
| 3 | Update all specialists (suggest/didYouMean signatures) | 1, 2 |
| 4 | Content script — new message handlers | 1 |
| 5 | Messaging functions | 4 |
| 6 | Page cache service | 2, 5 |
| 7 | extractTestable — chained locator support | 1 |
| 8 | Build tab — live suggestions integration | 3, 5, 6, 7 |
| 9 | Final integration and cleanup | All |

Tasks 2, 4, 7 can run in parallel after Task 1. Task 3 needs 1+2. Task 8 needs everything else.
