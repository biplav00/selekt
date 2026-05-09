export const DYNAMIC_CLASS_PATTERNS: RegExp[] = [
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

export function isDynamicId(id: string): boolean {
  if (/^[a-f0-9-]{20,}$/i.test(id)) return true;
  if (/^:r[0-9a-z]+:$/.test(id)) return true;
  if (/\d{4,}/.test(id)) return true;
  return false;
}

export const SEMANTIC_TAGS = new Set([
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
