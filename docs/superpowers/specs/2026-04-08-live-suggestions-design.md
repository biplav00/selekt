# Live DOM-Aware Suggestions Design

**Date:** 2026-04-08
**Status:** Approved
**Scope:** Upgrade suggestion system from static to live DOM-aware, SelectorHub-style

## Overview

Replace the current static suggestion system (pre-scraped `PageElement[]`) with a live DOM-aware system that provides real-time match counts, attribute value completion from the full DOM, scoped/relative suggestions for ambiguous selectors, and visual element highlighting on hover.

## Key Decisions

- **Progressive + pre-cache hybrid** — Pre-cache rich DOM data on page load for instant suggestions. Use batch queries for live match counts on visible suggestions.
- **Highlight on hover, keep last** — Debounced 100ms highlight on suggestion hover. Highlight persists until next hover, dropdown close, or new input.
- **Scoped suggestions inline** — When selector matches >1, scoped alternatives appear in the same dropdown below a divider labeled "Scoped (unique)".
- **RichPageData replaces PageElement[]** — Specialists receive richer cached data for more complete suggestions.

## Architecture

### New Message Types

**`SCRAPE_PAGE_DATA`** — Pre-cache rich DOM data:
```typescript
// Request
{ type: 'SCRAPE_PAGE_DATA' }
// Response
{ data: RichPageData }
```

**`QUERY_SELECTOR_BATCH`** — Test multiple selectors at once:
```typescript
// Request
{ type: 'QUERY_SELECTOR_BATCH', selectors: Array<{ id: string; selector: string; selectorType: 'css' | 'xpath' | 'role' }> }
// Response
{ counts: Record<string, number> }
```

### RichPageData

```typescript
interface RichPageData {
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

Scraped once on page load / tab change. The sidepanel re-requests `SCRAPE_PAGE_DATA` when it receives a `SELECTOR_STATUS_CHANGED` message (indicating DOM mutation detected by the existing MutationObserver in the content script). This piggybacks on the existing observer — no new observer needed. The sidepanel debounces re-scrape requests to at most once every 2s.

### Data Flow

```
Page loads / tab changes
  -> sidepanel sends SCRAPE_PAGE_DATA
  -> content script scrapes full DOM -> returns RichPageData
  -> sidepanel caches in memory (page-cache service)

User types in build tab
  -> specialist.suggest(partial, cachedPageData) -> instant suggestions (no round-trip)
  -> show suggestions immediately in dropdown (match counts show "..." loading state)
  -> sidepanel sends QUERY_SELECTOR_BATCH for visible suggestion selectors
  -> content script tests each -> returns counts
  -> update suggestion items with live match counts
  -> if typed selector matches >1: specialist.chain() -> batch test scoped alternatives
  -> scoped alternatives with count===1 appear below divider in dropdown

User hovers suggestion
  -> debounce 100ms -> send TEST_SELECTOR to content script
  -> content script highlights matching elements (green outline)
  -> highlight persists until next hover or dropdown close

Dropdown closes / user types more
  -> send CLEAR_HIGHLIGHTS
```

## Interface Changes

### SelectorSpecialist — Updated Methods

```typescript
// suggest() now receives RichPageData instead of PageElement[]
suggest(partial: string, pageData: RichPageData): Suggestion[];

