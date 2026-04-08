import { buildRichPageData, emptyPageData } from '@/specialists/helpers/page-data';
import { specialist } from '@/specialists/playwright';
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

describe('Playwright specialist', () => {
  it('has correct format', () => {
    expect(specialist.format).toBe('playwright');
    expect(specialist.displayName).toBe('Playwright');
  });

  describe('generate', () => {
    it('prioritizes getByTestId', () => {
      const el = makeElement({ attributes: { 'data-testid': 'submit-btn' } });
      const { selectors } = specialist.generate(el);
      expect(selectors[0].selector).toContain("getByTestId('submit-btn')");
    });

    it('generates getByRole with name for buttons', () => {
      const el = makeElement({ tagName: 'button', text: 'Submit', attributes: {} });
      const { selectors } = specialist.generate(el);
      const roleSel = selectors.find((s) => s.selector.includes('getByRole'));
      expect(roleSel).toBeDefined();
      expect(roleSel?.selector).toContain("'button'");
      expect(roleSel?.selector).toContain("name: 'Submit'");
    });

    it('infers roles for semantic HTML', () => {
      const el = makeElement({ tagName: 'a', text: 'Home', attributes: {} });
      const { selectors } = specialist.generate(el);
      const roleSel = selectors.find((s) => s.selector.includes('getByRole'));
      expect(roleSel?.selector).toContain("'link'");
    });

    it('generates getByLabel for aria-label', () => {
      const el = makeElement({ tagName: 'input', attributes: { 'aria-label': 'Search' } });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes("getByLabel('Search')"))).toBe(true);
    });

    it('generates getByPlaceholder', () => {
      const el = makeElement({ tagName: 'input', attributes: { placeholder: 'Email' } });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes("getByPlaceholder('Email')"))).toBe(true);
    });

    it('generates getByAltText for images', () => {
      const el = makeElement({ tagName: 'img', attributes: { alt: 'Logo' }, text: '' });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes("getByAltText('Logo')"))).toBe(true);
    });

    it('generates getByText', () => {
      const el = makeElement({ tagName: 'span', text: 'Hello World', attributes: {} });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes('getByText'))).toBe(true);
    });

    it('generates CSS locator fallback', () => {
      const el = makeElement({ tagName: 'div', text: '', attributes: { id: 'root' } });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes("locator('#root')"))).toBe(true);
    });

    it('generates getByRole with explicit role', () => {
      const el = makeElement({ attributes: { role: 'dialog' }, accessibleName: 'Settings' });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes("getByRole('dialog'"))).toBe(true);
    });
  });

  describe('score', () => {
    it('scores getByTestId highest', () => {
      const s = specialist.score("page.getByTestId('submit-btn')");
      expect(s.score).toBeGreaterThanOrEqual(90);
    });

    it('scores getByRole+name high', () => {
      const s = specialist.score("page.getByRole('button', { name: 'Submit' })");
      expect(s.score).toBeGreaterThanOrEqual(80);
    });

    it('scores locator CSS lower', () => {
      const s = specialist.score("page.locator('.btn-primary')");
      expect(s.score).toBeLessThan(70);
    });

    it('penalizes .nth()', () => {
      const s = specialist.score("page.getByRole('listitem').nth(2)");
      expect(s.score).toBeLessThan(70);
    });
  });

  describe('warn', () => {
    it('warns when locator uses CSS class', () => {
      const el = makeElement({
        tagName: 'button',
        attributes: { role: 'button' },
        accessibleName: 'Submit',
      });
      const warnings = specialist.warn("page.locator('.btn')", el);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].fix).toBeDefined();
    });

    it('warns when getByRole has no name', () => {
      const el = makeElement({ accessibleName: 'Submit' });
      const warnings = specialist.warn("page.getByRole('button')", el);
      expect(warnings.some((w) => w.message.toLowerCase().includes('name'))).toBe(true);
    });

    it('returns empty for clean selectors', () => {
      const el = makeElement({ attributes: { 'data-testid': 'x' } });
      const warnings = specialist.warn("page.getByTestId('x')", el);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('chain', () => {
    it('generates scoped selector', () => {
      const el = makeElement({
        tagName: 'a',
        attributes: { 'aria-label': 'Home' },
        parentChain: [{ tag: 'nav', id: '', classes: ['main-nav'] }],
      });
      const chained = specialist.chain(el, 3);
      expect(chained.length).toBeGreaterThan(0);
    });

    it('returns empty when no good ancestor', () => {
      const el = makeElement({ parentChain: [{ tag: 'div', id: '', classes: [] }] });
      expect(specialist.chain(el, 3)).toHaveLength(0);
    });
  });

  describe('validateAndFix', () => {
    it('validates correct Playwright syntax', () => {
      expect(specialist.validateAndFix("page.getByRole('button')").valid).toBe(true);
      expect(specialist.validateAndFix("page.getByTestId('x')").valid).toBe(true);
    });

    it('catches invalid method names', () => {
      const result = specialist.validateAndFix("page.getByXyz('foo')");
      expect(result.valid).toBe(false);
    });

    it('detects empty selector', () => {
      expect(specialist.validateAndFix('').valid).toBe(false);
    });
  });

  describe('suggest', () => {
    it('returns empty for empty input', () => {
      expect(specialist.suggest('', emptyPageData())).toHaveLength(0);
    });

    it('suggests methods after page.getBy', () => {
      const suggestions = specialist.suggest('page.getBy', emptyPageData());
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.selector.includes('getByRole'))).toBe(true);
    });
  });

  describe('didYouMean', () => {
    it('returns empty for no elements', () => {
      expect(specialist.didYouMean("page.getByTestId('x')", emptyPageData())).toHaveLength(0);
    });
  });
});
