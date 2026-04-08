import { describe, expect, it } from 'vitest';
import { getAllSpecialists, getFormats, getSpecialist } from '@/specialists/registry';

describe('specialist registry', () => {
  it('getSpecialist returns specialist by format', () => {
    const css = getSpecialist('css');
    expect(css.format).toBe('css');
    expect(css.displayName).toBe('CSS');
  });

  it('getAllSpecialists returns all 5', () => {
    const all = getAllSpecialists();
    expect(all).toHaveLength(5);
    const formats = all.map((s) => s.format);
    expect(formats).toContain('css');
    expect(formats).toContain('xpath');
    expect(formats).toContain('playwright');
    expect(formats).toContain('cypress');
    expect(formats).toContain('selenium');
  });

  it('getFormats returns all format strings', () => {
    const formats = getFormats();
    expect(formats).toEqual(['css', 'xpath', 'playwright', 'cypress', 'selenium']);
  });

  it('throws for unknown format', () => {
    expect(() => getSpecialist('unknown' as any)).toThrow();
  });

  it('each specialist implements the full interface', () => {
    for (const s of getAllSpecialists()) {
      expect(typeof s.generate).toBe('function');
      expect(typeof s.score).toBe('function');
      expect(typeof s.warn).toBe('function');
      expect(typeof s.chain).toBe('function');
      expect(typeof s.suggest).toBe('function');
      expect(typeof s.didYouMean).toBe('function');
      expect(typeof s.validateAndFix).toBe('function');
    }
  });
});
