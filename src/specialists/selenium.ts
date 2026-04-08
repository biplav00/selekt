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

import { findScopingAncestor } from './helpers/chaining';
import { escapeDoubleQuoteJs, escapeSingleQuoteJs, escapeXPathValue } from './helpers/escaping';

// ---------------------------------------------------------------------------
// Valid Selenium By.* methods
// ---------------------------------------------------------------------------

const SELENIUM_BY_METHODS = [
  'id',
  'name',
  'css',
  'xpath',
  'tagName',
  'className',
  'linkText',
  'partialLinkText',
] as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildScoredSelector(selector: string, scoreValue: number): ScoredSelector {
  return { selector, format: 'selenium', score: scoreValue, warnings: [] };
}

// ---------------------------------------------------------------------------
// generate
// ---------------------------------------------------------------------------

function generate(element: RichElementData): GenerateResult {
  const { tagName, attributes, text } = element;
  const tag = tagName.toLowerCase();
  const selectors: ScoredSelector[] = [];
  const proactive: ProactiveSuggestion[] = [];

  const add = (sel: string) => {
    const s = scoreSelector(sel);
    selectors.push(buildScoredSelector(sel, s.score));
  };

  // 1. data-testid via CSS
  const testid = attributes['data-testid'];
  if (testid) {
    add(`driver.findElement(By.css('[data-testid="${escapeDoubleQuoteJs(testid)}"]'))`);
  }

  // 2. data-test via CSS
  const dataTest = attributes['data-test'];
  if (dataTest) {
    add(`driver.findElement(By.css('[data-test="${escapeDoubleQuoteJs(dataTest)}"]'))`);
  }

  // 3. By.id — static ID
  const id = attributes.id;
  if (id && !id.includes(' ')) {
    add(`driver.findElement(By.id('${escapeSingleQuoteJs(id)}'))`);
  }

  // 4. By.name
  const name = attributes.name;
  if (name) {
    add(`driver.findElement(By.name('${escapeSingleQuoteJs(name)}'))`);
  }

  // 5. aria-label via CSS
  const ariaLabel = attributes['aria-label'];
  if (ariaLabel) {
    add(`driver.findElement(By.css('[aria-label="${escapeDoubleQuoteJs(ariaLabel)}"]'))`);
  }

  // 6. role via XPath
  const role = attributes.role;
  if (role) {
    add(`driver.findElement(By.xpath('//${tag}[@role=${escapeXPathValue(role)}]'))`);
  }

  // 7. By.linkText for <a> tags with text
  const trimmedText = text?.trim() ?? '';
  if (tag === 'a' && trimmedText && trimmedText.length > 0 && trimmedText.length <= 80) {
    add(`driver.findElement(By.linkText('${escapeSingleQuoteJs(trimmedText)}'))`);
  }

  // 8. Text via XPath normalize-space
  if (trimmedText && trimmedText.length > 0 && trimmedText.length <= 50) {
    add(
      `driver.findElement(By.xpath('//${tag}[normalize-space(text())=${escapeXPathValue(trimmedText)}]'))`
    );
  }

  // 9. By.tagName — fallback
  add(`driver.findElement(By.tagName('${tag}'))`);

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

  // By.id
  if (/By\.id\s*\(/.test(selector)) {
    factors.push({
      name: 'byId',
      impact: 40,
      description: 'By.id — highly specific and stable when ID is static.',
    });
    score += 40;
  }

  // By.name
  if (/By\.name\s*\(/.test(selector)) {
    factors.push({
      name: 'byName',
      impact: 30,
      description: 'By.name — stable for form elements with name attributes.',
    });
    score += 30;
  }

  // aria-label via CSS
  if (/By\.css\s*\(/.test(selector) && /aria-label/.test(selector)) {
    factors.push({
      name: 'ariaLabelCss',
      impact: 25,
      description: 'Uses aria-label for accessible identification.',
    });
    score += 25;
  }

  // By.linkText
  if (/By\.linkText\s*\(/.test(selector)) {
    factors.push({
      name: 'byLinkText',
      impact: 20,
      description: 'By.linkText — matches full visible text of anchor.',
    });
    score += 20;
  }

  // role via XPath
  if (/By\.xpath\s*\(/.test(selector) && /@role/.test(selector)) {
    factors.push({
      name: 'xpathRole',
      impact: 15,
      description: 'XPath with @role — semantic but may match multiple.',
    });
    score += 15;
  }

  // text via XPath (normalize-space)
  if (/By\.xpath\s*\(/.test(selector) && /normalize-space/.test(selector)) {
    factors.push({
      name: 'xpathText',
      impact: 10,
      description: 'XPath text match — fragile if text changes.',
    });
    score += 10;
  }

  // By.className penalty
  if (/By\.className\s*\(/.test(selector)) {
    factors.push({
      name: 'byClassName',
      impact: -10,
      description: 'By.className only supports a single class name and is fragile.',
    });
    score -= 10;
  }

  // By.tagName penalty
  if (/By\.tagName\s*\(/.test(selector)) {
    factors.push({
      name: 'byTagName',
      impact: -15,
      description: 'By.tagName is very broad and matches many elements.',
    });
    score -= 15;
  }

  // XPath positional penalty
  if (/By\.xpath\s*\(/.test(selector) && /\[\d+\]/.test(selector)) {
    factors.push({
      name: 'xpathPositional',
      impact: -20,
      description: 'XPath positional index is fragile if siblings change.',
    });
    score -= 20;
  }

  // Nested findElement bonus
  if (/\)\.findElement\s*\(/.test(selector)) {
    factors.push({
      name: 'nestedFindElement',
      impact: 5,
      description: 'Chained findElement scopes the search to an ancestor.',
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
  const { attributes, tagName } = element;
  const tag = tagName.toLowerCase();

  // By.className — only single class supported, fragile
  if (/By\.className\s*\(/.test(selector)) {
    let fix: ActionableWarning['fix'] | undefined;

    const testid = attributes['data-testid'] ?? attributes['data-test'];
    if (testid) {
      const attr = attributes['data-testid'] ? 'data-testid' : 'data-test';
      fix = {
        label: `Use By.css with ${attr} instead`,
        selector: `driver.findElement(By.css('[${attr}="${escapeDoubleQuoteJs(testid)}"]'))`,
      };
    } else if (attributes.id && !attributes.id.includes(' ')) {
      fix = {
        label: 'Use By.id instead',
        selector: `driver.findElement(By.id('${escapeSingleQuoteJs(attributes.id)}'))`,
      };
    } else if (attributes.name) {
      fix = {
        label: 'Use By.name instead',
        selector: `driver.findElement(By.name('${escapeSingleQuoteJs(attributes.name)}'))`,
      };
    }

    warnings.push({
      message:
        'By.className only accepts a single class name and is fragile if class names change. Consider using By.css or a more stable locator.',
      severity: 'warning',
      fix,
    });
  }

  // By.tagName — too broad
  if (/By\.tagName\s*\(/.test(selector)) {
    let fix: ActionableWarning['fix'] | undefined;

    const testid = attributes['data-testid'] ?? attributes['data-test'];
    if (testid) {
      const attr = attributes['data-testid'] ? 'data-testid' : 'data-test';
      fix = {
        label: `Use By.css with ${attr} instead`,
        selector: `driver.findElement(By.css('[${attr}="${escapeDoubleQuoteJs(testid)}"]'))`,
      };
    } else if (attributes.id && !attributes.id.includes(' ')) {
      fix = {
        label: 'Use By.id instead',
        selector: `driver.findElement(By.id('${escapeSingleQuoteJs(attributes.id)}'))`,
      };
    } else if (attributes.name) {
      fix = {
        label: 'Use By.name instead',
        selector: `driver.findElement(By.name('${escapeSingleQuoteJs(attributes.name)}'))`,
      };
    }

    warnings.push({
      message: `By.tagName('${tag}') matches every <${tag}> element on the page. Use a more specific locator.`,
      severity: 'warning',
      fix,
    });
  }

  // Auto-generated ID warning
  if (/By\.id\s*\(/.test(selector)) {
    const idMatch = selector.match(/By\.id\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (idMatch) {
      const idValue = idMatch[1];
      // Heuristic: IDs with numbers at the end that look generated
      if (/[0-9a-f]{8,}|__next|-[0-9]+$|\d{4,}/.test(idValue)) {
        const testid = attributes['data-testid'] ?? attributes['data-test'];
        let fix: ActionableWarning['fix'] | undefined;
        if (testid) {
          const attr = attributes['data-testid'] ? 'data-testid' : 'data-test';
          fix = {
            label: `Use By.css with ${attr} instead`,
            selector: `driver.findElement(By.css('[${attr}="${escapeDoubleQuoteJs(testid)}"]'))`,
          };
        }
        warnings.push({
          message:
            'This ID looks auto-generated and may change between builds. Add a stable data-testid instead.',
          severity: 'warning',
          fix,
        });
      }
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

function chain(element: RichElementData, _matchCount: number): ScoredSelector[] {
  const { tagName, attributes, parentChain } = element;
  const tag = tagName.toLowerCase();

  const ancestor = findScopingAncestor(parentChain);
  if (!ancestor) return [];

  // Only chain if ancestor has a clean ID (most useful for Selenium chaining)
  const ancestorAncestor = parentChain.find((a) => a.id && !a.id.includes(' '));
  if (!ancestorAncestor) return [];

  const ancestorId = ancestorAncestor.id;

  // Build child locator
  let childPart: string;
  const testid = attributes['data-testid'] ?? attributes['data-test'];

  if (testid) {
    const attr = attributes['data-testid'] ? 'data-testid' : 'data-test';
    childPart = `By.css('[${attr}="${escapeDoubleQuoteJs(testid)}"]')`;
  } else if (attributes.name) {
    childPart = `By.name('${escapeSingleQuoteJs(attributes.name)}')`;
  } else if (attributes['aria-label']) {
    childPart = `By.css('[aria-label="${escapeDoubleQuoteJs(attributes['aria-label'])}"]')`;
  } else {
    childPart = `By.tagName('${tag}')`;
  }

  const sel = `driver.findElement(By.id('${escapeSingleQuoteJs(ancestorId)}')).findElement(${childPart})`;
  const s = scoreSelector(sel);
  return [buildScoredSelector(sel, Math.min(100, s.score + 5))];
}

// ---------------------------------------------------------------------------
// suggest
// ---------------------------------------------------------------------------

function suggest(partial: string, _pageElements: PageElement[]): Suggestion[] {
  if (!partial) return [];

  const results: Suggestion[] = [];

  // Suggest By.* methods after "By."
  if (/By\.[a-zA-Z]*$/.test(partial)) {
    const methodPrefix = partial.match(/By\.([a-zA-Z]*)$/)?.[1]?.toLowerCase() ?? '';
    const methods = [
      { name: 'id', score: 90 },
      { name: 'name', score: 80 },
      { name: 'css', score: 85 },
      { name: 'xpath', score: 75 },
      { name: 'tagName', score: 35 },
      { name: 'className', score: 40 },
      { name: 'linkText', score: 70 },
      { name: 'partialLinkText', score: 60 },
    ];
    for (const { name, score } of methods) {
      if (name.toLowerCase().startsWith(methodPrefix)) {
        results.push({
          selector: `driver.findElement(By.${name}(`,
          label: `By.${name}(...)`,
          description: `Selenium By.${name} locator`,
          score,
          kind: 'autocomplete',
        });
      }
    }
    return results;
  }

  return results.slice(0, 10);
}

// ---------------------------------------------------------------------------
// didYouMean
// ---------------------------------------------------------------------------

function didYouMean(selector: string, pageElements: PageElement[]): Suggestion[] {
  if (!selector || pageElements.length === 0) return [];

  const results: Suggestion[] = [];

  // Extract value from By.css('[data-testid="..."]')
  const testIdMatch = selector.match(/data-testid=["']([^"']+)["']/);

  if (testIdMatch) {
    const searchVal = testIdMatch[1].toLowerCase();
    for (const el of pageElements) {
      if (
        el.testId &&
        el.testId.toLowerCase() !== searchVal &&
        el.testId.toLowerCase().includes(searchVal.slice(0, 3))
      ) {
        const sel = `driver.findElement(By.css('[data-testid="${escapeDoubleQuoteJs(el.testId)}"]'))`;
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

  if (!selector.startsWith('driver.findElement(')) {
    return {
      valid: false,
      error: 'Selenium selectors must start with "driver.findElement(".',
    };
  }

  // Extract By.* method
  const byMatch = selector.match(/By\.([a-zA-Z]+)\s*\(/);
  if (!byMatch) {
    return { valid: false, error: 'No valid By.* method found in selector.' };
  }

  const method = byMatch[1];
  if (!(SELENIUM_BY_METHODS as readonly string[]).includes(method)) {
    return {
      valid: false,
      error: `Unknown By method "${method}". Valid methods: ${SELENIUM_BY_METHODS.join(', ')}.`,
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
  format: 'selenium',
  displayName: 'Selenium',
  generate,
  score: scoreSelector,
  warn,
  chain,
  suggest,
  didYouMean,
  validateAndFix,
};
