/**
 * Playwright-only locator generation
 * Borrowed logic idea from playwright-crx / Playwright injected engine (Apache-2.0)
 * Ranking: data-testid > role[name] > label > placeholder > text > id > css > xpath
 * NOTE: Only Playwright locators are generated (no raw CSS/XPath strings).
 * Every value is directly paste-able: page.getByX / page.locator
 */
export interface Locator {
  kind: 'testId' | 'role' | 'placeholder' | 'label' | 'text' | 'alt' | 'id' | 'css' | 'xpath';
  value: string;
  score: number;
  count?: number;
}

function escapeString(str: string): string {
  // Escape backslash first, then single quote, then control chars. Do NOT slice here.
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function truncateForLocator(str: string, max = 80): string {
  if (str.length <= max) return str;
  // Truncate visibly and let caller decide to demote score
  return str.slice(0, max - 3) + '...';
}

function cssEscape(str: string): string {
  try {
    const css = (globalThis as unknown as { CSS?: { escape: (s: string) => string } }).CSS;
    if (typeof css !== 'undefined' && css.escape) return css.escape(str);
  } catch {
    void 0; // ignore - fallback to manual escape
  }
  return str.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

function isDynamicId(id: string): boolean {
  // Heuristic for framework-generated ids
  return (
    /^(ember|react-aria|:r\d+:|radix|chakra|mui|__next)/.test(id) ||
    /[0-9]{4,}/.test(id) ||
    /^[a-z]+-\d+-\d+/.test(id) ||
    id.length > 30
  );
}

function getCssSelector(el: Element): string {
  if (!(el instanceof Element)) return '';
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.documentElement && parts.length < 5) {
    let selector = cur.tagName.toLowerCase();
    const id = cur.getAttribute('id');
    if (
      id &&
      /^[a-zA-Z][\w-]*$/.test(id) &&
      !isDynamicId(id) &&
      document.querySelectorAll(`#${cssEscape(id)}`).length === 1
    ) {
      selector = `#${cssEscape(id)}`;
      parts.unshift(selector);
      break;
    }
    const testId = cur.getAttribute('data-testid');
    if (testId) {
      selector += `[data-testid="${cssEscape(testId)}"]`;
      parts.unshift(selector);
      break;
    }
    const parent = cur.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
      if (siblings.length > 1) {
        const idx = siblings.indexOf(cur) + 1;
        selector += `:nth-of-type(${idx})`;
      }
    }
    parts.unshift(selector);
    cur = cur.parentElement;
  }
  return parts.join(' > ');
}

function getXPath(el: Element): string {
  if (el.getAttribute('id') && !isDynamicId(el.getAttribute('id')!))
    return `//*[@id="${el.getAttribute('id')}"]`;
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.nodeType === Node.ELEMENT_NODE) {
    let idx = 1;
    let sib: Element | null = cur.previousElementSibling;
    while (sib) {
      if (sib.tagName === cur.tagName) idx++;
      sib = sib.previousElementSibling;
    }
    const tag = cur.tagName.toLowerCase();
    parts.unshift(`${tag}[${idx}]`);
    cur = cur.parentElement;
    if (cur?.getAttribute('id') && !isDynamicId(cur.getAttribute('id')!)) {
      parts.unshift(`//*[@id="${cur.getAttribute('id')}"]`);
      break;
    }
    if (parts.length > 4) break;
  }
  return '/' + parts.join('/');
}

function getRoleForElement(el: Element): string | null {
  const explicit = el.getAttribute('role');
  if (explicit) {
    if (explicit === 'presentation' || explicit === 'none') return null;
    return explicit;
  }
  if (el.hasAttribute('hidden') || (el as HTMLElement).hidden) return null;
  if (el.closest('[aria-hidden="true"]')) return null;
  // input types must be checked before generic map
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type?.toLowerCase();
    if (type === 'hidden') return null;
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (type === 'button' || type === 'submit') return 'button';
    if (type === 'search') return 'searchbox';
    return 'textbox';
  }
  if (el.tagName === 'A') {
    return el.hasAttribute('href') ? 'link' : null;
  }
  const map: Record<string, string> = {
    BUTTON: 'button',
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
  const tagRole = map[el.tagName];
  if (tagRole) return tagRole;
  return null;
}

