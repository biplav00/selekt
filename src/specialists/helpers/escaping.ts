export function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
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
  const parts = value.split("'").map((p) => `'${p}'`);
  return `concat(${parts.join(`, "'", `)})`;
}

export function escapeSingleQuoteJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function escapeDoubleQuoteJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
