import type { ElementInfo, ScoredSelector, SelectorFormat } from '@/types';

// ---------------------------------------------------------------------------
// Escaping utilities
// ---------------------------------------------------------------------------

export function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  // Fallback implementation
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
  // Mixed — use concat
  const parts = value.split("'").map((p) => `'${p}'`);
  return `concat(${parts.join(', "\'", ')})`;
}

export function escapeSingleQuoteJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function escapeDoubleQuoteJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// ---------------------------------------------------------------------------
// Dynamic class / ID detection
// ---------------------------------------------------------------------------

const DYNAMIC_CLASS_PATTERNS: RegExp[] = [
  /^css-[a-z0-9]+$/i,
  /^sc-[a-zA-Z]+$/,
  /^_[a-z]+_[a-z0-9]+_/,
  /^[a-z0-9]{5,8}$/, // hash-like short token
  /^jsx-[a-f0-9]+$/,
  /^svelte-[a-z0-9]+$/,
];

export function isDynamicClass(cls: string): boolean {
  return DYNAMIC_CLASS_PATTERNS.some((re) => re.test(cls));
}

function isDynamicId(id: string): boolean {
  // Long hex/UUID-like strings
  if (/^[a-f0-9-]{20,}$/i.test(id)) return true;
  // React useId pattern :r0:, :r1a:, etc.
  if (/^:r[0-9a-z]+:$/.test(id)) return true;
  // Contains 4+ consecutive digits
  if (/\d{4,}/.test(id)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Semantic tags
// ---------------------------------------------------------------------------

const SEMANTIC_TAGS = new Set([
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'form',
  'nav',
  'main',
  'header',
  'footer',
  'article',
  'section',
  'aside',
  'dialog',
  'table',
  'img',
  'video',
  'audio',
  'label',
  'fieldset',
  'legend',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
]);

// ---------------------------------------------------------------------------
// Score factors interface
// ---------------------------------------------------------------------------

interface ScoreFactors {
  hasTestId: boolean;
  hasId: boolean;
  idLooksDynamic: boolean;
  hasRole: boolean;
  hasAccessibleName: boolean;
  hasAriaLabel: boolean;
  isShort: boolean;
  isSemanticTag: boolean;
  isDeepNested: boolean;
  usesNthChild: boolean;
  usesDynamicClass: boolean;
  usesIndexPosition: boolean;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function computeScore(factors: ScoreFactors): number {
  let score = 50;

  if (factors.hasTestId) score += 40;
  if (factors.hasId && !factors.idLooksDynamic) score += 35;
  if (factors.hasRole && factors.hasAccessibleName) score += 30;
  if (factors.hasAriaLabel) score += 25;
  if (factors.isShort) score += 15;
  if (factors.isSemanticTag) score += 10;

  if (factors.isDeepNested) score -= 20;
  if (factors.usesNthChild) score -= 15;
  if (factors.usesDynamicClass) score -= 25;
  if (factors.usesIndexPosition) score -= 15;

  return Math.max(0, Math.min(100, score));
}

function buildWarnings(factors: ScoreFactors): string[] {
  const warnings: string[] = [];
  if (factors.usesDynamicClass) {
    warnings.push('Uses dynamically generated class names that may change between builds.');
  }
  if (factors.idLooksDynamic) {
    warnings.push('ID appears to be auto-generated and may not be stable across page loads.');
  }
  if (factors.isDeepNested) {
    warnings.push('Selector is deeply nested; DOM structure changes may break it.');
  }
  if (factors.usesNthChild) {
    warnings.push('nth-child/nth-of-type positioning is fragile if sibling order changes.');
  }
  if (factors.usesIndexPosition) {
    warnings.push('Index-based positioning makes the selector sensitive to reordering.');
  }
  return warnings;
}

// ---------------------------------------------------------------------------
// Selector text analysis (for scoreSelector)
// ---------------------------------------------------------------------------

function analyzeSelector(selector: string, format: SelectorFormat): ScoreFactors {
  const s = selector;
  const hasTestId = /data-testid|data-test/.test(s);
  const hasId =
    format === 'css'
      ? /^#[^\s>+~[]+/.test(s) || /\[id=/.test(s)
      : /\[@id=/.test(s) || /getByTestId|getById/.test(s);
  const idMatch = s.match(/(?:^#|id=["']?)([^"'\]\s>+~[]+)/);
  const idLooksDynamic = hasId && idMatch ? isDynamicId(idMatch[1]) : false;
  const hasRole = /\[role=|getByRole|by\.role/.test(s);
  const hasAriaLabel = /aria-label/.test(s);
  const hasAccessibleName = /aria-label|getByRole|getByText/.test(s);

  // Count combinator depth (spaces, >, +, ~)
  const combinatorCount = (s.match(/[\s>+~]/g) ?? []).length;
  const isShort = combinatorCount <= 2;
  const isDeepNested = combinatorCount > 3;

  // Tag heuristic: first segment is a semantic tag
  const firstTag = s.match(/^([a-z][a-z0-9]*)[\s\[.#:>+~(]|^([a-z][a-z0-9]*)$/i);
  const tagName = (firstTag?.[1] ?? firstTag?.[2] ?? '').toLowerCase();
  const isSemanticTag = SEMANTIC_TAGS.has(tagName);

  const usesNthChild = /nth-child|nth-of-type/.test(s);
  const usesIndexPosition = /\[\d+\]|:eq\(|\.eq\(/.test(s);

  // Check for dynamic classes
  let usesDynamicClass = false;
  const classMatches = s.match(/\.([a-zA-Z0-9_-]+)/g) ?? [];
  for (const cm of classMatches) {
    if (isDynamicClass(cm.slice(1))) {
      usesDynamicClass = true;
      break;
    }
  }

  return {
    hasTestId,
    hasId,
    idLooksDynamic,
    hasRole,
    hasAccessibleName,
    hasAriaLabel,
    isShort,
    isSemanticTag,
    isDeepNested,
    usesNthChild,
    usesDynamicClass,
    usesIndexPosition,
  };
}

// ---------------------------------------------------------------------------
// CSS generator
// ---------------------------------------------------------------------------

function generateCssSelectors(element: ElementInfo): ScoredSelector[] {
  const { tagName, attributes } = element;
  const tag = tagName.toLowerCase();
  const results: ScoredSelector[] = [];

  const add = (selector: string) => {
    results.push(scored(selector, 'css'));
  };

  // By data-testid
  const testid = attributes['data-testid'];
  if (testid) add(`[data-testid="${escapeCssAttrValue(testid)}"]`);

  // By data-test
  const dataTest = attributes['data-test'];
  if (dataTest) add(`[data-test="${escapeCssAttrValue(dataTest)}"]`);

  // By id
  const id = attributes.id;
  if (id && !id.includes(' ')) add(`#${cssEscape(id)}`);

  // By aria-label
  const ariaLabel = attributes['aria-label'];
  if (ariaLabel) add(`[aria-label="${escapeCssAttrValue(ariaLabel)}"]`);

  // By role
  const role = attributes.role;
  if (role) {
    if (ariaLabel) {
      add(`[role="${escapeCssAttrValue(role)}"][aria-label="${escapeCssAttrValue(ariaLabel)}"]`);
    } else {
      add(`[role="${escapeCssAttrValue(role)}"]`);
    }
  }

  // By name attribute (inputs, etc.)
  const name = attributes.name;
  if (name) add(`${tag}[name="${escapeCssAttrValue(name)}"]`);

  // By type + value (e.g. input[type="submit"][value="..."])
  const type = attributes.type;
  const value = attributes.value;
  if (type && value && tag === 'input') {
    add(`${tag}[type="${escapeCssAttrValue(type)}"][value="${escapeCssAttrValue(value)}"]`);
  }

  // By class (non-dynamic only)
  const className = attributes.class;
  if (className) {
    const classes = className.split(/\s+/).filter((c) => c && !isDynamicClass(c));
    if (classes.length > 0) {
      add(`${tag}.${classes.map(cssEscape).join('.')}`);
    }
  }

  // Fallback: tag only
  add(tag);

  return results;
}

// ---------------------------------------------------------------------------
// XPath generator
// ---------------------------------------------------------------------------

function generateXpathSelectors(element: ElementInfo): ScoredSelector[] {
  const { tagName, attributes, text } = element;
  const tag = tagName.toLowerCase();
  const results: ScoredSelector[] = [];

  const add = (selector: string) => {
    results.push(scored(selector, 'xpath'));
  };

  // By data-testid
  const testid = attributes['data-testid'];
  if (testid) add(`//${tag}[@data-testid=${escapeXPathValue(testid)}]`);

  const dataTest = attributes['data-test'];
  if (dataTest) add(`//${tag}[@data-test=${escapeXPathValue(dataTest)}]`);

  // By id
  const id = attributes.id;
  if (id && !id.includes(' ')) add(`//*[@id=${escapeXPathValue(id)}]`);

  // By aria-label
  const ariaLabel = attributes['aria-label'];
  if (ariaLabel) add(`//${tag}[@aria-label=${escapeXPathValue(ariaLabel)}]`);

  // By role
  const role = attributes.role;
  if (role) add(`//${tag}[@role=${escapeXPathValue(role)}]`);

  // By name
  const name = attributes.name;
  if (name) add(`//${tag}[@name=${escapeXPathValue(name)}]`);

  // By visible text (short text only)
  const trimmed = text?.trim();
  if (trimmed && trimmed.length > 0 && trimmed.length <= 50) {
    add(`//${tag}[normalize-space(text())=${escapeXPathValue(trimmed)}]`);
  }

  // Fallback: tag only
  add(`//${tag}`);

  return results;
}

// ---------------------------------------------------------------------------
// Playwright generator
// ---------------------------------------------------------------------------

function generatePlaywrightSelectors(element: ElementInfo): ScoredSelector[] {
  const { tagName, attributes, text } = element;
  const tag = tagName.toLowerCase();
  const results: ScoredSelector[] = [];

  const add = (selector: string) => {
    results.push(scored(selector, 'playwright'));
  };

  // By test id
  const testid = attributes['data-testid'];
  if (testid) add(`page.getByTestId('${escapeSingleQuoteJs(testid)}')`);

  const dataTest = attributes['data-test'];
  if (dataTest) add(`page.locator('[data-test="${escapeDoubleQuoteJs(dataTest)}"]')`);

  // By role + name
  const role = attributes.role;
  const ariaLabel = attributes['aria-label'];
  const trimmed = text?.trim();

  if (role) {
    if (ariaLabel) {
      add(
        `page.getByRole('${escapeSingleQuoteJs(role)}', { name: '${escapeSingleQuoteJs(ariaLabel)}' })`
      );
    } else if (trimmed && trimmed.length <= 50) {
      add(
        `page.getByRole('${escapeSingleQuoteJs(role)}', { name: '${escapeSingleQuoteJs(trimmed)}' })`
      );
    } else {
      add(`page.getByRole('${escapeSingleQuoteJs(role)}')`);
    }
  }

  // Semantic role inference
  const inferredRole: Record<string, string> = {
    button: 'button',
    a: 'link',
    input: 'textbox',
    select: 'combobox',
    textarea: 'textbox',
    nav: 'navigation',
    main: 'main',
    dialog: 'dialog',
  };
  const ir = inferredRole[tag];
  if (ir && !role) {
    if (ariaLabel) {
      add(`page.getByRole('${ir}', { name: '${escapeSingleQuoteJs(ariaLabel)}' })`);
    } else if (trimmed && trimmed.length <= 50) {
      add(`page.getByRole('${ir}', { name: '${escapeSingleQuoteJs(trimmed)}' })`);
    }
  }

  // By aria-label
  if (ariaLabel) add(`page.getByLabel('${escapeSingleQuoteJs(ariaLabel)}')`);

  // By placeholder
  const placeholder = attributes.placeholder;
  if (placeholder) add(`page.getByPlaceholder('${escapeSingleQuoteJs(placeholder)}')`);

  // By alt (images)
  const alt = attributes.alt;
  if (alt) add(`page.getByAltText('${escapeSingleQuoteJs(alt)}')`);

  // By text
  if (trimmed && trimmed.length > 0 && trimmed.length <= 50) {
    add(`page.getByText('${escapeSingleQuoteJs(trimmed)}')`);
  }

  // By CSS locator
  const id = attributes.id;
  if (id && !id.includes(' ')) add(`page.locator('#${cssEscape(id)}')`);

  return results;
}

// ---------------------------------------------------------------------------
// Cypress generator
// ---------------------------------------------------------------------------

function generateCypressSelectors(element: ElementInfo): ScoredSelector[] {
  const { tagName, attributes, text } = element;
  const tag = tagName.toLowerCase();
  const results: ScoredSelector[] = [];

  const add = (selector: string) => {
    results.push(scored(selector, 'cypress'));
  };

  // By data-testid (Cypress best practice)
  const testid = attributes['data-testid'];
  if (testid) add(`cy.get('[data-testid="${escapeDoubleQuoteJs(testid)}"]')`);

  const dataTest = attributes['data-test'];
  if (dataTest) add(`cy.get('[data-test="${escapeDoubleQuoteJs(dataTest)}"]')`);

  // By id
  const id = attributes.id;
  if (id && !id.includes(' ')) add(`cy.get('#${cssEscape(id)}')`);

  // By aria-label
  const ariaLabel = attributes['aria-label'];
  if (ariaLabel) add(`cy.get('[aria-label="${escapeDoubleQuoteJs(ariaLabel)}"]')`);

  // By role
  const role = attributes.role;
  if (role) {
    if (ariaLabel) {
      add(
        `cy.get('[role="${escapeDoubleQuoteJs(role)}"][aria-label="${escapeDoubleQuoteJs(ariaLabel)}"]')`
      );
    } else {
      add(`cy.get('[role="${escapeDoubleQuoteJs(role)}"]')`);
    }
  }

  // By name
  const name = attributes.name;
  if (name) add(`cy.get('${tag}[name="${escapeDoubleQuoteJs(name)}"]')`);

  // By visible text (contains)
  const trimmed = text?.trim();
  if (trimmed && trimmed.length > 0 && trimmed.length <= 50) {
    add(`cy.contains('${escapeSingleQuoteJs(trimmed)}')`);
  }

  // Fallback CSS
  add(`cy.get('${tag}')`);

  return results;
}

// ---------------------------------------------------------------------------
// Selenium generator
// ---------------------------------------------------------------------------

function generateSeleniumSelectors(element: ElementInfo): ScoredSelector[] {
  const { tagName, attributes, text } = element;
  const tag = tagName.toLowerCase();
  const results: ScoredSelector[] = [];

  const add = (selector: string) => {
    results.push(scored(selector, 'selenium'));
  };

  // By data-testid (CSS)
  const testid = attributes['data-testid'];
  if (testid) add(`driver.findElement(By.css('[data-testid="${escapeDoubleQuoteJs(testid)}"]'))`);

  const dataTest = attributes['data-test'];
  if (dataTest) add(`driver.findElement(By.css('[data-test="${escapeDoubleQuoteJs(dataTest)}"]'))`);

  // By id
  const id = attributes.id;
  if (id && !id.includes(' ')) add(`driver.findElement(By.id('${escapeSingleQuoteJs(id)}'))`);

  // By name
  const name = attributes.name;
  if (name) add(`driver.findElement(By.name('${escapeSingleQuoteJs(name)}'))`);

  // By aria-label (CSS)
  const ariaLabel = attributes['aria-label'];
  if (ariaLabel)
    add(`driver.findElement(By.css('[aria-label="${escapeDoubleQuoteJs(ariaLabel)}"]'))`);

  // By role (XPath)
  const role = attributes.role;
  if (role) add(`driver.findElement(By.xpath('//${tag}[@role=${escapeXPathValue(role)}]'))`);

  // By text (XPath)
  const trimmed = text?.trim();
  if (trimmed && trimmed.length > 0 && trimmed.length <= 50) {
    add(
      `driver.findElement(By.xpath('//${tag}[normalize-space(text())=${escapeXPathValue(trimmed)}]'))`
    );
  }

  // Fallback tag (CSS)
  add(`driver.findElement(By.tagName('${escapeSingleQuoteJs(tag)}'))`);

  return results;
}

// ---------------------------------------------------------------------------
// Helper: create a scored selector from a raw string
// ---------------------------------------------------------------------------

function scored(selector: string, format: SelectorFormat): ScoredSelector {
  const factors = analyzeSelector(selector, format);
  const score = computeScore(factors);
  const warnings = buildWarnings(factors);
  return { selector, format, score, warnings };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates all selector strategies for the given element across all 5 formats,
 * scores them, deduplicates, and returns them sorted by score descending.
 */
export function generateScoredSelectors(element: ElementInfo): ScoredSelector[] {
  const all: ScoredSelector[] = [
    ...generateCssSelectors(element),
    ...generateXpathSelectors(element),
    ...generatePlaywrightSelectors(element),
    ...generateCypressSelectors(element),
    ...generateSeleniumSelectors(element),
  ];

  // Deduplicate by selector string within each format
  const seen = new Set<string>();
  const deduped = all.filter((s) => {
    const key = `${s.format}::${s.selector}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by score descending
  return deduped.sort((a, b) => b.score - a.score);
}

/**
 * Scores a single existing selector string by analysing its text.
 */
export function scoreSelector(selector: string, format: SelectorFormat): ScoredSelector {
  return scored(selector, format);
}

/**
 * Extract a testable CSS/XPath selector from any framework-specific locator.
 * Returns { selector, selectorType } or null if extraction fails.
 */
export function extractTestable(
  locator: string,
  format: SelectorFormat
): { selector: string; selectorType: 'css' | 'xpath' } | null {
  if (format === 'css') return { selector: locator, selectorType: 'css' };
  if (format === 'xpath') return { selector: locator, selectorType: 'xpath' };

  if (format === 'playwright') {
    const locMatch = locator.match(/page\.locator\((['"`])(.*?)\1\)/);
    if (locMatch) return { selector: locMatch[2], selectorType: 'css' };

    const testIdMatch = locator.match(/page\.getByTestId\((['"`])(.*?)\1\)/);
    if (testIdMatch) return { selector: `[data-testid="${testIdMatch[2]}"]`, selectorType: 'css' };

    const roleMatch = locator.match(/page\.getByRole\((['"`])(.*?)\1/);
    if (roleMatch) return { selector: `[role="${roleMatch[2]}"]`, selectorType: 'css' };

    const textMatch = locator.match(/page\.getByText\((['"`])(.*?)\1/);
    if (textMatch)
      return { selector: `//*[contains(text(),"${textMatch[2]}")]`, selectorType: 'xpath' };

    const labelMatch = locator.match(/page\.getByLabel\((['"`])(.*?)\1/);
    if (labelMatch) return { selector: `[aria-label="${labelMatch[2]}"]`, selectorType: 'css' };

    const phMatch = locator.match(/page\.getByPlaceholder\((['"`])(.*?)\1/);
    if (phMatch) return { selector: `[placeholder="${phMatch[2]}"]`, selectorType: 'css' };

    const altMatch = locator.match(/page\.getByAltText\((['"`])(.*?)\1/);
    if (altMatch) return { selector: `[alt="${altMatch[2]}"]`, selectorType: 'css' };

    const titleMatch = locator.match(/page\.getByTitle\((['"`])(.*?)\1/);
    if (titleMatch) return { selector: `[title="${titleMatch[2]}"]`, selectorType: 'css' };

    return null;
  }

  if (format === 'cypress') {
    const getMatch = locator.match(/cy\.get\((['"`])(.*?)\1\)/);
    if (getMatch) return { selector: getMatch[2], selectorType: 'css' };

    const containsTagMatch = locator.match(/cy\.contains\((['"`])(.*?)\1,\s*(['"`])(.*?)\3\)/);
    if (containsTagMatch)
      return {
        selector: `//${containsTagMatch[2]}[contains(text(),"${containsTagMatch[4]}")]`,
        selectorType: 'xpath',
      };

    const containsMatch = locator.match(/cy\.contains\((['"`])(.*?)\1\)/);
    if (containsMatch)
      return { selector: `//*[contains(text(),"${containsMatch[2]}")]`, selectorType: 'xpath' };

    const roleMatch = locator.match(/cy\.findByRole\((['"`])(.*?)\1/);
    if (roleMatch) return { selector: `[role="${roleMatch[2]}"]`, selectorType: 'css' };

    const textMatch = locator.match(/cy\.findByText\((['"`])(.*?)\1/);
    if (textMatch)
      return { selector: `//*[contains(text(),"${textMatch[2]}")]`, selectorType: 'xpath' };

    const testIdMatch = locator.match(/cy\.findByTestId\((['"`])(.*?)\1/);
    if (testIdMatch) return { selector: `[data-testid="${testIdMatch[2]}"]`, selectorType: 'css' };

    return null;
  }

  if (format === 'selenium') {
    const cssMatch = locator.match(/By\.cssSelector\((['"`])(.*?)\1\)/);
    if (cssMatch) return { selector: cssMatch[2], selectorType: 'css' };

    const xpathMatch = locator.match(/By\.xpath\((['"`])(.*?)\1\)/);
    if (xpathMatch) return { selector: xpathMatch[2], selectorType: 'xpath' };

    const idMatch = locator.match(/By\.id\((['"`])(.*?)\1\)/);
    if (idMatch) return { selector: `#${idMatch[2]}`, selectorType: 'css' };

    const nameMatch = locator.match(/By\.name\((['"`])(.*?)\1\)/);
    if (nameMatch) return { selector: `[name="${nameMatch[2]}"]`, selectorType: 'css' };

    const classMatch = locator.match(/By\.className\((['"`])(.*?)\1\)/);
    if (classMatch) return { selector: `.${classMatch[2]}`, selectorType: 'css' };

    const tagMatch = locator.match(/By\.tagName\((['"`])(.*?)\1\)/);
    if (tagMatch) return { selector: tagMatch[2], selectorType: 'css' };

    const linkMatch = locator.match(/By\.linkText\((['"`])(.*?)\1\)/);
    if (linkMatch) return { selector: `//a[text()="${linkMatch[2]}"]`, selectorType: 'xpath' };

    const partialMatch = locator.match(/By\.partialLinkText\((['"`])(.*?)\1\)/);
    if (partialMatch)
      return { selector: `//a[contains(text(),"${partialMatch[2]}")]`, selectorType: 'xpath' };

    return null;
  }

  return null;
}
