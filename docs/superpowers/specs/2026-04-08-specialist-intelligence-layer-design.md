# Specialist Intelligence Layer Design

**Date:** 2026-04-08
**Status:** Approved
**Scope:** Per-format selector intelligence with pluggable specialist architecture

## Overview

Replace the monolithic scoring/generation engine with a pluggable specialist architecture. Each selector format (CSS, XPath, Playwright, Cypress, Selenium) gets its own intelligence module that independently handles generation, scoring, chaining, suggestions, validation, and actionable warnings.

## Key Decisions

- **Functional modules** — each specialist is a plain module exporting a `SelectorSpecialist` object, no classes
- **Convention-based discovery** — drop a file in `src/specialists/`, export `specialist`, add one import in registry
- **`RichElementData` as input** — parentChain, siblingTags, accessibleName for smarter selectors
- **Independent scoring** — each format scores within its own context, no cross-format comparison
- **Actionable warnings** — each warning includes a concrete fix selector the user can click to apply
- **SelectorHub-style suggestions** — autocomplete, "did you mean?", validation+fix, proactive hints
- **Format-idiomatic chaining** — scoped/chained selectors when direct selectors are ambiguous
- **Backward compatible** — floating widget, existing message types, and `ElementInfo` consumers unchanged

## Architecture

### Directory Structure

```
src/specialists/
  types.ts              -- SelectorSpecialist interface + shared types
  registry.ts           -- Auto-discovers and loads specialists
  helpers/
    escaping.ts         -- Shared escaping (moved from selector-core)
    aria.ts             -- ARIA role intelligence (shared)
    dynamic-detect.ts   -- Dynamic class/ID detection (shared)
    chaining.ts         -- Scoping ancestor resolution, sibling uniqueness, position qualifiers
    suggestions.ts      -- Tokenizer, typo correction, attribute search, format mismatch detection
  css.ts
  xpath.ts
  playwright.ts
  cypress.ts
  selenium.ts
```

### Core Interface

```typescript
export interface SelectorSpecialist {
  format: SelectorFormat;
  displayName: string;

  generate(element: RichElementData): GenerateResult;
  score(selector: string, element?: RichElementData): SpecialistScore;
  warn(selector: string, element: RichElementData): ActionableWarning[];
  chain(element: RichElementData, matchCount: number): ScoredSelector[];
  suggest(partial: string, pageElements: PageElement[]): Suggestion[];
  didYouMean(selector: string, pageElements: PageElement[]): Suggestion[];
  validateAndFix(selector: string): ValidationResult;
}
```

### Supporting Types

```typescript
export interface ActionableWarning {
  message: string;
  severity: 'info' | 'warning' | 'error';
  fix?: {
    label: string;
    selector: string;
  };
}

export interface SpecialistScore {
  score: number;
  factors: ScoreFactor[];
}

export interface ScoreFactor {
  name: string;
  impact: number;
  description: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  fix?: {
    label: string;
    selector: string;
  };
}

export interface Suggestion {
  selector: string;
  label: string;
  description: string;
  score: number;
  kind: 'autocomplete' | 'alternative' | 'fix' | 'scoped';
}

export interface ProactiveSuggestion {
  message: string;
  currentSelector: string;
  betterSelector: string;
  reason: string;
}

export interface GenerateResult {
  selectors: ScoredSelector[];
  proactive: ProactiveSuggestion[];  // Better alternatives the specialist wants to flag
}

export interface TokenContext {
  format: SelectorFormat;
  stage: 'method' | 'argument' | 'option-key' | 'option-value' | 'selector';
  prefix: string;
  methodName?: string;
  argIndex?: number;
}
```

### Registry

```typescript
// registry.ts
import { specialist as css } from './css';
import { specialist as xpath } from './xpath';
import { specialist as playwright } from './playwright';
import { specialist as cypress } from './cypress';
import { specialist as selenium } from './selenium';

const specialists = new Map<SelectorFormat, SelectorSpecialist>();
for (const s of [css, xpath, playwright, cypress, selenium]) {
  specialists.set(s.format, s);
}

export function getSpecialist(format: SelectorFormat): SelectorSpecialist;
export function getAllSpecialists(): SelectorSpecialist[];
export function getFormats(): SelectorFormat[];
```

Adding a new format: create the specialist file, export `specialist`, add one import line in `registry.ts`.

## Per-Specialist Intelligence

