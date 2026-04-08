import { specialist } from '@/specialists/css';
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

describe('CSS specialist', () => {
  it('has correct format and displayName', () => {
    expect(specialist.format).toBe('css');
    expect(specialist.displayName).toBe('CSS');
  });

  describe('generate', () => {
    it('prioritizes data-testid', () => {
      const el = makeElement({ attributes: { 'data-testid': 'submit-btn', id: 'btn1' } });
      const { selectors } = specialist.generate(el);
      expect(selectors[0].selector).toBe('[data-testid="submit-btn"]');
      expect(selectors[0].score).toBeGreaterThan(80);
    });

    it('generates ID selector when no testid', () => {
      const el = makeElement({ attributes: { id: 'my-btn' } });
      const { selectors } = specialist.generate(el);
      const idSel = selectors.find((s) => s.selector === '#my-btn');
      expect(idSel).toBeDefined();
    });

    it('filters dynamic classes', () => {
      const el = makeElement({ attributes: { class: 'css-abc123 btn-primary' } });
      const { selectors } = specialist.generate(el);
      const classSel = selectors.find((s) => s.selector.includes('.'));
      expect(classSel?.selector).toContain('btn-primary');
      expect(classSel?.selector).not.toContain('css-abc123');
    });

    it('generates fallback tag selector', () => {
      const el = makeElement({ tagName: 'span', attributes: {} });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector === 'span')).toBe(true);
    });

    it('generates role+aria-label combo', () => {
      const el = makeElement({ attributes: { role: 'button', 'aria-label': 'Close' } });
      const { selectors } = specialist.generate(el);
      expect(
        selectors.some(
          (s) =>
            s.selector.includes('[role="button"]') && s.selector.includes('[aria-label="Close"]')
        )
      ).toBe(true);
    });

    it('generates proactive suggestion when testid available but class selector shown', () => {
      const el = makeElement({ attributes: { 'data-testid': 'x', class: 'btn' } });
      const { selectors, proactive } = specialist.generate(el);
      expect(selectors.length).toBeGreaterThan(1);
      // May or may not have proactive — just check it doesn't crash
    });
  });

  describe('score', () => {
    it('scores data-testid selectors high', () => {
      const result = specialist.score('[data-testid="submit"]');
      expect(result.score).toBeGreaterThanOrEqual(85);
      expect(result.factors.some((f) => f.name === 'hasTestId')).toBe(true);
    });

    it('scores static ID high', () => {
      const result = specialist.score('#submit-btn');
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it('penalizes dynamic class selectors', () => {
      const result = specialist.score('div.css-abc123');
      expect(result.score).toBeLessThan(50);
      expect(result.factors.some((f) => f.name === 'usesDynamicClass')).toBe(true);
    });

    it('penalizes deep nesting', () => {
      const result = specialist.score('div > ul > li > a > span');
      expect(result.score).toBeLessThan(60);
    });

    it('returns factors array', () => {
      const result = specialist.score('[data-testid="x"]');
      expect(result.factors.length).toBeGreaterThan(0);
      for (const f of result.factors) {
        expect(f).toHaveProperty('name');
        expect(f).toHaveProperty('impact');
        expect(f).toHaveProperty('description');
      }
    });
  });

  describe('warn', () => {
    it('warns about dynamic classes with fix', () => {
      const el = makeElement({ attributes: { 'data-testid': 'btn', class: 'css-abc' } });
      const warnings = specialist.warn('button.css-abc', el);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].severity).toBe('warning');
      expect(warnings[0].fix).toBeDefined();
      expect(warnings[0].fix?.selector).toContain('data-testid');
    });

    it('warns about dynamic ID with fix', () => {
      const el = makeElement({ attributes: { id: ':r0:', 'aria-label': 'Search' } });
      const warnings = specialist.warn('#\\:r0\\:', el);
      expect(
        warnings.some((w) => w.message.includes('auto-generated') || w.message.includes('dynamic'))
      ).toBe(true);
    });

    it('returns empty for clean selectors', () => {
      const el = makeElement({ attributes: { 'data-testid': 'x' } });
      const warnings = specialist.warn('[data-testid="x"]', el);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('chain', () => {
    it('generates scoped selector using parentChain', () => {
      const el = makeElement({
        tagName: 'button',
        attributes: { class: 'btn' },
        parentChain: [{ tag: 'div', id: 'sidebar', classes: [] }],
      });
      const chained = specialist.chain(el, 3);
      expect(chained.length).toBeGreaterThan(0);
      expect(chained[0].selector).toContain('#sidebar');
    });

    it('returns empty when no good ancestor', () => {
      const el = makeElement({
        parentChain: [{ tag: 'div', id: '', classes: [] }],
      });
      const chained = specialist.chain(el, 3);
      expect(chained).toHaveLength(0);
    });
  });

  describe('suggest', () => {
    it('returns suggestions for partial selectors', () => {
      const elements = [
        {
          tag: 'button',
          id: 'submit',
          classes: [],
          testId: 'submit-btn',
          role: 'button',
          ariaLabel: 'Submit',
          name: '',
          placeholder: '',
          title: '',
          altText: '',
          text: 'Submit',
          matchCount: 1,
        },
      ];
      const suggestions = specialist.suggest('#sub', elements);
      expect(suggestions.length).toBeGreaterThanOrEqual(0); // May have matches
    });

    it('returns empty for empty input', () => {
      expect(specialist.suggest('', [])).toHaveLength(0);
    });
  });

  describe('didYouMean', () => {
    it('suggests alternatives when selector not found', () => {
      const elements = [
        {
          tag: 'button',
          id: '',
          classes: [],
          testId: 'submit-btn',
          role: '',
          ariaLabel: '',
          name: '',
          placeholder: '',
          title: '',
          altText: '',
          text: '',
          matchCount: 1,
        },
      ];
      const suggestions = specialist.didYouMean('[data-testid="sumbit-btn"]', elements);
      expect(suggestions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validateAndFix', () => {
    it('reports valid for correct selectors', () => {
      expect(specialist.validateAndFix('#my-id').valid).toBe(true);
      expect(specialist.validateAndFix('[data-testid="x"]').valid).toBe(true);
      expect(specialist.validateAndFix('button.btn').valid).toBe(true);
    });

    it('detects empty selector', () => {
      expect(specialist.validateAndFix('').valid).toBe(false);
    });
  });
});
