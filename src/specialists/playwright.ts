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

import { computeAccessibleName, getHeadingLevel, getInferredRole } from './helpers/aria';
import { findScopingAncestor } from './helpers/chaining';
import { cssEscape, escapeSingleQuoteJs } from './helpers/escaping';

// ---------------------------------------------------------------------------
// Known ARIA roles (for validation)
// ---------------------------------------------------------------------------

const VALID_ARIA_ROLES = new Set([
  'alert',
  'alertdialog',
  'application',
  'article',
  'banner',
  'blockquote',
  'button',
  'caption',
  'cell',
  'checkbox',
  'code',
  'columnheader',
  'combobox',
  'complementary',
  'contentinfo',
  'definition',
  'deletion',
  'dialog',
  'directory',
  'document',
  'emphasis',
  'feed',
  'figure',
  'form',
  'generic',
  'grid',
  'gridcell',
  'group',
  'heading',
  'img',
  'insertion',
  'link',
  'list',
  'listbox',
  'listitem',
  'log',
  'main',
  'marquee',
  'math',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'meter',
  'navigation',
  'none',
  'note',
  'option',
  'paragraph',
  'presentation',
  'progressbar',
  'radio',
  'radiogroup',
  'region',
  'row',
  'rowgroup',
  'rowheader',
  'scrollbar',
  'search',
  'searchbox',
  'separator',
  'slider',
  'spinbutton',
  'status',
  'strong',
  'subscript',
  'superscript',
  'switch',
  'tab',
  'table',
  'tablist',
  'tabpanel',
  'term',
  'textbox',
  'time',
  'timer',
  'toolbar',
  'tooltip',
  'tree',
  'treegrid',
  'treeitem',
]);

// Valid option keys for getByRole
const VALID_ROLE_OPTIONS = new Set([
  'name',
  'exact',
  'checked',
  'disabled',
  'expanded',
  'includeHidden',
  'level',
  'pressed',
  'selected',
]);

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

/** Build options object string for getByRole. */
function buildRoleOptions(element: RichElementData, accessName: string): string {
  const tag = element.tagName.toLowerCase();
  const attrs = element.attributes;
  const opts: string[] = [];

  if (accessName) opts.push(`name: '${escapeSingleQuoteJs(accessName)}'`);

  // heading level
  const level = getHeadingLevel(tag, attrs);
  if (level) opts.push(`level: ${level}`);

  // state options — only add if explicitly set in attributes.
  // checked / pressed accept the tristate value "mixed"; Playwright maps it to "mixed".
  const checked = attrs['aria-checked'];
  if (checked === 'true' || checked === 'false') opts.push(`checked: ${checked}`);
  else if (checked === 'mixed') opts.push(`checked: 'mixed'`);
  if (attrs['aria-disabled'] === 'true') opts.push('disabled: true');
  const expanded = attrs['aria-expanded'];
  if (expanded === 'true' || expanded === 'false') opts.push(`expanded: ${expanded}`);
  const pressed = attrs['aria-pressed'];
  if (pressed === 'true' || pressed === 'false') opts.push(`pressed: ${pressed}`);
  else if (pressed === 'mixed') opts.push(`pressed: 'mixed'`);
  const selected = attrs['aria-selected'];
  if (selected === 'true' || selected === 'false') opts.push(`selected: ${selected}`);
  // checked state from native checkbox/radio
  if (
    tag === 'input' &&
    (attrs.type === 'checkbox' || attrs.type === 'radio') &&
    attrs.checked !== undefined
  ) {
    if (!opts.some((o) => o.startsWith('checked'))) {
      opts.push('checked: true');
    }
  }
  // disabled from native attribute
  if (attrs.disabled !== undefined && !opts.some((o) => o.startsWith('disabled'))) {
    opts.push('disabled: true');
  }

  if (opts.length === 0) return '';
  return `{ ${opts.join(', ')} }`;
}

/**
 * Build the element-part of a Playwright locator (without the `page.` prefix).
 * Used for chained selectors where the ancestor is scoped separately.
 * Returns empty string if no useful semantic locator could be produced.
 */
