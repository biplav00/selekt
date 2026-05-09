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

    it('generates getByLabel with exact for aria-label', () => {
      const el = makeElement({ tagName: 'input', attributes: { 'aria-label': 'Search' } });
      const { selectors } = specialist.generate(el);
      expect(
        selectors.some(
          (s) => s.selector.includes("getByLabel('Search'") && s.selector.includes('exact: true')
        )
      ).toBe(true);
    });

    it('generates getByPlaceholder with exact', () => {
      const el = makeElement({ tagName: 'input', attributes: { placeholder: 'Email' } });
      const { selectors } = specialist.generate(el);
      expect(
        selectors.some(
          (s) =>
            s.selector.includes("getByPlaceholder('Email'") && s.selector.includes('exact: true')
        )
      ).toBe(true);
    });

    it('generates getByAltText with exact for images', () => {
      const el = makeElement({ tagName: 'img', attributes: { alt: 'Logo' }, text: '' });
      const { selectors } = specialist.generate(el);
      expect(
        selectors.some(
          (s) => s.selector.includes("getByAltText('Logo'") && s.selector.includes('exact: true')
        )
      ).toBe(true);
    });

    it('generates getByTitle with exact', () => {
      const el = makeElement({ tagName: 'div', attributes: { title: 'Info' }, text: '' });
      const { selectors } = specialist.generate(el);
      expect(
        selectors.some(
          (s) => s.selector.includes("getByTitle('Info'") && s.selector.includes('exact: true')
        )
      ).toBe(true);
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

    // --- Chained locators ---
    it('generates chained locator via parent with id', () => {
      const el = makeElement({
        tagName: 'button',
        text: 'Submit',
        attributes: {},
        accessibleName: 'Submit',
        parentChain: [{ tag: 'form', id: 'login-form', classes: [] }],
      });
      const { selectors } = specialist.generate(el);
      const chained = selectors.find(
        (s) => s.selector.includes("locator('#login-form')") && s.selector.includes('getByRole')
      );
      expect(chained).toBeDefined();
    });

    it('generates chained locator via parent with classes', () => {
      const el = makeElement({
        tagName: 'a',
        text: 'Home',
        attributes: {},
        accessibleName: 'Home',
        parentChain: [{ tag: 'nav', id: '', classes: ['main-nav'] }],
      });
      const { selectors } = specialist.generate(el);
      const chained = selectors.find(
        (s) => s.selector.includes("locator('nav.main-nav')") && s.selector.includes('getByRole')
      );
      expect(chained).toBeDefined();
    });

    it('does not generate chain when parent has no identifier', () => {
      const el = makeElement({
        tagName: 'button',
        text: 'OK',
        attributes: {},
        parentChain: [{ tag: 'div', id: '', classes: [] }],
      });
      const { selectors } = specialist.generate(el);
      expect(
        selectors.every((s) => !s.selector.includes('.locator(') || s.selector.includes('#'))
      ).toBe(true);
    });

    // --- Heading level ---
    it('generates getByRole heading with level for h2', () => {
      const el = makeElement({
        tagName: 'h2',
        text: 'Section Title',
        attributes: {},
        accessibleName: 'Section Title',
      });
      const { selectors } = specialist.generate(el);
      const roleSel = selectors.find((s) => s.selector.includes('getByRole'));
      expect(roleSel?.selector).toContain("'heading'");
      expect(roleSel?.selector).toContain('level: 2');
    });

    it('generates heading level from aria-level', () => {
      const el = makeElement({
        tagName: 'div',
        attributes: { role: 'heading', 'aria-level': '3' },
        accessibleName: 'Title',
      });
      const { selectors } = specialist.generate(el);
      const roleSel = selectors.find((s) => s.selector.includes('getByRole'));
      expect(roleSel?.selector).toContain('level: 3');
    });

    // --- Input type role inference ---
    it('infers checkbox role for input[type=checkbox]', () => {
      const el = makeElement({
        tagName: 'input',
        attributes: { type: 'checkbox' },
        text: '',
        accessibleName: 'Accept terms',
      });
      const { selectors } = specialist.generate(el);
      const roleSel = selectors.find((s) => s.selector.includes('getByRole'));
      expect(roleSel?.selector).toContain("'checkbox'");
    });

    it('infers radio role for input[type=radio]', () => {
      const el = makeElement({
        tagName: 'input',
        attributes: { type: 'radio' },
        text: '',
        accessibleName: 'Option A',
      });
      const { selectors } = specialist.generate(el);
      const roleSel = selectors.find((s) => s.selector.includes('getByRole'));
      expect(roleSel?.selector).toContain("'radio'");
    });

    it('infers slider role for input[type=range]', () => {
      const el = makeElement({
        tagName: 'input',
        attributes: { type: 'range' },
        text: '',
        accessibleName: 'Volume',
      });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes("'slider'"))).toBe(true);
    });

    it('infers searchbox role for input[type=search]', () => {
      const el = makeElement({
        tagName: 'input',
        attributes: { type: 'search' },
        text: '',
        accessibleName: 'Search',
      });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes("'searchbox'"))).toBe(true);
    });

    it('infers spinbutton role for input[type=number]', () => {
      const el = makeElement({
        tagName: 'input',
        attributes: { type: 'number' },
        text: '',
        accessibleName: 'Quantity',
      });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes("'spinbutton'"))).toBe(true);
    });

    // --- State options ---
    it('generates checked option for aria-checked', () => {
      const el = makeElement({
        tagName: 'input',
        attributes: { type: 'checkbox', 'aria-checked': 'true' },
        accessibleName: 'Accept',
      });
      const { selectors } = specialist.generate(el);
      const roleSel = selectors.find((s) => s.selector.includes('getByRole'));
      expect(roleSel?.selector).toContain('checked: true');
    });

    it('generates disabled option for aria-disabled', () => {
      const el = makeElement({
        tagName: 'button',
        attributes: { 'aria-disabled': 'true' },
        accessibleName: 'Submit',
      });
      const { selectors } = specialist.generate(el);
      const roleSel = selectors.find((s) => s.selector.includes('getByRole'));
      expect(roleSel?.selector).toContain('disabled: true');
    });

    it('generates expanded option for aria-expanded', () => {
      const el = makeElement({
        tagName: 'button',
        attributes: { 'aria-expanded': 'false' },
        accessibleName: 'Menu',
      });
      const { selectors } = specialist.generate(el);
      const roleSel = selectors.find((s) => s.selector.includes('getByRole'));
      expect(roleSel?.selector).toContain('expanded: false');
    });

    it('generates pressed option for aria-pressed', () => {
      const el = makeElement({
        tagName: 'button',
        attributes: { 'aria-pressed': 'true' },
        accessibleName: 'Bold',
      });
      const { selectors } = specialist.generate(el);
      const roleSel = selectors.find((s) => s.selector.includes('getByRole'));
      expect(roleSel?.selector).toContain('pressed: true');
    });

    it('generates selected option for aria-selected', () => {
      const el = makeElement({
        tagName: 'div',
        attributes: { role: 'tab', 'aria-selected': 'true' },
        accessibleName: 'Home',
      });
      const { selectors } = specialist.generate(el);
      const roleSel = selectors.find((s) => s.selector.includes('getByRole'));
      expect(roleSel?.selector).toContain('selected: true');
    });

    it('supports aria-checked="mixed" tristate', () => {
      const el = makeElement({
        tagName: 'input',
        attributes: { type: 'checkbox', 'aria-checked': 'mixed' },
        accessibleName: 'Toggle',
      });
      const { selectors } = specialist.generate(el);
      const roleSel = selectors.find((s) => s.selector.includes('getByRole'));
      expect(roleSel?.selector).toContain("checked: 'mixed'");
    });

    it('infers button role for input[type=submit]', () => {
      const el = makeElement({
        tagName: 'input',
        attributes: { type: 'submit' },
        text: '',
        accessibleName: 'Submit',
      });
      const { selectors } = specialist.generate(el);
      expect(selectors.some((s) => s.selector.includes("'button'"))).toBe(true);
    });

    it('infers no role for input[type=hidden]', () => {
      const el = makeElement({
        tagName: 'input',
        attributes: { type: 'hidden' },
        text: '',
        accessibleName: '',
      });
      const { selectors } = specialist.generate(el);
      expect(selectors.every((s) => !s.selector.includes('getByRole'))).toBe(true);
    });

    it('includes heading level in chained selector even without accessible name', () => {
      const el = makeElement({
        tagName: 'h2',
        text: '',
        accessibleName: '',
        attributes: {},
        parentChain: [{ tag: 'section', id: 'hero', classes: [] }],
      });
      const { selectors } = specialist.generate(el);
      const chained = selectors.find(
        (s) => s.selector.includes("locator('#hero')") && s.selector.includes('level: 2')
      );
      expect(chained).toBeDefined();
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

    it('rewards heading with level', () => {
      const withLevel = specialist.score("page.getByRole('heading', { name: 'Title', level: 2 })");
      const without = specialist.score("page.getByRole('heading', { name: 'Title' })");
      expect(withLevel.score).toBeGreaterThan(without.score);
    });

    it('rewards state options', () => {
      const withState = specialist.score(
        "page.getByRole('checkbox', { name: 'Accept', checked: true })"
      );
      const without = specialist.score("page.getByRole('checkbox', { name: 'Accept' })");
      expect(withState.score).toBeGreaterThan(without.score);
    });

    it('rewards exact on getByLabel', () => {
      const withExact = specialist.score("page.getByLabel('Search', { exact: true })");
      const without = specialist.score("page.getByLabel('Search')");
      expect(withExact.score).toBeGreaterThan(without.score);
    });

    it('scores getByAltText', () => {
      const s = specialist.score("page.getByAltText('Logo', { exact: true })");
      expect(s.score).toBeGreaterThanOrEqual(70);
    });

    it('scores getByTitle', () => {
      const s = specialist.score("page.getByTitle('Info', { exact: true })");
      expect(s.score).toBeGreaterThanOrEqual(70);
    });

    it('penalizes .first()', () => {
      const s = specialist.score("page.getByRole('button').first()");
      expect(s.factors.some((f) => f.name === 'usesFirst')).toBe(true);
    });

    it('rewards .filter with hasText', () => {
      const s = specialist.score("page.getByRole('listitem').filter({ hasText: 'Product' })");
      expect(s.factors.some((f) => f.name === 'usesFilter')).toBe(true);
      expect(s.score).toBeGreaterThan(specialist.score("page.getByRole('listitem')").score);
    });

    it('rewards .and()', () => {
      const s = specialist.score("page.getByRole('button').and(page.getByText('Submit'))");
      expect(s.factors.some((f) => f.name === 'usesAnd')).toBe(true);
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

    it('warns heading without level', () => {
      const el = makeElement({ tagName: 'h2', text: 'Title', attributes: {} });
      const warnings = specialist.warn("page.getByRole('heading', { name: 'Title' })", el);
      expect(warnings.some((w) => w.message.includes('level'))).toBe(true);
    });

    it('provides fix for heading without level', () => {
      const el = makeElement({ tagName: 'h2', text: 'Title', attributes: {} });
      const warnings = specialist.warn("page.getByRole('heading', { name: 'Title' })", el);
      const levelWarn = warnings.find((w) => w.message.includes('level'));
      expect(levelWarn?.fix?.selector).toContain('level: 2');
    });

    it('warns for invalid ARIA role', () => {
      const el = makeElement();
      const warnings = specialist.warn("page.getByRole('inputbox')", el);
      expect(warnings.some((w) => w.severity === 'error')).toBe(true);
    });

    it('warns getByText without exact', () => {
      const el = makeElement();
      const warnings = specialist.warn("page.getByText('Submit')", el);
      expect(warnings.some((w) => w.message.includes('exact'))).toBe(true);
    });

    it('warns getByText with very short text', () => {
      const el = makeElement();
      const warnings = specialist.warn("page.getByText('x')", el);
      expect(warnings.some((w) => w.message.includes('short text'))).toBe(true);
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

    it('returns empty when no good ancestor and single match', () => {
      const el = makeElement({ parentChain: [{ tag: 'div', id: '', classes: [] }] });
      expect(specialist.chain(el, 1)).toHaveLength(0);
    });

    it('generates .first() variant when matchCount > 1', () => {
      const el = makeElement({
        tagName: 'button',
        parentChain: [{ tag: 'div', id: '', classes: [] }],
      });
      const chained = specialist.chain(el, 5);
      expect(chained.some((s) => s.selector.includes('.first()'))).toBe(true);
    });

    it('generates .filter({ hasText }) variant when matchCount > 1', () => {
      const el = makeElement({
        tagName: 'button',
        text: 'Submit',
        parentChain: [{ tag: 'div', id: '', classes: [] }],
      });
      const chained = specialist.chain(el, 5);
      expect(chained.some((s) => s.selector.includes('.filter('))).toBe(true);
      expect(chained.some((s) => s.selector.includes("hasText: 'Submit'"))).toBe(true);
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

    it('catches invalid ARIA role', () => {
      const result = specialist.validateAndFix("page.getByRole('inputbox')");
      expect(result.valid).toBe(false);
      expect(result.valid === false && result.error).toContain('Unknown ARIA role');
    });

    it('catches invalid getByRole option', () => {
      const result = specialist.validateAndFix("page.getByRole('button', { naem: 'Submit' })");
      expect(result.valid).toBe(false);
      expect(result.valid === false && result.error).toContain('Unknown getByRole option');
    });

    it('catches invalid chained method', () => {
      const result = specialist.validateAndFix(
        "page.getByRole('button').filterz({ hasText: 'x' })"
      );
      expect(result.valid).toBe(false);
      expect(result.valid === false && result.error).toContain('Unknown chained method');
    });

    it('catches invalid filter option', () => {
      const result = specialist.validateAndFix(
        "page.getByRole('button').filter({ hasTextt: 'x' })"
      );
      expect(result.valid).toBe(false);
      expect(result.valid === false && result.error).toContain('Unknown filter option');
    });

    it('validates valid chained selectors', () => {
      expect(
        specialist.validateAndFix(
          "page.getByRole('listitem').filter({ hasText: 'Product' }).first()"
        ).valid
      ).toBe(true);
    });

    it('validates all valid getByRole options', () => {
      expect(
        specialist.validateAndFix(
          "page.getByRole('heading', { name: 'Title', level: 2, exact: true })"
        ).valid
      ).toBe(true);
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

    it('suggests expanded role list', () => {
      const suggestions = specialist.suggest("page.getByRole('s", emptyPageData());
      expect(suggestions.some((s) => s.label.includes('searchbox'))).toBe(true);
      expect(suggestions.some((s) => s.label.includes('slider'))).toBe(true);
      expect(suggestions.some((s) => s.label.includes('spinbutton'))).toBe(true);
      expect(suggestions.some((s) => s.label.includes('switch'))).toBe(true);
      expect(suggestions.some((s) => s.label.includes('status'))).toBe(true);
      expect(suggestions.some((s) => s.label.includes('separator'))).toBe(true);
    });

    it('suggests chain methods after closing paren', () => {
      const suggestions = specialist.suggest("page.getByRole('button').", emptyPageData());
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.label.includes('.filter'))).toBe(true);
      expect(suggestions.some((s) => s.label.includes('.first'))).toBe(true);
      expect(suggestions.some((s) => s.label.includes('.nth'))).toBe(true);
      expect(suggestions.some((s) => s.label.includes('.and'))).toBe(true);
      expect(suggestions.some((s) => s.label.includes('.or'))).toBe(true);
    });

    it('filters chain method suggestions by prefix', () => {
      const suggestions = specialist.suggest("page.getByRole('button').fi", emptyPageData());
      expect(suggestions.every((s) => s.label.includes('.fi'))).toBe(true);
    });

    it('caps role suggestion results', () => {
      // Empty prefix matches all roles; should be capped at 10.
      const suggestions = specialist.suggest("page.getByRole('", emptyPageData());
      expect(suggestions.length).toBeLessThanOrEqual(10);
    });
  });

  describe('regex robustness', () => {
    it('detects heading missing level with double-quoted role', () => {
      const el = makeElement({ tagName: 'h2', text: 'Title', attributes: {} });
      const warnings = specialist.warn('page.getByRole("heading", { name: "Title" })', el);
      expect(warnings.some((w) => w.message.includes('level'))).toBe(true);
    });

    it('detects invalid role with double-quoted syntax', () => {
      const el = makeElement();
      const warnings = specialist.warn('page.getByRole("inputbox")', el);
      expect(warnings.some((w) => w.severity === 'error')).toBe(true);
    });
  });

  describe('didYouMean', () => {
    it('returns empty for no elements', () => {
      expect(specialist.didYouMean("page.getByTestId('x')", emptyPageData())).toHaveLength(0);
    });
  });
});
