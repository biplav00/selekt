# Specialist Intelligence Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic selector scoring/generation engine with a pluggable specialist architecture where each format (CSS, XPath, Playwright, Cypress, Selenium) has its own intelligence module with independent scoring, chaining, suggestions, validation, and actionable warnings.

**Architecture:** Functional modules in `src/specialists/` each exporting a `SelectorSpecialist` object. Shared helpers in `src/specialists/helpers/` for escaping, ARIA, dynamic detection, chaining, and suggestions. A registry auto-discovers specialists. The existing `selector-engine.ts` becomes a thin facade. Content script upgraded to extract `RichElementData` with parentChain, siblingTags, and accessibleName.

**Tech Stack:** TypeScript, Lit Web Components, WXT (Chrome Extension Framework), Vitest (new — for testing specialists)

**Spec:** `docs/superpowers/specs/2026-04-08-specialist-intelligence-layer-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/specialists/types.ts` | `SelectorSpecialist` interface, `ActionableWarning`, `SpecialistScore`, `ScoreFactor`, `ValidationResult`, `Suggestion`, `ProactiveSuggestion`, `GenerateResult`, `TokenContext` |
| `src/specialists/registry.ts` | Import all specialists, expose `getSpecialist()`, `getAllSpecialists()`, `getFormats()` |
| `src/specialists/helpers/escaping.ts` | Escaping functions moved from `selector-core.ts` |
| `src/specialists/helpers/aria.ts` | ARIA role maps, `computeAccessibleName()`, moved from `selector-core.ts` |
| `src/specialists/helpers/dynamic-detect.ts` | `isDynamicClass()`, `isDynamicId()`, `SEMANTIC_TAGS` moved from `selector-engine.ts` |
| `src/specialists/helpers/chaining.ts` | `findScopingAncestor()`, `isUniqueAmongSiblings()`, `getPositionQualifier()` |
| `src/specialists/helpers/suggestions.ts` | `tokenize()`, `findTypoCorrections()`, `findAttributeElsewhere()` |
| `src/specialists/css.ts` | CSS specialist — generate, score, warn, chain, suggest, didYouMean, validateAndFix |
| `src/specialists/xpath.ts` | XPath specialist |
| `src/specialists/playwright.ts` | Playwright specialist |
| `src/specialists/cypress.ts` | Cypress specialist |
| `src/specialists/selenium.ts` | Selenium specialist |
| `vitest.config.ts` | Vitest configuration |
| `tests/specialists/helpers/escaping.test.ts` | Tests for escaping helpers |
| `tests/specialists/helpers/dynamic-detect.test.ts` | Tests for dynamic detection |
| `tests/specialists/helpers/chaining.test.ts` | Tests for chaining helpers |
| `tests/specialists/helpers/suggestions.test.ts` | Tests for suggestion helpers |
| `tests/specialists/css.test.ts` | CSS specialist tests |
| `tests/specialists/xpath.test.ts` | XPath specialist tests |
| `tests/specialists/playwright.test.ts` | Playwright specialist tests |
| `tests/specialists/cypress.test.ts` | Cypress specialist tests |
| `tests/specialists/selenium.test.ts` | Selenium specialist tests |
| `tests/specialists/registry.test.ts` | Registry tests |

### Modified Files

| File | Changes |
|------|---------|
| `src/types.ts` | Add `accessibleName` already in `RichElementData` (done), update `ScoredSelector.warnings` to `ActionableWarning[]` |
| `src/shared/selector-core.ts` | Remove escaping, ARIA, dynamic-detect code (moved to helpers). Keep `generateLocators()`, `detectFormat()`, `extractTestable()`, highlight functions, `runSelectorTest()` — these are used by floating widget + content script |
| `src/entrypoints/sidepanel/services/selector-engine.ts` | Replace with thin facade delegating to specialist registry |
| `src/entrypoints/content.ts` | Upgrade `handleClick` to extract `RichElementData` with `parentChain`, `siblingTags`, `accessibleName` |
| `src/entrypoints/sidepanel/components/pick-tab.ts` | Use grouped-by-format display, show proactive suggestions and actionable warnings |
| `src/entrypoints/sidepanel/components/selector-card.ts` | Add actionable warning rows with fix buttons, score factor breakdown |
| `src/entrypoints/sidepanel/components/build-tab.ts` | Add autocomplete dropdown, "did you mean?" recovery, validation error display |
| `package.json` | Add `vitest` devDependency and `test` script |

---

### Task 1: Set up Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
```

- [ ] **Step 3: Add test script to package.json**

Add to `scripts` in `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create a smoke test to verify setup**

Create `tests/smoke.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';

describe('vitest setup', () => {
  it('works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run smoke test**

Run: `npm test`
Expected: 1 test passes.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/smoke.test.ts package.json package-lock.json
git commit -m "chore: set up Vitest test framework"
```

---

### Task 2: Specialist Types

**Files:**
- Create: `src/specialists/types.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Write the test**

Create `tests/specialists/types.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type {
  ActionableWarning,
  GenerateResult,
  ProactiveSuggestion,
  ScoreFactor,
  SelectorSpecialist,
  SpecialistScore,
  Suggestion,
  TokenContext,
  ValidationResult,
} from '@/specialists/types';