function getAccessibleName(el: Element): string | null {
  // Spec order: aria-labelledby > aria-label > native
  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    const ids = labelledby.split(/\s+/).filter(Boolean);
    const texts = ids
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean) as string[];
    if (texts.length) return texts.join(' ');
  }
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel?.trim()) return ariaLabel.trim();

  const tag = el.tagName;
  // alt only for img/area/input image
  if (
    tag === 'IMG' ||
    tag === 'AREA' ||
    (tag === 'INPUT' && (el as HTMLInputElement).type === 'image')
  ) {
    const alt = el.getAttribute('alt');
    if (alt?.trim()) return alt.trim();
  }

  // For form controls, try label association before generic text
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) {
    const id = el.getAttribute('id');
    if (id) {
      const labFor = document.querySelector(`label[for="${cssEscape(id)}"]`);
      if (labFor?.textContent?.trim()) return labFor.textContent.trim();
    }
    const wrappedLabel = el.closest('label');
    if (wrappedLabel?.textContent?.trim()) return wrappedLabel.textContent.trim();
    const placeholder = el.getAttribute('placeholder');
    if (placeholder?.trim()) return placeholder.trim();
  }

  // Generic text fallback (jsdom compat)
  const rawText = ((el as HTMLElement).innerText ?? (el as HTMLElement).textContent ?? '').trim();
  if (
    rawText &&
    rawText.length > 0 &&
    rawText.length < 100 &&
    !['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)
  )
    return rawText;

  const title = el.getAttribute('title');
  if (title?.trim()) return title.trim();
  return null;
}

function getLabelForControl(el: Element): string | null {
  const id = el.getAttribute('id');
  if (id) {
    const lab = document.querySelector(`label[for="${cssEscape(id)}"]`);
    if (lab?.textContent?.trim()) return lab.textContent.trim();
  }
  const wrapped = el.closest('label');
  if (wrapped?.textContent?.trim()) return wrapped.textContent.trim();
  return null;
}

