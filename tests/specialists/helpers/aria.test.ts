import {
  IMPLICIT_ROLES,
  ROLE_TO_TAGS,
  computeAccessibleName,
  getInferredRole,
} from '@/specialists/helpers/aria';
import { describe, expect, it } from 'vitest';

describe('IMPLICIT_ROLES', () => {
  it('maps button to button', () => {
    expect(IMPLICIT_ROLES.button).toBe('button');
  });

  it('maps a to link', () => {
    expect(IMPLICIT_ROLES.a).toBe('link');
  });

  it('maps h1-h6 to heading', () => {
    expect(IMPLICIT_ROLES.h1).toBe('heading');
    expect(IMPLICIT_ROLES.h6).toBe('heading');
  });
});

describe('ROLE_TO_TAGS', () => {
  it('maps button role to button and summary tags', () => {
    expect(ROLE_TO_TAGS.button).toContain('button');
    expect(ROLE_TO_TAGS.button).toContain('summary');
  });

  it('maps heading to h1-h6', () => {
    expect(ROLE_TO_TAGS.heading).toContain('h1');
    expect(ROLE_TO_TAGS.heading).toContain('h6');
  });
});

describe('getInferredRole', () => {
  it('returns explicit role from attributes', () => {
    expect(getInferredRole('div', { role: 'navigation' })).toBe('navigation');
  });

  it('returns implicit role from tag', () => {
    expect(getInferredRole('button', {})).toBe('button');
    expect(getInferredRole('a', {})).toBe('link');
    expect(getInferredRole('nav', {})).toBe('navigation');
  });

  it('returns undefined for non-semantic tags', () => {
    expect(getInferredRole('div', {})).toBeUndefined();
    expect(getInferredRole('span', {})).toBeUndefined();
  });

  it('prefers explicit role over implicit', () => {
    expect(getInferredRole('button', { role: 'tab' })).toBe('tab');
  });
});

describe('computeAccessibleName', () => {
  it('returns aria-label when present', () => {
    expect(computeAccessibleName({ 'aria-label': 'Search' }, 'text')).toBe('Search');
  });

  it('returns alt when no aria-label', () => {
    expect(computeAccessibleName({ alt: 'Logo' }, '')).toBe('Logo');
  });

  it('returns title when no aria-label or alt', () => {
    expect(computeAccessibleName({ title: 'Help' }, '')).toBe('Help');
  });

  it('returns placeholder when no other attributes', () => {
    expect(computeAccessibleName({ placeholder: 'Enter email' }, '')).toBe('Enter email');
  });

  it('returns text content as fallback', () => {
    expect(computeAccessibleName({}, 'Click me')).toBe('Click me');
  });

  it('returns empty for long text', () => {
    const longText = 'a'.repeat(100);
    expect(computeAccessibleName({}, longText)).toBe('');
  });

  it('returns empty when nothing available', () => {
    expect(computeAccessibleName({}, '')).toBe('');
  });
});
