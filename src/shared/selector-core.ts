import type { SelectorFormat } from '@/types';

// ---------------------------------------------------------------------------
// Escaping utilities — re-exported from helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Simple locator generation (one per format)
// ---------------------------------------------------------------------------

export interface SimpleLocators {
  css: string;
  xpath: string;
  playwright: string;
  cypress: string;
  selenium: string;
}

export interface SimpleElementData {
  tagName: string;
  text: string;
  attributes: Record<string, string>;
}

export function generateLocators(el: SimpleElementData): SimpleLocators {
  const tag = el.tagName.toLowerCase();
  const a = el.attributes;
  const tid = a['data-testid'] || a['data-test'];
  const id = a.id;
  const role = a.role;
  const aria = a['aria-label'];
  const name = a.name;
  const cls = a.class;
  const txt = el.text?.trim().substring(0, 50) || '';
  const placeholder = a.placeholder;

  // --- CSS ---
  let css: string;
  if (tid) css = `[data-testid="${escapeCssAttrValue(tid)}"]`;
  else if (id && !id.includes(' ')) css = `#${cssEscape(id)}`;
  else if (role && aria)
    css = `[role="${escapeCssAttrValue(role)}"][aria-label="${escapeCssAttrValue(aria)}"]`;
  else if (aria) css = `[aria-label="${escapeCssAttrValue(aria)}"]`;
  else if (role) css = `[role="${escapeCssAttrValue(role)}"]`;
  else if (name) css = `${tag}[name="${escapeCssAttrValue(name)}"]`;
  else if (cls) {
    const classes = cls.split(/\s+/).filter(Boolean);
    const nonDynamic = classes.filter((c) => !isDynamicClass(c));
    if (nonDynamic.length > 0) css = `${tag}.${nonDynamic.slice(0, 2).map(cssEscape).join('.')}`;
    else css = tag;
  } else css = tag;

  // --- XPath ---
  let xpath: string;
  if (tid) xpath = `//${tag}[@data-testid=${escapeXPathValue(tid)}]`;
  else if (id && !id.includes(' ')) xpath = `//*[@id=${escapeXPathValue(id)}]`;
  else if (aria) xpath = `//${tag}[@aria-label=${escapeXPathValue(aria)}]`;
  else if (role) xpath = `//${tag}[@role=${escapeXPathValue(role)}]`;
  else if (name) xpath = `//${tag}[@name=${escapeXPathValue(name)}]`;
  else if (txt && txt.length <= 30)
    xpath = `//${tag}[normalize-space(text())=${escapeXPathValue(txt)}]`;
  else xpath = `//${tag}`;

  // --- Playwright ---
  let playwright: string;
  if (tid) playwright = `page.getByTestId('${escapeSingleQuoteJs(tid)}')`;
  else if (role) {
    const n = aria || txt;
    playwright = n
      ? `page.getByRole('${escapeSingleQuoteJs(role)}', { name: '${escapeSingleQuoteJs(n.substring(0, 40))}' })`
      : `page.getByRole('${escapeSingleQuoteJs(role)}')`;
  } else if (aria) playwright = `page.getByLabel('${escapeSingleQuoteJs(aria)}')`;
  else if (placeholder) playwright = `page.getByPlaceholder('${escapeSingleQuoteJs(placeholder)}')`;
  else if ((tag === 'button' || tag === 'a') && txt) {
    const inferredRole = tag === 'button' ? 'button' : 'link';
    playwright = `page.getByRole('${inferredRole}', { name: '${escapeSingleQuoteJs(txt.substring(0, 40))}' })`;
  } else if (txt && txt.length <= 30) playwright = `page.getByText('${escapeSingleQuoteJs(txt)}')`;
  else playwright = `page.locator('${escapeSingleQuoteJs(css)}')`;

  // --- Cypress ---
  let cypress: string;
  if (tid) cypress = `cy.get('[data-testid="${escapeDoubleQuoteJs(tid)}"]')`;
  else if (txt && txt.length <= 30 && (tag === 'button' || tag === 'a'))
    cypress = `cy.contains('${escapeSingleQuoteJs(tag)}', '${escapeSingleQuoteJs(txt)}')`;
  else cypress = `cy.get('${escapeSingleQuoteJs(css)}')`;

  // --- Selenium ---
  let selenium: string;
  if (id && !id.includes(' ')) selenium = `driver.findElement(By.id("${escapeDoubleQuoteJs(id)}"))`;
  else if (name) selenium = `driver.findElement(By.name("${escapeDoubleQuoteJs(name)}"))`;
  else selenium = `driver.findElement(By.cssSelector("${escapeDoubleQuoteJs(css)}"))`;

  return { css, xpath, playwright, cypress, selenium };
}

