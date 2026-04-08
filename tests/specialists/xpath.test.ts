import { specialist } from '@/specialists/xpath';
import type { RichElementData } from '@/types';
import { describe, expect, it } from 'vitest';

function makeElement(overrides: Partial<RichElementData> = {}): RichElementData {
  return {
    tagName: 'button',
    text: 'Submit',
    attributes: {},
    parentChain: [],
    siblingTags: [],
    accessibleName: 'Submit',
    ...overrides,
  };
}

describe('XPath specialist', () => {
  it('has correct format', () => {
    expect(specialist.format).toBe('xpath');
    expect(specialist.displayName).toBe('XPath');
  });

  describe('generate', () => {
    it('prioritizes data-testid', () => {
      const el = makeElement({ attributes: { 'data-testid': 'submit-btn' } });
      const { selectors } = specialist.generate(el);
      expect(selectors[0].selector).toContain('@data-testid');
    });

    it('uses normalize-space for text matching', () => {
      const el = makeElement({ tagName: 'span', text: 'Hello' });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes('normalize-space'))).toBe(true);
    });

    it('generates id selector', () => {
      const el = makeElement({ attributes: { id: 'my-btn' } });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes('@id'))).toBe(true);
    });

    it('generates aria-label selector', () => {
      const el = makeElement({ attributes: { 'aria-label': 'Close' } });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes('@aria-label'))).toBe(true);
    });

    it('generates role selector', () => {
      const el = makeElement({ attributes: { role: 'dialog' } });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes('@role'))).toBe(true);
    });

    it('generates tag fallback', () => {
      const el = makeElement({ tagName: 'div', text: '', attributes: {} });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector === '//div')).toBe(true);
    });
  });

  describe('score', () => {
    it('scores data-testid high', () => {
      const s = specialist.score("//button[@data-testid='submit-btn']");
      expect(s.score).toBeGreaterThanOrEqual(85);
    });

    it('penalizes contains(text()) for partial matching', () => {
      const exact = specialist.score("//button[normalize-space(text())='Submit']");
      const partial = specialist.score("//button[contains(text(),'Sub')]");
      expect(exact.score).toBeGreaterThan(partial.score);
    });

    it('penalizes positional selectors', () => {
      const s = specialist.score("(//div[@class='card'])[3]");
      expect(s.score).toBeLessThan(60);
    });
  });

  describe('warn', () => {
    it('warns about contains() partial match with fix', () => {
      const el = makeElement({ text: 'Submit' });
      const warnings = specialist.warn("//button[contains(text(),'Sub')]", el);
      expect(warnings.some((w) => w.message.toLowerCase().includes('partial'))).toBe(true);
      expect(warnings[0].fix).toBeDefined();
    });

    it('returns empty for clean selectors', () => {
      const el = makeElement({ attributes: { 'data-testid': 'x' } });
      const warnings = specialist.warn("//button[@data-testid='x']", el);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('chain', () => {
    it('generates ancestor-scoped xpath', () => {
      const el = makeElement({
        tagName: 'a',
        attributes: { 'aria-label': 'Settings' },
        parentChain: [{ tag: 'nav', id: 'main-nav', classes: [] }],
      });
      const chained = specialist.chain(el, 3);
      expect(chained.length).toBeGreaterThan(0);
      expect(chained[0].selector).toContain("@id='main-nav'");
    });

    it('returns empty when no good ancestor', () => {
      const el = makeElement({ parentChain: [{ tag: 'div', id: '', classes: [] }] });
      expect(specialist.chain(el, 3)).toHaveLength(0);
    });
  });

  describe('validateAndFix', () => {
    it('reports valid for correct xpath', () => {
      expect(specialist.validateAndFix('//div[@id="x"]').valid).toBe(true);
    });

    it('detects empty selector', () => {
      expect(specialist.validateAndFix('').valid).toBe(false);
    });
  });

  describe('suggest', () => {
    it('returns empty for empty input', () => {
      expect(specialist.suggest('', [])).toHaveLength(0);
    });
  });

  describe('didYouMean', () => {
    it('handles missing elements gracefully', () => {
      expect(specialist.didYouMean("//div[@data-testid='x']", [])).toHaveLength(0);
    });
  });
});
