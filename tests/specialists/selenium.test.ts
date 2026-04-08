import { specialist } from '@/specialists/selenium';
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

describe('Selenium specialist', () => {
  it('has correct format', () => {
    expect(specialist.format).toBe('selenium');
    expect(specialist.displayName).toBe('Selenium');
  });

  describe('generate', () => {
    it('prioritizes data-testid via CSS', () => {
      const el = makeElement({ attributes: { 'data-testid': 'submit-btn' } });
      const { selectors } = specialist.generate(el);
      expect(selectors[0].selector).toContain('By.css(\'[data-testid="submit-btn"]\')');
    });

    it('generates By.id for static IDs', () => {
      const el = makeElement({ attributes: { id: 'submit' } });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes("By.id('submit')"))).toBe(true);
    });

    it('generates By.name', () => {
      const el = makeElement({ tagName: 'input', attributes: { name: 'email' } });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes("By.name('email')"))).toBe(true);
    });

    it('generates By.linkText for anchor text', () => {
      const el = makeElement({ tagName: 'a', text: 'Home' });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes("By.linkText('Home')"))).toBe(true);
    });

    it('generates aria-label via CSS', () => {
      const el = makeElement({ attributes: { 'aria-label': 'Close' } });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes('aria-label'))).toBe(true);
    });

    it('generates role via XPath', () => {
      const el = makeElement({ attributes: { role: 'dialog' } });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes('@role'))).toBe(true);
    });

    it('generates tag fallback', () => {
      const el = makeElement({ tagName: 'div', text: '', attributes: {} });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes("By.tagName('div')"))).toBe(true);
    });
  });

  describe('score', () => {
    it('scores data-testid high', () => {
      const s = specialist.score('driver.findElement(By.css(\'[data-testid="x"]\'))');
      expect(s.score).toBeGreaterThanOrEqual(85);
    });

    it('scores By.id high', () => {
      const s = specialist.score("driver.findElement(By.id('submit'))");
      expect(s.score).toBeGreaterThanOrEqual(80);
    });

    it('penalizes By.tagName', () => {
      const s = specialist.score("driver.findElement(By.tagName('div'))");
      expect(s.score).toBeLessThan(50);
    });

    it('penalizes By.className', () => {
      const s = specialist.score("driver.findElement(By.className('btn'))");
      expect(s.score).toBeLessThan(55);
    });
  });

  describe('warn', () => {
    it('warns about By.className single class limit', () => {
      const el = makeElement({ attributes: { 'data-testid': 'btn' } });
      const warnings = specialist.warn("driver.findElement(By.className('btn'))", el);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].fix).toBeDefined();
    });

    it('warns about By.tagName too broad', () => {
      const el = makeElement({ attributes: { id: 'submit' } });
      const warnings = specialist.warn("driver.findElement(By.tagName('div'))", el);
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('returns empty for clean selectors', () => {
      const el = makeElement({ attributes: { 'data-testid': 'x' } });
      const warnings = specialist.warn('driver.findElement(By.css(\'[data-testid="x"]\'))', el);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('chain', () => {
    it('generates nested findElement', () => {
      const el = makeElement({
        attributes: { name: 'email' },
        parentChain: [{ tag: 'form', id: 'login', classes: [] }],
      });
      const chained = specialist.chain(el, 3);
      expect(chained.length).toBeGreaterThan(0);
      expect(chained[0].selector).toContain('findElement');
      expect(chained[0].selector).toContain("By.id('login')");
    });

    it('returns empty when no good ancestor', () => {
      const el = makeElement({ parentChain: [{ tag: 'div', id: '', classes: [] }] });
      expect(specialist.chain(el, 3)).toHaveLength(0);
    });
  });

  describe('validateAndFix', () => {
    it('validates correct Selenium syntax', () => {
      expect(specialist.validateAndFix("driver.findElement(By.id('x'))").valid).toBe(true);
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
    it('returns empty for no elements', () => {
      expect(specialist.didYouMean("driver.findElement(By.id('x'))", [])).toHaveLength(0);
    });
  });
});