function buildElementPart(element: RichElementData, semanticOnly: boolean): string {
  const { tagName, attributes, text, accessibleName } = element;
  const tag = tagName.toLowerCase();
  const accessName = accessibleName || computeAccessibleName(attributes, text);
  const role = attributes.role || getInferredRole(tag, attributes);

  if (attributes['data-testid']) {
    return `getByTestId('${escapeSingleQuoteJs(attributes['data-testid'])}')`;
  }
  if (role) {
    const opts = buildRoleOptions(element, accessName);
    return opts
      ? `getByRole('${escapeSingleQuoteJs(role)}', ${opts})`
      : `getByRole('${escapeSingleQuoteJs(role)}')`;
  }
  if (attributes['aria-label']) {
    return `getByLabel('${escapeSingleQuoteJs(attributes['aria-label'])}', { exact: true })`;
  }
  if (attributes.placeholder) {
    return `getByPlaceholder('${escapeSingleQuoteJs(attributes.placeholder)}', { exact: true })`;
  }
  if (semanticOnly) return '';
  return `locator('${cssEscape(tag)}')`;
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

  // 3. Explicit role with options
  const explicitRole = attributes.role;
  const accessName = accessibleName || computeAccessibleName(attributes, text);

  if (explicitRole) {
    const opts = buildRoleOptions(element, accessName);
    if (opts) {
      add(`page.getByRole('${escapeSingleQuoteJs(explicitRole)}', ${opts})`);
    } else {
      add(`page.getByRole('${escapeSingleQuoteJs(explicitRole)}')`);
    }
  }

  // 4. Inferred role with options (only if no explicit role)
  if (!explicitRole) {
    const inferredRole = getInferredRole(tag, attributes);
    if (inferredRole) {
      const opts = buildRoleOptions(element, accessName);
      if (opts) {
        add(`page.getByRole('${escapeSingleQuoteJs(inferredRole)}', ${opts})`);
      } else {
        add(`page.getByRole('${escapeSingleQuoteJs(inferredRole)}')`);
      }
    }
  }

  // 5. getByLabel (aria-label) — with exact
  const ariaLabel = attributes['aria-label'];
  if (ariaLabel) {
    add(`page.getByLabel('${escapeSingleQuoteJs(ariaLabel)}', { exact: true })`);
  }

  // 6. getByPlaceholder — with exact
  const placeholder = attributes.placeholder;
  if (placeholder) {
    add(`page.getByPlaceholder('${escapeSingleQuoteJs(placeholder)}', { exact: true })`);
  }

  // 7. getByAltText — with exact
  const alt = attributes.alt;
  if (alt) {
    add(`page.getByAltText('${escapeSingleQuoteJs(alt)}', { exact: true })`);
  }

  // 8. getByTitle — with exact
  const title = attributes.title;
  if (title) {
    add(`page.getByTitle('${escapeSingleQuoteJs(title)}', { exact: true })`);
  }

  // 9. getByText (text content ≤ 50 chars)
  const trimmedText = text?.trim();
  if (trimmedText && trimmedText.length <= 50 && trimmedText.length > 0) {
    add(`page.getByText('${escapeSingleQuoteJs(trimmedText)}', { exact: true })`);
  }

  // 10. CSS ID fallback via locator
  const id = attributes.id;
  if (id && !id.includes(' ')) {
    add(`page.locator('#${cssEscape(id)}')`);
  }

  // 11. Chained locator scoped by the nearest identifiable ancestor.
  if (element.parentChain?.length) {
    const ancestor = findScopingAncestor(element.parentChain);
    const childPart = buildElementPart(element, /* semanticOnly */ true);
    if (ancestor && childPart) {
      add(`page.locator('${ancestor.selector}').${childPart}`);
    }
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
    const hasLevel = /level\s*:/.test(selector);
    const hasState = /(?:checked|disabled|expanded|pressed|selected)\s*:/.test(selector);
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
    if (hasLevel) {
      factors.push({
        name: 'hasLevel',
        impact: 5,
        description: 'Level option distinguishes heading hierarchy.',
      });
      score += 5;
    }
    if (hasState) {
      factors.push({
        name: 'hasState',
        impact: 3,
        description: 'State option narrows match to specific element state.',
      });
      score += 3;
    }
  }

  if (/getByLabel\(/.test(selector)) {
    const hasExact = /exact\s*:\s*true/.test(selector);
    factors.push({
      name: 'getByLabel',
      impact: hasExact ? 32 : 30,
      description: hasExact
        ? 'Uses getByLabel with exact match — tied to accessible label.'
        : 'Uses getByLabel — tied to accessible label.',
    });
    score += hasExact ? 32 : 30;
  }

  if (/getByPlaceholder\(/.test(selector)) {
    const hasExact = /exact\s*:\s*true/.test(selector);
    factors.push({
      name: 'getByPlaceholder',
      impact: hasExact ? 27 : 25,
      description: hasExact
        ? 'Uses getByPlaceholder with exact match.'
        : 'Uses getByPlaceholder — reasonable for inputs.',
    });
    score += hasExact ? 27 : 25;
  }

  if (/getByAltText\(/.test(selector)) {
    const hasExact = /exact\s*:\s*true/.test(selector);
    factors.push({
      name: 'getByAltText',
      impact: hasExact ? 28 : 25,
      description: hasExact
        ? 'Uses getByAltText with exact match.'
        : 'Uses getByAltText — good for images.',
    });
    score += hasExact ? 28 : 25;
  }

  if (/getByTitle\(/.test(selector)) {
    const hasExact = /exact\s*:\s*true/.test(selector);
    factors.push({
      name: 'getByTitle',
      impact: hasExact ? 22 : 20,
      description: hasExact
        ? 'Uses getByTitle with exact match.'
        : 'Uses getByTitle — title attribute can be volatile.',
    });
    score += hasExact ? 22 : 20;
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

  if (/\.first\(\)/.test(selector)) {
    factors.push({
      name: 'usesFirst',
      impact: -10,
      description: '.first() selects first match — fragile if order changes.',
    });
    score -= 10;
  }

  if (/\.last\(\)/.test(selector)) {
    factors.push({
      name: 'usesLast',
      impact: -10,
      description: '.last() selects last match — fragile if order changes.',
    });
    score -= 10;
  }

  if (/\.filter\(/.test(selector)) {
    const hasText = /hasText\s*:/.test(selector);
    const hasLocator = /has\s*:/.test(selector) && !/hasText|hasNot/.test(selector);
    factors.push({
      name: 'usesFilter',
      impact: hasText || hasLocator ? 8 : 5,
      description: '.filter() chaining narrows the match.',
    });
    score += hasText || hasLocator ? 8 : 5;
  }

  if (/\.and\(/.test(selector)) {
    factors.push({
      name: 'usesAnd',
      impact: 5,
      description: '.and() intersects two locators for precision.',
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
  const tag = element.tagName.toLowerCase();

  // locator() with a CSS class selector
  if (/locator\(\s*['"][^'"]*\.[a-zA-Z]/.test(selector)) {
    const role = attributes.role || getInferredRole(tag, attributes);
    const name = accessibleName || computeAccessibleName(attributes, text);
    let fix: ActionableWarning['fix'] | undefined;

    if (role && name) {
      fix = {
        label: 'Use getByRole instead',
        selector: `page.getByRole('${escapeSingleQuoteJs(role)}', { name: '${escapeSingleQuoteJs(name)}' })`,
      };
    } else if (role) {
      fix = {
        label: 'Use getByRole instead',
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
      const roleMatch = selector.match(/getByRole\(\s*['"]([^'"]+)['"]/);
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

  // getByRole('heading') without level
  const headingMatch = selector.match(/getByRole\(\s*['"]heading['"]/);
  if (headingMatch && !/level\s*:/.test(selector)) {
    const level = getHeadingLevel(tag, attributes);
    let fix: ActionableWarning['fix'] | undefined;

    if (level) {
      fix = {
        label: `Add level: ${level}`,
        selector: selector.replace(
          /getByRole\(\s*['"]heading['"]\s*(?:,\s*\{([^}]*)\})?\s*\)/,
          (_m, opts) => {
            const existingOpts = opts ? `${opts.trim()}, ` : '';
            return `getByRole('heading', { ${existingOpts}level: ${level} })`;
          }
        ),
      };
    }

    warnings.push({
      message:
        "getByRole('heading') without { level } matches all h1-h6. Add level to target a specific heading.",
      severity: 'warning',
      fix,
    });
  }

  // Invalid role name
  const roleNameMatch = selector.match(/getByRole\(\s*['"]([^'"]+)['"]/);
  if (roleNameMatch && !VALID_ARIA_ROLES.has(roleNameMatch[1])) {
    warnings.push({
      message: `Unknown ARIA role "${roleNameMatch[1]}". This may not match any elements.`,
      severity: 'error',
    });
  }

  // getByText without exact
  if (/getByText\(/.test(selector) && !/exact\s*:\s*true/.test(selector)) {
    const textMatch = selector.match(/getByText\(\s*['"]([^'"]+)['"]/);
    const textVal = textMatch ? textMatch[1] : '';
    let fix: ActionableWarning['fix'] | undefined;

    if (textVal) {
      fix = {
        label: 'Use exact match',
        selector: selector.replace(
          /getByText\(\s*(['"])([^'"]+)\1\s*\)/,
          `getByText($1$2$1, { exact: true })`
        ),
      };
    }

    warnings.push({
      message: 'getByText without { exact: true } may match partial text and be too broad.',
      severity: 'info',
      fix,
    });
  }

  // getByText with very short text (≤2 chars) — very fragile
  const shortTextMatch = selector.match(/getByText\(\s*['"]([^'"]{1,2})['"]/);
  if (shortTextMatch) {
    warnings.push({
      message: `getByText with very short text "${shortTextMatch[1]}" is fragile — likely to match unintended elements.`,
      severity: 'warning',
    });
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// chain
// ---------------------------------------------------------------------------

function chain(element: RichElementData, matchCount: number): ScoredSelector[] {
  const { text, parentChain } = element;
  const results: ScoredSelector[] = [];
  const elementPart = buildElementPart(element, /* semanticOnly */ false);

  // Scoped by ancestor
  const ancestor = findScopingAncestor(parentChain);
  if (ancestor) {
    const sel = `page.locator('${ancestor.selector}').${elementPart}`;
    const s = scoreSelector(sel);
    results.push(buildScoredSelector(sel, Math.min(100, s.score + 5)));
  }

  // Variants for disambiguating when multiple elements match
  if (matchCount > 1) {
    const baseSel = `page.${elementPart}.first()`;
    const s = scoreSelector(baseSel);
    results.push(buildScoredSelector(baseSel, s.score));

    const trimmedText = text?.trim();
    if (trimmedText && trimmedText.length <= 50) {
      const filterSel = `page.${elementPart}.filter({ hasText: '${escapeSingleQuoteJs(trimmedText)}' })`;
      const fs = scoreSelector(filterSel);
      results.push(buildScoredSelector(filterSel, Math.min(100, fs.score + 3)));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// suggest
// ---------------------------------------------------------------------------

function suggest(partial: string, pageData: RichPageData): Suggestion[] {
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
          selectorType: 'role',
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
      'searchbox',
      'slider',
      'spinbutton',
      'switch',
      'progressbar',
      'alertdialog',
      'alert',
      'table',
      'row',
      'cell',
      'columnheader',
      'rowheader',
      'toolbar',
      'tooltip',
      'tree',
      'treeitem',
      'grid',
      'gridcell',
      'separator',
      'option',
      'group',
      'region',
      'form',
      'status',
      'banner',
      'contentinfo',
      'complementary',
      'main',
      'article',
      'figure',
    ];
    for (const r of roles) {
      if (r.startsWith(rolePrefix)) {
        results.push({
          selector: `page.getByRole('${r}')`,
          label: `'${r}'`,
          description: `ARIA role: ${r}`,
          score: 75,
          kind: 'autocomplete',
          selectorType: 'role',
        });
      }
    }
    return results.slice(0, 10);
  }

  // Suggest chaining methods after a closing paren + dot
  if (/\)\.\s*$/.test(partial) || /\)\.[a-z]*$/i.test(partial)) {
    const chainPrefix = partial.match(/\)\.([a-z]*)$/i)?.[1]?.toLowerCase() ?? '';
    const chainMethods = [
      {
        method: 'filter',
        template: ".filter({ hasText: '' })",
        desc: 'Filter by text content or child locator',
        score: 80,
      },
      {
        method: 'first',
        template: '.first()',
        desc: 'Select first matching element',
        score: 70,
      },
      {
        method: 'last',
        template: '.last()',
        desc: 'Select last matching element',
        score: 70,
      },
      {
        method: 'nth',
        template: '.nth(0)',
        desc: 'Select nth matching element (0-based)',
        score: 65,
      },
      {
        method: 'getByRole',
        template: ".getByRole('')",
        desc: 'Find child by ARIA role',
        score: 85,
      },
      {
        method: 'getByText',
        template: ".getByText('', { exact: true })",
        desc: 'Find child by text content',
        score: 75,
      },
      {
        method: 'getByTestId',
        template: ".getByTestId('')",
        desc: 'Find child by test ID',
        score: 90,
      },
      {
        method: 'locator',
        template: ".locator('')",
        desc: 'Find child by CSS/XPath',
        score: 60,
      },
      {
        method: 'and',
        template: ".and(page.locator(''))",
        desc: 'Intersect with another locator',
        score: 70,
      },
      {
        method: 'or',
        template: ".or(page.locator(''))",
        desc: 'Union with another locator',
        score: 65,
      },
    ];
    const base = partial.replace(/\.[a-z]*$/i, '');
    for (const cm of chainMethods) {
      if (cm.method.toLowerCase().startsWith(chainPrefix)) {
        results.push({
          selector: `${base}${cm.template}`,
          label: cm.template,
          description: cm.desc,
          score: cm.score,
          kind: 'autocomplete',
          selectorType: 'role',
        });
      }
    }
    return results.slice(0, 10);
  }

  // Suggest testIds from page elements
  if (/^page\.getByTestId\(['"]/.test(partial)) {
    const prefix = partial.match(/page\.getByTestId\(['"]([^'"]*)$/)?.[1] ?? '';
    for (const el of pageData.elements) {
      if (el.testId?.toLowerCase().startsWith(prefix.toLowerCase())) {
        const sel = `page.getByTestId('${escapeSingleQuoteJs(el.testId)}')`;
        results.push({
          selector: sel,
          label: sel,
          description: `data-testid on <${el.tag}>`,
          score: scoreSelector(sel).score,
          kind: 'autocomplete',
          selectorType: 'role',
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
  if (!selector || pageData.elements.length === 0) return [];

  const results: Suggestion[] = [];

  // Extract value from getByTestId
  const testIdMatch = selector.match(/getByTestId\(['"]([^'"]+)['"]\)/);
  if (testIdMatch) {
    const searchVal = testIdMatch[1].toLowerCase();
    for (const el of pageData.elements) {
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
          selectorType: 'role',
        });
      }
    }
  }

  return results.slice(0, 5);
}

// ---------------------------------------------------------------------------
// validateAndFix
// ---------------------------------------------------------------------------

// Valid chaining methods that can follow a locator
const VALID_CHAIN_METHODS = new Set([
  'filter',
  'first',
  'last',
  'nth',
  'and',
  'or',
  'locator',
  'getByRole',
  'getByText',
  'getByTestId',
  'getByLabel',
  'getByPlaceholder',
  'getByAltText',
  'getByTitle',
]);

// Valid filter option keys
const VALID_FILTER_OPTIONS = new Set(['has', 'hasNot', 'hasText', 'hasNotText', 'visible']);

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

  // Validate role name in getByRole
  const roleMatch = selector.match(/getByRole\(\s*['"]([^'"]+)['"]/);
  if (roleMatch && !VALID_ARIA_ROLES.has(roleMatch[1])) {
    return {
      valid: false,
      error: `Unknown ARIA role "${roleMatch[1]}". Check spelling or use a valid role.`,
    };
  }

  // Validate option keys in getByRole
  const roleOptsMatch = selector.match(/getByRole\([^)]*\{([^}]*)\}/);
  if (roleOptsMatch) {
    const optKeys = roleOptsMatch[1].match(/(\w+)\s*:/g);
    if (optKeys) {
      for (const raw of optKeys) {
        const key = raw.replace(':', '').trim();
        if (!VALID_ROLE_OPTIONS.has(key)) {
          return {
            valid: false,
            error: `Unknown getByRole option "${key}". Valid options: ${[...VALID_ROLE_OPTIONS].join(', ')}.`,
          };
        }
      }
    }
  }

  // Validate chained methods
  const chainMatches = selector.matchAll(/\)\.([a-zA-Z]+)\(/g);
  for (const cm of chainMatches) {
    if (!VALID_CHAIN_METHODS.has(cm[1])) {
      return {
        valid: false,
        error: `Unknown chained method ".${cm[1]}()". Valid: ${[...VALID_CHAIN_METHODS].join(', ')}.`,
      };
    }
  }

  // Validate filter option keys
  const filterOptsMatch = selector.match(/\.filter\(\s*\{([^}]*)\}/);
  if (filterOptsMatch) {
    const optKeys = filterOptsMatch[1].match(/(\w+)\s*:/g);
    if (optKeys) {
      for (const raw of optKeys) {
        const key = raw.replace(':', '').trim();
        if (!VALID_FILTER_OPTIONS.has(key)) {
          return {
            valid: false,
            error: `Unknown filter option "${key}". Valid options: ${[...VALID_FILTER_OPTIONS].join(', ')}.`,
          };
        }
      }
    }
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
