import { describe, it, expect, beforeEach } from 'vitest';
import { generateLocators } from '../utils/locators';

describe('Playwright-only locators', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('generates getByTestId as top priority', () => {
    const el = document.createElement('button');
    el.setAttribute('data-testid', 'submit-btn');
    el.textContent = 'Submit';
    document.body.appendChild(el);
    const locs = generateLocators(el);
    expect(locs[0].value).toBe("page.getByTestId('submit-btn')");
    expect(locs[0].kind).toBe('testId');
    // All values must be Playwright syntax
    for (const l of locs) {
      expect(l.value.startsWith('page.')).toBe(true);
    }
  });

  it('generates getByRole with name', () => {
    const el = document.createElement('button');
    el.textContent = 'Click me';
    document.body.appendChild(el);
    const locs = generateLocators(el);
    const roleLoc = locs.find((l) => l.kind === 'role' && l.value.includes("getByRole('button'"));
    expect(roleLoc).toBeDefined();
    expect(roleLoc!.value).toContain("name: 'Click me'");
  });

  it('generates getByPlaceholder', () => {
    const el = document.createElement('input');
    el.setAttribute('placeholder', 'Enter name');
    document.body.appendChild(el);
    const locs = generateLocators(el);
    expect(locs.some((l) => l.value === "page.getByPlaceholder('Enter name')")).toBe(true);
  });

  it('generates getByText for leaf elements', () => {
    const el = document.createElement('span');
    el.textContent = 'Hello World';
    document.body.appendChild(el);
    const locs = generateLocators(el);
    expect(locs.some((l) => l.value === "page.getByText('Hello World')")).toBe(true);
  });

  it('does not generate raw CSS or raw XPath', () => {
    const el = document.createElement('div');
    el.id = 'my-id';
    document.body.appendChild(el);
    const locs = generateLocators(el);
    // Should have page.locator for id, not raw '#my-id'
    expect(locs.some((l) => l.value === '#my-id')).toBe(false);
    expect(locs.some((l) => l.value === '//*[@id="my-id"]')).toBe(false);
    expect(locs.some((l) => l.value === "page.locator('#my-id')")).toBe(true);
    // All locators must be page. prefix
    for (const l of locs) {
      expect(l.value.startsWith('page.')).toBe(true);
    }
  });

  it('escapes single quotes in locators', () => {
    const el = document.createElement('button');
    el.setAttribute('data-testid', "test'id");
    el.textContent = "It's tricky";
    document.body.appendChild(el);
    const locs = generateLocators(el);
    const testIdLoc = locs.find((l) => l.kind === 'testId');
    expect(testIdLoc!.value).toContain("\\'");
  });

  it('handles element with aria-label', () => {
    const el = document.createElement('button');
    el.setAttribute('aria-label', 'Close dialog');
    document.body.appendChild(el);
    const locs = generateLocators(el);
    // Aria-label should produce getByRole with name, not raw getByLabel (a11y correct)
    expect(
      locs.some((l) => l.value.includes("getByRole('button'") && l.value.includes('Close dialog'))
    ).toBe(true);
    // Should NOT produce hidden or presentation locators
    expect(locs.every((l) => !l.value.includes('presentation'))).toBe(true);
  });

  it('deduplicates locators', () => {
    const el = document.createElement('button');
    el.setAttribute('data-testid', 'dup');
    el.setAttribute('id', 'dup');
    el.textContent = 'dup';
    document.body.appendChild(el);
    const locs = generateLocators(el);
    const values = locs.map((l) => l.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('generates page.locator for CSS fallback', () => {
    const parent = document.createElement('div');
    parent.id = 'parent';
    const child = document.createElement('span');
    child.textContent = 'child';
    parent.appendChild(child);
    document.body.appendChild(parent);
    const locs = generateLocators(child);
    const cssLoc = locs.find((l) => l.kind === 'css');
    expect(cssLoc).toBeDefined();
    expect(cssLoc!.value.startsWith("page.locator('")).toBe(true);
  });

  it('handles checkbox role', () => {
    const el = document.createElement('input');
    (el as HTMLInputElement).type = 'checkbox';
    el.setAttribute('aria-label', 'Accept terms');
    document.body.appendChild(el);
    const locs = generateLocators(el);
    expect(locs.some((l) => l.value.includes("getByRole('checkbox'"))).toBe(true);
  });

  it('returns empty for detached element gracefully', () => {
    const el = document.createElement('div');
    expect(() => generateLocators(el)).not.toThrow();
  });
});