describe('specialist types', () => {
  it('ActionableWarning has correct shape', () => {
    const w: ActionableWarning = {
      message: 'Dynamic class',
      severity: 'warning',
      fix: { label: 'Use testid', selector: '[data-testid="x"]' },
    };
    expect(w.severity).toBe('warning');
    expect(w.fix?.selector).toBe('[data-testid="x"]');
  });

  it('GenerateResult has selectors and proactive', () => {
    const r: GenerateResult = {
      selectors: [{ selector: '#x', format: 'css', score: 90, warnings: [] }],
      proactive: [{ message: 'Better', currentSelector: '#x', betterSelector: '[data-testid]', reason: 'stable' }],
    };
    expect(r.selectors).toHaveLength(1);
    expect(r.proactive).toHaveLength(1);
  });

  it('SpecialistScore has factors array', () => {
    const s: SpecialistScore = {
      score: 85,
      factors: [{ name: 'hasTestId', impact: 45, description: 'Uses data-testid' }],
    };
    expect(s.factors[0].impact).toBe(45);
  });

  it('Suggestion has kind field', () => {
    const s: Suggestion = {
      selector: '#foo',
      label: 'ID selector',
      description: 'Matches element with id foo',
      score: 80,
      kind: 'autocomplete',
    };
    expect(s.kind).toBe('autocomplete');
  });

  it('ValidationResult can have fix', () => {
    const v: ValidationResult = {
      valid: false,
      error: 'Unclosed bracket',
      fix: { label: 'Add ]', selector: '[data-testid="x"]' },
    };
    expect(v.valid).toBe(false);
    expect(v.fix?.label).toBe('Add ]');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/specialists/types.test.ts`
Expected: FAIL — cannot find module `@/specialists/types`

- [ ] **Step 3: Create specialist types**

Create `src/specialists/types.ts`:

```typescript
import type { PageElement, RichElementData, ScoredSelector, SelectorFormat } from '@/types';

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
  proactive: ProactiveSuggestion[];
}

export interface TokenContext {
  format: SelectorFormat;
  stage: 'method' | 'argument' | 'option-key' | 'option-value' | 'selector';
  prefix: string;
  methodName?: string;
  argIndex?: number;
}

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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/specialists/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/specialists/types.ts tests/specialists/types.test.ts
git commit -m "feat: add specialist types and interfaces"
```

---

### Task 3: Shared Helpers — Escaping

Move escaping functions from `src/shared/selector-core.ts` to `src/specialists/helpers/escaping.ts`. Update imports.

**Files:**
- Create: `src/specialists/helpers/escaping.ts`
- Create: `tests/specialists/helpers/escaping.test.ts`
- Modify: `src/shared/selector-core.ts` — remove escaping functions, import from helpers

- [ ] **Step 1: Write the tests**

Create `tests/specialists/helpers/escaping.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  cssEscape,
  escapeCssAttrValue,
  escapeDoubleQuoteJs,
  escapeSingleQuoteJs,
  escapeXPathValue,
} from '@/specialists/helpers/escaping';

describe('cssEscape', () => {
  it('escapes special CSS characters', () => {
    expect(cssEscape('my:id')).toContain('\\:');
  });

  it('escapes leading digit', () => {
    expect(cssEscape('3foo')).toMatch(/\\3/);
  });

  it('handles plain strings', () => {
    expect(cssEscape('simple')).toBe('simple');
  });
});

describe('escapeCssAttrValue', () => {
  it('escapes double quotes', () => {
    expect(escapeCssAttrValue('say "hi"')).toBe('say \\"hi\\"');
  });

  it('escapes backslashes', () => {
    expect(escapeCssAttrValue('path\\to')).toBe('path\\\\to');
  });
});

describe('escapeXPathValue', () => {
  it('wraps in single quotes when no single quotes', () => {
    expect(escapeXPathValue('hello')).toBe("'hello'");
  });

  it('wraps in double quotes when contains single quotes', () => {
    expect(escapeXPathValue("it's")).toBe('"it\'s"');
  });

  it('uses concat when both quote types present', () => {
    const result = escapeXPathValue(`he said "it's"`);
    expect(result).toContain('concat(');
  });
});

describe('escapeSingleQuoteJs', () => {
  it('escapes single quotes', () => {
    expect(escapeSingleQuoteJs("it's")).toBe("it\\'s");
  });

  it('escapes backslashes first', () => {
    expect(escapeSingleQuoteJs("a\\b")).toBe('a\\\\b');
  });
});

describe('escapeDoubleQuoteJs', () => {
  it('escapes double quotes', () => {
    expect(escapeDoubleQuoteJs('say "hi"')).toBe('say \\"hi\\"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/specialists/helpers/escaping.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Create the escaping helper**

Create `src/specialists/helpers/escaping.ts`:

```typescript
export function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return value
    .replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1')
    .replace(/^([0-9])/, '\\3$1 ');
}

export function escapeCssAttrValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function escapeXPathValue(value: string): string {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  const parts = value.split("'").map((p) => `'${p}'`);
  return `concat(${parts.join(`, "'", `)})`;
}

export function escapeSingleQuoteJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function escapeDoubleQuoteJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/specialists/helpers/escaping.test.ts`
Expected: PASS

- [ ] **Step 5: Update selector-core.ts to re-export from helpers**

In `src/shared/selector-core.ts`, replace the escaping function definitions (lines 7-31) with:

```typescript
export {
  cssEscape,
  escapeCssAttrValue,
  escapeDoubleQuoteJs,
  escapeSingleQuoteJs,
  escapeXPathValue,
} from '@/specialists/helpers/escaping';

import {
  cssEscape,
  escapeCssAttrValue,
  escapeDoubleQuoteJs,
  escapeSingleQuoteJs,
  escapeXPathValue,
} from '@/specialists/helpers/escaping';
```

- [ ] **Step 6: Build to verify nothing broke**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/specialists/helpers/escaping.ts tests/specialists/helpers/escaping.test.ts src/shared/selector-core.ts
git commit -m "refactor: extract escaping helpers to specialists/helpers"
```

---

### Task 4: Shared Helpers — Dynamic Detection

Move `isDynamicClass`, `isDynamicId`, `SEMANTIC_TAGS`, `DYNAMIC_CLASS_PATTERNS` from `selector-core.ts` and `selector-engine.ts`.

**Files:**
- Create: `src/specialists/helpers/dynamic-detect.ts`
- Create: `tests/specialists/helpers/dynamic-detect.test.ts`
- Modify: `src/shared/selector-core.ts` — re-export `isDynamicClass` from helpers
- Modify: `src/entrypoints/sidepanel/services/selector-engine.ts` — import from helpers

- [ ] **Step 1: Write the tests**

Create `tests/specialists/helpers/dynamic-detect.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { SEMANTIC_TAGS, isDynamicClass, isDynamicId } from '@/specialists/helpers/dynamic-detect';

describe('isDynamicClass', () => {
  it('detects CSS-in-JS patterns', () => {
    expect(isDynamicClass('css-a3f2x')).toBe(true);
    expect(isDynamicClass('sc-bdnxRM')).toBe(true);
    expect(isDynamicClass('jsx-abc123')).toBe(true);
    expect(isDynamicClass('svelte-1abc2d')).toBe(true);
  });

  it('detects hash-like short tokens', () => {
    expect(isDynamicClass('abcde')).toBe(true);
    expect(isDynamicClass('a1b2c3')).toBe(true);
  });

  it('rejects normal class names', () => {
    expect(isDynamicClass('btn-primary')).toBe(false);
    expect(isDynamicClass('container')).toBe(false);
    expect(isDynamicClass('nav-link')).toBe(false);
  });
});

describe('isDynamicId', () => {
  it('detects UUID-like IDs', () => {
    expect(isDynamicId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
  });

  it('detects React useId patterns', () => {
    expect(isDynamicId(':r0:')).toBe(true);
    expect(isDynamicId(':r1a:')).toBe(true);
  });

  it('detects IDs with 4+ consecutive digits', () => {
    expect(isDynamicId('user-38291')).toBe(true);
  });

  it('rejects stable IDs', () => {
    expect(isDynamicId('main-nav')).toBe(false);
    expect(isDynamicId('sidebar')).toBe(false);
    expect(isDynamicId('form-123')).toBe(false);
  });
});

describe('SEMANTIC_TAGS', () => {
  it('includes common semantic tags', () => {
    expect(SEMANTIC_TAGS.has('button')).toBe(true);
    expect(SEMANTIC_TAGS.has('nav')).toBe(true);
    expect(SEMANTIC_TAGS.has('main')).toBe(true);
    expect(SEMANTIC_TAGS.has('h1')).toBe(true);
  });

  it('excludes non-semantic tags', () => {
    expect(SEMANTIC_TAGS.has('div')).toBe(false);
    expect(SEMANTIC_TAGS.has('span')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/specialists/helpers/dynamic-detect.test.ts`
Expected: FAIL

- [ ] **Step 3: Create the dynamic-detect helper**

Create `src/specialists/helpers/dynamic-detect.ts`:

```typescript
export const DYNAMIC_CLASS_PATTERNS: RegExp[] = [
  /^css-[a-z0-9]+$/i,
  /^sc-[a-zA-Z]+$/,
  /^_[a-z]+_[a-z0-9]+_/,
  /^[a-z0-9]{5,8}$/,
  /^jsx-[a-f0-9]+$/,
  /^svelte-[a-z0-9]+$/,
];

export function isDynamicClass(cls: string): boolean {
  return DYNAMIC_CLASS_PATTERNS.some((re) => re.test(cls));
}

export function isDynamicId(id: string): boolean {
  if (/^[a-f0-9-]{20,}$/i.test(id)) return true;
  if (/^:r[0-9a-z]+:$/.test(id)) return true;
  if (/\d{4,}/.test(id)) return true;
  return false;
}

export const SEMANTIC_TAGS = new Set([
  'button', 'a', 'input', 'select', 'textarea', 'form', 'nav', 'main',
  'header', 'footer', 'article', 'section', 'aside', 'dialog', 'table',
  'img', 'video', 'audio', 'label', 'fieldset', 'legend',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/specialists/helpers/dynamic-detect.test.ts`
Expected: PASS

- [ ] **Step 5: Update selector-core.ts and selector-engine.ts imports**

In `src/shared/selector-core.ts`, replace the `isDynamicClass` definition and `DYNAMIC_CLASS_PATTERNS` (lines 122-137) with:

```typescript
export { isDynamicClass } from '@/specialists/helpers/dynamic-detect';
import { isDynamicClass } from '@/specialists/helpers/dynamic-detect';
```

In `src/entrypoints/sidepanel/services/selector-engine.ts`, replace the `isDynamicId` function, `SEMANTIC_TAGS` set, and remove the `isDynamicClass` re-export from `@/shared/selector-core` (it will now come from helpers). Update imports at top:

```typescript
import { isDynamicClass, isDynamicId, SEMANTIC_TAGS } from '@/specialists/helpers/dynamic-detect';
```

Remove the `isDynamicClass` from the re-export block of `@/shared/selector-core`, and remove the local `isDynamicId` function definition and `SEMANTIC_TAGS` set.

- [ ] **Step 6: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/specialists/helpers/dynamic-detect.ts tests/specialists/helpers/dynamic-detect.test.ts src/shared/selector-core.ts src/entrypoints/sidepanel/services/selector-engine.ts
git commit -m "refactor: extract dynamic detection and semantic tags to specialists/helpers"
```

---

### Task 5: Shared Helpers — ARIA

Move ARIA intelligence from `selector-core.ts` to `src/specialists/helpers/aria.ts`. Add `computeAccessibleName()`.

**Files:**
- Create: `src/specialists/helpers/aria.ts`
- Create: `tests/specialists/helpers/aria.test.ts`
- Modify: `src/shared/selector-core.ts` — re-export from helpers

- [ ] **Step 1: Write the tests**

Create `tests/specialists/helpers/aria.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { IMPLICIT_ROLES, ROLE_TO_TAGS, getInferredRole } from '@/specialists/helpers/aria';

describe('IMPLICIT_ROLES', () => {
  it('maps button to button', () => {
    expect(IMPLICIT_ROLES.button).toBe('button');
  });

  it('maps a to link', () => {
    expect(IMPLICIT_ROLES.a).toBe('link');
  });

  it('maps h1-h6 to heading', () => {
    expect(IMPLICIT_ROLES.h1).toBe('heading');
    expect(IMPLICIT_ROLES.h6).toBe('heading');
  });
});

describe('ROLE_TO_TAGS', () => {
  it('maps button role to button and summary tags', () => {
    expect(ROLE_TO_TAGS.button).toContain('button');
    expect(ROLE_TO_TAGS.button).toContain('summary');
  });

  it('maps heading to h1-h6', () => {
    expect(ROLE_TO_TAGS.heading).toContain('h1');
    expect(ROLE_TO_TAGS.heading).toContain('h6');
  });
});

describe('getInferredRole', () => {
  it('returns explicit role from attributes', () => {
    expect(getInferredRole('div', { role: 'navigation' })).toBe('navigation');
  });

  it('returns implicit role from tag', () => {
    expect(getInferredRole('button', {})).toBe('button');
    expect(getInferredRole('a', {})).toBe('link');
    expect(getInferredRole('nav', {})).toBe('navigation');
  });

  it('returns undefined for non-semantic tags', () => {
    expect(getInferredRole('div', {})).toBeUndefined();
    expect(getInferredRole('span', {})).toBeUndefined();
  });

  it('prefers explicit role over implicit', () => {
    expect(getInferredRole('button', { role: 'tab' })).toBe('tab');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/specialists/helpers/aria.test.ts`
Expected: FAIL

- [ ] **Step 3: Create the ARIA helper**

Create `src/specialists/helpers/aria.ts`:

```typescript
export const IMPLICIT_ROLES: Record<string, string> = {
  button: 'button',
  a: 'link',
  input: 'textbox',
  select: 'combobox',
  textarea: 'textbox',
  img: 'img',
  nav: 'navigation',
  main: 'main',
  header: 'banner',
  footer: 'contentinfo',
  aside: 'complementary',
  form: 'form',
  table: 'table',
  dialog: 'dialog',
  article: 'article',
  section: 'region',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  ul: 'list',
  ol: 'list',
  li: 'listitem',
  details: 'group',
  summary: 'button',
  progress: 'progressbar',
  meter: 'meter',
  output: 'status',
};

export const ROLE_TO_TAGS: Record<string, string[]> = {};
for (const [tag, role] of Object.entries(IMPLICIT_ROLES)) {
  if (!ROLE_TO_TAGS[role]) ROLE_TO_TAGS[role] = [];
  ROLE_TO_TAGS[role].push(tag);
}

/** Get the ARIA role for a tag — explicit role takes precedence over implicit. */
export function getInferredRole(
  tag: string,
  attributes: Record<string, string>
): string | undefined {
  if (attributes.role) return attributes.role;
  return IMPLICIT_ROLES[tag.toLowerCase()];
}

/**
 * Compute accessible name from an element's attributes.
 * Simplified W3C accessible name computation — does not require live DOM.
 * Priority: aria-label > alt > title > placeholder > text content
 */
export function computeAccessibleName(
  attributes: Record<string, string>,
  text: string
): string {
  if (attributes['aria-label']) return attributes['aria-label'];
  if (attributes.alt) return attributes.alt;
  if (attributes.title) return attributes.title;
  if (attributes.placeholder) return attributes.placeholder;
  const trimmed = text?.trim();
  if (trimmed && trimmed.length <= 80) return trimmed;
  return '';
}

// --- DOM-dependent functions (only work in content script context) ---

export function getRoleCandidates(role: string): Element[] {
  const out: Element[] = [];
  out.push(...Array.from(document.querySelectorAll(`[role="${role}"]`)));
  for (const tag of ROLE_TO_TAGS[role] || []) {
    for (const el of document.querySelectorAll(tag)) {
      if (!el.hasAttribute('role')) out.push(el);
    }
  }
  return out;
}

export function filterByName(els: Element[], name: string): Element[] {
  const lower = name.toLowerCase();
  return els.filter((el) => {
    if (el.getAttribute('aria-label')?.toLowerCase().includes(lower)) return true;
    if ((el.textContent?.trim().toLowerCase() || '').includes(lower)) return true;
    if (el.getAttribute('title')?.toLowerCase().includes(lower)) return true;
    if (el.getAttribute('alt')?.toLowerCase().includes(lower)) return true;
    if ((el as HTMLInputElement).value?.toLowerCase().includes(lower)) return true;
    return false;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/specialists/helpers/aria.test.ts`
Expected: PASS

- [ ] **Step 5: Update selector-core.ts to import from helpers**

In `src/shared/selector-core.ts`, replace the `IMPLICIT_ROLES`, `ROLE_TO_TAGS`, `getRoleCandidates`, `filterByName` definitions with imports:

```typescript
export { filterByName, getRoleCandidates } from '@/specialists/helpers/aria';
import { ROLE_TO_TAGS, filterByName, getRoleCandidates } from '@/specialists/helpers/aria';
```

Remove the `IMPLICIT_ROLES`, `ROLE_TO_TAGS` const definitions and `getRoleCandidates`, `filterByName` function definitions from `selector-core.ts`.

- [ ] **Step 6: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/specialists/helpers/aria.ts tests/specialists/helpers/aria.test.ts src/shared/selector-core.ts
git commit -m "refactor: extract ARIA helpers to specialists/helpers"
```

---

### Task 6: Shared Helpers — Chaining

**Files:**
- Create: `src/specialists/helpers/chaining.ts`
- Create: `tests/specialists/helpers/chaining.test.ts`

- [ ] **Step 1: Write the tests**

Create `tests/specialists/helpers/chaining.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  findScopingAncestor,
  getPositionQualifier,
  isUniqueAmongSiblings,
} from '@/specialists/helpers/chaining';

describe('findScopingAncestor', () => {
  it('returns ancestor with id', () => {
    const chain = [
      { tag: 'div', id: '', classes: [] },
      { tag: 'nav', id: 'main-nav', classes: [] },
      { tag: 'div', id: '', classes: ['page'] },
    ];
    const result = findScopingAncestor(chain);
    expect(result).not.toBeNull();
    expect(result!.selector).toBe('#main-nav');
    expect(result!.depth).toBe(1);
  });

  it('returns ancestor with data-testid class hint', () => {
    const chain = [
      { tag: 'div', id: '', classes: ['sidebar'] },
    ];
    const result = findScopingAncestor(chain);
    expect(result).not.toBeNull();
    expect(result!.selector).toBe('div.sidebar');
  });

  it('returns null when no good ancestor', () => {
    const chain = [
      { tag: 'div', id: '', classes: [] },
      { tag: 'div', id: '', classes: [] },
    ];
    expect(findScopingAncestor(chain)).toBeNull();
  });
});

describe('isUniqueAmongSiblings', () => {
  it('returns true when tag is unique', () => {
    expect(isUniqueAmongSiblings('button', ['div', 'span', 'a'])).toBe(true);
  });

  it('returns false when same tag exists in siblings', () => {
    expect(isUniqueAmongSiblings('div', ['div', 'span', 'div'])).toBe(false);
  });

  it('returns true when no siblings', () => {
    expect(isUniqueAmongSiblings('div', [])).toBe(true);
  });
});

describe('getPositionQualifier', () => {
  it('returns index when tag is not unique', () => {
    const result = getPositionQualifier('li', ['li', 'li', 'li'], 1);
    expect(result).toEqual({ index: 2, total: 4 });
  });

  it('returns null when tag is unique', () => {
    expect(getPositionQualifier('button', ['div', 'span'], 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/specialists/helpers/chaining.test.ts`
Expected: FAIL

- [ ] **Step 3: Create the chaining helper**

Create `src/specialists/helpers/chaining.ts`:

```typescript
import { isDynamicClass } from './dynamic-detect';
import { cssEscape } from './escaping';

interface AncestorInfo {
  tag: string;
  id: string;
  classes: string[];
}

/**
 * Find the nearest ancestor with a unique identifier suitable for scoping.
 * Returns the CSS selector for the ancestor and its depth in the chain.
 */
export function findScopingAncestor(
  parentChain: AncestorInfo[]
): { depth: number; selector: string } | null {
  for (let i = 0; i < parentChain.length; i++) {
    const a = parentChain[i];

    // Best: ancestor has a static ID
    if (a.id && !a.id.includes(' ')) {
      return { depth: i, selector: `#${cssEscape(a.id)}` };
    }

    // Good: ancestor has non-dynamic classes
    const stableClasses = a.classes.filter((c) => c && !isDynamicClass(c));
    if (stableClasses.length > 0) {
      return {
        depth: i,
        selector: `${a.tag}.${stableClasses.slice(0, 2).map(cssEscape).join('.')}`,
      };
    }
  }

  return null;
}

/**
 * Check if an element's tag is unique among its siblings.
 */
export function isUniqueAmongSiblings(tag: string, siblingTags: string[]): boolean {
  return !siblingTags.some((s) => s === tag);
}

/**
 * Get a 1-based position index for the element among same-tag siblings.
 * Returns null if the element is unique by tag.
 */
export function getPositionQualifier(
  tag: string,
  siblingTags: string[],
  indexAmongSameTag: number
): { index: number; total: number } | null {
  const sameTagCount = siblingTags.filter((s) => s === tag).length;
  if (sameTagCount === 0) return null;
  return { index: indexAmongSameTag + 1, total: sameTagCount + 1 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/specialists/helpers/chaining.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/specialists/helpers/chaining.ts tests/specialists/helpers/chaining.test.ts
git commit -m "feat: add chaining helpers for scoped selector generation"
```

---

### Task 7: Shared Helpers — Suggestions

**Files:**
- Create: `src/specialists/helpers/suggestions.ts`
- Create: `tests/specialists/helpers/suggestions.test.ts`

- [ ] **Step 1: Write the tests**

Create `tests/specialists/helpers/suggestions.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  findAttributeElsewhere,
  findTypoCorrections,
  tokenize,
} from '@/specialists/helpers/suggestions';
import type { PageElement } from '@/types';

describe('tokenize', () => {
  it('detects method completion for Playwright', () => {
    const ctx = tokenize('page.getBy', 'playwright');
    expect(ctx.stage).toBe('method');
    expect(ctx.prefix).toBe('getBy');
  });

  it('detects argument completion for Playwright getByRole', () => {
    const ctx = tokenize("page.getByRole('", 'playwright');
    expect(ctx.stage).toBe('argument');
    expect(ctx.methodName).toBe('getByRole');
    expect(ctx.prefix).toBe('');
  });

  it('detects selector stage for CSS', () => {
    const ctx = tokenize('#my-', 'css');
    expect(ctx.stage).toBe('selector');
    expect(ctx.prefix).toBe('#my-');
  });

  it('detects method completion for Cypress', () => {
    const ctx = tokenize('cy.find', 'cypress');
    expect(ctx.stage).toBe('method');
    expect(ctx.prefix).toBe('find');
  });

  it('detects selector stage for XPath', () => {
    const ctx = tokenize('//div[@', 'xpath');
    expect(ctx.stage).toBe('selector');
  });
});

describe('findTypoCorrections', () => {
  it('finds close matches', () => {
    const results = findTypoCorrections('sumbit', ['submit', 'signup', 'reset'], 2);
    expect(results).toHaveLength(1);
    expect(results[0].candidate).toBe('submit');
    expect(results[0].distance).toBe(2);
  });

  it('returns empty when no close matches', () => {
    const results = findTypoCorrections('xyz', ['submit', 'signup'], 2);
    expect(results).toHaveLength(0);
  });

  it('returns exact matches at distance 0', () => {
    const results = findTypoCorrections('submit', ['submit', 'reset'], 2);
    expect(results[0].distance).toBe(0);
  });
});

describe('findAttributeElsewhere', () => {
  const elements: PageElement[] = [
    { tag: 'input', id: '', classes: [], testId: 'login-form', role: '', ariaLabel: '', name: 'email', placeholder: '', title: '', altText: '', text: '', matchCount: 1 },
    { tag: 'button', id: 'submit', classes: [], testId: '', role: 'button', ariaLabel: 'Submit', name: '', placeholder: '', title: '', altText: '', text: 'Submit', matchCount: 1 },
  ];

  it('finds value in a different attribute', () => {
    const results = findAttributeElsewhere('login-form', elements);
    expect(results).toHaveLength(1);
    expect(results[0].attribute).toBe('testId');
  });

  it('finds value across multiple elements', () => {
    const results = findAttributeElsewhere('Submit', elements);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty when value not found', () => {
    const results = findAttributeElsewhere('nonexistent', elements);
    expect(results).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/specialists/helpers/suggestions.test.ts`
Expected: FAIL

- [ ] **Step 3: Create the suggestions helper**

Create `src/specialists/helpers/suggestions.ts`:

```typescript
import type { PageElement, SelectorFormat } from '@/types';
import type { TokenContext } from '../types';

/**
 * Tokenize a partial selector input to determine the cursor context.
 * Used by specialists to generate relevant autocomplete suggestions.
 */
export function tokenize(partial: string, format: SelectorFormat): TokenContext {
  if (format === 'playwright') {
    // page.getBy| → method completion
    const methodMatch = partial.match(/^page\.(\w*)$/);
    if (methodMatch) {
      return { format, stage: 'method', prefix: methodMatch[1] };
    }
    // page.getByRole('| → argument completion
    const argMatch = partial.match(/^page\.(\w+)\((['"`])([^'"`]*)$/);
    if (argMatch) {
      return { format, stage: 'argument', prefix: argMatch[3], methodName: argMatch[1], argIndex: 0 };
    }
    // page.getByRole('button', { name: '| → option value
    const optMatch = partial.match(/^page\.(\w+)\([^)]*\{\s*(\w+):\s*(['"`])([^'"`]*)$/);
    if (optMatch) {
      return { format, stage: 'option-value', prefix: optMatch[4], methodName: optMatch[1] };
    }
  }

  if (format === 'cypress') {
    const methodMatch = partial.match(/^cy\.(\w*)$/);
    if (methodMatch) {
      return { format, stage: 'method', prefix: methodMatch[1] };
    }
    const argMatch = partial.match(/^cy\.(\w+)\((['"`])([^'"`]*)$/);
    if (argMatch) {
      return { format, stage: 'argument', prefix: argMatch[3], methodName: argMatch[1], argIndex: 0 };
    }
  }

  if (format === 'selenium') {
    const methodMatch = partial.match(/^driver\.findElement\(By\.(\w*)$/);
    if (methodMatch) {
      return { format, stage: 'method', prefix: methodMatch[1] };
    }
    const argMatch = partial.match(/^driver\.findElement\(By\.\w+\((['"`])([^'"`]*)$/);
    if (argMatch) {
      return { format, stage: 'argument', prefix: argMatch[2], argIndex: 0 };
    }
  }

  // Default: selector stage (CSS, XPath, or unrecognized)
  return { format, stage: 'selector', prefix: partial };
}

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

/**
 * Find candidates within a given Levenshtein distance of the input value.
 */
export function findTypoCorrections(
  value: string,
  candidates: string[],
  maxDistance: number
): Array<{ candidate: string; distance: number }> {
  const results: Array<{ candidate: string; distance: number }> = [];
  const lower = value.toLowerCase();

  for (const c of candidates) {
    const dist = levenshtein(lower, c.toLowerCase());
    if (dist <= maxDistance) {
      results.push({ candidate: c, distance: dist });
    }
  }

  return results.sort((a, b) => a.distance - b.distance);
}

/**
 * Search all page elements for a given value in any attribute.
 * Returns which element and attribute contain the value.
 */
export function findAttributeElsewhere(
  value: string,
  pageElements: PageElement[]
): Array<{ element: PageElement; attribute: string }> {
  const results: Array<{ element: PageElement; attribute: string }> = [];
  const lower = value.toLowerCase();

  for (const el of pageElements) {
    const checks: Array<[string, string]> = [
      ['testId', el.testId],
      ['id', el.id],
      ['role', el.role],
      ['ariaLabel', el.ariaLabel],
      ['name', el.name],
      ['placeholder', el.placeholder],
      ['title', el.title],
      ['altText', el.altText],
      ['text', el.text],
    ];

    for (const [attr, val] of checks) {
      if (val && val.toLowerCase().includes(lower)) {
        results.push({ element: el, attribute: attr });
        break; // One match per element
      }
    }
  }

  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/specialists/helpers/suggestions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/specialists/helpers/suggestions.ts tests/specialists/helpers/suggestions.test.ts
git commit -m "feat: add suggestion helpers — tokenizer, typo correction, attribute search"
```

---

### Task 8: CSS Specialist

**Files:**
- Create: `src/specialists/css.ts`
- Create: `tests/specialists/css.test.ts`

- [ ] **Step 1: Write the tests**

Create `tests/specialists/css.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { specialist } from '@/specialists/css';
import type { RichElementData } from '@/types';

function makeElement(overrides: Partial<RichElementData> = {}): RichElementData {
  return {
    tagName: 'button',
    text: 'Submit',
    attributes: {},
    parentChain: [],
    siblingTags: [],
    accessibleName: 'Submit',
    ...overrides,
  };
}

describe('CSS specialist', () => {
  it('has correct format and displayName', () => {
    expect(specialist.format).toBe('css');
    expect(specialist.displayName).toBe('CSS');
  });

  describe('generate', () => {
    it('prioritizes data-testid', () => {
      const el = makeElement({ attributes: { 'data-testid': 'submit-btn', id: 'btn1' } });
      const { selectors } = specialist.generate(el);
      expect(selectors[0].selector).toBe('[data-testid="submit-btn"]');
      expect(selectors[0].score).toBeGreaterThan(80);
    });

    it('generates ID selector when no testid', () => {
      const el = makeElement({ attributes: { id: 'my-btn' } });
      const { selectors } = specialist.generate(el);
      const idSel = selectors.find((s) => s.selector === '#my-btn');
      expect(idSel).toBeDefined();
    });

    it('filters dynamic classes', () => {
      const el = makeElement({ attributes: { class: 'css-abc123 btn-primary' } });
      const { selectors } = specialist.generate(el);
      const classSel = selectors.find((s) => s.selector.includes('.'));
      expect(classSel?.selector).toContain('btn-primary');
      expect(classSel?.selector).not.toContain('css-abc123');
    });

    it('generates fallback tag selector', () => {
      const el = makeElement({ tagName: 'span', attributes: {} });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector === 'span')).toBe(true);
    });

    it('includes proactive suggestion when testid available but lower-priority selector shown', () => {
      const el = makeElement({ attributes: { 'data-testid': 'x', class: 'btn' } });
      const { selectors, proactive } = specialist.generate(el);
      // proactive may suggest testid over class
      expect(selectors.length).toBeGreaterThan(1);
    });
  });

  describe('score', () => {
    it('scores data-testid selectors high', () => {
      const result = specialist.score('[data-testid="submit"]');
      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.factors.some((f) => f.name === 'hasTestId')).toBe(true);
    });

    it('penalizes dynamic class selectors', () => {
      const result = specialist.score('div.css-abc123');
      expect(result.score).toBeLessThan(50);
      expect(result.factors.some((f) => f.name === 'usesDynamicClass')).toBe(true);
    });
  });

  describe('warn', () => {
    it('warns about dynamic classes with fix', () => {
      const el = makeElement({ attributes: { 'data-testid': 'btn', class: 'css-abc' } });
      const warnings = specialist.warn('button.css-abc', el);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].severity).toBe('warning');
      expect(warnings[0].fix).toBeDefined();
      expect(warnings[0].fix?.selector).toContain('data-testid');
    });
  });

  describe('chain', () => {
    it('generates scoped selector using parentChain', () => {
      const el = makeElement({
        tagName: 'button',
        attributes: { class: 'btn' },
        parentChain: [{ tag: 'div', id: 'sidebar', classes: [] }],
      });
      const chained = specialist.chain(el, 3);
      expect(chained.length).toBeGreaterThan(0);
      expect(chained[0].selector).toContain('#sidebar');
    });

    it('returns empty when no good ancestor', () => {
      const el = makeElement({
        parentChain: [{ tag: 'div', id: '', classes: [] }],
      });
      const chained = specialist.chain(el, 3);
      expect(chained).toHaveLength(0);
    });
  });

  describe('validateAndFix', () => {
    it('reports valid for correct selectors', () => {
      expect(specialist.validateAndFix('#my-id').valid).toBe(true);
      expect(specialist.validateAndFix('[data-testid="x"]').valid).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/specialists/css.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement CSS specialist**

Create `src/specialists/css.ts`. The specialist implements all 7 methods of the `SelectorSpecialist` interface. Use the existing `generateCssSelectors` logic from `selector-engine.ts` as the base for `generate()`, but accept `RichElementData`, use format-specific scoring weights, produce `ActionableWarning[]` with fix suggestions, and support chaining via `findScopingAncestor`.

This file should be approximately 200-300 lines. Key implementation details:

- `generate()`: Same priority order as existing CSS generator but returns `GenerateResult` with proactive suggestions (e.g., when class selector is generated but testid is available)
- `score()`: CSS-specific weights from spec (testid +45, static ID +40, etc.)
- `warn()`: Check for dynamic classes, dynamic IDs, too-broad selectors. Each warning has a `fix` with the best alternative selector for the element
- `chain()`: Use `findScopingAncestor()` from chaining helpers to prefix with ancestor selector
- `suggest()`: Use tokenizer — for CSS, suggest IDs (`#`), classes (`.`), attributes (`[`) from pageElements
- `didYouMean()`: Use `findTypoCorrections` and `findAttributeElsewhere`
- `validateAndFix()`: Try parsing as CSS selector — catch common errors like unclosed brackets

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/specialists/css.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/specialists/css.ts tests/specialists/css.test.ts
git commit -m "feat: add CSS selector specialist"
```

---

### Task 9: XPath Specialist

**Files:**
- Create: `src/specialists/xpath.ts`
- Create: `tests/specialists/xpath.test.ts`

- [ ] **Step 1: Write the tests**

Create `tests/specialists/xpath.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { specialist } from '@/specialists/xpath';
import type { RichElementData } from '@/types';

function makeElement(overrides: Partial<RichElementData> = {}): RichElementData {
  return {
    tagName: 'button',
    text: 'Submit',
    attributes: {},
    parentChain: [],
    siblingTags: [],
    accessibleName: 'Submit',
    ...overrides,
  };
}

describe('XPath specialist', () => {
  it('has correct format', () => {
    expect(specialist.format).toBe('xpath');
    expect(specialist.displayName).toBe('XPath');
  });

  describe('generate', () => {
    it('prioritizes data-testid', () => {
      const el = makeElement({ attributes: { 'data-testid': 'submit-btn' } });
      const { selectors } = specialist.generate(el);
      expect(selectors[0].selector).toContain('@data-testid');
    });

    it('uses normalize-space for text matching', () => {
      const el = makeElement({ tagName: 'span', text: 'Hello' });
      const { selectors } = specialist.generate(el);
      const textSel = selectors.find((s) => s.selector.includes('normalize-space'));
      expect(textSel).toBeDefined();
    });
  });

  describe('score', () => {
    it('penalizes contains(text()) for partial matching', () => {
      const exact = specialist.score("//button[normalize-space(text())='Submit']");
      const partial = specialist.score("//button[contains(text(),'Sub')]");
      expect(exact.score).toBeGreaterThan(partial.score);
    });
  });

  describe('warn', () => {
    it('warns about contains() partial match with fix', () => {
      const el = makeElement({ text: 'Submit' });
      const warnings = specialist.warn("//button[contains(text(),'Sub')]", el);
      expect(warnings.some((w) => w.message.includes('partial'))).toBe(true);
      expect(warnings[0].fix).toBeDefined();
    });
  });

  describe('chain', () => {
    it('generates ancestor-scoped xpath', () => {
      const el = makeElement({
        tagName: 'a',
        attributes: { 'aria-label': 'Settings' },
        parentChain: [{ tag: 'nav', id: 'main-nav', classes: [] }],
      });
      const chained = specialist.chain(el, 3);
      expect(chained.length).toBeGreaterThan(0);
      expect(chained[0].selector).toContain("@id='main-nav'");
    });
  });

  describe('validateAndFix', () => {
    it('reports valid for correct xpath', () => {
      expect(specialist.validateAndFix('//div[@id="x"]').valid).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/specialists/xpath.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement XPath specialist**

Create `src/specialists/xpath.ts`. Follow the same pattern as the CSS specialist. Key differences:

- `generate()`: XPath priority order from spec. Uses `escapeXPathValue` for all values
- `score()`: XPath-specific weights (contains -5, positional -20, deep nesting counted by `/` depth)
- `warn()`: Warn about `contains(text())` with fix to `normalize-space(text())=`. Warn about positional `[n]`
- `chain()`: Ancestor scoping via `//ancestor//descendant` pattern. Sibling axes (`following-sibling`) when parent has a label

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/specialists/xpath.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/specialists/xpath.ts tests/specialists/xpath.test.ts
git commit -m "feat: add XPath selector specialist"
```

---

### Task 10: Playwright Specialist

**Files:**
- Create: `src/specialists/playwright.ts`
- Create: `tests/specialists/playwright.test.ts`

- [ ] **Step 1: Write the tests**

Create `tests/specialists/playwright.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { specialist } from '@/specialists/playwright';
import type { RichElementData } from '@/types';

function makeElement(overrides: Partial<RichElementData> = {}): RichElementData {
  return {
    tagName: 'button',
    text: 'Submit',
    attributes: {},
    parentChain: [],
    siblingTags: [],
    accessibleName: 'Submit',
    ...overrides,
  };
}

describe('Playwright specialist', () => {
  it('has correct format', () => {
    expect(specialist.format).toBe('playwright');
    expect(specialist.displayName).toBe('Playwright');
  });

  describe('generate', () => {
    it('prioritizes getByTestId', () => {
      const el = makeElement({ attributes: { 'data-testid': 'submit-btn' } });
      const { selectors } = specialist.generate(el);
      expect(selectors[0].selector).toContain("getByTestId('submit-btn')");
    });

    it('generates getByRole with name for buttons', () => {
      const el = makeElement({ tagName: 'button', text: 'Submit', attributes: {} });
      const { selectors } = specialist.generate(el);
      const roleSel = selectors.find((s) => s.selector.includes('getByRole'));
      expect(roleSel).toBeDefined();
      expect(roleSel?.selector).toContain("'button'");
      expect(roleSel?.selector).toContain("name: 'Submit'");
    });

    it('infers roles for semantic HTML', () => {
      const el = makeElement({ tagName: 'a', text: 'Home', attributes: {} });
      const { selectors } = specialist.generate(el);
      const roleSel = selectors.find((s) => s.selector.includes('getByRole'));
      expect(roleSel?.selector).toContain("'link'");
    });

    it('generates getByLabel for aria-label', () => {
      const el = makeElement({ attributes: { 'aria-label': 'Search' } });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes("getByLabel('Search')"))).toBe(true);
    });

    it('generates getByPlaceholder', () => {
      const el = makeElement({ tagName: 'input', attributes: { placeholder: 'Email' } });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes("getByPlaceholder('Email')"))).toBe(true);
    });

    it('suggests exact:true when text is common via proactive', () => {
      const el = makeElement({ text: 'Submit', attributes: {} });
      const { selectors } = specialist.generate(el);
      // Should have getByText variant
      expect(selectors.some((s) => s.selector.includes('getByText'))).toBe(true);
    });
  });

  describe('score', () => {
    it('scores getByTestId highest', () => {
      const s = specialist.score("page.getByTestId('submit-btn')");
      expect(s.score).toBeGreaterThanOrEqual(90);
    });

    it('scores getByRole+name high', () => {
      const s = specialist.score("page.getByRole('button', { name: 'Submit' })");
      expect(s.score).toBeGreaterThanOrEqual(80);
    });

    it('scores locator CSS lower', () => {
      const s = specialist.score("page.locator('.btn-primary')");
      expect(s.score).toBeLessThan(70);
    });
  });

  describe('warn', () => {
    it('warns when locator uses CSS class', () => {
      const el = makeElement({ tagName: 'button', attributes: { role: 'button' }, accessibleName: 'Submit' });
      const warnings = specialist.warn("page.locator('.btn')", el);
      expect(warnings.some((w) => w.message.includes('role-based') || w.message.includes('CSS'))).toBe(true);
      expect(warnings[0].fix).toBeDefined();
    });
  });

  describe('chain', () => {
    it('generates chained getByRole selectors', () => {
      const el = makeElement({
        tagName: 'a',
        attributes: { 'aria-label': 'Home' },
        parentChain: [{ tag: 'nav', id: '', classes: ['main-nav'] }],
      });
      const chained = specialist.chain(el, 3);
      expect(chained.length).toBeGreaterThan(0);
      // Should use .locator() or getByRole chaining
    });
  });

  describe('validateAndFix', () => {
    it('validates correct Playwright syntax', () => {
      expect(specialist.validateAndFix("page.getByRole('button')").valid).toBe(true);
    });

    it('catches invalid method names', () => {
      const result = specialist.validateAndFix("page.getByXyz('foo')");
      expect(result.valid).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/specialists/playwright.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Playwright specialist**

Create `src/specialists/playwright.ts`. Key features:

- `generate()`: Full Playwright priority order from spec. Infer roles for semantic HTML using `getInferredRole()` from aria helpers. Generate `getByRole` with `{ exact: true }` variant. Generate `getByText` with `{ exact: true }`
- `score()`: Playwright-specific weights (getByTestId +45, getByRole+name+exact +42, etc.)
- `warn()`: Warn about `getByText` without exact, `getByRole` without name, CSS `locator` when role-based available. Each with fix
- `chain()`: Use `.filter({ hasText })` and `.locator()` scoping. For headings, add `{ level }`. Use `.nth()` as last resort
- `suggest()`: Method completion after `page.getBy`, role name completion after `getByRole('`, accessible name completion for `{ name: '`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/specialists/playwright.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/specialists/playwright.ts tests/specialists/playwright.test.ts
git commit -m "feat: add Playwright selector specialist"
```

---

### Task 11: Cypress Specialist

**Files:**
- Create: `src/specialists/cypress.ts`
- Create: `tests/specialists/cypress.test.ts`

- [ ] **Step 1: Write the tests**

Create `tests/specialists/cypress.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { specialist } from '@/specialists/cypress';
import type { RichElementData } from '@/types';

function makeElement(overrides: Partial<RichElementData> = {}): RichElementData {
  return {
    tagName: 'button',
    text: 'Submit',
    attributes: {},
    parentChain: [],
    siblingTags: [],
    accessibleName: 'Submit',
    ...overrides,
  };
}

describe('Cypress specialist', () => {
  it('has correct format', () => {
    expect(specialist.format).toBe('cypress');
    expect(specialist.displayName).toBe('Cypress');
  });

  describe('generate', () => {
    it('prioritizes data-testid', () => {
      const el = makeElement({ attributes: { 'data-testid': 'submit-btn' } });
      const { selectors } = specialist.generate(el);
      expect(selectors[0].selector).toContain("cy.get('[data-testid=\"submit-btn\"]')");
    });

    it('generates findByRole for Testing Library', () => {
      const el = makeElement({ attributes: { role: 'button' }, accessibleName: 'Submit' });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes('findByRole'))).toBe(true);
    });

    it('generates cy.contains for text', () => {
      const el = makeElement({ text: 'Click me' });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes('contains'))).toBe(true);
    });
  });

  describe('score', () => {
    it('scores data-testid high', () => {
      const s = specialist.score("cy.get('[data-testid=\"x\"]')");
      expect(s.score).toBeGreaterThanOrEqual(85);
    });

    it('penalizes .eq()', () => {
      const s = specialist.score("cy.get('.item').eq(2)");
      expect(s.score).toBeLessThan(50);
    });
  });

  describe('warn', () => {
    it('warns about cy.contains case sensitivity', () => {
      const el = makeElement({ attributes: { role: 'button' }, accessibleName: 'Submit' });
      const warnings = specialist.warn("cy.contains('Submit')", el);
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe('chain', () => {
    it('generates .find() chain', () => {
      const el = makeElement({
        attributes: { class: 'nav-link' },
        parentChain: [{ tag: 'div', id: 'sidebar', classes: [] }],
      });
      const chained = specialist.chain(el, 3);
      expect(chained.length).toBeGreaterThan(0);
      expect(chained[0].selector).toContain('.find(');
    });
  });

  describe('validateAndFix', () => {
    it('validates correct Cypress syntax', () => {
      expect(specialist.validateAndFix("cy.get('#foo')").valid).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test, implement, run test, commit**

Follow same TDD pattern as Tasks 8-10. Implement `src/specialists/cypress.ts` with Testing Library support (`findByRole`, `findByLabelText`), `.find()` chaining, `.within()` blocks.

- [ ] **Step 3: Commit**

```bash
git add src/specialists/cypress.ts tests/specialists/cypress.test.ts
git commit -m "feat: add Cypress selector specialist"
```

---

### Task 12: Selenium Specialist

**Files:**
- Create: `src/specialists/selenium.ts`
- Create: `tests/specialists/selenium.test.ts`

- [ ] **Step 1: Write the tests**

Create `tests/specialists/selenium.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { specialist } from '@/specialists/selenium';
import type { RichElementData } from '@/types';

function makeElement(overrides: Partial<RichElementData> = {}): RichElementData {
  return {
    tagName: 'button',
    text: 'Submit',
    attributes: {},
    parentChain: [],
    siblingTags: [],
    accessibleName: 'Submit',
    ...overrides,
  };
}

describe('Selenium specialist', () => {
  it('has correct format', () => {
    expect(specialist.format).toBe('selenium');
    expect(specialist.displayName).toBe('Selenium');
  });

  describe('generate', () => {
    it('prioritizes data-testid via CSS', () => {
      const el = makeElement({ attributes: { 'data-testid': 'submit-btn' } });
      const { selectors } = specialist.generate(el);
      expect(selectors[0].selector).toContain("By.css('[data-testid=\"submit-btn\"]')");
    });

    it('generates By.id for static IDs', () => {
      const el = makeElement({ attributes: { id: 'submit' } });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes("By.id('submit')"))).toBe(true);
    });

    it('generates By.linkText for anchor text', () => {
      const el = makeElement({ tagName: 'a', text: 'Home' });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes("By.linkText('Home')"))).toBe(true);
    });
  });

  describe('score', () => {
    it('penalizes By.tagName', () => {
      const s = specialist.score("driver.findElement(By.tagName('div'))");
      expect(s.score).toBeLessThan(50);
    });
  });

  describe('chain', () => {
    it('generates nested findElement', () => {
      const el = makeElement({
        attributes: { name: 'email' },
        parentChain: [{ tag: 'form', id: 'login', classes: [] }],
      });
      const chained = specialist.chain(el, 3);
      expect(chained.length).toBeGreaterThan(0);
      expect(chained[0].selector).toContain('findElement');
      expect(chained[0].selector).toContain("By.id('login')");
    });
  });

  describe('validateAndFix', () => {
    it('validates correct Selenium syntax', () => {
      expect(specialist.validateAndFix("driver.findElement(By.id('x'))").valid).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Implement and test**

Follow same TDD pattern. Implement `src/specialists/selenium.ts` with nested `findElement` chaining, `By.linkText` for anchors, `By.xpath` vs `By.css` performance warnings.

- [ ] **Step 3: Commit**

```bash
git add src/specialists/selenium.ts tests/specialists/selenium.test.ts
git commit -m "feat: add Selenium selector specialist"
```

---

### Task 13: Registry

**Files:**
- Create: `src/specialists/registry.ts`
- Create: `tests/specialists/registry.test.ts`

- [ ] **Step 1: Write the tests**

Create `tests/specialists/registry.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { getAllSpecialists, getFormats, getSpecialist } from '@/specialists/registry';

describe('specialist registry', () => {
  it('getSpecialist returns specialist by format', () => {
    const css = getSpecialist('css');
    expect(css.format).toBe('css');
    expect(css.displayName).toBe('CSS');
  });

  it('getAllSpecialists returns all 5', () => {
    const all = getAllSpecialists();
    expect(all).toHaveLength(5);
    const formats = all.map((s) => s.format);
    expect(formats).toContain('css');
    expect(formats).toContain('xpath');
    expect(formats).toContain('playwright');
    expect(formats).toContain('cypress');
    expect(formats).toContain('selenium');
  });

  it('getFormats returns all format strings', () => {
    const formats = getFormats();
    expect(formats).toEqual(['css', 'xpath', 'playwright', 'cypress', 'selenium']);
  });

  it('throws for unknown format', () => {
    expect(() => getSpecialist('unknown' as any)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/specialists/registry.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement registry**

Create `src/specialists/registry.ts`:

```typescript
import type { SelectorFormat } from '@/types';
import type { SelectorSpecialist } from './types';
import { specialist as css } from './css';
import { specialist as xpath } from './xpath';
import { specialist as playwright } from './playwright';
import { specialist as cypress } from './cypress';
import { specialist as selenium } from './selenium';

const specialists = new Map<SelectorFormat, SelectorSpecialist>();
for (const s of [css, xpath, playwright, cypress, selenium]) {
  specialists.set(s.format, s);
}

export function getSpecialist(format: SelectorFormat): SelectorSpecialist {
  const s = specialists.get(format);
  if (!s) throw new Error(`Unknown specialist format: ${format}`);
  return s;
}

export function getAllSpecialists(): SelectorSpecialist[] {
  return Array.from(specialists.values());
}

export function getFormats(): SelectorFormat[] {
  return Array.from(specialists.keys());
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/specialists/registry.test.ts`
Expected: PASS

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/specialists/registry.ts tests/specialists/registry.test.ts
git commit -m "feat: add specialist registry with auto-discovery"
```

---

### Task 14: Migrate selector-engine.ts to Facade

Replace the monolithic `selector-engine.ts` with a thin facade delegating to the specialist registry.

**Files:**
- Modify: `src/entrypoints/sidepanel/services/selector-engine.ts`

- [ ] **Step 1: Rewrite selector-engine.ts as facade**

Replace the entire contents of `src/entrypoints/sidepanel/services/selector-engine.ts` with:

```typescript
import type { RichElementData, ScoredSelector, SelectorFormat } from '@/types';
import { getAllSpecialists, getSpecialist } from '@/specialists/registry';
import type { ActionableWarning, GenerateResult, ProactiveSuggestion, SpecialistScore } from '@/specialists/types';

// Re-export shared utilities for backward compatibility
export {
  cssEscape,
  escapeCssAttrValue,
  escapeDoubleQuoteJs,
  escapeSingleQuoteJs,
  escapeXPathValue,
} from '@/specialists/helpers/escaping';
export { isDynamicClass } from '@/specialists/helpers/dynamic-detect';
export { extractTestable } from '@/shared/selector-core';

/**
 * Generate scored selectors across all formats for a given element.
 * Delegates to per-format specialists.
 */
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

  // Deduplicate by format::selector
  const seen = new Set<string>();
  const deduped = allSelectors.filter((s) => {
    const key = `${s.format}::${s.selector}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    selectors: deduped.sort((a, b) => b.score - a.score),
    proactive: allProactive,
  };
}

/**
 * Score a single selector string using its format's specialist.
 */
export function scoreSelector(selector: string, format: SelectorFormat): SpecialistScore {
  return getSpecialist(format).score(selector);
}
```

- [ ] **Step 2: Update pick-tab.ts to handle new return type**

In `src/entrypoints/sidepanel/components/pick-tab.ts`, update the call to `generateScoredSelectors` to destructure `{ selectors, proactive }`. For now, ignore `proactive` — it will be wired up in the UI task.

Find: `const selectors = generateScoredSelectors(element);`
Replace: `const { selectors } = generateScoredSelectors(element);`

Also update the `ElementInfo` parameter to `RichElementData` where applicable, or ensure backward compatibility (the function should accept both since `RichElementData` extends `ElementInfo` fields).

- [ ] **Step 3: Build to verify nothing broke**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/entrypoints/sidepanel/services/selector-engine.ts src/entrypoints/sidepanel/components/pick-tab.ts
git commit -m "refactor: replace selector-engine with specialist facade"
```

---

### Task 15: Upgrade Content Script — RichElementData Extraction

**Files:**
- Modify: `src/entrypoints/content.ts`

- [ ] **Step 1: Add extractRichElementData function**

In `src/entrypoints/content.ts`, add the `extractRichElementData` function before the `handleClick` function:

```typescript
import { computeAccessibleName } from '@/specialists/helpers/aria';

function extractRichElementData(target: HTMLElement): RichElementData {
  const tagName = target.tagName.toLowerCase();
  const text = target.innerText?.substring(0, 100) || '';
  const attributes: Record<string, string> = {};
  for (const attr of target.attributes) {
    attributes[attr.name] = attr.value;
  }

  // Walk up to 6 ancestors
  const parentChain: Array<{ tag: string; id: string; classes: string[] }> = [];
  let current = target.parentElement;
  for (let i = 0; i < 6 && current && current !== document.body; i++) {
    parentChain.push({
      tag: current.tagName.toLowerCase(),
      id: current.id || '',
      classes: Array.from(current.classList).slice(0, 5),
    });
    current = current.parentElement;
  }

  // Sibling tags
  const siblingTags = Array.from(target.parentElement?.children || [])
    .filter((el) => el !== target)
    .map((el) => el.tagName.toLowerCase());

  // Accessible name
  const accessibleName = computeAccessibleName(attributes, text);

  return { tagName, text, attributes, parentChain, siblingTags, accessibleName };
}
```

- [ ] **Step 2: Update handleClick to use extractRichElementData**

Replace the inline element data extraction in `handleClick` with a call to `extractRichElementData(target)`. The `ELEMENT_SELECTED` message payload changes from `ElementInfo` to `RichElementData`.

Add `import type { RichElementData } from '@/types';` at top.

Replace the inline extraction block:
```typescript
const target = e.target as HTMLElement;
const elementData = extractRichElementData(target);

// Clear any existing test highlights
clearHighlights();
stopElementPicker();

if (isFloatingMode) {
  floatingWidget.setElementData(elementData);
}

chrome.runtime.sendMessage({
  type: 'ELEMENT_SELECTED',
  element: elementData,
});
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/entrypoints/content.ts
git commit -m "feat: upgrade content script to extract RichElementData"
```

---

### Task 16: UI — Selector Card Actionable Warnings and Score Breakdown

**Files:**
- Modify: `src/entrypoints/sidepanel/components/selector-card.ts`

- [ ] **Step 1: Update selector-card to render actionable warnings**

Modify the `selector-card.ts` component to:

1. Accept `warnings` as `ActionableWarning[]` (instead of `string[]`). For backward compat, check if warnings are strings or objects and handle both.
2. Render warning rows with severity icon and fix button
3. Add score factor breakdown on click/hover of score badge

The warning row template:
```typescript
${this.data.warnings.map((w) => {
  const warning = typeof w === 'string' ? { message: w, severity: 'warning' as const } : w;
  return html`
    <div class="warning-row ${warning.severity}">
      <span class="warning-icon">${warning.severity === 'error' ? '!' : warning.severity === 'info' ? 'i' : '!'}</span>
      <span class="warning-text">${warning.message}</span>
      ${warning.fix ? html`
        <button class="fix-btn" @click=${(e: Event) => {
          e.stopPropagation();
          this.dispatchEvent(new CustomEvent('apply-fix', {
            detail: { selector: warning.fix!.selector, format: this.data.format },
            bubbles: true, composed: true,
          }));
        }}>${warning.fix.label}</button>
      ` : nothing}
    </div>
  `;
})}
```

Add CSS for `.warning-row`, `.warning-icon`, `.fix-btn`.

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/entrypoints/sidepanel/components/selector-card.ts
git commit -m "feat: add actionable warnings and fix buttons to selector card"
```

---

### Task 17: UI — Pick Tab Grouped by Format

**Files:**
- Modify: `src/entrypoints/sidepanel/components/pick-tab.ts`

- [ ] **Step 1: Update pick-tab to group selectors by format**

Modify `pick-tab.ts` to:

1. Group selectors by format after generation
2. Show format sections with collapsible headers
3. User's preferred format expanded first, others collapsed
4. Show top 2-3 selectors per format, "Show all" expands
5. Display proactive suggestions below relevant selector cards

Add state:
```typescript
@state() private _expandedFormats: Set<string> = new Set();
@state() private _proactiveSuggestions: ProactiveSuggestion[] = [];
```

Group rendering:
```typescript
private _renderFormatGroup(format: string, selectors: ScoredSelector[]) {
  const expanded = this._expandedFormats.has(format);
  const best = selectors[0]?.score ?? 0;
  const shown = expanded ? selectors : selectors.slice(0, 3);

  return html`
    <div class="format-group">
      <button class="format-header" @click=${() => this._toggleFormat(format)}>
        <span class="format-arrow">${expanded ? '▼' : '▸'}</span>
        <span class="format-name">${FORMAT_LABELS[format]} (best: ${best})</span>
      </button>
      ${expanded || selectors.length <= 3 ? html`
        <div class="format-selectors">
          ${shown.map((s) => html`<selector-card .data=${s} ...></selector-card>`)}
        </div>
      ` : nothing}
    </div>
  `;
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/entrypoints/sidepanel/components/pick-tab.ts
git commit -m "feat: group pick results by format with collapsible sections"
```

---

### Task 18: UI — Build Tab Autocomplete

**Files:**
- Modify: `src/entrypoints/sidepanel/components/build-tab.ts`

- [ ] **Step 1: Add autocomplete dropdown to build tab freeform input**

Add to `build-tab.ts`:

1. State for suggestions: `@state() private _suggestions: Suggestion[] = [];`
2. State for selected index: `@state() private _suggestionIndex = -1;`
3. State for "did you mean": `@state() private _didYouMean: Suggestion[] = [];`
4. On input, call `specialist.suggest(partial, pageElements)` debounced
5. Render dropdown below input with max 8 items
6. Keyboard handling: ArrowUp/Down navigate, Enter/Tab accept, Esc dismiss
7. On zero matches, call `specialist.didYouMean()` and render recovery suggestions
8. On validation error from `specialist.validateAndFix()`, show inline error with fix button

The autocomplete dropdown template:
```typescript
${this._suggestions.length > 0 ? html`
  <div class="autocomplete-dropdown">
    ${this._suggestions.map((s, i) => html`
      <button
        class="suggestion-item ${i === this._suggestionIndex ? 'selected' : ''}"
        @click=${() => this._applySuggestion(s)}
      >
        <span class="suggestion-selector">${s.selector}</span>
        <span class="suggestion-desc">${s.description}</span>
      </button>
    `)}
  </div>
` : nothing}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/entrypoints/sidepanel/components/build-tab.ts
git commit -m "feat: add autocomplete, did-you-mean, and validation to build tab"
```

---

### Task 19: Final Integration and Cleanup

**Files:**
- Modify: `src/shared/selector-core.ts` — clean up any remaining duplicated code
- Run: full test suite and build

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint:fix`
Expected: No errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Remove smoke test**

Delete `tests/smoke.test.ts` — it was only for setup verification.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final integration cleanup for specialist architecture"
```

---

## Task Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Set up Vitest | None |
| 2 | Specialist types | 1 |
| 3 | Helpers — Escaping | 1 |
| 4 | Helpers — Dynamic Detection | 3 |
| 5 | Helpers — ARIA | 3 |
| 6 | Helpers — Chaining | 3, 4 |
| 7 | Helpers — Suggestions | 2 |
| 8 | CSS Specialist | 2, 3, 4, 5, 6 |
| 9 | XPath Specialist | 2, 3, 4, 5, 6 |
| 10 | Playwright Specialist | 2, 3, 4, 5, 6 |
| 11 | Cypress Specialist | 2, 3, 4, 5, 6 |
| 12 | Selenium Specialist | 2, 3, 4, 5, 6 |
| 13 | Registry | 8, 9, 10, 11, 12 |
| 14 | Migrate selector-engine facade | 13 |
| 15 | Content script RichElementData | 5 |
| 16 | UI — Selector card warnings | 14 |
| 17 | UI — Pick tab grouped format | 14, 16 |
| 18 | UI — Build tab autocomplete | 7, 13 |
| 19 | Final integration | All |

Tasks 3-7 can run in parallel (shared helpers). Tasks 8-12 can run in parallel (specialists). Tasks 15, 16, 17, 18 can partially overlap.
