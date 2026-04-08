import {
  findAttributeElsewhere,
  findTypoCorrections,
  tokenize,
} from '@/specialists/helpers/suggestions';
import type { PageElement } from '@/types';
import { describe, expect, it } from 'vitest';

describe('tokenize', () => {
  it('detects method completion for Playwright', () => {
    const ctx = tokenize('page.getBy', 'playwright');
    expect(ctx.stage).toBe('method');
    expect(ctx.prefix).toBe('getBy');
  });

  it('detects argument completion for Playwright getByRole', () => {
    const ctx = tokenize("page.getByRole('", 'playwright');
    expect(ctx.stage).toBe('argument');
    expect(ctx.methodName).toBe('getByRole');
    expect(ctx.prefix).toBe('');
  });

  it('detects selector stage for CSS', () => {
    const ctx = tokenize('#my-', 'css');
    expect(ctx.stage).toBe('selector');
    expect(ctx.prefix).toBe('#my-');
  });

  it('detects method completion for Cypress', () => {
    const ctx = tokenize('cy.find', 'cypress');
    expect(ctx.stage).toBe('method');
    expect(ctx.prefix).toBe('find');
  });

  it('detects selector stage for XPath', () => {
    const ctx = tokenize('//div[@', 'xpath');
    expect(ctx.stage).toBe('selector');
  });
});

describe('findTypoCorrections', () => {
  it('finds close matches', () => {
    const results = findTypoCorrections('sumbit', ['submit', 'signup', 'reset'], 2);
    expect(results).toHaveLength(1);
    expect(results[0].candidate).toBe('submit');
    expect(results[0].distance).toBe(2);
  });

  it('returns empty when no close matches', () => {
    const results = findTypoCorrections('xyz', ['submit', 'signup'], 2);
    expect(results).toHaveLength(0);
  });

  it('returns exact matches at distance 0', () => {
    const results = findTypoCorrections('submit', ['submit', 'reset'], 2);
    expect(results[0].distance).toBe(0);
  });
});

describe('findAttributeElsewhere', () => {
  const elements: PageElement[] = [
    {
      tag: 'input',
      id: '',
      classes: [],
      testId: 'login-form',
      role: '',
      ariaLabel: '',
      name: 'email',
      placeholder: '',
      title: '',
      altText: '',
      text: '',
      matchCount: 1,
    },
    {
      tag: 'button',
      id: 'submit',
      classes: [],
      testId: '',
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

  it('finds value in a different attribute', () => {
    const results = findAttributeElsewhere('login-form', elements);
    expect(results).toHaveLength(1);
    expect(results[0].attribute).toBe('testId');
  });

  it('finds value across multiple elements', () => {
    const results = findAttributeElsewhere('Submit', elements);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty when value not found', () => {
    const results = findAttributeElsewhere('nonexistent', elements);
    expect(results).toHaveLength(0);
  });
});
