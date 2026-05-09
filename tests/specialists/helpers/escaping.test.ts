import {
  cssEscape,
  escapeCssAttrValue,
  escapeDoubleQuoteJs,
  escapeSingleQuoteJs,
  escapeXPathValue,
} from '@/specialists/helpers/escaping';
import { describe, expect, it } from 'vitest';

describe('cssEscape', () => {
  it('escapes special CSS characters', () => {
    expect(cssEscape('my:id')).toContain('\\:');
  });

  it('escapes leading digit', () => {
    expect(cssEscape('3foo')).toMatch(/\\3/);
  });

  it('handles plain strings', () => {
    expect(cssEscape('simple')).toBe('simple');
  });
});

describe('escapeCssAttrValue', () => {
  it('escapes double quotes', () => {
    expect(escapeCssAttrValue('say "hi"')).toBe('say \\"hi\\"');
  });

  it('escapes backslashes', () => {
    expect(escapeCssAttrValue('path\\to')).toBe('path\\\\to');
  });
});

describe('escapeXPathValue', () => {
  it('wraps in single quotes when no single quotes', () => {
    expect(escapeXPathValue('hello')).toBe("'hello'");
  });

  it('wraps in double quotes when contains single quotes', () => {
    expect(escapeXPathValue("it's")).toBe('"it\'s"');
  });

  it('uses concat when both quote types present', () => {
    const result = escapeXPathValue(`he said "it's"`);
    expect(result).toContain('concat(');
  });
});

describe('escapeSingleQuoteJs', () => {
  it('escapes single quotes', () => {
    expect(escapeSingleQuoteJs("it's")).toBe("it\\'s");
  });

  it('escapes backslashes first', () => {
    expect(escapeSingleQuoteJs('a\\b')).toBe('a\\\\b');
  });
});

describe('escapeDoubleQuoteJs', () => {
  it('escapes double quotes', () => {
    expect(escapeDoubleQuoteJs('say "hi"')).toBe('say \\"hi\\"');
  });
});
