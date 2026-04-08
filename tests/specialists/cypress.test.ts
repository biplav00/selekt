import { specialist } from '@/specialists/cypress';
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

describe('Cypress specialist', () => {
  it('has correct format', () => {
    expect(specialist.format).toBe('cypress');
    expect(specialist.displayName).toBe('Cypress');
  });

  describe('generate', () => {
    it('prioritizes data-testid', () => {
      const el = makeElement({ attributes: { 'data-testid': 'submit-btn' } });
      const { selectors } = specialist.generate(el);
      expect(selectors[0].selector).toContain('cy.get(\'[data-testid="submit-btn"]\')');
    });

    it('generates findByRole for Testing Library', () => {
      const el = makeElement({ attributes: { role: 'button' }, accessibleName: 'Submit' });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes('findByRole'))).toBe(true);
    });

    it('generates cy.contains for text', () => {
      const el = makeElement({ text: 'Click me' });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes('contains'))).toBe(true);
    });

    it('generates ID selector', () => {
      const el = makeElement({ attributes: { id: 'my-btn' } });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes("cy.get('#my-btn')"))).toBe(true);
    });

    it('generates aria-label selector', () => {
      const el = makeElement({ attributes: { 'aria-label': 'Close' } });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes('aria-label'))).toBe(true);
    });

    it('generates fallback tag selector', () => {
      const el = makeElement({ tagName: 'div', text: '', attributes: {} });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector === "cy.get('div')")).toBe(true);
    });
  });

  describe('score', () => {
    it('scores data-testid high', () => {
      const s = specialist.score('cy.get(\'[data-testid="x"]\')');
      expect(s.score).toBeGreaterThanOrEqual(85);
    });

    it('scores findByRole high', () => {
      const s = specialist.score("cy.findByRole('button', { name: 'Submit' })");
      expect(s.score).toBeGreaterThanOrEqual(80);
    });

    it('penalizes .eq()', () => {
      const s = specialist.score("cy.get('.item').eq(2)");
      expect(s.score).toBeLessThan(50);
    });

    it('penalizes dynamic classes', () => {
      const s = specialist.score("cy.get('.css-abc123')");
      expect(s.score).toBeLessThan(50);
    });
  });

  describe('warn', () => {
    it('warns about cy.contains case sensitivity', () => {
      const el = makeElement({ attributes: { role: 'button' }, accessibleName: 'Submit' });
      const warnings = specialist.warn("cy.contains('Submit')", el);
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('warns about class selector with fix', () => {
      const el = makeElement({ attributes: { 'data-testid': 'btn' } });
      const warnings = specialist.warn("cy.get('.btn-primary')", el);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].fix).toBeDefined();
    });

    it('returns empty for clean selectors', () => {
      const el = makeElement({ attributes: { 'data-testid': 'x' } });
      const warnings = specialist.warn('cy.get(\'[data-testid="x"]\')', el);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('chain', () => {
    it('generates .find() chain', () => {
      const el = makeElement({
        attributes: { class: 'nav-link' },
        parentChain: [{ tag: 'div', id: 'sidebar', classes: [] }],
      });
      const chained = specialist.chain(el, 3);
      expect(chained.length).toBeGreaterThan(0);
      expect(chained[0].selector).toContain('.find(');
    });

    it('returns empty when no good ancestor', () => {
      const el = makeElement({ parentChain: [{ tag: 'div', id: '', classes: [] }] });
      expect(specialist.chain(el, 3)).toHaveLength(0);
    });
  });

  describe('validateAndFix', () => {
    it('validates correct Cypress syntax', () => {
      expect(specialist.validateAndFix("cy.get('#foo')").valid).toBe(true);
      expect(specialist.validateAndFix("cy.contains('text')").valid).toBe(true);
    });

    it('detects empty selector', () => {
      expect(specialist.validateAndFix('').valid).toBe(false);
    });
  });

  describe('suggest', () => {
    it('returns empty for empty input', () => {
      expect(specialist.suggest('', [])).toHaveLength(0);
    });

    it('suggests methods after cy.', () => {
      const suggestions = specialist.suggest('cy.', []);
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('didYouMean', () => {
    it('returns empty for no elements', () => {
      expect(specialist.didYouMean('cy.get(\'[data-testid="x"]\')', [])).toHaveLength(0);
    });
  });
});
