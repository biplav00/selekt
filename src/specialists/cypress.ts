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
import { isDynamicClass } from './helpers/dynamic-detect';
import { escapeDoubleQuoteJs, escapeSingleQuoteJs } from './helpers/escaping';

// ---------------------------------------------------------------------------
// Valid Cypress methods
// ---------------------------------------------------------------------------

const CYPRESS_METHODS = [
  'get',
  'contains',
  'find',
  'findByRole',
  'findByLabelText',
  'findByPlaceholderText',
  'findByText',
  'findByTestId',
] as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildScoredSelector(selector: string, scoreValue: number): ScoredSelector {
  return { selector, format: 'cypress', score: scoreValue, warnings: [] };
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
    add(`cy.get('[data-testid="${escapeDoubleQuoteJs(testid)}"]')`);
  }

  // 2. data-test
  const dataTest = attributes['data-test'];
  if (dataTest) {
    add(`cy.get('[data-test="${escapeDoubleQuoteJs(dataTest)}"]')`);
  }

  // 3. findByRole (Testing Library) — explicit role first
  const accessName = accessibleName || computeAccessibleName(attributes, text);
  const explicitRole = attributes.role;

  if (explicitRole && accessName) {
    add(
      `cy.findByRole('${escapeSingleQuoteJs(explicitRole)}', { name: '${escapeSingleQuoteJs(accessName)}' })`
    );
  } else if (explicitRole) {
    add(`cy.findByRole('${escapeSingleQuoteJs(explicitRole)}')`);
  }

  // Inferred role (only if no explicit role)
  if (!explicitRole) {
    const inferredRole = getInferredRole(tag, attributes);
    if (inferredRole) {
      if (accessName) {
        add(
          `cy.findByRole('${escapeSingleQuoteJs(inferredRole)}', { name: '${escapeSingleQuoteJs(accessName)}' })`
        );
      } else {
        add(`cy.findByRole('${escapeSingleQuoteJs(inferredRole)}')`);
      }
    }
  }

  // 4. findByLabelText (aria-label)
  const ariaLabel = attributes['aria-label'];
  if (ariaLabel) {
    add(`cy.findByLabelText('${escapeSingleQuoteJs(ariaLabel)}')`);
  }

  // 5. findByPlaceholderText
  const placeholder = attributes.placeholder;
  if (placeholder) {
    add(`cy.findByPlaceholderText('${escapeSingleQuoteJs(placeholder)}')`);
  }

  // 6. cy.get('#id') — static ID
  const id = attributes.id;
  if (id && !id.includes(' ')) {
    add(`cy.get('#${id}')`);
  }

  // 7. cy.get('[aria-label="..."]')
  if (ariaLabel) {
    add(`cy.get('[aria-label="${escapeDoubleQuoteJs(ariaLabel)}"]')`);
  }

  // 8. cy.get('[role="..."]')
  if (explicitRole) {
    add(`cy.get('[role="${escapeDoubleQuoteJs(explicitRole)}"]')`);
  }

  // 9. cy.get('tag[name="..."]')
  const name = attributes.name;
  if (name) {
    add(`cy.get('${tag}[name="${escapeDoubleQuoteJs(name)}"]')`);
  }

  // 10. cy.contains('tag', 'text') — scoped contains for buttons/links
  const trimmedText = text?.trim();
  const scopedTags = new Set([
    'button',
    'a',
    'label',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'li',
    'td',
    'th',
    'span',
    'p',
  ]);
  if (trimmedText && trimmedText.length > 0 && trimmedText.length <= 80 && scopedTags.has(tag)) {
    add(`cy.contains('${tag}', '${escapeSingleQuoteJs(trimmedText)}')`);
  }

  // 11. cy.contains('text') — unscoped
  if (trimmedText && trimmedText.length > 0 && trimmedText.length <= 80) {
    add(`cy.contains('${escapeSingleQuoteJs(trimmedText)}')`);
  }

  // 12. cy.get('tag') — fallback
  add(`cy.get('${tag}')`);

  return { selectors, proactive };
}

// ---------------------------------------------------------------------------
// score
// ---------------------------------------------------------------------------