### CSS Specialist

**Generation priorities:** `[data-testid]` > `#id` > `[aria-label]` > `[role]` > `tag[name]` > `tag.class` > `tag`. Filters dynamic classes, skips space-containing IDs.

**Chaining:** Scope under nearest ancestor with unique identifier (`#sidebar [aria-label="Search"]`). Uses `parentChain`. Falls back to `:nth-of-type` as last resort.

**Scoring:** `data-testid` +45, static ID +40, `aria-label` +25, role+name +30, semantic tag +10, short +15. Penalties: dynamic class -30, deep nesting -20, `nth-child` -15, scoped chain +5 bonus.

**Warnings:** Dynamic classes with fix to `data-testid`/`role`. Auto-generated IDs with fix to `aria-label`/`name`. Too-broad selectors with fix from `chain()`.

### XPath Specialist

**Generation priorities:** `@data-testid` > `@id` > `@aria-label` > `@role` > `@name` > `normalize-space(text())` > tag.

**Chaining:** Ancestor scoping (`//nav[@id='main-nav']//a`). Sibling-based (`//label[text()='Email']/following-sibling::input`). Positional as last resort.

**Scoring:** `@data-testid` +45, static `@id` +40, `@aria-label` +25, `@role` +20, `normalize-space` +10. Penalties: `contains(text())` -5, positional `[n]` -20, deep nesting -15.

**Warnings:** Partial text match with fix to exact match. Positional fragility with fix to ancestor-scoped. Deep nesting with fix to skip intermediate nodes.

### Playwright Specialist

**Generation priorities:** `getByTestId` > `getByRole` with name+exact > `getByRole` with name > `getByLabel` > `getByPlaceholder` > `getByAltText` > `getByText` exact > `locator` CSS fallback. Infers roles for semantic HTML (`button`->`button`, `a`->`link`, `input`->`textbox`, etc.).

**Chaining:** `.filter({ hasText })`, `.locator()` scoping (`getByRole('navigation').getByRole('link', { name: 'Home' })`), heading levels (`getByRole('heading', { level: 2 })`). `.nth()` as last resort.

**Scoring:** `getByTestId` +45, `getByRole`+name+exact +42, `getByRole`+name +38, `getByLabel` +30, `getByPlaceholder` +25, `getByText` exact +15, `locator` CSS +10. Penalties: `.nth()` -15, chained `.filter()` +5 bonus.

**Warnings:** Ambiguous `getByText` with fix to `getByRole`. Nameless `getByRole` with fix to add name. CSS `locator` with fix to role-based. Missing `exact: true` with fix.

### Cypress Specialist

**Generation priorities:** `cy.get('[data-testid]')` > `cy.findByRole` (Testing Library) > `cy.findByLabelText` > `cy.findByPlaceholderText` > `cy.get('#id')` > `cy.get('[aria-label]')` > `cy.contains('tag', 'text')` > `cy.contains('text')` > `cy.get('tag')`.

**Chaining:** `.find()` scoping, `.within()` blocks, `.contains()` after `.get()`. `.eq(n)` as last resort. `.parent()`, `.siblings()`, `.closest()`.

**Scoring:** `data-testid` +45, `findByRole`+name +40, `findByLabelText` +30, static ID +35, `aria-label` +25, scoped `contains` +15, unscoped `contains` +5. Penalties: `.eq(n)` -15, dynamic class -30, `.find()` chain +5 bonus.

**Warnings:** Case-sensitive `contains` with fix to `findByRole` with regex. Class selector with fix to `data-testid`/`findByRole`. Missing Testing Library with info-level suggestion. Position-dependent with fix to scoped `contains`.

### Selenium Specialist

**Generation priorities:** `By.css('[data-testid]')` > `By.id` > `By.name` > `By.css('[aria-label]')` > `By.xpath('[@role]')` > `By.linkText` > `By.xpath(text)` > `By.cssSelector` > `By.tagName`.

**Chaining:** Nested `findElement` calls. CSS scoping. XPath ancestor scoping.

**Scoring:** `data-testid` +45, `By.id` +40, `By.name` +30, `By.linkText` +20, `aria-label` +25, xpath role +15, xpath text +10. Penalties: `By.className` -10, `By.tagName` -15, xpath positional -20, nested `findElement` +5 bonus.

