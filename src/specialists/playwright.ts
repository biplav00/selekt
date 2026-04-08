import type { PageElement, RichElementData, ScoredSelector } from '@/types';
import type {
  ActionableWarning,
  GenerateResult,
  ProactiveSuggestion,
  SpecialistScore,
  Suggestion,
  ValidationResult,
} from './types';
import type { SelectorSpecialist } from './types';

import { computeAccessibleName, getInferredRole } from './helpers/aria';
import { findScopingAncestor } from './helpers/chaining';
import { escapeSingleQuoteJs } from './helpers/escaping';
import { cssEscape } from './helpers/escaping';

// ---------------------------------------------------------------------------
// Valid Playwright locator methods
// ---------------------------------------------------------------------------

const PLAYWRIGHT_METHODS = [
  'getByRole',
  'getByTestId',
  'getByText',
  'getByLabel',
  'getByPlaceholder',
  'getByAltText',
  'getByTitle',
  'locator',
] as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildScoredSelector(selector: string, scoreValue: number): ScoredSelector {
  return { selector, format: 'playwright', score: scoreValue, warnings: [] };
}

// ---------------------------------------------------------------------------
// generate
// ---------------------------------------------------------------------------

function generate(element: RichElementData): GenerateResult {
  const { tagName, attributes, text, accessibleName } = element;
  const tag = tagName.toLowerCase();
  const selectors: ScoredSelector[] = [];
  const proactive: ProactiveSuggestion[] = [];

  const add = (sel: string) => {
    const s = scoreSelector(sel);
    selectors.push(buildScoredSelector(sel, s.score));
  };

  // 1. data-testid (highest priority)
  const testid = attributes['data-testid'];
  if (testid) {
    add(`page.getByTestId('${escapeSingleQuoteJs(testid)}')`);
  }

  // 2. data-test
  const dataTest = attributes['data-test'];
  if (dataTest) {
    add(`page.locator('[data-test="${escapeSingleQuoteJs(dataTest)}"]')`);
  }

  // 3. Explicit role + accessible name
  const explicitRole = attributes.role;
  const accessName = accessibleName || computeAccessibleName(attributes, text);

  if (explicitRole && accessName) {
    add(
      `page.getByRole('${escapeSingleQuoteJs(explicitRole)}', { name: '${escapeSingleQuoteJs(accessName)}' })`
    );
  } else if (explicitRole) {
    add(`page.getByRole('${escapeSingleQuoteJs(explicitRole)}')`);
  }

  // 4. Inferred role + accessible name (only if no explicit role)
  if (!explicitRole) {
    const inferredRole = getInferredRole(tag, attributes);
    if (inferredRole) {
      if (accessName) {
        add(
          `page.getByRole('${escapeSingleQuoteJs(inferredRole)}', { name: '${escapeSingleQuoteJs(accessName)}' })`
        );
      } else {
        add(`page.getByRole('${escapeSingleQuoteJs(inferredRole)}')`);
      }
    }
  }

  // 5. getByLabel (aria-label)
  const ariaLabel = attributes['aria-label'];
  if (ariaLabel) {
    add(`page.getByLabel('${escapeSingleQuoteJs(ariaLabel)}')`);
  }

  // 6. getByPlaceholder
  const placeholder = attributes.placeholder;
  if (placeholder) {
    add(`page.getByPlaceholder('${escapeSingleQuoteJs(placeholder)}')`);
  }

  // 7. getByAltText
  const alt = attributes.alt;
  if (alt) {
    add(`page.getByAltText('${escapeSingleQuoteJs(alt)}')`);
  }

  // 8. getByText (text content ≤ 50 chars)
  const trimmedText = text?.trim();
  if (trimmedText && trimmedText.length <= 50 && trimmedText.length > 0) {
    add(`page.getByText('${escapeSingleQuoteJs(trimmedText)}', { exact: true })`);
  }

  // 9. CSS ID fallback via locator
  const id = attributes.id;
  if (id && !id.includes(' ')) {
    add(`page.locator('#${cssEscape(id)}')`);
  }

  return { selectors, proactive };
}

// ---------------------------------------------------------------------------
// score
// ---------------------------------------------------------------------------

