import { describe, it, expect, beforeEach } from 'vitest';
import { generateLocators } from '../utils/locators';

describe('a11y and robustness', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('prefers getByLabel over getByPlaceholder', () => {
    const id = 'my-input';
    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = 'Email address';
    const input = document.createElement('input');
    input.id = id;
    input.setAttribute('placeholder', 'Enter email');
    document.body.appendChild(label);
    document.body.appendChild(input);
    const locs = generateLocators(input);
    const labelIdx = locs.findIndex((l) => l.kind === 'label');
    const placeholderIdx = locs.findIndex((l) => l.kind === 'placeholder');
    expect(labelIdx).not.toBe(-1);
    expect(placeholderIdx).not.toBe(-1);
    expect(labelIdx).toBeLessThan(placeholderIdx); // label ranked higher
    expect(locs.find((l) => l.kind === 'label')!.score).toBeGreaterThan(
      locs.find((l) => l.kind === 'placeholder')!.score
    );
  });

  it('handles heading with level', () => {
    const h2 = document.createElement('h2');
    h2.textContent = 'Section Title';
    document.body.appendChild(h2);
    const locs = generateLocators(h2);
    expect(
      locs.some((l) => l.value.includes("getByRole('heading'") && l.value.includes('level: 2'))
    ).toBe(true);
  });

  it('demotes dynamic ids', () => {
    const el = document.createElement('div');
    el.id = 'radix-:r1:';
    document.body.appendChild(el);
    const locs = generateLocators(el);
    // Should NOT have id locator for dynamic id
    expect(locs.some((l) => l.kind === 'id' && l.value.includes('radix'))).toBe(false);
    // Should still have css fallback as page.locator
    expect(locs.some((l) => l.kind === 'css')).toBe(true);
  });

  it('ignores aria-hidden subtree', () => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('aria-hidden', 'true');
    const btn = document.createElement('button');
    btn.textContent = 'Hidden';
    wrapper.appendChild(btn);
    document.body.appendChild(wrapper);
    const locs = generateLocators(btn);
    // Should not have high-score role locators
    expect(
      locs.find((l) => l.kind === 'role' && l.value.includes('Hidden'))?.score
    ).toBeUndefined();
    // But still has fallback css
    expect(locs.some((l) => l.kind === 'css')).toBe(true);
  });

  it('handles aria-labelledby with multiple ids', () => {
    const ref1 = document.createElement('span');
    ref1.id = 'ref1';
    ref1.textContent = 'First';
    const ref2 = document.createElement('span');
    ref2.id = 'ref2';
    ref2.textContent = 'Second';
    const btn = document.createElement('button');
    btn.setAttribute('aria-labelledby', 'ref1 ref2');
    document.body.appendChild(ref1);
    document.body.appendChild(ref2);
    document.body.appendChild(btn);
    const locs = generateLocators(btn);
    expect(locs.some((l) => l.value.includes('First Second'))).toBe(true);
  });

  it('generates getByAltText for images', () => {
    const img = document.createElement('img');
    img.setAttribute('alt', 'Company logo');
    document.body.appendChild(img);
    const locs = generateLocators(img);
    expect(locs.some((l) => l.value.includes("getByAltText('Company logo')"))).toBe(true);
  });

  it('bare role without name is demoted', () => {
    const btn = document.createElement('button');
    btn.textContent = ''; // no name
    document.body.appendChild(btn);
    const locs = generateLocators(btn);
    const bare = locs.find((l) => l.value === "page.getByRole('button')");
    expect(bare).toBeDefined();
    expect(bare!.score).toBe(40); // demoted below css
  });

  it('all locators are Playwright syntax', () => {
    const el = document.createElement('input');
    el.id = 'test';
    el.setAttribute('data-testid', 'my-test');
    el.setAttribute('placeholder', 'placeholder');
    el.setAttribute('aria-label', 'label');
    document.body.appendChild(el);
    const locs = generateLocators(el);
    for (const l of locs) {
      expect(l.value.startsWith('page.')).toBe(true);
      expect(l.value).not.toBe('#test');
      expect(l.value).not.toMatch(/^\/\//);
    }
  });

  it('escapes backslashes and quotes', () => {
    const el = document.createElement('button');
    el.setAttribute('data-testid', "a\\b'c");
    document.body.appendChild(el);
    const locs = generateLocators(el);
    expect(locs[0].value).toContain("a\\\\b\\'c");
  });

  it('handles anchor without href as not link', () => {
    const a = document.createElement('a');
    a.textContent = 'Click';
    document.body.appendChild(a);
    const locs = generateLocators(a);
    expect(locs.some((l) => l.value.includes("getByRole('link'"))).toBe(false);
  });

  it('handles anchor with href as link', () => {
    const a = document.createElement('a');
    a.setAttribute('href', 'https://example.com');
    a.textContent = 'Go';
    document.body.appendChild(a);
    const locs = generateLocators(a);
    expect(locs.some((l) => l.value.includes("getByRole('link'"))).toBe(true);
  });
});
