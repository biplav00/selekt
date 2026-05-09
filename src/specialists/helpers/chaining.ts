import { isDynamicClass } from './dynamic-detect';
import { cssEscape } from './escaping';

interface AncestorInfo {
  tag: string;
  id: string;
  classes: string[];
}

/**
 * Find the nearest ancestor with a unique identifier suitable for scoping.
 * Returns the CSS selector for the ancestor and its depth in the chain.
 */
export function findScopingAncestor(
  parentChain: AncestorInfo[]
): { depth: number; selector: string } | null {
  for (let i = 0; i < parentChain.length; i++) {
    const a = parentChain[i];

    // Best: ancestor has a static ID
    if (a.id && !a.id.includes(' ')) {
      return { depth: i, selector: `#${cssEscape(a.id)}` };
    }

    // Good: ancestor has non-dynamic classes
    const stableClasses = a.classes.filter((c) => c && !isDynamicClass(c));
    if (stableClasses.length > 0) {
      return {
        depth: i,
        selector: `${a.tag}.${stableClasses.slice(0, 2).map(cssEscape).join('.')}`,
      };
    }
  }

  return null;
}

/**
 * Check if an element's tag is unique among its siblings.
 */
export function isUniqueAmongSiblings(tag: string, siblingTags: string[]): boolean {
  return !siblingTags.some((s) => s === tag);
}

/**
 * Get a 1-based position index for the element among same-tag siblings.
 * Returns null if the element is unique by tag.
 */
export function getPositionQualifier(
  tag: string,
  siblingTags: string[],
  indexAmongSameTag: number
): { index: number; total: number } | null {
  const sameTagCount = siblingTags.filter((s) => s === tag).length;
  if (sameTagCount === 0) return null;
  return { index: indexAmongSameTag + 1, total: sameTagCount + 1 };
}
