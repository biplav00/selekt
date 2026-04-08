import { describe, expect, it } from 'vitest';
import {
  findScopingAncestor,
  getPositionQualifier,
  isUniqueAmongSiblings,
} from '@/specialists/helpers/chaining';

describe('findScopingAncestor', () => {
  it('returns ancestor with id', () => {
    const chain = [
      { tag: 'div', id: '', classes: [] },
      { tag: 'nav', id: 'main-nav', classes: [] },
      { tag: 'div', id: '', classes: ['page'] },
    ];
    const result = findScopingAncestor(chain);
    expect(result).not.toBeNull();
    expect(result!.selector).toBe('#main-nav');
    expect(result!.depth).toBe(1);
  });

  it('returns ancestor with stable classes', () => {
    const chain = [
      { tag: 'div', id: '', classes: ['container'] },
    ];
    const result = findScopingAncestor(chain);
    expect(result).not.toBeNull();
    expect(result!.selector).toBe('div.container');
  });

  it('prefers id over classes', () => {
    const chain = [
      { tag: 'div', id: 'root', classes: ['container'] },
    ];
    const result = findScopingAncestor(chain);
    expect(result!.selector).toBe('#root');
  });

  it('skips dynamic classes', () => {
    const chain = [
      { tag: 'div', id: '', classes: ['css-abc12'] },
      { tag: 'section', id: '', classes: ['main-content'] },
    ];
    const result = findScopingAncestor(chain);
    expect(result).not.toBeNull();
    expect(result!.selector).toBe('section.main-content');
    expect(result!.depth).toBe(1);
  });

  it('returns null when no good ancestor', () => {
    const chain = [
      { tag: 'div', id: '', classes: [] },
      { tag: 'div', id: '', classes: [] },
    ];
    expect(findScopingAncestor(chain)).toBeNull();
  });

  it('returns null for empty chain', () => {
    expect(findScopingAncestor([])).toBeNull();
  });
});

describe('isUniqueAmongSiblings', () => {
  it('returns true when tag is unique', () => {
    expect(isUniqueAmongSiblings('button', ['div', 'span', 'a'])).toBe(true);
  });

  it('returns false when same tag exists in siblings', () => {
    expect(isUniqueAmongSiblings('div', ['div', 'span', 'div'])).toBe(false);
  });

  it('returns true when no siblings', () => {
    expect(isUniqueAmongSiblings('div', [])).toBe(true);
  });
});

describe('getPositionQualifier', () => {
  it('returns index when tag is not unique', () => {
    const result = getPositionQualifier('li', ['li', 'li', 'li'], 1);
    expect(result).toEqual({ index: 2, total: 4 });
  });

  it('returns null when tag is unique', () => {
    expect(getPositionQualifier('button', ['div', 'span'], 0)).toBeNull();
  });
});