function scoreSelector(selector: string): SpecialistScore {
  const factors: SpecialistScore['factors'] = [];
  let score = 50;

  // data-testid / data-test
  if (/data-testid|data-test/.test(selector)) {
    factors.push({
      name: 'hasTestId',
      impact: 45,
      description: 'Uses a data-testid attribute — stable and intent-revealing.',
    });
    score += 45;
  }

  // findByRole with name
  if (/findByRole\(/.test(selector)) {
    if (/name\s*:/.test(selector)) {
      factors.push({
        name: 'findByRoleWithName',
        impact: 40,
        description: 'findByRole with accessible name — semantic and stable.',
      });
      score += 40;
    } else {
      factors.push({
        name: 'findByRole',
        impact: 20,
        description: 'findByRole without name — may match multiple elements.',
      });
      score += 20;
    }
  }

  // findByLabelText
  if (/findByLabelText\(/.test(selector)) {
    factors.push({
      name: 'findByLabelText',
      impact: 30,
      description: 'findByLabelText — tied to accessible label.',
    });
    score += 30;
  }

  // findByPlaceholderText
  if (/findByPlaceholderText\(/.test(selector)) {
    factors.push({
      name: 'findByPlaceholderText',
      impact: 20,
      description: 'findByPlaceholderText — reasonable for inputs.',
    });
    score += 20;
  }

  // Static ID (cy.get('#id'))
  if (/cy\.get\s*\(\s*'#/.test(selector) || /cy\.get\s*\(\s*"#/.test(selector)) {
    factors.push({
      name: 'hasStaticId',
      impact: 35,
      description: 'Uses a stable ID attribute.',
    });
    score += 35;
  }

  // aria-label CSS attribute
  if (/\[aria-label=/.test(selector) && !/findByLabelText/.test(selector)) {
    factors.push({
      name: 'hasAriaLabel',
      impact: 25,
      description: 'Uses aria-label for accessible identification.',
    });
    score += 25;
  }

  // Scoped cy.contains('tag', 'text')
  if (/cy\.contains\s*\(\s*['"][a-z]+['"]/.test(selector) && selector.includes(',')) {
    factors.push({
      name: 'scopedContains',
      impact: 15,
      description: 'Scoped cy.contains — narrows match to a specific tag.',
    });
    score += 15;
  } else if (/cy\.contains\(/.test(selector)) {
    // Unscoped cy.contains
    factors.push({
      name: 'unscopedContains',
      impact: 5,
      description: 'Unscoped cy.contains — may match too broadly.',
    });
    score += 5;
  }

  // .find() chain bonus
  if (/\.find\s*\(/.test(selector)) {
    factors.push({
      name: 'findChain',
      impact: 5,
      description: '.find() chain scopes the search to an ancestor.',
    });
    score += 5;
  }

  // .eq() position penalty
  if (/\.eq\s*\(/.test(selector)) {
    factors.push({
      name: 'usesEq',
      impact: -15,
      description: '.eq() positioning is fragile if element order changes.',
    });
    score -= 15;
  }

  // Dynamic classes penalty
  const classMatches = selector.match(/\.([a-zA-Z0-9_-]+)/g) ?? [];
  let hasDynClass = false;
  for (const cm of classMatches) {
    // Skip method calls like .get, .find, .eq, .contains
    const cls = cm.slice(1);
    if (
      /^(get|find|eq|contains|findByRole|findByLabelText|findByPlaceholderText|findByText|findByTestId)$/.test(
        cls
      )
    )
      continue;
    if (isDynamicClass(cls)) {
      hasDynClass = true;
      break;
    }
  }
  if (hasDynClass) {
    factors.push({
      name: 'usesDynamicClass',
      impact: -30,
      description: 'Uses dynamically generated class names that may change between builds.',
    });
    score -= 30;
  }

  return { score: Math.max(0, Math.min(100, score)), factors };
}

// ---------------------------------------------------------------------------
// warn
// ---------------------------------------------------------------------------

function warn(selector: string, element: RichElementData): ActionableWarning[] {
  const warnings: ActionableWarning[] = [];
  const { attributes, accessibleName, text, tagName } = element;
  const tag = tagName.toLowerCase();

  // cy.contains() — case-sensitive and partial match warning
  if (/cy\.contains\(/.test(selector) && !/cy\.contains\s*\(\s*['"][a-z]+['"]/.test(selector)) {
    const role = attributes.role || getInferredRole(tag, attributes);
    const accessName = accessibleName || computeAccessibleName(attributes, text);
    let fix: ActionableWarning['fix'] | undefined;

    if (role && accessName) {
      fix = {
        label: 'Use findByRole instead',
        selector: `cy.findByRole('${escapeSingleQuoteJs(role)}', { name: '${escapeSingleQuoteJs(accessName)}' })`,
      };
    } else if (role) {
      fix = {
        label: 'Use findByRole instead',
        selector: `cy.findByRole('${escapeSingleQuoteJs(role)}')`,
      };
    }

    warnings.push({
      message:
        'cy.contains() is case-sensitive and may match partial text. Consider using findByRole for more precise targeting.',
      severity: 'info',
      fix,
    });
  }

  // Class selector — may be dynamic/unstable
  const classMatches = selector.match(/cy\.get\s*\(\s*['"]([^'"]*)\s*['"]\s*\)/);
  if (classMatches) {
    const cssSelector = classMatches[1];
    // Check if it's a class-based selector (starts with . or contains only class selectors)
    if (/^\.[a-zA-Z]/.test(cssSelector) && !/\[/.test(cssSelector) && !/#/.test(cssSelector)) {
      let fix: ActionableWarning['fix'] | undefined;
      const testid = attributes['data-testid'] ?? attributes['data-test'];
      if (testid) {
        const attr = attributes['data-testid'] ? 'data-testid' : 'data-test';
        fix = {
          label: `Use ${attr} instead`,
          selector: `cy.get('[${attr}="${escapeDoubleQuoteJs(testid)}"]')`,
        };
      } else if (attributes.role && (accessibleName || computeAccessibleName(attributes, text))) {
        const accessName = accessibleName || computeAccessibleName(attributes, text);
        fix = {
          label: 'Use findByRole instead',
          selector: `cy.findByRole('${escapeSingleQuoteJs(attributes.role)}', { name: '${escapeSingleQuoteJs(accessName)}' })`,
        };
      }

      warnings.push({
        message:
          'Class-based selectors may change between builds and refactors. Prefer data-testid or semantic selectors.',
        severity: 'warning',
        fix,
      });
    }
  }

  // .eq() position-dependent warning
  if (/\.eq\s*\(/.test(selector)) {
    warnings.push({
      message:
        '.eq() relies on element position which is fragile if siblings are added, removed, or reordered.',
      severity: 'warning',
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

  // Build the descendant (find) portion
  let findPart: string;
  const testid = attributes['data-testid'] ?? attributes['data-test'];

  if (testid) {
    const attr = attributes['data-testid'] ? 'data-testid' : 'data-test';
    findPart = `[${attr}="${escapeDoubleQuoteJs(testid)}"]`;
  } else if (attributes['aria-label']) {
    findPart = `[aria-label="${escapeDoubleQuoteJs(attributes['aria-label'])}"]`;
  } else if (attributes.id && !attributes.id.includes(' ')) {
    findPart = `#${attributes.id}`;
  } else {
    const className = attributes.class;
    const stableClasses = className
      ? className.split(/\s+/).filter((c) => c && !isDynamicClass(c))
      : [];
    findPart = stableClasses.length > 0 ? `${tag}.${stableClasses.slice(0, 2).join('.')}` : tag;
  }

  const sel = `cy.get('${ancestor.selector}').find('${escapeSingleQuoteJs(findPart)}')`;
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

  // Suggest methods after "cy."
  if (/^cy\.$/.test(partial) || /^cy\.[a-zA-Z]*$/.test(partial)) {
    const methodPrefix = partial.replace(/^cy\./, '').toLowerCase();
    const methods = [
      { name: 'get', score: 75 },
      { name: 'contains', score: 65 },
      { name: 'findByRole', score: 85 },
      { name: 'findByLabelText', score: 80 },
      { name: 'findByPlaceholderText', score: 70 },
      { name: 'findByText', score: 60 },
      { name: 'findByTestId', score: 90 },
    ];
    for (const { name, score } of methods) {
      if (name.toLowerCase().startsWith(methodPrefix)) {
        results.push({
          selector: `cy.${name}(`,
          label: `cy.${name}(...)`,
          description: `Cypress ${name} command`,
          score,
          kind: 'autocomplete',
        });
      }
    }
    return results;
  }

  // Suggest testIds after cy.get('[data-testid="
  if (/cy\.get\s*\(\s*['"\[].*data-testid.*=["']/.test(partial)) {
    const prefix = partial.match(/data-testid[=]["']([^"']*)$/)?.[1] ?? '';
    for (const el of pageElements) {
      if (el.testId && el.testId.toLowerCase().startsWith(prefix.toLowerCase())) {
        const sel = `cy.get('[data-testid="${escapeDoubleQuoteJs(el.testId)}"]')`;
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

  // Suggest testIds after cy.findByTestId(
  if (/cy\.findByTestId\s*\(\s*['"]/.test(partial)) {
    const prefix = partial.match(/cy\.findByTestId\s*\(\s*['"]([^'"]*)$/)?.[1] ?? '';
    for (const el of pageElements) {
      if (el.testId && el.testId.toLowerCase().startsWith(prefix.toLowerCase())) {
        const sel = `cy.findByTestId('${escapeSingleQuoteJs(el.testId)}')`;
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

  // Extract value from cy.get('[data-testid="..."]') or cy.findByTestId('...')
  const testIdMatch =
    selector.match(/data-testid=["']([^"']+)["']/) ??
    selector.match(/findByTestId\s*\(\s*['"]([^'"]+)['"]\s*\)/);

  if (testIdMatch) {
    const searchVal = testIdMatch[1].toLowerCase();
    for (const el of pageElements) {
      if (
        el.testId &&
        el.testId.toLowerCase() !== searchVal &&
        el.testId.toLowerCase().includes(searchVal.slice(0, 3))
      ) {
        const sel = `cy.get('[data-testid="${escapeDoubleQuoteJs(el.testId)}"]')`;
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

  if (!selector.startsWith('cy.')) {
    return { valid: false, error: 'Cypress selectors must start with "cy.".' };
  }

  // Extract the method name
  const methodMatch = selector.match(/^cy\.([a-zA-Z]+)\(/);
  if (!methodMatch) {
    return { valid: false, error: 'No valid method call found after "cy.".' };
  }

  const method = methodMatch[1];
  if (!(CYPRESS_METHODS as readonly string[]).includes(method)) {
    return {
      valid: false,
      error: `Unknown Cypress method "${method}". Valid methods: ${CYPRESS_METHODS.join(', ')}.`,
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
  format: 'cypress',
  displayName: 'Cypress',
  generate,
  score: scoreSelector,
  warn,
  chain,
  suggest,
  didYouMean,
  validateAndFix,
};