**Warnings:** `By.className` single class limit with fix to `By.cssSelector`. XPath slower than CSS equivalent with fix. Auto-generated ID with fix. Too-broad `By.tagName` with fix to nested scoping.

## Suggestion Engine

### Type-Ahead Autocomplete

Triggers on keystroke in build tab freeform input.

Flow: `keystroke` -> `detectFormat(partial)` -> `getSpecialist(format)` -> `specialist.suggest(partial, pageElements)` -> dropdown.

Shared tokenizer (`helpers/suggestions.ts`) parses cursor context:
- Method completion: `page.getBy|` -> list `getByRole`, `getByTestId`, etc.
- Argument completion: `page.getByRole('|` -> role names found on page
- Option value: `{ name: '|` -> accessible names of matching elements
- CSS attribute: `[|` -> attribute names from page elements

Display: dropdown below input, max 8 items, keyboard navigation, each row shows selector + match count + element preview.

### Proactive Suggestions After Picking

Specialists emit `ProactiveSuggestion` items during `generate()` when a better strategy exists. Shown as subtle hint rows below selector cards: "Better option available" with click-to-replace.

### "Did You Mean?" (Zero-Match Recovery)

When selector matches 0 elements, `specialist.didYouMean()` tries recovery:

1. **Typo correction** — Levenshtein distance on attribute values against `pageElements`
2. **Stale selector repair** — fuzzy match on key attributes against current page state
3. **Format mismatch** — user typed CSS in Playwright input, suggest wrapped version
4. **Scope widening** — remove last qualifier, check if broader selector matches
5. **Attribute value search** — scan all elements for the value in any attribute

Shared helpers in `suggestions.ts`:
- `findTypoCorrections(value, candidates, maxDistance)` — Levenshtein-based
- `findAttributeElsewhere(value, pageElements)` — attribute-agnostic value search

### Validation + Fix

`specialist.validateAndFix(selector)` checks syntax per format:
- CSS: `querySelectorAll()` try/catch, parse error message
- XPath: `document.evaluate()` try/catch
- Playwright/Cypress/Selenium: regex-based API signature validation

Common fixes: unclosed bracket/quote insertion, unknown method correction, quote type swap, escaping suggestion.

## RichElementData Extraction

Content script's `handleClick` upgraded to extract full `RichElementData`:

```typescript
function extractRichElementData(target: HTMLElement): RichElementData {
  // tagName, text, attributes — same as today

  // parentChain — walk up to 6 ancestors
  const parentChain = [];
  let current = target.parentElement;
  for (let i = 0; i < 6 && current && current !== document.body; i++) {
    parentChain.push({
      tag: current.tagName.toLowerCase(),
      id: current.id || '',
      classes: Array.from(current.classList).slice(0, 5),
    });
    current = current.parentElement;
  }

  // siblingTags — tags of siblings sharing same parent
  const siblingTags = Array.from(target.parentElement?.children || [])
    .filter(el => el !== target)
    .map(el => el.tagName.toLowerCase());

  // accessibleName — simplified W3C computation
  // Priority: aria-label > aria-labelledby > label[for] > alt > title > text content
  const accessibleName = computeAccessibleName(target);

  return { tagName, text, attributes, parentChain, siblingTags, accessibleName };
}
```

## Data Flow

### Picking Flow

```
User clicks "Pick"
  -> content script captures element
  -> extracts RichElementData
  -> sends ELEMENT_SELECTED message (payload: RichElementData)
  -> pick-tab receives element
  -> for each format: getSpecialist(format).generate(element)
  -> test top selector per format on page to get matchCount
  -> if matchCount > 1: specialist.chain(element, matchCount) for additional scoped options
  -> merge, deduplicate, group by format
  -> display with proactive suggestions (from generate) and actionable warnings
```

### Build Tab Freeform Flow

```
User types in freeform input
  -> detectFormat(partial) -> get active specialist
  -> specialist.suggest(partial, pageElements) -> show autocomplete dropdown
  -> on commit:
      -> specialist.score(selector, element)
      -> specialist.warn(selector, element) -> show actionable warnings
      -> testSelector on page -> show match count
      -> if 0 matches: specialist.didYouMean(selector, pageElements) -> show recovery
  -> on syntax error:
      -> specialist.validateAndFix(selector) -> show inline error with fix button
```

### Migration Path

`selector-engine.ts` becomes a thin facade delegating to the specialist registry:

