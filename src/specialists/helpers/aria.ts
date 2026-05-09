export const IMPLICIT_ROLES: Record<string, string> = {
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
  fieldset: 'group',
  option: 'option',
  hr: 'separator',
  tbody: 'rowgroup',
  thead: 'rowgroup',
  tfoot: 'rowgroup',
  tr: 'row',
  td: 'cell',
  th: 'columnheader',
  menu: 'menu',
};

/** Map input[type] to more specific ARIA roles. */
const INPUT_TYPE_ROLES: Record<string, string> = {
  checkbox: 'checkbox',
  radio: 'radio',
  range: 'slider',
  number: 'spinbutton',
  search: 'searchbox',
  email: 'textbox',
  tel: 'textbox',
  url: 'textbox',
  password: 'textbox',
  text: 'textbox',
  button: 'button',
  submit: 'button',
  reset: 'button',
  image: 'button',
};

/** Input types that have no ARIA role (no accessible interaction). */
const INPUT_TYPES_NO_ROLE = new Set(['hidden', 'file', 'color']);

export const ROLE_TO_TAGS: Record<string, string[]> = {};
for (const [tag, role] of Object.entries(IMPLICIT_ROLES)) {
  if (!ROLE_TO_TAGS[role]) ROLE_TO_TAGS[role] = [];
  ROLE_TO_TAGS[role].push(tag);
}

/** Get the ARIA role for a tag — explicit role takes precedence over implicit. */
export function getInferredRole(
  tag: string,
  attributes: Record<string, string>
): string | undefined {
  if (attributes.role) return attributes.role;
  const lower = tag.toLowerCase();
  // input[type] has more specific role mappings
  if (lower === 'input') {
    const type = attributes.type?.toLowerCase();
    if (!type) return 'textbox';
    if (INPUT_TYPES_NO_ROLE.has(type)) return undefined;
    return INPUT_TYPE_ROLES[type] ?? 'textbox';
  }
  return IMPLICIT_ROLES[lower];
}

/** Extract heading level from tag name (h1→1, h2→2, etc.) or aria-level. */
export function getHeadingLevel(
  tag: string,
  attributes: Record<string, string>
): number | undefined {
  const ariaLevel = attributes['aria-level'];
  if (ariaLevel) {
    const n = Number.parseInt(ariaLevel, 10);
    if (Number.isFinite(n) && n >= 1) return n;
  }
  const match = tag.toLowerCase().match(/^h([1-6])$/);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

/**
 * Compute accessible name from element attributes.
 * Simplified W3C accessible name computation — no live DOM needed.
 * Priority: aria-label > alt > title > placeholder > text content
 */
export function computeAccessibleName(attributes: Record<string, string>, text: string): string {
  if (attributes['aria-label']) return attributes['aria-label'];
  if (attributes.alt) return attributes.alt;
  if (attributes.title) return attributes.title;
  if (attributes.placeholder) return attributes.placeholder;
  const trimmed = text?.trim();
  if (trimmed && trimmed.length <= 80) return trimmed;
  return '';
}

// --- DOM-dependent functions (only work in content script context) ---

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