// ---------------------------------------------------------------------------
// Dynamic class / ID detection
// ---------------------------------------------------------------------------

const DYNAMIC_CLASS_PATTERNS: RegExp[] = [
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

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

export function detectFormat(input: string): SelectorFormat {
  const s = input.trimStart();
  if (s.startsWith('//') || s.startsWith('(/')) return 'xpath';
  if (s.startsWith('page.')) return 'playwright';
  if (s.startsWith('cy.')) return 'cypress';
  if (s.startsWith('driver.')) return 'selenium';
  return 'css';
}

// ---------------------------------------------------------------------------
// Extract testable selector from any framework locator
// ---------------------------------------------------------------------------

export function extractTestable(
  locator: string,
  format: SelectorFormat
): { selector: string; selectorType: 'css' | 'xpath' | 'role' } | null {
  if (format === 'css') return { selector: locator, selectorType: 'css' };
  if (format === 'xpath') return { selector: locator, selectorType: 'xpath' };

  if (format === 'playwright') {
    const loc = locator.match(/page\.locator\((['"`])(.*?)\1\)/);
    if (loc) return { selector: loc[2], selectorType: 'css' };
    const tid = locator.match(/page\.getByTestId\((['"`])(.*?)\1\)/);
    if (tid) return { selector: `[data-testid="${tid[2]}"]`, selectorType: 'css' };
    const rwn = locator.match(/page\.getByRole\((['"`])(.*?)\1,\s*\{[^}]*name:\s*(['"`])(.*?)\3/);
    if (rwn) return { selector: `${rwn[2]}::${rwn[4]}`, selectorType: 'role' };
    const ro = locator.match(/page\.getByRole\((['"`])(.*?)\1/);
    if (ro) return { selector: ro[2], selectorType: 'role' };
    const txt = locator.match(/page\.getByText\((['"`])(.*?)\1/);
    if (txt) return { selector: `//*[contains(text(),"${txt[2]}")]`, selectorType: 'xpath' };
    const lbl = locator.match(/page\.getByLabel\((['"`])(.*?)\1/);
    if (lbl) return { selector: `[aria-label="${lbl[2]}"]`, selectorType: 'css' };
    const ph = locator.match(/page\.getByPlaceholder\((['"`])(.*?)\1/);
    if (ph) return { selector: `[placeholder="${ph[2]}"]`, selectorType: 'css' };
    const alt = locator.match(/page\.getByAltText\((['"`])(.*?)\1/);
    if (alt) return { selector: `[alt="${alt[2]}"]`, selectorType: 'css' };
    const ttl = locator.match(/page\.getByTitle\((['"`])(.*?)\1/);
    if (ttl) return { selector: `[title="${ttl[2]}"]`, selectorType: 'css' };
    return null;
  }

  if (format === 'cypress') {
    const get = locator.match(/cy\.get\((['"`])(.*?)\1\)/);
    if (get) return { selector: get[2], selectorType: 'css' };
    const ctag = locator.match(/cy\.contains\((['"`])(.*?)\1,\s*(['"`])(.*?)\3\)/);
    if (ctag)
      return { selector: `//${ctag[2]}[contains(text(),"${ctag[4]}")]`, selectorType: 'xpath' };
    const c = locator.match(/cy\.contains\((['"`])(.*?)\1\)/);
    if (c) return { selector: `//*[contains(text(),"${c[2]}")]`, selectorType: 'xpath' };
    const tid = locator.match(/cy\.findByTestId\((['"`])(.*?)\1/);
    if (tid) return { selector: `[data-testid="${tid[2]}"]`, selectorType: 'css' };
    const role = locator.match(/cy\.findByRole\((['"`])(.*?)\1/);
    if (role) return { selector: role[2], selectorType: 'role' };
    return null;
  }

  if (format === 'selenium') {
    const css = locator.match(/By\.css(?:Selector)?\((['"`])(.*?)\1\)/);
    if (css) return { selector: css[2], selectorType: 'css' };
    const xp = locator.match(/By\.xpath\((['"`])(.*?)\1\)/);
    if (xp) return { selector: xp[2], selectorType: 'xpath' };
    const id = locator.match(/By\.id\((['"`])(.*?)\1\)/);
    if (id) return { selector: `#${id[2]}`, selectorType: 'css' };
    const nm = locator.match(/By\.name\((['"`])(.*?)\1\)/);
    if (nm) return { selector: `[name="${nm[2]}"]`, selectorType: 'css' };
    const cl = locator.match(/By\.className\((['"`])(.*?)\1\)/);
    if (cl) return { selector: `.${cl[2]}`, selectorType: 'css' };
    const tg = locator.match(/By\.tagName\((['"`])(.*?)\1\)/);
    if (tg) return { selector: tg[2], selectorType: 'css' };
    const lnk = locator.match(/By\.linkText\((['"`])(.*?)\1\)/);
    if (lnk) return { selector: `//a[text()="${lnk[2]}"]`, selectorType: 'xpath' };
    const plnk = locator.match(/By\.partialLinkText\((['"`])(.*?)\1\)/);
    if (plnk) return { selector: `//a[contains(text(),"${plnk[2]}")]`, selectorType: 'xpath' };
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// ARIA role intelligence — for testing role-based selectors on a live page
// ---------------------------------------------------------------------------

const IMPLICIT_ROLES: Record<string, string> = {
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

const ROLE_TO_TAGS: Record<string, string[]> = {};
for (const [tag, role] of Object.entries(IMPLICIT_ROLES)) {
  if (!ROLE_TO_TAGS[role]) ROLE_TO_TAGS[role] = [];
  ROLE_TO_TAGS[role].push(tag);
}

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

// ---------------------------------------------------------------------------
// Unified highlight system
// ---------------------------------------------------------------------------

const HIGHLIGHT_ATTR = 'data-selekt-hl';

export function clearHighlights(): void {
  document.querySelectorAll(`[${HIGHLIGHT_ATTR}]`).forEach((el) => {
    (el as HTMLElement).style.outline = '';
    (el as HTMLElement).style.outlineOffset = '';
    el.removeAttribute(HIGHLIGHT_ATTR);
  });
}

export function highlightElements(elements: Element[]): void {
  clearHighlights();
  for (const el of elements) {
    (el as HTMLElement).style.outline = '2px solid #22c55e';
    (el as HTMLElement).style.outlineOffset = '2px';
    el.setAttribute(HIGHLIGHT_ATTR, '1');
  }
}

// ---------------------------------------------------------------------------
// Run a test for any selector, handling role-based matching
// ---------------------------------------------------------------------------

export function runSelectorTest(
  selector: string,
  selectorType: 'css' | 'xpath' | 'role'
): { count: number; elements: Element[] } {
  if (selectorType === 'role') {
    const parts = selector.split('::');
    const role = parts[0];
    const nameFilter = parts[1] || undefined;
    const candidates = getRoleCandidates(role);
    const matches = nameFilter ? filterByName(candidates, nameFilter) : candidates;
    return { count: matches.length, elements: matches };
  }

  try {
    let elements: Element[];
    if (selectorType === 'xpath') {
      elements = [];
      const xr = document.evaluate(
        selector,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      for (let i = 0; i < xr.snapshotLength; i++) {
        const n = xr.snapshotItem(i);
        if (n instanceof Element) elements.push(n);
      }
    } else {
      elements = Array.from(document.querySelectorAll(selector));
    }
    return { count: elements.length, elements };
  } catch {
    return { count: -1, elements: [] };
  }
}
