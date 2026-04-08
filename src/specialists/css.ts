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

import { findScopingAncestor, getPositionQualifier } from './helpers/chaining';
import { SEMANTIC_TAGS, isDynamicClass, isDynamicId } from './helpers/dynamic-detect';
import { cssEscape, escapeCssAttrValue } from './helpers/escaping';
import { findAttributeElsewhere, findTypoCorrections } from './helpers/suggestions';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function countCombinators(selector: string): number {
  return (selector.match(/[\s>+~]/g) ?? []).length;
}

function buildScoredSelector(selector: string, scoreValue: number): ScoredSelector {
  return { selector, format: 'css', score: scoreValue, warnings: [] };
}

// ---------------------------------------------------------------------------
// generate
// ---------------------------------------------------------------------------

function generate(element: RichElementData): GenerateResult {
  const { tagName, attributes } = element;
  const tag = tagName.toLowerCase();
  const selectors: ScoredSelector[] = [];
  const proactive: ProactiveSuggestion[] = [];

  const add = (sel: string) => {
    const s = scoreSelector(sel);
    selectors.push(buildScoredSelector(sel, s.score));
  };

  // data-testid (highest priority)
  const testid = attributes['data-testid'];
  if (testid) add(`[data-testid="${escapeCssAttrValue(testid)}"]`);

  // data-test
  const dataTest = attributes['data-test'];
  if (dataTest) add(`[data-test="${escapeCssAttrValue(dataTest)}"]`);

  // id
  const id = attributes.id;
  if (id && !id.includes(' ')) add(`#${cssEscape(id)}`);

  // aria-label
  const ariaLabel = attributes['aria-label'];
  if (ariaLabel) add(`[aria-label="${escapeCssAttrValue(ariaLabel)}"]`);

  // role + aria-label combo, or role alone
  const role = attributes.role;
  if (role) {
    if (ariaLabel) {
      add(`[role="${escapeCssAttrValue(role)}"][aria-label="${escapeCssAttrValue(ariaLabel)}"]`);
    } else {
      add(`[role="${escapeCssAttrValue(role)}"]`);
    }
  }

  // tag[name="..."]
  const name = attributes.name;
  if (name) add(`${tag}[name="${escapeCssAttrValue(name)}"]`);

  // input[type="..."][value="..."]
  const type = attributes.type;
  const value = attributes.value;
  if (type && value && tag === 'input') {
    add(`${tag}[type="${escapeCssAttrValue(type)}"][value="${escapeCssAttrValue(value)}"]`);
  }

  // class (non-dynamic only)
  const className = attributes.class;
  if (className) {
    const classes = className.split(/\s+/).filter((c) => c && !isDynamicClass(c));
    if (classes.length > 0) {
      const classSel = `${tag}.${classes.map(cssEscape).join('.')}`;
      add(classSel);

      // Proactive: testid is available but we're also emitting class selector
      if (testid) {
        proactive.push({
          message: 'testid available — prefer over class selector',
          currentSelector: classSel,
          betterSelector: `[data-testid="${escapeCssAttrValue(testid)}"]`,
          reason: 'data-testid selectors are more stable across refactors and build changes.',
        });
      }
    }
  }

  // fallback tag
  add(tag);

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
  const hasId = /^#[^\s>+~[]+/.test(selector) || /\[id=/.test(selector);
  if (hasId) {
    const idMatch = selector.match(/(?:^#)([^\s>+~[\\.:#(]+)/);
    const idValue = idMatch ? idMatch[1].replace(/\\(.)/g, '$1') : '';
    if (!isDynamicId(idValue)) {
      factors.push({ name: 'hasStaticId', impact: 40, description: 'Uses a stable ID attribute.' });
      score += 40;
    } else {
      factors.push({
        name: 'hasDynamicId',
        impact: -20,
        description: 'ID appears auto-generated and may not be stable.',
      });
      score -= 20;
    }
  }

  // hasRoleAndName
  if (/\[role=/.test(selector) && /aria-label/.test(selector)) {
    factors.push({
      name: 'hasRoleAndName',
      impact: 30,
      description: 'Combines role and accessible name — semantic and stable.',
    });
    score += 30;
  }

  // hasAriaLabel
  if (/aria-label/.test(selector) && !/\[role=/.test(selector)) {
    factors.push({
      name: 'hasAriaLabel',
      impact: 25,
      description: 'Uses aria-label for accessible identification.',
    });
    score += 25;
  }

  // isShort
  const combinatorCount = countCombinators(selector);
  if (combinatorCount <= 2) {
    factors.push({
      name: 'isShort',
      impact: 15,
      description: 'Short selector with few combinators — easy to maintain.',
    });
    score += 15;
  }

  // isSemanticTag
  const firstTag = selector.match(/^([a-z][a-z0-9]*)[\s\[.#:>+~(]|^([a-z][a-z0-9]*)$/i);
  const tagName = (firstTag?.[1] ?? firstTag?.[2] ?? '').toLowerCase();
  if (tagName && SEMANTIC_TAGS.has(tagName)) {
    factors.push({
      name: 'isSemanticTag',
      impact: 10,
      description: 'Targets a semantic HTML element.',
    });
    score += 10;
  }

  // usesDynamicClass
  const classMatches = selector.match(/\.([a-zA-Z0-9_-]+)/g) ?? [];
  let hasDynClass = false;
  for (const cm of classMatches) {
    if (isDynamicClass(cm.slice(1))) {
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

  // isDeepNested
  if (combinatorCount > 3) {
    factors.push({
      name: 'isDeepNested',
      impact: -20,
      description: 'Deeply nested selector is fragile when DOM structure changes.',
    });
    score -= 20;
  }

  // usesNthChild
  if (/nth-child|nth-of-type/.test(selector)) {
    factors.push({
      name: 'usesNthChild',
      impact: -15,
      description: 'nth-child/nth-of-type positioning is fragile if sibling order changes.',
    });
    score -= 15;
  }

  // usesIndexPosition
  if (/\[\d+\]|:eq\(|\.eq\(/.test(selector)) {
    factors.push({
      name: 'usesIndexPosition',
      impact: -15,
      description: 'Index-based positioning is sensitive to element reordering.',
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
  const { attributes } = element;

  // Dynamic classes
  const classMatches = selector.match(/\.([a-zA-Z0-9_-]+)/g) ?? [];
  for (const cm of classMatches) {
    if (isDynamicClass(cm.slice(1))) {
      let fix: ActionableWarning['fix'] | undefined;
      const testid = attributes['data-testid'] ?? attributes['data-test'];
      if (testid) {
        const attr = attributes['data-testid'] ? 'data-testid' : 'data-test';
        fix = {
          label: `Use ${attr} instead`,
          selector: `[${attr}="${escapeCssAttrValue(testid)}"]`,
        };
      } else if (attributes.role && attributes['aria-label']) {
        fix = {
          label: 'Use role + aria-label instead',
          selector: `[role="${escapeCssAttrValue(attributes.role)}"][aria-label="${escapeCssAttrValue(attributes['aria-label'])}"]`,
        };
      }

      warnings.push({
        message: 'Uses dynamically generated class names that may change between builds.',
        severity: 'warning',
        fix,
      });
      break;
    }
  }

  // Dynamic ID
  if (/^#/.test(selector)) {
    // Match ID portion — allow escaped characters (backslash sequences)
    const idMatch = selector.match(/^#((?:\\.|[^\s>+~[\]#.(: ])+)/);
    const rawId = idMatch ? idMatch[1].replace(/\\(.)/g, '$1') : '';
    if (rawId && isDynamicId(rawId)) {
      let fix: ActionableWarning['fix'] | undefined;
      if (attributes['aria-label']) {
        fix = {
          label: 'Use aria-label instead',
          selector: `[aria-label="${escapeCssAttrValue(attributes['aria-label'])}"]`,
        };
      } else if (attributes.name) {
        fix = {
          label: 'Use name attribute instead',
          selector: `[name="${escapeCssAttrValue(attributes.name)}"]`,
        };
      }
      warnings.push({
        message:
          'ID appears to be auto-generated and may not be stable across page loads. Use a more stable selector.',
        severity: 'warning',
        fix,
      });
    }
  }

  // Deep nesting
  if (countCombinators(selector) > 3) {
    warnings.push({
      message:
        'Selector is deeply nested; DOM structure changes may break it. Consider using a data-testid on the target element.',
      severity: 'warning',
    });
  }

  // nth-child fragility
  if (/nth-child|nth-of-type/.test(selector)) {
    warnings.push({
      message: 'nth-child/nth-of-type positioning is fragile if sibling order changes.',
      severity: 'warning',
    });
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

function chain(element: RichElementData, matchCount: number): ScoredSelector[] {
  const { tagName, attributes, parentChain, siblingTags } = element;
  const tag = tagName.toLowerCase();

  const ancestor = findScopingAncestor(parentChain);
  if (!ancestor) {
    // Last resort: nth-of-type
    const pos = getPositionQualifier(tag, siblingTags, 0);
    if (pos) {
      const sel = `${tag}:nth-of-type(${pos.index})`;
      const s = scoreSelector(sel);
      return [buildScoredSelector(sel, s.score)];
    }
    return [];
  }

  const results: ScoredSelector[] = [];

  // Build element portion
  const testid = attributes['data-testid'] ?? attributes['data-test'];
  let elementPart: string;
  if (testid) {
    const attr = attributes['data-testid'] ? 'data-testid' : 'data-test';
    elementPart = `[${attr}="${escapeCssAttrValue(testid)}"]`;
  } else if (attributes['aria-label']) {
    elementPart = `${tag}[aria-label="${escapeCssAttrValue(attributes['aria-label'])}"]`;
  } else if (attributes.id && !attributes.id.includes(' ')) {
    elementPart = `#${cssEscape(attributes.id)}`;
  } else {
    const className = attributes.class;
    const stableClasses = className
      ? className.split(/\s+/).filter((c) => c && !isDynamicClass(c))
      : [];
    elementPart =
      stableClasses.length > 0
        ? `${tag}.${stableClasses.slice(0, 2).map(cssEscape).join('.')}`
        : tag;
  }

  const sel = `${ancestor.selector} ${elementPart}`;
  const s = scoreSelector(sel);
  // Apply scoped chain bonus
  results.push(buildScoredSelector(sel, Math.min(100, s.score + 5)));

  return results;
}

// ---------------------------------------------------------------------------
// suggest
// ---------------------------------------------------------------------------

function suggest(partial: string, pageElements: PageElement[]): Suggestion[] {
  if (!partial) return [];

  const results: Suggestion[] = [];
  const lower = partial.toLowerCase();

  if (partial.startsWith('#')) {
    // Suggest matching IDs
    const prefix = partial.slice(1).toLowerCase();
    for (const el of pageElements) {
      if (el.id?.toLowerCase().startsWith(prefix)) {
        const sel = `#${cssEscape(el.id)}`;
        results.push({
          selector: sel,
          label: sel,
          description: `ID on <${el.tag}>`,
          score: scoreSelector(sel).score,
          kind: 'autocomplete',
        });
      }
    }
  } else if (partial.startsWith('.')) {
    // Suggest matching classes
    const prefix = partial.slice(1).toLowerCase();
    const seen = new Set<string>();
    for (const el of pageElements) {
      for (const cls of el.classes) {
        if (cls.toLowerCase().startsWith(prefix) && !seen.has(cls) && !isDynamicClass(cls)) {
          seen.add(cls);
          const sel = `.${cssEscape(cls)}`;
          results.push({
            selector: sel,
            label: sel,
            description: `Class on <${el.tag}>`,
            score: scoreSelector(sel).score,
            kind: 'autocomplete',
          });
        }
      }
    }
  } else if (partial.startsWith('[')) {
    // Suggest attribute names
    const attrSuggestions = [
      'data-testid',
      'data-test',
      'role',
      'aria-label',
      'name',
      'type',
      'placeholder',
    ];
    for (const attr of attrSuggestions) {
      if (attr.startsWith(partial.slice(1).replace(/\[/, '').toLowerCase())) {
        results.push({
          selector: `[${attr}=`,
          label: `[${attr}="..."]`,
          description: `Attribute selector for ${attr}`,
          score: attr.includes('testid') ? 90 : 60,
          kind: 'autocomplete',
        });
      }
    }
  } else {
    // Suggest testIds and IDs matching the prefix
    for (const el of pageElements) {
      if (el.testId?.toLowerCase().startsWith(lower)) {
        const sel = `[data-testid="${escapeCssAttrValue(el.testId)}"]`;
        results.push({
          selector: sel,
          label: sel,
          description: `data-testid on <${el.tag}>`,
          score: scoreSelector(sel).score,
          kind: 'autocomplete',
        });
      }
      if (el.id?.toLowerCase().startsWith(lower)) {
        const sel = `#${cssEscape(el.id)}`;
        results.push({
          selector: sel,
          label: sel,
          description: `ID on <${el.tag}>`,
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
  if (!selector) return [];

  const results: Suggestion[] = [];

  // Extract value from selector — e.g. [data-testid="foo"] → "foo", #foo → "foo"
  let extractedValue = '';
  const attrMatch = selector.match(/\[[\w-]+=["']?([^"'\]]+)["']?\]/);
  const idMatch = selector.match(/^#([^\s>+~[\\.:#(]+)/);

  if (attrMatch) {
    extractedValue = attrMatch[1];
  } else if (idMatch) {
    extractedValue = idMatch[1].replace(/\\(.)/g, '$1');
  } else {
    extractedValue = selector.replace(/[#.\[\]>+~]/g, '').trim();
  }

  if (!extractedValue) return [];

  // Gather candidates from page elements
  const testIds = pageElements.map((e) => e.testId).filter(Boolean);
  const ids = pageElements.map((e) => e.id).filter(Boolean);
  const ariaLabels = pageElements.map((e) => e.ariaLabel).filter(Boolean);

  const typoTestIds = findTypoCorrections(extractedValue, testIds, 2);
  for (const { candidate } of typoTestIds) {
    const sel = `[data-testid="${escapeCssAttrValue(candidate)}"]`;
    results.push({
      selector: sel,
      label: sel,
      description: `Did you mean data-testid="${candidate}"?`,
      score: scoreSelector(sel).score,
      kind: 'alternative',
    });
  }

  const typoIds = findTypoCorrections(extractedValue, ids, 2);
  for (const { candidate } of typoIds) {
    const sel = `#${cssEscape(candidate)}`;
    results.push({
      selector: sel,
      label: sel,
      description: `Did you mean #${candidate}?`,
      score: scoreSelector(sel).score,
      kind: 'alternative',
    });
  }

  // findAttributeElsewhere for cross-attribute suggestions
  const elsewhere = findAttributeElsewhere(extractedValue, pageElements);
  for (const { element, attribute } of elsewhere.slice(0, 3)) {
    let sel = '';
    if (attribute === 'testId' && element.testId) {
      sel = `[data-testid="${escapeCssAttrValue(element.testId)}"]`;
    } else if (attribute === 'id' && element.id) {
      sel = `#${cssEscape(element.id)}`;
    } else if (attribute === 'ariaLabel' && element.ariaLabel) {
      sel = `[aria-label="${escapeCssAttrValue(element.ariaLabel)}"]`;
    }
    if (sel) {
      results.push({
        selector: sel,
        label: sel,
        description: `Value found in ${attribute} attribute`,
        score: scoreSelector(sel).score,
        kind: 'alternative',
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

  // Unclosed bracket
  const openBrackets = (selector.match(/\[/g) ?? []).length;
  const closeBrackets = (selector.match(/\]/g) ?? []).length;
  if (openBrackets !== closeBrackets) {
    return { valid: false, error: 'Unclosed attribute bracket in selector.' };
  }

  // Unclosed quote
  const doubleQuotes = (selector.match(/"/g) ?? []).length;
  const singleQuotes = (selector.match(/'/g) ?? []).length;
  if (doubleQuotes % 2 !== 0) {
    return { valid: false, error: 'Unclosed double quote in selector.' };
  }
  if (singleQuotes % 2 !== 0) {
    return { valid: false, error: 'Unclosed single quote in selector.' };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const specialist: SelectorSpecialist = {
  format: 'css',
  displayName: 'CSS',
  generate,
  score: scoreSelector,
  warn,
  chain,
  suggest,
  didYouMean,
  validateAndFix,
};
