/**
 * Manual locator parsing and suggestion collection
 * Extracted from content.ts to reduce god-function complexity
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

function findByRoleManual(role: string, name: string, exact: boolean): Element[] {
  const all = Array.from(document.querySelectorAll('*')) as Element[];
  const lowerName = name.toLowerCase();
  return all.filter((el) => {
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
    };
    const computedRole = el.getAttribute('role') || tagRoleMap[el.tagName] || null;
    if (computedRole !== role) return false;
    const ariaLabel = el.getAttribute('aria-label')?.trim();
    const text = ((el as HTMLElement).innerText ?? (el as HTMLElement).textContent ?? '').trim();
    const accessibleName = ariaLabel || text || el.getAttribute('alt') || el.getAttribute('placeholder') || '';
    if (exact) return accessibleName === name;
    return accessibleName.toLowerCase().includes(lowerName);
  });
}

function findByTextManual(text: string, exact: boolean): Element[] {
  const all = Array.from(document.querySelectorAll('*')) as Element[];
  const lower = text.toLowerCase();
  return all.filter((el) => {
    if (el.children.length > 0) return false;
    const t = ((el as HTMLElement).innerText ?? (el as HTMLElement).textContent ?? '').trim();
    if (!t) return false;
    return exact ? t === text : t.toLowerCase().includes(lower);
  });
}

export function parseManualLocator(input: string): { elements: Element[]; error?: string } {
  const raw = input.trim();
  if (!raw) return { elements: [], error: 'Empty locator' };

  let m = raw.match(/^page\.getByTestId\(['"](.*)['"]\)$/);
  if (m) {
    try {
      const val = m[1].replace(/\\'/g, "'").replace(/\\"/g, '"');
      return { elements: Array.from(document.querySelectorAll(`[data-testid="${cssEscapeManual(val)}"]`)) };
    } catch {
      return { elements: [], error: 'Invalid testId' };
    }
  }

  m = raw.match(/^page\.getByRole\(['"]([^'"]+)['"]\s*,?\s*(?:\{[^}]*name:\s*['"]([^'"]+)['"][^}]*\})?\)$/);
  if (m) {
    const role = m[1];
    const name = m[2];
    if (name) {
      const exact = raw.includes('exact: true');
      return { elements: findByRoleManual(role, name, exact) };
    }
    const all = Array.from(document.querySelectorAll('*')).filter((el) => {
      const r = el.getAttribute('role') || ({ BUTTON: 'button', A: 'link' } as Record<string, string>)[el.tagName] || null;
      return r === role;
    });
    return { elements: all as Element[] };
  }

  m = raw.match(/^page\.getByText\(['"](.*)['"]\s*(?:,\s*\{[^}]*\})?\)$/);
  if (m) {
    const text = m[1].replace(/\\'/g, "'").replace(/\\"/g, '"');
    const exact = raw.includes('exact: true');
    return { elements: findByTextManual(text, exact) };
  }

  m = raw.match(/^page\.getByPlaceholder\(['"](.*)['"]\)$/);
  if (m) {
    const val = m[1].replace(/\\'/g, "'");
    try {
      return { elements: Array.from(document.querySelectorAll(`[placeholder="${cssEscapeManual(val)}"]`)) };
    } catch {
      return { elements: Array.from(document.querySelectorAll(`[placeholder="${val}"]`)) };
    }
  }

  m = raw.match(/^page\.getByLabel\(['"](.*)['"]\)$/);
  if (m) {
    const val = m[1].replace(/\\'/g, "'");
    const byFor = Array.from(document.querySelectorAll(`label`))
      .filter((l) => l.textContent?.trim() === val)
      .map((l) => {
        const forId = l.getAttribute('for');
        return forId ? document.getElementById(forId) : l.closest('label')?.querySelector('input,select,textarea');
      })
      .filter(Boolean) as Element[];
    if (byFor.length) return { elements: byFor };
    return { elements: Array.from(document.querySelectorAll(`[aria-label="${cssEscapeManual(val)}"]`)) };
  }

  m = raw.match(/^page\.getByAltText\(['"](.*)['"]\)$/);
  if (m) {
    const val = m[1].replace(/\\'/g, "'");
    return { elements: Array.from(document.querySelectorAll(`img[alt="${cssEscapeManual(val)}"]`)) };
  }

  m = raw.match(/^page\.locator\(['"](.*)['"]\)$/);
  if (m) {
    const inner = m[1];
    if (inner.startsWith('//') || inner.startsWith('xpath=')) {
      const xpath = inner.startsWith('xpath=') ? inner.slice(6) : inner;
      try {
        const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        const els: Element[] = [];
        for (let i = 0; i < result.snapshotLength; i++) els.push(result.snapshotItem(i) as Element);
        return { elements: els };
      } catch (e) {
        return { elements: [], error: 'Invalid XPath: ' + String((e as Error).message).slice(0, 60) };
      }
    }
    try {
      return { elements: Array.from(document.querySelectorAll(inner)) };
    } catch {
      return { elements: [], error: 'Invalid CSS selector' };
    }
  }

  if (raw.startsWith('//') || raw.startsWith('(//')) {
    try {
      const result = document.evaluate(raw, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const els: Element[] = [];
      for (let i = 0; i < result.snapshotLength; i++) els.push(result.snapshotItem(i) as Element);
      return { elements: els };
    } catch {
      return { elements: [], error: 'Invalid XPath' };
    }
  }

  try {
    return { elements: Array.from(document.querySelectorAll(raw)) };
  } catch {
    return { elements: [], error: 'Invalid selector — try CSS like #id, .class, [data-testid="x"] or page.getByTestId(\'x\')' };
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
    const testIds = Array.from(document.querySelectorAll('[data-testid]')).slice(0, 8) as HTMLElement[];
    testIds.forEach((el) => {
      const v = el.getAttribute('data-testid');
      if (v) add(`page.getByTestId('${v.replace(/'/g, "\\'")}')`);
    });
    const ids = Array.from(document.querySelectorAll('[id]')).slice(0, 8) as HTMLElement[];
    ids.forEach((el) => {
      const v = el.id;
      if (v && /^[a-zA-Z][\w-]*$/.test(v) && v.length < 30) add(`#${v}`);
    });
    const placeholders = Array.from(document.querySelectorAll('[placeholder]')).slice(0, 5) as HTMLElement[];
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
      if (t && t.length < 40) add(`page.getByRole('heading', { name: '${t.replace(/'/g, "\\'")}' })`);
    });
  } catch {
    // ignore - return static suggestions only
    void 0;
  }
  return suggestions.slice(0, 25);
}
