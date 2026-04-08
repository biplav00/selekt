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
// Dynamic class/ID detection — re-exported from helpers
// ---------------------------------------------------------------------------

export { isDynamicClass } from '@/specialists/helpers/dynamic-detect';

import { isDynamicClass } from '@/specialists/helpers/dynamic-detect';

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

export type TestableResult =
  | { selector: string; selectorType: 'css' | 'xpath' | 'role' }
  | { chain: Array<{ selector: string; selectorType: 'css' | 'xpath' | 'role' }> };

// ---------------------------------------------------------------------------
// Playwright helpers
// ---------------------------------------------------------------------------

function extractSinglePlaywright(
  segment: string
): { selector: string; selectorType: 'css' | 'xpath' | 'role' } | null {
  const loc = segment.match(/page\.locator\((['"`])(.*?)\1\)/);
  if (loc) return { selector: loc[2], selectorType: 'css' };
  const tid = segment.match(/page\.getByTestId\((['"`])(.*?)\1\)/);
  if (tid) return { selector: `[data-testid="${tid[2]}"]`, selectorType: 'css' };
  const rwn = segment.match(/page\.getByRole\((['"`])(.*?)\1,\s*\{[^}]*name:\s*(['"`])(.*?)\3/);
  if (rwn) return { selector: `${rwn[2]}::${rwn[4]}`, selectorType: 'role' };
  const ro = segment.match(/page\.getByRole\((['"`])(.*?)\1/);
  if (ro) return { selector: ro[2], selectorType: 'role' };
  const txt = segment.match(/page\.getByText\((['"`])(.*?)\1/);
  if (txt) return { selector: `//*[contains(text(),"${txt[2]}")]`, selectorType: 'xpath' };
  const lbl = segment.match(/page\.getByLabel\((['"`])(.*?)\1/);
  if (lbl) return { selector: `[aria-label="${lbl[2]}"]`, selectorType: 'css' };
  const ph = segment.match(/page\.getByPlaceholder\((['"`])(.*?)\1/);
  if (ph) return { selector: `[placeholder="${ph[2]}"]`, selectorType: 'css' };
  const alt = segment.match(/page\.getByAltText\((['"`])(.*?)\1/);
  if (alt) return { selector: `[alt="${alt[2]}"]`, selectorType: 'css' };
  const ttl = segment.match(/page\.getByTitle\((['"`])(.*?)\1/);
  if (ttl) return { selector: `[title="${ttl[2]}"]`, selectorType: 'css' };
  // filter({ hasText: '...' }) — convert to XPath contains
  const filter = segment.match(/page\.filter\(\{[^}]*hasText:\s*(['"`])(.*?)\1/);
  if (filter) return { selector: `//*[contains(text(),"${filter[2]}")]`, selectorType: 'xpath' };
  return null;
}

function splitPlaywrightChain(locator: string): string[] {
  const segments: string[] = [];
  const re = /\.?((?:page\.)?(?:getBy\w+|locator|filter|nth|first|last))\s*\(([^()]*(?:\{[^}]*\}[^()]*)*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(locator)) !== null) {
    const fullMatch = match[0].startsWith('page') ? match[0] : `page${match[0]}`;
    segments.push(fullMatch);
  }
  return segments;
}

// ---------------------------------------------------------------------------
// Cypress helpers
// ---------------------------------------------------------------------------

function extractSingleCypress(
  segment: string
): { selector: string; selectorType: 'css' | 'xpath' | 'role' } | null {
  const get = segment.match(/cy\.get\((['"`])(.*?)\1\)/);
  if (get) return { selector: get[2], selectorType: 'css' };
  const find = segment.match(/(?:cy\.)?find\((['"`])(.*?)\1\)/);
  if (find) return { selector: find[2], selectorType: 'css' };
  const ctag = segment.match(/cy\.contains\((['"`])(.*?)\1,\s*(['"`])(.*?)\3\)/);
  if (ctag)
    return { selector: `//${ctag[2]}[contains(text(),"${ctag[4]}")]`, selectorType: 'xpath' };
  const c = segment.match(/cy\.contains\((['"`])(.*?)\1\)/);
  if (c) return { selector: `//*[contains(text(),"${c[2]}")]`, selectorType: 'xpath' };
  const contains = segment.match(/(?:cy\.)?contains\((['"`])(.*?)\1\)/);
  if (contains)
    return { selector: `//*[contains(text(),"${contains[2]}")]`, selectorType: 'xpath' };
  const tid = segment.match(/cy\.findByTestId\((['"`])(.*?)\1/);
  if (tid) return { selector: `[data-testid="${tid[2]}"]`, selectorType: 'css' };
  const role = segment.match(/cy\.findByRole\((['"`])(.*?)\1/);
  if (role) return { selector: role[2], selectorType: 'role' };
  return null;
}

function splitCypressChain(locator: string): string[] {
  // Split cy.get(...).find(...).contains(...) etc.
  // First segment starts with cy., subsequent ones are .method(...)
  const segments: string[] = [];
  // Match cy.METHOD(...) at start
  const firstRe = /^(cy\.\w+\([^)]*\))/;
  const firstMatch = locator.match(firstRe);
  if (firstMatch) {
    segments.push(firstMatch[1]);
    // Match subsequent .METHOD(...) calls, normalize to cy.METHOD(...)
    const rest = locator.slice(firstMatch[1].length);
    const chainRe = /\.((\w+)\([^)]*\))/g;
    let m: RegExpExecArray | null;
    while ((m = chainRe.exec(rest)) !== null) {
      segments.push(`cy.${m[1]}`);
    }
  }
  return segments;
}

// ---------------------------------------------------------------------------
// Selenium helpers
// ---------------------------------------------------------------------------

function extractSingleSelenium(
  segment: string
): { selector: string; selectorType: 'css' | 'xpath' | 'role' } | null {
  const css = segment.match(/By\.css(?:Selector)?\((['"`])(.*?)\1\)/);
  if (css) return { selector: css[2], selectorType: 'css' };
  const xp = segment.match(/By\.xpath\((['"`])(.*?)\1\)/);
  if (xp) return { selector: xp[2], selectorType: 'xpath' };
  const id = segment.match(/By\.id\((['"`])(.*?)\1\)/);
  if (id) return { selector: `#${id[2]}`, selectorType: 'css' };
  const nm = segment.match(/By\.name\((['"`])(.*?)\1\)/);
  if (nm) return { selector: `[name="${nm[2]}"]`, selectorType: 'css' };
  const cl = segment.match(/By\.className\((['"`])(.*?)\1\)/);
  if (cl) return { selector: `.${cl[2]}`, selectorType: 'css' };
  const tg = segment.match(/By\.tagName\((['"`])(.*?)\1\)/);
  if (tg) return { selector: tg[2], selectorType: 'css' };
  const lnk = segment.match(/By\.linkText\((['"`])(.*?)\1\)/);
  if (lnk) return { selector: `//a[text()="${lnk[2]}"]`, selectorType: 'xpath' };
  const plnk = segment.match(/By\.partialLinkText\((['"`])(.*?)\1\)/);
  if (plnk) return { selector: `//a[contains(text(),"${plnk[2]}")]`, selectorType: 'xpath' };
  return null;
}

function splitSeleniumChain(locator: string): string[] {
  // Split on .findElement( boundaries
  // e.g. "driver.findElement(By.id('form')).findElement(By.name('email'))"
  // → ["driver.findElement(By.id('form'))", "driver.findElement(By.name('email'))"]
  const segments: string[] = [];
  const re = /(?:driver|element)?\.?findElement\([^)]+\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(locator)) !== null) {
    // Normalize: ensure prefix is "driver.findElement"
    const raw = match[0];
    const normalized = raw.startsWith('driver') ? raw : `driver${raw.startsWith('.') ? raw : `.${raw}`}`;
    segments.push(normalized);
  }
  return segments;
}

// ---------------------------------------------------------------------------
// Main extractTestable
// ---------------------------------------------------------------------------

export function extractTestable(
  locator: string,
  format: SelectorFormat
): TestableResult | null {
  if (format === 'css') return { selector: locator, selectorType: 'css' };
  if (format === 'xpath') return { selector: locator, selectorType: 'xpath' };

  if (format === 'playwright') {
    // Detect chain: more than one method call
    const methodCalls = locator.match(/\.(getBy\w+|locator|filter|nth|first|last)\s*\(/g);
    if (methodCalls && methodCalls.length > 1) {
      const segments = splitPlaywrightChain(locator);
      if (segments.length > 1) {
        const chain: Array<{ selector: string; selectorType: 'css' | 'xpath' | 'role' }> = [];
        for (const seg of segments) {
          const result = extractSinglePlaywright(seg);
          if (result) chain.push(result);
        }
        if (chain.length > 1) return { chain };
      }
    }
    // Fall through to single extraction
    const single = extractSinglePlaywright(locator);
    return single;
  }

  if (format === 'cypress') {
    // Detect chain: cy.get(...).find(...) or cy.get(...).contains(...)
    const chainMatch = locator.match(/^cy\.\w+\(.*?\)\.\w+\(/);
    if (chainMatch) {
      const segments = splitCypressChain(locator);
      if (segments.length > 1) {
        const chain: Array<{ selector: string; selectorType: 'css' | 'xpath' | 'role' }> = [];
        for (const seg of segments) {
          const result = extractSingleCypress(seg);
          if (result) chain.push(result);
        }
        if (chain.length > 1) return { chain };
      }
    }
    const single = extractSingleCypress(locator);
    return single;
  }

  if (format === 'selenium') {
    const findCount = (locator.match(/\.findElement\(/g) || []).length;
    if (findCount > 1) {
      const segments = splitSeleniumChain(locator);
      if (segments.length > 1) {
        const chain: Array<{ selector: string; selectorType: 'css' | 'xpath' | 'role' }> = [];
        for (const seg of segments) {
          const result = extractSingleSelenium(seg);
          if (result) chain.push(result);
        }
        if (chain.length > 1) return { chain };
      }
    }
    const single = extractSingleSelenium(locator);
    return single;
  }

  return null;
}

// ---------------------------------------------------------------------------
// ARIA role intelligence — re-exported from helpers
// ---------------------------------------------------------------------------

export { filterByName, getRoleCandidates } from '@/specialists/helpers/aria';

import { filterByName, getRoleCandidates } from '@/specialists/helpers/aria';

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