function scoreSelector(selector: string): SpecialistScore {
  const factors: SpecialistScore['factors'] = [];
  let score = 50;

  if (/getByTestId\(/.test(selector)) {
    factors.push({
      name: 'getByTestId',
      impact: 45,
      description: 'Uses getByTestId — most stable Playwright locator.',
    });
    score += 45;
  }

  if (/getByRole\(/.test(selector)) {
    const hasName = /name\s*:/.test(selector);
    const hasExact = /exact\s*:/.test(selector);
    if (hasName && hasExact) {
      factors.push({
        name: 'getByRoleNameExact',
        impact: 42,
        description: 'getByRole with name (exact) — highly reliable.',
      });
      score += 42;
    } else if (hasName) {
      factors.push({
        name: 'getByRoleName',
        impact: 38,
        description: 'getByRole with accessible name — semantic and stable.',
      });
      score += 38;
    } else {
      factors.push({
        name: 'getByRole',
        impact: 20,
        description: 'getByRole without name — may match multiple elements.',
      });
      score += 20;
    }
  }

  if (/getByLabel\(/.test(selector)) {
    factors.push({
      name: 'getByLabel',
      impact: 30,
      description: 'Uses getByLabel — tied to accessible label.',
    });
    score += 30;
  }

  if (/getByPlaceholder\(/.test(selector)) {
    factors.push({
      name: 'getByPlaceholder',
      impact: 25,
      description: 'Uses getByPlaceholder — reasonable for inputs.',
    });
    score += 25;
  }

  if (/getByText\(/.test(selector)) {
    const hasExact = /exact\s*:\s*true/.test(selector);
    if (hasExact) {
      factors.push({
        name: 'getByTextExact',
        impact: 15,
        description: 'getByText with exact match.',
      });
      score += 15;
    } else {
      factors.push({
        name: 'getByText',
        impact: 5,
        description: 'getByText — may match too broadly.',
      });
      score += 5;
    }
  }

  if (/locator\(/.test(selector) && !/getBy/.test(selector)) {
    factors.push({
      name: 'locatorCss',
      impact: 10,
      description: 'Uses locator() with CSS — less semantic.',
    });
    score += 10;
  }

  if (/\.nth\(/.test(selector)) {
    factors.push({
      name: 'usesNth',
      impact: -15,
      description: '.nth() positioning is fragile if sibling order changes.',
    });
    score -= 15;
  }

  if (/\.filter\(/.test(selector)) {
    factors.push({
      name: 'usesFilter',
      impact: 5,
      description: '.filter() chaining narrows the match.',
    });
    score += 5;
  }

  return { score: Math.max(0, Math.min(100, score)), factors };
}

// ---------------------------------------------------------------------------
// warn
// ---------------------------------------------------------------------------

function warn(selector: string, element: RichElementData): ActionableWarning[] {
  const warnings: ActionableWarning[] = [];
  const { attributes, accessibleName, text } = element;

  // locator() with a CSS class selector
  if (/locator\(\s*['"][^'"]*\.[a-zA-Z]/.test(selector)) {
    const role = attributes.role || getInferredRole(element.tagName.toLowerCase(), attributes);
    const name = accessibleName || computeAccessibleName(attributes, text);
    let fix: ActionableWarning['fix'] | undefined;

    if (role && name) {
      fix = {
        label: `Use getByRole instead`,
        selector: `page.getByRole('${escapeSingleQuoteJs(role)}', { name: '${escapeSingleQuoteJs(name)}' })`,
      };
    } else if (role) {
      fix = {
        label: `Use getByRole instead`,
        selector: `page.getByRole('${escapeSingleQuoteJs(role)}')`,
      };
    }

    warnings.push({
      message:
        'Using CSS class selector in locator() — class names may change between builds. Prefer semantic locators.',
      severity: 'warning',
      fix,
    });
  }

  // getByRole without name option
  if (/getByRole\(/.test(selector) && !/name\s*:/.test(selector)) {
    const name = accessibleName || computeAccessibleName(attributes, text);
    let fix: ActionableWarning['fix'] | undefined;

    if (name) {
      // Extract the role from the selector
      const roleMatch = selector.match(/getByRole\(\s*'([^']+)'/);
      const role = roleMatch ? roleMatch[1] : '';
      if (role) {
        fix = {
          label: 'Add accessible name',
          selector: `page.getByRole('${escapeSingleQuoteJs(role)}', { name: '${escapeSingleQuoteJs(name)}' })`,
        };
      }
    }

    warnings.push({
      message:
        'getByRole without a name option may match multiple elements. Add { name: "..." } to be more specific.',
      severity: 'warning',
      fix,
    });
  }

  // getByText without exact
  if (/getByText\(/.test(selector) && !/exact\s*:\s*true/.test(selector)) {
    const textMatch = selector.match(/getByText\(\s*'([^']+)'/);
    const textVal = textMatch ? textMatch[1] : '';
    let fix: ActionableWarning['fix'] | undefined;

    if (textVal) {
      fix = {
        label: 'Use exact match',
        selector: selector.replace(
          /getByText\(\s*'([^']+)'\s*\)/,
          `getByText('$1', { exact: true })`
        ),
      };
    }

    warnings.push({
      message: 'getByText without { exact: true } may match partial text and be too broad.',
      severity: 'info',
      fix,
    });
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

function chain(element: RichElementData, _matchCount: number): ScoredSelector[] {
  const { tagName, attributes, text, accessibleName, parentChain } = element;
  const tag = tagName.toLowerCase();

  const ancestor = findScopingAncestor(parentChain);
  if (!ancestor) return [];

  const results: ScoredSelector[] = [];
  const accessName = accessibleName || computeAccessibleName(attributes, text);
  const role = getInferredRole(tag, attributes);

  let elementPart: string;

  if (attributes['data-testid']) {
    elementPart = `getByTestId('${escapeSingleQuoteJs(attributes['data-testid'])}')`;
  } else if (role && accessName) {
    elementPart = `getByRole('${escapeSingleQuoteJs(role)}', { name: '${escapeSingleQuoteJs(accessName)}' })`;
  } else if (attributes['aria-label']) {
    elementPart = `getByLabel('${escapeSingleQuoteJs(attributes['aria-label'])}')`;
  } else if (attributes.placeholder) {
    elementPart = `getByPlaceholder('${escapeSingleQuoteJs(attributes.placeholder)}')`;
  } else if (role) {
    elementPart = `getByRole('${escapeSingleQuoteJs(role)}')`;
  } else {
    elementPart = `locator('${cssEscape(tag)}')`;
  }

  const sel = `page.locator('${ancestor.selector}').${elementPart}`;
  const s = scoreSelector(sel);
  results.push(buildScoredSelector(sel, Math.min(100, s.score + 5)));

  return results;
}

// ---------------------------------------------------------------------------
// suggest
// ---------------------------------------------------------------------------

function suggest(partial: string, pageElements: PageElement[]): Suggestion[] {
  if (!partial) return [];

  const results: Suggestion[] = [];

  // Suggest method names after "page.getBy"
  if (/^page\.getBy$/i.test(partial) || /^page\.getBy[a-z]*$/i.test(partial)) {
    const prefix = partial.replace(/^page\./, '').toLowerCase();
    const methods = [
      'getByRole',
      'getByTestId',
      'getByText',
      'getByLabel',
      'getByPlaceholder',
      'getByAltText',
      'getByTitle',
    ];
    for (const method of methods) {
      if (method.toLowerCase().startsWith(prefix)) {
        results.push({
          selector: `page.${method}(`,
          label: `page.${method}(...)`,
          description: `Playwright ${method} locator`,
          score: method === 'getByTestId' ? 95 : method === 'getByRole' ? 85 : 70,
          kind: 'autocomplete',
        });
      }
    }
    return results;
  }

  // Suggest role names after "page.getByRole('"
  if (/page\.getByRole\(['"]$/.test(partial) || /page\.getByRole\(['"][a-z]*$/.test(partial)) {
    const rolePrefix = partial.match(/page\.getByRole\(['"]([a-z]*)$/)?.[1] ?? '';
    const roles = [
      'button',
      'link',
      'textbox',
      'combobox',
      'dialog',
      'navigation',
      'heading',
      'listitem',
      'list',
      'img',
      'checkbox',
      'radio',
      'tab',
      'tabpanel',
      'menu',
      'menuitem',
    ];
    for (const r of roles) {
      if (r.startsWith(rolePrefix)) {
        results.push({
          selector: `page.getByRole('${r}')`,
          label: `'${r}'`,
          description: `ARIA role: ${r}`,
          score: 75,
          kind: 'autocomplete',
        });
      }
    }
    return results;
  }

  // Suggest testIds from page elements
  if (/^page\.getByTestId\(['"]/.test(partial)) {
    const prefix = partial.match(/page\.getByTestId\(['"]([^'"]*)$/)?.[1] ?? '';
    for (const el of pageElements) {
      if (el.testId?.toLowerCase().startsWith(prefix.toLowerCase())) {
        const sel = `page.getByTestId('${escapeSingleQuoteJs(el.testId)}')`;
        results.push({
          selector: sel,
          label: sel,
          description: `data-testid on <${el.tag}>`,
          score: scoreSelector(sel).score,
          kind: 'autocomplete',
        });
      }
    }
  }

  return results.slice(0, 10);
}

// ---------------------------------------------------------------------------
// didYouMean
// ---------------------------------------------------------------------------

function didYouMean(selector: string, pageElements: PageElement[]): Suggestion[] {
  if (!selector || pageElements.length === 0) return [];

  const results: Suggestion[] = [];

  // Extract value from getByTestId
  const testIdMatch = selector.match(/getByTestId\(['"]([^'"]+)['"]\)/);
  if (testIdMatch) {
    const searchVal = testIdMatch[1].toLowerCase();
    for (const el of pageElements) {
      if (
        el.testId &&
        el.testId.toLowerCase() !== searchVal &&
        el.testId.toLowerCase().includes(searchVal.slice(0, 3))
      ) {
        const sel = `page.getByTestId('${escapeSingleQuoteJs(el.testId)}')`;
        results.push({
          selector: sel,
          label: sel,
          description: `Did you mean data-testid="${el.testId}"?`,
          score: scoreSelector(sel).score,
          kind: 'alternative',
        });
      }
    }
  }

  return results.slice(0, 5);
}

// ---------------------------------------------------------------------------
// validateAndFix
// ---------------------------------------------------------------------------

function validateAndFix(selector: string): ValidationResult {
  if (!selector || !selector.trim()) {
    return { valid: false, error: 'Selector is empty.' };
  }

  if (!selector.startsWith('page.')) {
    return { valid: false, error: 'Playwright selectors must start with "page.".' };
  }

  // Extract the method name
  const methodMatch = selector.match(/^page\.([a-zA-Z]+)\(/);
  if (!methodMatch) {
    return { valid: false, error: 'No valid method call found after "page.".' };
  }

  const method = methodMatch[1];
  if (!(PLAYWRIGHT_METHODS as readonly string[]).includes(method)) {
    return {
      valid: false,
      error: `Unknown Playwright method "${method}". Valid methods: ${PLAYWRIGHT_METHODS.join(', ')}.`,
    };
  }

  // Check balanced parentheses
  let parenDepth = 0;
  for (const char of selector) {
    if (char === '(') parenDepth++;
    else if (char === ')') parenDepth--;
    if (parenDepth < 0) return { valid: false, error: 'Unmatched closing parenthesis.' };
  }
  if (parenDepth !== 0) {
    return { valid: false, error: 'Unclosed parenthesis in selector.' };
  }

  // Check balanced quotes
  const singleQuotes = (selector.match(/(?<!\\)'/g) ?? []).length;
  const doubleQuotes = (selector.match(/(?<!\\)"/g) ?? []).length;
  if (singleQuotes % 2 !== 0) {
    return { valid: false, error: 'Unclosed single quote in selector.' };
  }
  if (doubleQuotes % 2 !== 0) {
    return { valid: false, error: 'Unclosed double quote in selector.' };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const specialist: SelectorSpecialist = {
  format: 'playwright',
  displayName: 'Playwright',
  generate,
  score: scoreSelector,
  warn,
  chain,
  suggest,
  didYouMean,
  validateAndFix,
};