function isInAccessibilityTree(el: Element): boolean {
  if (el.closest('[aria-hidden="true"]')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  const role = el.getAttribute('role');
  if (role === 'presentation' || role === 'none') return false;
  if ((el as HTMLElement).hidden) return false;
  return true;
}

export function generateLocators(el: Element): Locator[] {
  const locators: Locator[] = [];
  const testIdAttr = 'data-testid';
  const testId = el.getAttribute(testIdAttr);
  if (testId) {
    const safe = truncateForLocator(testId);
    locators.push({
      kind: 'testId',
      value: `page.getByTestId('${escapeString(safe)}')`,
      score: 100,
    });
  }

  const role = getRoleForElement(el);
  const name = getAccessibleName(el);
  const inTree = isInAccessibilityTree(el);

  if (role && name && inTree) {
    const safeName = truncateForLocator(name);
    const isTruncated = safeName !== name;
    // Heading level handling
    if (role === 'heading' && /^H[1-6]$/.test(el.tagName)) {
      const level = Number(el.tagName[1]);
      locators.push({
        kind: 'role',
        value: `page.getByRole('heading', { name: '${escapeString(safeName)}', level: ${level} })`,
        score: isTruncated ? 90 : 96,
      });
    }
    locators.push({
      kind: 'role',
      value: `page.getByRole('${role}', { name: '${escapeString(safeName)}' })`,
      score: isTruncated ? 88 : 95,
    });
    if (safeName.length < 40 && !isTruncated) {
      locators.push({
        kind: 'role',
        value: `page.getByRole('${role}', { name: '${escapeString(safeName)}', exact: true })`,
        score: 90,
      });
    }
  } else if (role && inTree) {
    // Demote bare role without name (not recommended, matches many)
    locators.push({ kind: 'role', value: `page.getByRole('${role}')`, score: 40 });
  }

  // Label: prefer explicit label association for form controls
  const labelText = getLabelForControl(el);
  if (labelText) {
    const safe = truncateForLocator(labelText);
    locators.push({ kind: 'label', value: `page.getByLabel('${escapeString(safe)}')`, score: 88 });
  } else {
    // Also consider aria-label as label only if no role name already covers it, but we already handled role+name
    // For form controls with aria-label, getByLabel may still work via accessible name, but we prefer role
  }

  const placeholder = el.getAttribute('placeholder');
  if (placeholder) {
    const safe = truncateForLocator(placeholder);
    // Only emit placeholder if no label (placeholder is not a label per a11y)
    const hasLabel = !!labelText;
    const score = hasLabel ? 60 : 75;
    locators.push({
      kind: 'placeholder',
      value: `page.getByPlaceholder('${escapeString(safe)}')`,
      score,
    });
  }

  // Alt text for images
  if (el.tagName === 'IMG') {
    const alt = el.getAttribute('alt');
    if (alt) {
      locators.push({
        kind: 'alt',
        value: `page.getByAltText('${escapeString(truncateForLocator(alt))}')`,
        score: 88,
      });
    }
  }

  const rawText = ((el as HTMLElement).innerText ?? (el as HTMLElement).textContent ?? '').trim();
  if (rawText && rawText.length > 0 && rawText.length < 80 && el.children.length === 0) {
    locators.push({
      kind: 'text',
      value: `page.getByText('${escapeString(truncateForLocator(rawText))}')`,
      score: 75,
    });
    locators.push({
      kind: 'text',
      value: `page.getByText('${escapeString(truncateForLocator(rawText))}', { exact: true })`,
      score: 70,
    });
  }

  const id = el.getAttribute('id');
  if (id && /^[a-zA-Z][\w-]*$/.test(id) && !isDynamicId(id)) {
    locators.push({ kind: 'id', value: `page.locator('#${cssEscape(id)}')`, score: 60 });
  }

  const css = getCssSelector(el);
  if (css) {
    locators.push({ kind: 'css', value: `page.locator('${escapeString(css)}')`, score: 50 });
  }

  const xpath = getXPath(el);
  // Only add xpath if no better locator exists or as low fallback; still Playwright-only
  if (locators.length === 0 || locators.every((l) => l.score <= 50)) {
    locators.push({ kind: 'xpath', value: `page.locator('${escapeString(xpath)}')`, score: 30 });
  } else {
    locators.push({ kind: 'xpath', value: `page.locator('${escapeString(xpath)}')`, score: 20 });
  }

  // Demote truncated locators already handled, deduplicate
  const seen = new Set<string>();
  const deduped = locators.filter((l) => {
    if (seen.has(l.value)) return false;
    seen.add(l.value);
    return true;
  });

  return deduped.sort((a, b) => b.score - a.score);
}

export function getUniquenessCount(selector: string, kind: string): number {
  try {
    if (kind === 'css' || kind === 'id' || kind === 'xpath') {
      // Extract from page.locator('...')
      const m = selector.match(/^page\.locator\(['"](.*)['"]\)$/);
      const raw = m ? m[1] : selector;
      // xpath: use evaluate count
      if (raw.startsWith('/') || raw.startsWith('xpath=')) {
        const xpath = raw.startsWith('xpath=') ? raw.slice(6) : raw;
        const result = document.evaluate(
          `count(${xpath})`,
          document,
          null,
          XPathResult.NUMBER_TYPE,
          null
        );
        return Math.round(result.numberValue);
      }
      return document.querySelectorAll(raw).length;
    }
    if (kind === 'testId') {
      const m = selector.match(/getByTestId\('(.*)'\)/);
      if (m)
        return document.querySelectorAll(`[data-testid="${cssEscape(m[1].replace(/\\'/g, "'"))}"]`)
          .length;
    }
    // For role/text/etc, approximate as 1 unless we can compute
    return 1;
  } catch {
    return 0;
  }
}