```typescript
export function generateScoredSelectors(element: RichElementData): {
  selectors: ScoredSelector[];
  proactive: ProactiveSuggestion[];
} {
  const allSelectors: ScoredSelector[] = [];
  const allProactive: ProactiveSuggestion[] = [];
  for (const specialist of getAllSpecialists()) {
    const result = specialist.generate(element);
    allSelectors.push(...result.selectors);
    allProactive.push(...result.proactive);
  }
  return {
    selectors: deduplicate(allSelectors).sort((a, b) => b.score - a.score),
    proactive: allProactive,
  };
}

export function scoreSelector(selector: string, format: SelectorFormat): SpecialistScore {
  return getSpecialist(format).score(selector);
}
```

`extractTestable` stays in `shared/selector-core.ts`. Floating widget continues using `generateLocators()` for its simple display.

### Backward Compatibility

- `ElementInfo` consumers degrade gracefully — `RichElementData` is a superset; missing fields mean no chaining/sibling analysis
- Floating widget unchanged — uses `generateLocators()` from `selector-core.ts`
- All existing message types unchanged — only `ELEMENT_SELECTED` payload grows
- `ScoredSelector` type unchanged — `warnings` field now populated with richer content

## UI Changes

### Selector Card Updates

**Actionable warning row:**
```
[!] Uses dynamic class `css-a3f2x` -- changes between builds  [Fix: [data-testid="submit"] ->]
```
Fix button replaces current selector and re-runs test.

**Proactive suggestion row** (subtle, below warnings):
```
[i] Better: page.getByRole('button', { name: 'Submit' }) -- role-based is more resilient  [Use this ->]
```
Only shown when specialist flags a better alternative. Dismissible.

### Build Tab Autocomplete

Dropdown below freeform input. Max 8 suggestions. Each row: selector text (monospace), match count badge, element preview. Keyboard navigation (up/down/Enter/Esc). Tab to accept.

**Zero-match recovery** below input:
```
No matches found.
  Did you mean:
  - [data-test="submit-btn"]  -- 1 match (attribute name differs)
  - [data-testid="submit-button"]  -- 1 match (typo: "btn" -> "button")
```

**Validation error inline:** Red underline on error position, fix button auto-corrects.

### Score Factor Breakdown

On hover/click of score badge, show breakdown:
```
Score: 82
  +45  data-testid attribute (stable)
  +15  Short selector
  +10  Semantic tag <button>
  -3   No accessible name
```

### Pick Results Grouped by Format

```
> Playwright (best: 92)
  page.getByTestId('submit-btn')                    92
  page.getByRole('button', { name: 'Submit' })      88

> CSS (best: 85)
  [data-testid="submit-btn"]                         85
  #submit-btn                                        75

> Cypress (best: 88)
  cy.get('[data-testid="submit-btn"]')               88
  cy.findByRole('button', { name: 'Submit' })        82

v XPath (best: 80) -- collapsed
v Selenium (best: 78) -- collapsed
```

User's preferred format (from settings) expanded first, others collapsed. "Show all" expands everything.

## Shared Helpers

### `helpers/escaping.ts`
Moved from `selector-core.ts`: `cssEscape`, `escapeCssAttrValue`, `escapeXPathValue`, `escapeSingleQuoteJs`, `escapeDoubleQuoteJs`.

### `helpers/aria.ts`
Moved from `selector-core.ts`: `IMPLICIT_ROLES`, `ROLE_TO_TAGS`, `getRoleCandidates`, `filterByName`. Plus `computeAccessibleName(element)`.

### `helpers/dynamic-detect.ts`
Moved from `selector-core.ts`/`selector-engine.ts`: `isDynamicClass`, `isDynamicId`, `DYNAMIC_CLASS_PATTERNS`.

### `helpers/chaining.ts`
New: `findScopingAncestor(parentChain)`, `isUniqueAmongSiblings(element)`, `getPositionQualifier(element)`.

### `helpers/suggestions.ts`
New: `tokenize(partial, format)`, `findTypoCorrections(value, candidates, maxDistance)`, `findAttributeElsewhere(value, pageElements)`.

## Adding a New Format

To add e.g. TestCafe:

1. Create `src/specialists/testcafe.ts`
2. Export `specialist: SelectorSpecialist` implementing all 7 methods
3. Add one import line in `registry.ts`
4. Add `'testcafe'` to `SelectorFormat` union in `types.ts`

No other files need changing.