// didYouMean() same change
didYouMean(selector: string, pageData: RichPageData): Suggestion[];
```

### Suggestion Type — Updated

```typescript
interface Suggestion {
  selector: string;
  label: string;
  description: string;
  score: number;
  kind: 'autocomplete' | 'alternative' | 'fix' | 'scoped';
  matchCount?: number;     // Filled by batch query; undefined while loading
  selectorType?: 'css' | 'xpath' | 'role';  // Needed for batch testing
}
```

### RichPageData Type

Added to `src/specialists/types.ts`:

```typescript
interface RichPageData {
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

## Autocomplete Dropdown UX

### Suggestion Row Layout

```
[selector text]                    [match count badge]
[description]                      [element tag preview]
```

Match count badge colors:
- `1` — green (unique, ideal)
- `2-5` — yellow (ambiguous)
- `0` — red (no match)
- `...` — gray (loading)

### Scoped Suggestions

When typed selector matches >1, scoped alternatives appear below a divider:

```
+--------------------------------------------------+
|  button                                    5      |
|  CSS selector                          <button>   |
|-- Scoped (unique) --------------------------------|
|  #sidebar button                           1      |
|  nav.main-nav button                       1      |
|  .modal button                             1      |
+--------------------------------------------------+
```

Generated via specialist's existing `chain()` method, batch-tested for live counts, filtered to show only unique (count===1) results.

### Highlight on Hover

- `mouseenter` starts 100ms debounce timer
- After 100ms, send `TEST_SELECTOR` to content script
- Elements highlight with green outline (existing highlight system)
- Highlight persists on `mouseleave` — not cleared
- Cleared when: dropdown closes, user types more, different suggestion highlighted

### Attribute Value Completion

When typing `[class="` or `@class=`, specialist queries `cachedPageData.classes` for completions. Same for `[id="` -> `cachedPageData.ids`, `[data-testid="` -> `cachedPageData.testIds`, `[@role=` -> `cachedPageData.roles`, etc.

### Enhanced "Did You Mean?"

When 0 matches:
1. **Typo correction** — Levenshtein distance against cached values (existing)
2. **Attribute migration** — value found under different attribute name (existing)
3. **Scope narrowing** — remove last qualifier, check broader selector via batch query
4. **Live cache search** — search all cached values for partial match

Each "did you mean" suggestion shows live match count.

## New Files

| File | Purpose |
|------|---------|
| `src/specialists/helpers/page-data.ts` | `RichPageData` type re-export, `scrapePageData()` function for content script |
| `src/entrypoints/sidepanel/services/page-cache.ts` | Cache management — triggers scrape, stores result, refreshes on tab change / DOM mutation |

## Modified Files

| File | Changes |
|------|---------|
| `src/specialists/types.ts` | Add `RichPageData`, update `Suggestion` (matchCount, selectorType), update `SelectorSpecialist` interface (suggest/didYouMean signatures) |
| `src/specialists/css.ts` | `suggest()` and `didYouMean()` use `RichPageData` — query `pageData.ids`, `pageData.classes`, `pageData.testIds` for completions |
| `src/specialists/xpath.ts` | Same — query `pageData.tags`, `pageData.testIds`, `pageData.ids` |
| `src/specialists/playwright.ts` | Same — query `pageData.roles`, `pageData.testIds` for role/testid completion |
| `src/specialists/cypress.ts` | Same — query `pageData.testIds`, `pageData.roles` |
| `src/specialists/selenium.ts` | Same — query `pageData.ids`, `pageData.names`, `pageData.testIds` |
| `src/specialists/helpers/suggestions.ts` | Update `findTypoCorrections` and `findAttributeElsewhere` to work with `RichPageData` |
| `src/specialists/registry.ts` | No changes needed |
| `src/entrypoints/content.ts` | Handle `SCRAPE_PAGE_DATA`, `QUERY_SELECTOR_BATCH`, and `TEST_SELECTOR_SCOPED` message types |
| `src/shared/selector-core.ts` | Update `extractTestable()` to handle chained locators, returning `{ chain: [...] }` for multi-segment selectors |
| `src/entrypoints/sidepanel/components/build-tab.ts` | Use page cache, batch query for counts, hover highlight with debounce, scoped suggestions in dropdown, enhanced did-you-mean |
| `src/entrypoints/sidepanel/services/messaging.ts` | Add `scrapePageData()` and `batchQuerySelectors()` messaging functions |
| `src/types.ts` | Add `SCRAPE_PAGE_DATA`, `QUERY_SELECTOR_BATCH`, and `TEST_SELECTOR_SCOPED` to `MessageType` union |

## Chained Locator Testing

### The Problem

Framework-specific chained selectors like `page.getByRole('navigation').getByRole('link', { name: 'Home' })` or `cy.get('#sidebar').find('.nav-link')` cannot be tested on the live page via `extractTestable()` — it only parses single method calls and returns a CSS/XPath/role selector for DOM testing.

### Solution

For chained selectors, `extractTestable()` must be updated to handle chains by decomposing them into sequential DOM queries:

1. Parse the chain into individual segments: `page.getByRole('navigation')` + `.getByRole('link', { name: 'Home' })`
2. Test the first segment to get matching elements
3. Within those elements, test the second segment
4. Return the intersection count

This requires a new content script capability: **scoped selector testing**.

**`TEST_SELECTOR_SCOPED`** message:
```typescript
// Request
{ type: 'TEST_SELECTOR_SCOPED', chain: Array<{ selector: string; selectorType: 'css' | 'xpath' | 'role' }> }
// Response
{ count: number }
```

The content script tests each segment sequentially, scoping each subsequent query to the results of the previous one.

### Per-Format Chain Parsing

Each specialist adds a `parseChain(selector: string)` helper that breaks a chained selector into testable segments:

- **Playwright**: Split on `.getBy`, `.locator(`, `.filter(`, `.nth(`, `.first()`, `.last()`
- **Cypress**: Split on `.find(`, `.within(`, `.contains(`, `.eq(`, `.first()`, `.last()`
- **Selenium**: Split on `.findElement(`
- **CSS/XPath**: Split on space (descendant combinator) for CSS, `//` for nested XPath — these already work with existing testing

### `extractTestable()` Update

```typescript
// Updated return type
export function extractTestable(
  locator: string,
  format: SelectorFormat
): { selector: string; selectorType: 'css' | 'xpath' | 'role' }
   | { chain: Array<{ selector: string; selectorType: 'css' | 'xpath' | 'role' }> }
   | null;
```

When the locator is chained, returns `{ chain: [...] }` instead of a single selector. The caller checks for `chain` and uses `TEST_SELECTOR_SCOPED` instead of `TEST_SELECTOR`.

## Backward Compatibility

- `RichPageData.elements` contains the existing `PageElement[]` — specialists can access it if needed
- Floating widget unaffected — doesn't use suggestions
- Content script's existing `fetchPageElements` (used in build tab) can be replaced by `scrapePageData` which returns a superset
- All existing tests continue to pass — specialist tests mock the input data
