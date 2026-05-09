import type { RichElementData, ScoredSelector } from '@/types';
import type {
  ActionableWarning,
  GenerateResult,
  ProactiveSuggestion,
  RichPageData,
  SpecialistScore,
  Suggestion,
  ValidationResult,
} from './types';
import type { SelectorSpecialist } from './types';

import { findScopingAncestor } from './helpers/chaining';
import { escapeXPathValue } from './helpers/escaping';
import { findAttributeElsewhere, findTypoCorrections } from './helpers/suggestions';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function countSlashes(selector: string): number {
  // Count axis separators (// or /) as nesting indicators
  return (selector.match(/\//g) ?? []).length;
}

function buildScoredSelector(selector: string, scoreValue: number): ScoredSelector {
  return { selector, format: 'xpath', score: scoreValue, warnings: [] };
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

  // data-testid (highest priority)
  const testid = attributes['data-testid'];
  if (testid) add(`//${tag}[@data-testid=${escapeXPathValue(testid)}]`);

  // data-test
  const dataTest = attributes['data-test'];
  if (dataTest) add(`//${tag}[@data-test=${escapeXPathValue(dataTest)}]`);

  // id
  const id = attributes.id;
  if (id && !id.includes(' ')) add(`//${tag}[@id=${escapeXPathValue(id)}]`);

  // aria-label
  const ariaLabel = attributes['aria-label'];
  if (ariaLabel) add(`//${tag}[@aria-label=${escapeXPathValue(ariaLabel)}]`);

  // role + state attributes (aria-checked, aria-disabled, aria-expanded, aria-pressed, aria-selected)
  const role = attributes.role;
  if (role) {
    const stateConditions: string[] = [];
    const checked = attributes['aria-checked'];
    const disabled = attributes['aria-disabled'];
    const expanded = attributes['aria-expanded'];
    const pressed = attributes['aria-pressed'];
    const selected = attributes['aria-selected'];
    const current = attributes['aria-current'];

    if (checked) stateConditions.push(`@aria-checked=${escapeXPathValue(checked)}`);
    if (disabled) stateConditions.push(`@aria-disabled=${escapeXPathValue(disabled)}`);
    if (expanded) stateConditions.push(`@aria-expanded=${escapeXPathValue(expanded)}`);
    if (pressed) stateConditions.push(`@aria-pressed=${escapeXPathValue(pressed)}`);
    if (selected) stateConditions.push(`@aria-selected=${escapeXPathValue(selected)}`);
    if (current) stateConditions.push(`@aria-current=${escapeXPathValue(current)}`);

    if (ariaLabel) {
      const labelCond = `@aria-label=${escapeXPathValue(ariaLabel)}`;
      add(`//${tag}[@role=${escapeXPathValue(role)} and ${labelCond}]`);
      if (stateConditions.length > 0) {
        add(
          `//${tag}[@role=${escapeXPathValue(role)} and ${labelCond} and ${stateConditions.join(' and ')}]`
        );
      }
    } else {
      add(`//${tag}[@role=${escapeXPathValue(role)}]`);
      if (stateConditions.length > 0) {
        add(`//${tag}[@role=${escapeXPathValue(role)} and ${stateConditions.join(' and ')}]`);
      }
    }
  }

  // name
  const name = attributes.name;
  if (name) add(`//${tag}[@name=${escapeXPathValue(name)}]`);

  // Native disabled attribute
  if (attributes.disabled !== undefined) {
    add(`//${tag}[@disabled]`);
  }

  // Native checked attribute (checkbox/radio)
  const type = attributes.type;
  if (attributes.checked !== undefined && (type === 'checkbox' || type === 'radio')) {
    add(`//${tag}[@type=${escapeXPathValue(type)} and @checked]`);
  }

  // normalize-space(text()) for text content (≤50 chars)
  const trimmedText = text?.trim() ?? '';
  if (trimmedText && trimmedText.length <= 50) {
    add(`//${tag}[normalize-space(text())=${escapeXPathValue(trimmedText)}]`);
  }

  // fallback tag
  add(`//${tag}`);

  return { selectors, proactive };
}

// ---------------------------------------------------------------------------
// score
// ---------------------------------------------------------------------------

function scoreSelector(selector: string): SpecialistScore {
  const factors: SpecialistScore['factors'] = [];
  let score = 50;

  // hasTestId
  if (/data-testid|data-test/.test(selector)) {
    factors.push({
      name: 'hasTestId',
      impact: 45,
      description: 'Uses a data-testid attribute — stable and intent-revealing.',
    });
    score += 45;
  }

  // hasStaticId
  if (/@id=/.test(selector)) {
    factors.push({ name: 'hasStaticId', impact: 40, description: 'Uses a stable ID attribute.' });
    score += 40;
  }

  // hasAriaLabel (with role)
  if (/@aria-label=/.test(selector) && /@role=/.test(selector)) {
    factors.push({
      name: 'hasRoleAndName',
      impact: 30,
      description: 'Combines role and accessible name — semantic and stable.',
    });
    score += 30;
  } else if (/@aria-label=/.test(selector)) {
    factors.push({
      name: 'hasAriaLabel',
      impact: 25,
      description: 'Uses aria-label for accessible identification.',
    });
    score += 25;
  }

  // hasRole alone
  if (/@role=/.test(selector) && !/@aria-label=/.test(selector)) {
    factors.push({
      name: 'hasRole',
      impact: 20,
      description: 'Uses role attribute for semantic targeting.',
    });
    score += 20;
  }

  // hasState - ARIA or native state attributes add precision
  const hasAriaState =
    /@aria-checked|@aria-disabled|@aria-expanded|@aria-pressed|@aria-selected|@aria-current/.test(
      selector
    );
  const hasNativeState = /@disabled|@checked/.test(selector);
  if (hasAriaState) {
    factors.push({
      name: 'hasState',
      impact: 8,
      description: 'Uses ARIA state attribute for precise element matching.',
    });
    score += 8;
  } else if (hasNativeState) {
    factors.push({
      name: 'hasNativeState',
      impact: 5,
      description: 'Uses native state attribute for precise element matching.',
    });
    score += 5;
  }

  // normalize-space text matching
  if (/normalize-space/.test(selector)) {
    factors.push({
      name: 'normalizeSpaceText',
      impact: 10,
      description: 'Uses normalize-space() for whitespace-tolerant exact text matching.',
    });
    score += 10;
  }

  // contains(text()) partial match — slight penalty
  if (/contains\(text\(\)/.test(selector)) {
    factors.push({
      name: 'containsText',
      impact: -5,
      description: 'contains(text()) partial match may be too broad.',
    });
    score -= 5;
  }

  // Positional selector [n] at end (wrapped xpath like (//...)[3])
  if (/\)\[\d+\]$/.test(selector)) {
    factors.push({
      name: 'usesPositionalIndex',
      impact: -20,
      description: 'Positional index is fragile when element order changes.',
    });
    score -= 20;
  }

  // Deep nesting (more than 4 slashes)
  if (countSlashes(selector) > 4) {
    factors.push({
      name: 'isDeepNested',
      impact: -15,
      description: 'Deep XPath nesting is fragile when DOM structure changes.',
    });
    score -= 15;
  }

  return { score: Math.max(0, Math.min(100, score)), factors };
}

// ---------------------------------------------------------------------------
// warn
// ---------------------------------------------------------------------------

function warn(selector: string, element: RichElementData): ActionableWarning[] {
  const warnings: ActionableWarning[] = [];
  const { text } = element;

  // contains(text()) partial match warning
  if (/contains\(text\(\)/.test(selector)) {
    const trimmedText = text?.trim() ?? '';
    let fix: ActionableWarning['fix'] | undefined;

    // Extract tag from selector for the fix
    const tagMatch = selector.match(/^\/\/([a-z][a-z0-9]*)/i);
    const tag = tagMatch ? tagMatch[1] : '*';

    if (trimmedText) {
      fix = {
        label: 'Use normalize-space() for exact match',
        selector: `//${tag}[normalize-space(text())=${escapeXPathValue(trimmedText)}]`,
      };
    }

    warnings.push({
      message: 'contains(text()) performs a partial match and may target unintended elements.',
      severity: 'warning',
      fix,
    });
  }

  // Positional index warning
  if (/\)\[\d+\]$/.test(selector)) {
    warnings.push({
      message: 'Positional index [n] is fragile if the element order changes.',
      severity: 'warning',
    });
  }

  // Deep nesting warning
  if (countSlashes(selector) > 4) {
    warnings.push({
      message:
        'Selector is deeply nested; DOM structure changes may break it. Consider using a data-testid on the target element.',
      severity: 'warning',
    });
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

  // Convert CSS ancestor selector to XPath format
  // findScopingAncestor returns CSS like `#main-nav` or `nav.menu`
  let ancestorXPath: string;
  const cssSelector = ancestor.selector;

  // CSS #id → XPath [@id='...']
  const idMatch = cssSelector.match(/^#(.+)$/);
  // CSS tag.class1.class2 → XPath [contains(@class,'class1')]...
  const tagClassMatch = cssSelector.match(/^([a-z][a-z0-9]*)\.(.+)$/i);

  if (idMatch) {
    const idValue = idMatch[1].replace(/\\(.)/g, '$1');
    ancestorXPath = `//*[@id=${escapeXPathValue(idValue)}]`;
  } else if (tagClassMatch) {
    const ancTag = tagClassMatch[1];
    const classes = tagClassMatch[2].split('.').map((c) => c.replace(/\\(.)/g, '$1'));
    const classConditions = classes
      .map((c) => `contains(@class,${escapeXPathValue(c)})`)
      .join(' and ');
    ancestorXPath = `//${ancTag}[${classConditions}]`;
  } else {
    // fallback: use the CSS selector as-is embedded in a generic XPath
    ancestorXPath = `//*[@id=${escapeXPathValue(cssSelector)}]`;
  }

  // Build descendant element part
  const testid = attributes['data-testid'] ?? attributes['data-test'];
  let elementPart: string;
  if (testid) {
    const attr = attributes['data-testid'] ? 'data-testid' : 'data-test';
    elementPart = `//${tag}[@${attr}=${escapeXPathValue(testid)}]`;
  } else if (attributes['aria-label']) {
    elementPart = `//${tag}[@aria-label=${escapeXPathValue(attributes['aria-label'])}]`;
  } else if (attributes.id) {
    elementPart = `//${tag}[@id=${escapeXPathValue(attributes.id)}]`;
  } else {
    elementPart = `//${tag}`;
  }

  const sel = `${ancestorXPath}${elementPart}`;
  const s = scoreSelector(sel);
  return [buildScoredSelector(sel, Math.min(100, s.score + 5))];
}

// ---------------------------------------------------------------------------
// suggest
// ---------------------------------------------------------------------------

function suggest(partial: string, pageData: RichPageData): Suggestion[] {
  if (!partial) return [];

  const results: Suggestion[] = [];
  const lower = partial.toLowerCase();

  if (partial.startsWith('//')) {
    // Suggest tag completions from page elements
    const tagPrefix = partial.slice(2).toLowerCase();
    const seen = new Set<string>();
    for (const el of pageData.elements) {
      if (el.tag.toLowerCase().startsWith(tagPrefix) && !seen.has(el.tag)) {
        seen.add(el.tag);
        const sel = `//${el.tag}`;
        results.push({
          selector: sel,
          label: sel,
          description: `Tag <${el.tag}>`,
          score: scoreSelector(sel).score,
          kind: 'autocomplete',
          selectorType: 'xpath',
        });
      }
    }
  } else if (partial.startsWith('@') || partial.includes('[@')) {
    // Suggest attribute names
    const attrSuggestions = [
      'data-testid',
      'data-test',
      'id',
      'aria-label',
      'role',
      'name',
      'type',
      'placeholder',
    ];
    const attrPrefix = partial.replace(/.*\[@?/, '').toLowerCase();
    for (const attr of attrSuggestions) {
      if (attr.startsWith(attrPrefix)) {
        results.push({
          selector: `[@${attr}=`,
          label: `[@${attr}="..."]`,
          description: `XPath attribute: @${attr}`,
          score: attr.includes('testid') ? 90 : 60,
          kind: 'autocomplete',
          selectorType: 'xpath',
        });
      }
    }
  } else {
    // Suggest testids and ids matching the prefix
    for (const el of pageData.elements) {
      if (el.testId?.toLowerCase().startsWith(lower)) {
        const sel = `//*[@data-testid=${escapeXPathValue(el.testId)}]`;
        results.push({
          selector: sel,
          label: sel,
          description: `data-testid on <${el.tag}>`,
          score: scoreSelector(sel).score,
          kind: 'autocomplete',
          selectorType: 'xpath',
        });
      }
      if (el.id?.toLowerCase().startsWith(lower)) {
        const sel = `//*[@id=${escapeXPathValue(el.id)}]`;
        results.push({
          selector: sel,
          label: sel,
          description: `ID on <${el.tag}>`,
          score: scoreSelector(sel).score,
          kind: 'autocomplete',
          selectorType: 'xpath',
        });
      }
    }
  }

  return results.slice(0, 10);
}

// ---------------------------------------------------------------------------
// didYouMean
// ---------------------------------------------------------------------------

function didYouMean(selector: string, pageData: RichPageData): Suggestion[] {
  if (!selector) return [];

  // Extract attribute value from xpath selector
  let extractedValue = '';
  const attrMatch = selector.match(/@[\w-]+=["']([^"']+)["']/);
  if (attrMatch) {
    extractedValue = attrMatch[1];
  } else {
    // Try to extract text value from normalize-space or contains
    const textMatch = selector.match(
      /normalize-space\(text\(\)\)=["']([^"']+)["']|contains\(text\(\),["']([^"']+)["']\)/
    );
    if (textMatch) {
      extractedValue = textMatch[1] ?? textMatch[2] ?? '';
    }
  }

  if (!extractedValue) return [];

  const results: Suggestion[] = [];

  const typoTestIds = findTypoCorrections(extractedValue, pageData.testIds, 2);
  for (const { candidate } of typoTestIds) {
    const sel = `//*[@data-testid=${escapeXPathValue(candidate)}]`;
    results.push({
      selector: sel,
      label: sel,
      description: `Did you mean data-testid="${candidate}"?`,
      score: scoreSelector(sel).score,
      kind: 'alternative',
      selectorType: 'xpath',
    });
  }

  const typoIds = findTypoCorrections(extractedValue, pageData.ids, 2);
  for (const { candidate } of typoIds) {
    const sel = `//*[@id=${escapeXPathValue(candidate)}]`;
    results.push({
      selector: sel,
      label: sel,
      description: `Did you mean @id="${candidate}"?`,
      score: scoreSelector(sel).score,
      kind: 'alternative',
      selectorType: 'xpath',
    });
  }

  // findAttributeElsewhere for cross-attribute suggestions
  const elsewhere = findAttributeElsewhere(extractedValue, pageData);
  for (const { element, attribute } of elsewhere.slice(0, 3)) {
    let sel = '';
    if (attribute === 'testId' && element.testId) {
      sel = `//*[@data-testid=${escapeXPathValue(element.testId)}]`;
    } else if (attribute === 'id' && element.id) {
      sel = `//*[@id=${escapeXPathValue(element.id)}]`;
    } else if (attribute === 'ariaLabel' && element.ariaLabel) {
      sel = `//*[@aria-label=${escapeXPathValue(element.ariaLabel)}]`;
    }
    if (sel) {
      results.push({
        selector: sel,
        label: sel,
        description: `Value found in ${attribute} attribute`,
        score: scoreSelector(sel).score,
        kind: 'alternative',
        selectorType: 'xpath',
      });
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

  // Must start with // or /
  if (!/^[\/(]/.test(selector)) {
    return {
      valid: false,
      error: 'XPath expression should start with // or /.',
      fix: {
        label: 'Prefix with //',
        selector: `//${selector}`,
      },
    };
  }

  // Unbalanced brackets
  const openBrackets = (selector.match(/\[/g) ?? []).length;
  const closeBrackets = (selector.match(/\]/g) ?? []).length;
  if (openBrackets !== closeBrackets) {
    return { valid: false, error: 'Unbalanced brackets in XPath expression.' };
  }

  // Unbalanced parentheses
  const openParens = (selector.match(/\(/g) ?? []).length;
  const closeParens = (selector.match(/\)/g) ?? []).length;
  if (openParens !== closeParens) {
    return { valid: false, error: 'Unbalanced parentheses in XPath expression.' };
  }

  // Unclosed quotes
  const doubleQuotes = (selector.match(/"/g) ?? []).length;
  const singleQuotes = (selector.match(/'/g) ?? []).length;
  if (doubleQuotes % 2 !== 0) {
    return { valid: false, error: 'Unclosed double quote in XPath expression.' };
  }
  if (singleQuotes % 2 !== 0) {
    return { valid: false, error: 'Unclosed single quote in XPath expression.' };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const specialist: SelectorSpecialist = {
  format: 'xpath',
  displayName: 'XPath',
  generate,
  score: scoreSelector,
  warn,
  chain,
  suggest,
  didYouMean,
  validateAndFix,
};
