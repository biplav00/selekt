import { describe, expect, it } from 'vitest';
import { SEMANTIC_TAGS, isDynamicClass, isDynamicId } from '@/specialists/helpers/dynamic-detect';

describe('isDynamicClass', () => {
  it('detects CSS-in-JS patterns', () => {
    expect(isDynamicClass('css-a3f2x')).toBe(true);
    expect(isDynamicClass('sc-bdnxRM')).toBe(true);
    expect(isDynamicClass('jsx-abc123')).toBe(true);
    expect(isDynamicClass('svelte-1abc2d')).toBe(true);
  });

  it('detects hash-like short tokens', () => {
    expect(isDynamicClass('abcde')).toBe(true);
    expect(isDynamicClass('a1b2c3')).toBe(true);
  });

  it('rejects normal class names', () => {
    expect(isDynamicClass('btn-primary')).toBe(false);
    expect(isDynamicClass('container')).toBe(false);
    expect(isDynamicClass('nav-link')).toBe(false);
  });
});

describe('isDynamicId', () => {
  it('detects UUID-like IDs', () => {
    expect(isDynamicId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
  });

  it('detects React useId patterns', () => {
    expect(isDynamicId(':r0:')).toBe(true);
    expect(isDynamicId(':r1a:')).toBe(true);
  });

  it('detects IDs with 4+ consecutive digits', () => {
    expect(isDynamicId('user-38291')).toBe(true);
  });

  it('rejects stable IDs', () => {
    expect(isDynamicId('main-nav')).toBe(false);
    expect(isDynamicId('sidebar')).toBe(false);
    expect(isDynamicId('form-123')).toBe(false);
  });
});

describe('SEMANTIC_TAGS', () => {
  it('includes common semantic tags', () => {
    expect(SEMANTIC_TAGS.has('button')).toBe(true);
    expect(SEMANTIC_TAGS.has('nav')).toBe(true);
    expect(SEMANTIC_TAGS.has('main')).toBe(true);
    expect(SEMANTIC_TAGS.has('h1')).toBe(true);
  });

  it('excludes non-semantic tags', () => {
    expect(SEMANTIC_TAGS.has('div')).toBe(false);
    expect(SEMANTIC_TAGS.has('span')).toBe(false);
  });
});
