/**
 * Manual locator parsing and suggestion collection
 * Extracted from content.ts to reduce god-function complexity.
 *
 * Supports Playwright chains: page.getBy*(), page.locator() plus
 * .locator(), .getBy*(), .filter({ hasText }), .first(), .last(),
 * .nth(i), .and(), .or() — as well as raw CSS / XPath probes.
 */

function cssEscapeManual(s: string): string {
  try {
    const css = (globalThis as unknown as { CSS?: { escape: (s: string) => string } }).CSS;
    if (typeof css !== 'undefined' && css.escape) return css.escape(s);
  } catch {
    void 0;
  }
  return s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function unescapeManual(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function tagRoleOf(el: Element): string | null {
  const tagRoleMap: Record<string, string> = {
    BUTTON: 'button',
    A: 'link',
    INPUT: 'textbox',
    SELECT: 'combobox',
    TEXTAREA: 'textbox',
    H1: 'heading',
    H2: 'heading',
    H3: 'heading',
    H4: 'heading',
    H5: 'heading',
    H6: 'heading',
    IMG: 'img',
    NAV: 'navigation',
    FORM: 'form',
    TABLE: 'table',
    UL: 'list',
    OL: 'list',
  };
  return el.getAttribute('role') || tagRoleMap[el.tagName] || null;
}

function accessibleNameOf(el: Element): string {
  const ariaLabel = el.getAttribute('aria-label')?.trim();
  const text = ((el as HTMLElement).innerText ?? (el as HTMLElement).textContent ?? '').trim();
  return (
    ariaLabel ||
    text ||
    el.getAttribute('alt') ||
    el.getAttribute('placeholder') ||
    el.getAttribute('title') ||
    ''
  );
}

function elementTextOf(el: Element): string {
  return ((el as HTMLElement).innerText ?? (el as HTMLElement).textContent ?? '').trim();
}

function scopeCandidates(scope: Element[] | null): Element[] {
  if (!scope) return Array.from(document.querySelectorAll('*')) as Element[];
  const out: Element[] = [];
  const seen = new Set<Element>();
  for (const root of scope) {
    if (!seen.has(root)) {
      seen.add(root);
      out.push(root);
    }
    const desc = root.querySelectorAll('*');
    for (const d of Array.from(desc) as Element[]) {
      if (!seen.has(d)) {
        seen.add(d);
        out.push(d);
      }
    }
  }
  return out;
}

function dedupe(elements: Element[]): Element[] {
  return Array.from(new Set(elements));
}

function queryCss(css: string, scope: Element[] | null): Element[] {
  if (!scope) return Array.from(document.querySelectorAll(css)) as Element[];
  const out: Element[] = [];
  for (const root of scope) {
    try {
      for (const d of Array.from(root.querySelectorAll(css)) as Element[]) out.push(d);
    } catch {
      throw new Error('Invalid CSS selector');
    }
  }
  return dedupe(out);
}

function queryXpath(xpath: string, scope: Element[] | null): Element[] {
  // A bare `//` searches from the document root even with a context node —
  // rewrite to `.//` so chained locators stay scoped like Playwright.
  const scoped = (xp: string): string => {
    if (!scope) return xp;
    if (xp.startsWith('//')) return '.' + xp;
    if (xp.startsWith('(//')) return '(.//' + xp.slice(3);
    return xp;
  };
  const run = (xp: string, node: Node): Element[] => {
    const result = document.evaluate(xp, node, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    const els: Element[] = [];
    for (let i = 0; i < result.snapshotLength; i++) {
      const n = result.snapshotItem(i);
      if (n instanceof Element) els.push(n);
    }
    return els;
  };
  if (!scope) return run(xpath, document);
  const out: Element[] = [];
  for (const root of scope) {
    for (const e of run(scoped(xpath), root)) out.push(e);
  }
  return dedupe(out);
}

function matchName(accessibleName: string, wanted: string, exact: boolean): boolean {
  if (exact) return accessibleName === wanted;
  return accessibleName.toLowerCase().includes(wanted.toLowerCase());
}

function matchNameRegex(accessibleName: string, re: RegExp): boolean {
  try {
    return re.test(accessibleName);
  } catch {
    return false;
  }
}

function findByRoleInScope(
  role: string,
  scope: Element[] | null,
  nameString: string | null,
  nameRegex: RegExp | null,
  exact: boolean,
  level?: number | null
): Element[] {
  return scopeCandidates(scope).filter((el) => {
    if (tagRoleOf(el) !== role) return false;
    if (level != null && (role === 'heading' || role === 'link')) {
      const m = /^H([1-6])$/.exec(el.tagName);
      if (m && Number(m[1]) !== level) return false;
    }
    if (nameString == null && !nameRegex) return true;
    const accessibleName = accessibleNameOf(el);
    if (nameRegex) return matchNameRegex(accessibleName, nameRegex);
    return matchName(accessibleName, nameString ?? '', exact);
  });
}

function findByTextInScope(
  scope: Element[] | null,
  wanted: string | null,
  wantedRegex: RegExp | null,
  exact: boolean
): Element[] {
  return scopeCandidates(scope).filter((el) => {
    if (el.children.length > 0) return false;
    const t = elementTextOf(el);
    if (!t) return false;
    if (wantedRegex) return matchNameRegex(t, wantedRegex);
    if (wanted == null) return false;
    return exact ? t === wanted : t.toLowerCase().includes(wanted.toLowerCase());
  });
}

/** First quoted string in an args list, unescaped. */
function firstStringArg(args: string): string | null {
  const m = args.match(/^\s*(['"`])((?:\\\1|(?!\1).)*?)\1/);
  if (m) return unescapeManual(m[2]);
  const anywhere = args.match(/(['"`])((?:\\\1|(?!\1).)*?)\1/);
  return anywhere ? unescapeManual(anywhere[2]) : null;
}

/** First arg as string-or-regex: 'text' or /pattern/flags. */
function firstStringOrRegexArg(
  args: string
): { kind: 'string'; value: string } | { kind: 'regex'; re: RegExp } | null {
  const trimmed = args.trim();
  if (trimmed.startsWith('/')) {
    const m = trimmed.match(/^\/(?:\\\/|[^/])*\/[dgimsuy]*/);
    if (m) {
      try {
        const lastSlash = m[0].lastIndexOf('/');
        const pattern = m[0].slice(1, lastSlash);
        const flags = m[0].slice(lastSlash + 1);
        return { kind: 'regex', re: new RegExp(pattern, flags) };
      } catch {
        return null;
      }
    }
    return null;
  }
  const s = firstStringArg(args);
  return s == null ? null : { kind: 'string', value: s };
}

function optionString(args: string, key: string): string | null {
  const m = args.match(new RegExp(key + '\\s*:\\s*([\'"`])((?:\\\\\\1|(?:(?!\\1).))*?)\\1'));
  return m ? unescapeManual(m[2]) : null;
}

function optionRegex(args: string, key: string): RegExp | null {
  const m = args.match(new RegExp(key + '\\s*:\\s*/((?:\\\\/|[^/])*)/([dgimsuy]*)'));
  if (!m) return null;
  try {
    return new RegExp(m[1], m[2]);
  } catch {
    return null;
  }
}

function hasExact(args: string): boolean {
  return /exact\s*:\s*true/.test(args);
}

function optionLevel(args: string): number | null {
  const m = args.match(/level\s*:\s*(\d)/);
  return m ? Number(m[1]) : null;
}

interface ChainStep {
  name: string;
  args: string;
}

function parseChainSteps(body: string): { steps?: ChainStep[]; error?: string } {
  const steps: ChainStep[] = [];
  let i = 0;
  const skipWs = () => {
    while (i < body.length && /\s/.test(body[i])) i++;
  };
  while (true) {
    skipWs();
    if (i >= body.length) break;
    const nameMatch = /^[A-Za-z_$][\w$]*/.exec(body.slice(i));
    if (!nameMatch)
      return {
        error: `Invalid locator — unexpected "${body[i]}" near "${body.slice(Math.max(0, i - 10), i + 10)}"`,
      };
    const name = nameMatch[0];
    i += name.length;
    skipWs();
    // first()/last() always have parens in Playwright, but tolerate bare uses.
    if (body[i] !== '(') {
      if (name === 'first' || name === 'last') {
        steps.push({ name, args: '' });
        skipWs();
        if (body[i] === '.') {
          i++;
          continue;
        }
        if (i >= body.length) break;
        return { error: `Invalid locator — unexpected "${body[i]}" after .${name}` };
      }
      return { error: `Invalid locator — expected ( after ${name}` };
    }
    i++; // consume (
    let depth = 1;
    let quote: string | null = null;
    let escaped = false;
    const start = i;
    while (i < body.length && depth > 0) {
      const ch = body[i];
      if (quote) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === quote) quote = null;
      } else {
        if (ch === "'" || ch === '"' || ch === '`') quote = ch;
        else if (ch === '(' || ch === '{' || ch === '[') depth++;
        else if (ch === ')') {
          depth--;
          if (depth === 0) break;
        } else if (ch === '}' || ch === ']') depth--;
      }
      i++;
    }
    if (depth !== 0) return { error: `Invalid locator — unbalanced ( in ${name}()` };
    const args = body.slice(start, i);
    i++; // consume )
    steps.push({ name, args });
    skipWs();
    if (i >= body.length) break;
    if (body[i] === '.') {
      i++;
      continue;
    }
    return { error: `Invalid locator — unexpected "${body[i]}" — did you mean .first() / .nth()?` };
  }
  if (!steps.length) return { error: 'Invalid locator — empty expression' };
  return { steps };
}

function evalTextEngine(inner: string, scope: Element[] | null): Element[] {
  const m = inner.match(/^(text(?:-is)?(?:-matches)?)\s*=\s*(.*)$/s);
  if (!m) return [];
  const op = m[1];
  const rest = (m[2] ?? '').trim();
  if (rest.startsWith('/')) {
    const lit = rest.match(/^\/(?:\\\/|[^/])*\/[dgimsuy]*/);
    if (lit) {
      try {
        const lastSlash = lit[0].lastIndexOf('/');
        const re = new RegExp(lit[0].slice(1, lastSlash), lit[0].slice(lastSlash + 1));
        return findByTextInScope(scope, null, re, false);
      } catch {
        return [];
      }
    }
  }
  const str = rest.replace(/^['"`]|['"`]$/g, '');
  if (op === 'text-is') return findByTextInScope(scope, unescapeManual(str), null, true);
  return findByTextInScope(scope, unescapeManual(str), null, false);
}

function evalLocatorInner(inner: string, scope: Element[] | null): Element[] {
  const value = inner.trim();
  if (!value) throw new Error('locator() needs a selector string');
  if (value.startsWith('xpath=')) return queryXpath(value.slice(6), scope);
  if (value.startsWith('css=')) return queryCss(value.slice(4), scope);
  if (value.startsWith('//') || value.startsWith('(//')) return queryXpath(value, scope);
  if (/^(text(?:-is)?(?:-matches)?)=/.test(value)) return evalTextEngine(value, scope);
  if (/^role=/.test(value))
    throw new Error('role= engine is not supported — use getByRole() instead');
  if (value.includes('>>')) {
    throw new Error('">>" chains are not supported — split into .locator().locator() instead');
  }
  // Strip Playwright CSS extensions we can't query natively.
  let css = value
    .replace(/:visible/g, '')
    .replace(/:light\b/g, '')
    .trim();
  // :has-text("foo") → query the base then filter by text.
  const hasTextMatch = css.match(/:has-text\(\s*(['"`])((?:\\\1|(?!\1).)*?)\1\s*\)/);
  let hasText: string | null = null;
  if (hasTextMatch) {
    hasText = unescapeManual(hasTextMatch[2]);
    css = css.replace(hasTextMatch[0], '').trim() || '*';
  }
  let els: Element[];
  try {
    els = queryCss(css || '*', scope);
  } catch {
    throw new Error('Invalid CSS selector');
  }
  if (hasText != null) {
    const lower = hasText.toLowerCase();
    els = els.filter((el) => (el.textContent ?? '').toLowerCase().includes(lower));
  }
  return els;
}

function applyHasTextFilter(elements: Element[], args: string): Element[] {
  const str = optionString(args, 'hasText');
  const re = optionRegex(args, 'hasText');
  if (str == null && !re) return elements;
  return elements.filter((el) => {
    const t = (el as HTMLElement).innerText ?? el.textContent ?? '';
    if (re) {
      try {
        return re.test(t);
      } catch {
        return false;
      }
    }
    return t.toLowerCase().includes((str ?? '').toLowerCase());
  });
}

function evalLocatorStep(
  step: ChainStep,
  scope: Element[] | null,
  _depth: number
): { elements?: Element[]; error?: string } {
  const args = step.args;
  try {
    switch (step.name) {
      case 'getByTestId': {
        const val = firstStringArg(args);
        if (val == null) return { error: 'getByTestId() needs an id string' };
        return { elements: queryCss(`[data-testid="${cssEscapeManual(val)}"]`, scope) };
      }
      case 'getByRole': {
        const role = firstStringArg(args);
        if (role == null) return { error: 'getByRole() needs a role string' };
        const exact = hasExact(args);
        const nameStr = optionString(args, 'name');
        const nameRe = optionRegex(args, 'name');
        return {
          elements: findByRoleInScope(role, scope, nameStr, nameRe, exact, optionLevel(args)),
        };
      }
      case 'getByText': {
        const first = firstStringOrRegexArg(args);
        if (!first) return { error: 'getByText() needs a text string' };
        const exact = hasExact(args);
        if (first.kind === 'regex')
          return { elements: findByTextInScope(scope, null, first.re, exact) };
        return { elements: findByTextInScope(scope, first.value, null, exact) };
      }
      case 'getByPlaceholder': {
        const val = firstStringArg(args);
        if (val == null) return { error: 'getByPlaceholder() needs a string' };
        const exact = hasExact(args);
        const lower = val.toLowerCase();
        return {
          elements: scopeCandidates(scope).filter((el) => {
            if (
              !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) &&
              !el.hasAttribute('placeholder')
            )
              return false;
            const p = el.getAttribute('placeholder') ?? '';
            if (!p) return false;
            return exact ? p === val : p.toLowerCase().includes(lower);
          }),
        };
      }
      case 'getByLabel': {
        const val = firstStringArg(args);
        if (val == null) return { error: 'getByLabel() needs a string' };
        const exact = hasExact(args);
        const lower = val.toLowerCase();
        const matchLabel = (t: string) => (exact ? t === val : t.toLowerCase().includes(lower));
        return {
          elements: scopeCandidates(scope).filter((el) => {
            if (
              !['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(el.tagName) &&
              el.tagName !== 'INPUT'
            )
              return false;
            const id = el.getAttribute('id');
            if (id) {
              const lab = document.querySelector(`label[for="${cssEscapeManual(id)}"]`);
              if (lab?.textContent && matchLabel(lab.textContent.trim())) return true;
            }
            const wrapped = el.closest('label');
            if (wrapped?.textContent && matchLabel(wrapped.textContent.trim())) return true;
            const aria = el.getAttribute('aria-label') ?? '';
            if (aria && matchLabel(aria.trim())) return true;
            return false;
          }),
        };
      }
      case 'getByAltText': {
        const val = firstStringArg(args);
        if (val == null) return { error: 'getByAltText() needs a string' };
        const exact = hasExact(args);
        const lower = val.toLowerCase();
        return {
          elements: scopeCandidates(scope).filter((el) => {
            const alt = el.getAttribute('alt');
            if (alt == null) return false;
            if (
              el.tagName !== 'IMG' &&
              el.tagName !== 'AREA' &&
              (el as HTMLInputElement).type !== 'image'
            )
              return false;
            return exact ? alt === val : alt.toLowerCase().includes(lower);
          }),
        };
      }
      case 'getByTitle': {
        const val = firstStringArg(args);
        if (val == null) return { error: 'getByTitle() needs a string' };
        const exact = hasExact(args);
        const lower = val.toLowerCase();
        return {
          elements: scopeCandidates(scope).filter((el) => {
            const t = el.getAttribute('title') ?? '';
            if (!t) return false;
            return exact ? t === val : t.toLowerCase().includes(lower);
          }),
        };
      }
      case 'locator': {
        const inner = firstStringArg(args);
        if (inner == null) return { error: 'locator() needs a selector string' };
        let els = evalLocatorInner(inner, scope);
        const hasTextStr = optionString(args, 'hasText');
        const hasTextRe = optionRegex(args, 'hasText');
        if (hasTextStr != null || hasTextRe) {
          els = els.filter((el) => {
            const t = (el as HTMLElement).innerText ?? el.textContent ?? '';
            if (hasTextRe) {
              try {
                return hasTextRe.test(t);
              } catch {
                return false;
              }
            }
            return t.toLowerCase().includes((hasTextStr ?? '').toLowerCase());
          });
        }
        return { elements: els };
      }
      default:
        return {
          error: `Unsupported step .${step.name}() — try locator(), getBy*, filter(), first(), last(), nth()`,
        };
    }
  } catch (e) {
    return { error: (e as Error).message || `Invalid ${step.name}()` };
  }
}

function evalChain(body: string, depth: number): { elements?: Element[]; error?: string } {
  if (depth > 5) return { error: 'Locator is too deeply nested' };
  const parsed = parseChainSteps(body);
  if (parsed.error || !parsed.steps) return { error: parsed.error ?? 'Invalid locator' };
  const steps = parsed.steps;
  let current: Element[] | null = null;
  let started = false;
  for (const step of steps) {
    if (
      step.name === 'getByTestId' ||
      step.name === 'getByRole' ||
      step.name === 'getByText' ||
      step.name === 'getByPlaceholder' ||
      step.name === 'getByLabel' ||
      step.name === 'getByAltText' ||
      step.name === 'getByTitle' ||
      step.name === 'locator'
    ) {
      const r = evalLocatorStep(step, current, depth);
      if (r.error) return r;
      current = r.elements ?? [];
      started = true;
      continue;
    }
    if (!started || !current) {
      if (
        step.name === 'filter' ||
        step.name === 'first' ||
        step.name === 'last' ||
        step.name === 'nth' ||
        step.name === 'and' ||
        step.name === 'or'
      ) {
        return { error: `.${step.name}() needs a locator before it` };
      }
      return {
        error: `Unsupported step .${step.name}() — a chain must start with page.getBy*() or page.locator()`,
      };
    }
    switch (step.name) {
      case 'filter': {
        current = applyHasTextFilter(current, step.args);
        // Best-effort `has:` support — keep elements containing the nested match.
        if (/has\s*:/.test(step.args) && !/hasText\s*:/.test(step.args)) {
          const innerIdx = step.args.search(/page\./);
          if (innerIdx >= 0 && depth < 5) {
            const innerExpr = step.args
              .slice(innerIdx)
              .replace(/\}\s*$/, '')
              .trim();
            const inner = parseManualLocator(innerExpr, depth + 1);
            if (!inner.error) {
              const targets = new Set(inner.elements);
              current = current.filter((el) => {
                for (const t of targets) if (el === t || el.contains(t)) return true;
                return false;
              });
            }
          }
        }
        break;
      }
      case 'first':
        current = current.slice(0, 1);
        break;
      case 'last':
        current = current.slice(-1);
        break;
      case 'nth': {
        const m = step.args.match(/-?\d+/);
        if (!m) return { error: 'nth() needs an index, e.g. .nth(0)' };
        const idx = Number(m[0]);
        const at = idx < 0 ? current.length + idx : idx;
        current = at >= 0 && at < current.length ? [current[at]] : [];
        break;
      }
      case 'and': {
        const innerExpr = step.args.trim();
        if (!innerExpr) return { error: 'and() needs a locator, e.g. .and(page.getByText("x"))' };
        const inner = parseManualLocator(innerExpr, depth + 1);
        if (inner.error) return { error: inner.error };
        const set = new Set(inner.elements);
        current = current.filter((el) => set.has(el));
        break;
      }
      case 'or': {
        const innerExpr = step.args.trim();
        if (!innerExpr) return { error: 'or() needs a locator, e.g. .or(page.getByText("x"))' };
        const inner = parseManualLocator(innerExpr, depth + 1);
        if (inner.error) return { error: inner.error };
        current = dedupe([...current, ...inner.elements]);
        break;
      }
      default:
        return {
          error: `Unsupported step .${step.name}() — try filter(), first(), last(), nth(), and(), or()`,
        };
    }
  }
  return { elements: current ?? [] };
}

export function parseManualLocator(
  input: string,
  depth = 0
): { elements: Element[]; error?: string } {
  const raw = input.trim();
  if (!raw) return { elements: [], error: 'Empty locator' };

  // Bare XPath probes (no page. prefix).
  if (raw.startsWith('//') || raw.startsWith('(//')) {
    try {
      const result = document.evaluate(
        raw,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      const els: Element[] = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const n = result.snapshotItem(i);
        if (n instanceof Element) els.push(n);
      }
      return { elements: els };
    } catch {
      return { elements: [], error: 'Invalid XPath' };
    }
  }
  if (raw.startsWith('xpath=')) {
    try {
      const result = document.evaluate(
        raw.slice(6),
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      const els: Element[] = [];
      for (let i = 0; i < result.snapshotLength; i++) {
        const n = result.snapshotItem(i);
        if (n instanceof Element) els.push(n);
      }
      return { elements: els };
    } catch (e) {
      return { elements: [], error: 'Invalid XPath: ' + String((e as Error).message).slice(0, 60) };
    }
  }

  // Playwright chains — with or without the page. prefix.
  if (raw.startsWith('page.') || /^(getBy[A-Z]\w*|locator)\s*\(/.test(raw)) {
    const body = raw.startsWith('page.') ? raw.slice(5) : raw;
    if (/^frameLocator\s*\(/.test(body)) {
      return {
        elements: [],
        error: 'frameLocator() is not supported in the probe — switch to the frame first',
      };
    }
    const r = evalChain(body, depth);
    if (r.error) return { elements: [], error: r.error };
    return { elements: r.elements ?? [] };
  }

  // Raw CSS (css= prefix tolerated).
  const css = raw.startsWith('css=') ? raw.slice(4) : raw;
  try {
    return { elements: Array.from(document.querySelectorAll(css)) };
  } catch {
    return {
      elements: [],
      error:
        'Invalid selector — try CSS like #id, .class, [data-testid="x"] or page.getByTestId(\'x\')',
    };
  }
}

export function collectManualSuggestions(): string[] {
  const suggestions: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    if (!seen.has(s) && s) {
      seen.add(s);
      suggestions.push(s);
    }
  };

  add("page.getByTestId('')");
  add("page.getByRole('button', { name: '' })");
  add("page.getByRole('textbox', { name: '' })");
  add("page.getByPlaceholder('')");
  add("page.getByLabel('')");
  add("page.getByText('')");
  add("page.getByAltText('')");
  add("page.locator('#id')");
  add("page.locator('.class')");
  add('[data-testid=""]');
  add('#my-id');
  add('.my-class');
  add('//div[@id=""]');

  try {
    const testIds = Array.from(document.querySelectorAll('[data-testid]')).slice(
      0,
      8
    ) as HTMLElement[];
    testIds.forEach((el) => {
      const v = el.getAttribute('data-testid');
      if (v) add(`page.getByTestId('${v.replace(/'/g, "\\'")}')`);
    });
    const ids = Array.from(document.querySelectorAll('[id]')).slice(0, 8) as HTMLElement[];
    ids.forEach((el) => {
      const v = el.id;
      if (v && /^[a-zA-Z][\w-]*$/.test(v) && v.length < 30) add(`#${v}`);
    });
    const placeholders = Array.from(document.querySelectorAll('[placeholder]')).slice(
      0,
      5
    ) as HTMLElement[];
    placeholders.forEach((el) => {
      const v = el.getAttribute('placeholder');
      if (v) add(`page.getByPlaceholder('${v.replace(/'/g, "\\'")}')`);
    });
    const labels = Array.from(document.querySelectorAll('label')).slice(0, 5);
    labels.forEach((el) => {
      const t = el.textContent?.trim();
      if (t && t.length < 40) add(`page.getByLabel('${t.replace(/'/g, "\\'")}')`);
    });
    const buttons = Array.from(document.querySelectorAll('button')).slice(0, 5) as HTMLElement[];
    buttons.forEach((el) => {
      const t = (el.innerText ?? el.textContent ?? '').trim();
      if (t && t.length < 30) {
        add(`page.getByRole('button', { name: '${t.replace(/'/g, "\\'")}' })`);
      }
    });
    const headings = Array.from(document.querySelectorAll('h1,h2,h3')).slice(0, 3) as HTMLElement[];
    headings.forEach((el) => {
      const t = (el.innerText ?? el.textContent ?? '').trim();
      if (t && t.length < 40)
        add(`page.getByRole('heading', { name: '${t.replace(/'/g, "\\'")}' })`);
    });
  } catch {
    // ignore - return static suggestions only
    void 0;
  }
  return suggestions.slice(0, 25);
}
