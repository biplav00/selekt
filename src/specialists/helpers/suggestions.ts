import type { PageElement, SelectorFormat } from '@/types';
import type { TokenContext } from '../types';

/**
 * Tokenize a partial selector input to determine the cursor context.
 * Used by specialists to generate relevant autocomplete suggestions.
 */
export function tokenize(partial: string, format: SelectorFormat): TokenContext {
  if (format === 'playwright') {
    const methodMatch = partial.match(/^page\.(\w*)$/);
    if (methodMatch) {
      return { format, stage: 'method', prefix: methodMatch[1] };
    }
    const argMatch = partial.match(/^page\.(\w+)\((['"`])([^'"`]*)$/);
    if (argMatch) {
      return { format, stage: 'argument', prefix: argMatch[3], methodName: argMatch[1], argIndex: 0 };
    }
    const optMatch = partial.match(/^page\.(\w+)\([^)]*\{\s*(\w+):\s*(['"`])([^'"`]*)$/);
    if (optMatch) {
      return { format, stage: 'option-value', prefix: optMatch[4], methodName: optMatch[1] };
    }
  }

  if (format === 'cypress') {
    const methodMatch = partial.match(/^cy\.(\w*)$/);
    if (methodMatch) {
      return { format, stage: 'method', prefix: methodMatch[1] };
    }
    const argMatch = partial.match(/^cy\.(\w+)\((['"`])([^'"`]*)$/);
    if (argMatch) {
      return { format, stage: 'argument', prefix: argMatch[3], methodName: argMatch[1], argIndex: 0 };
    }
  }

  if (format === 'selenium') {
    const methodMatch = partial.match(/^driver\.findElement\(By\.(\w*)$/);
    if (methodMatch) {
      return { format, stage: 'method', prefix: methodMatch[1] };
    }
    const argMatch = partial.match(/^driver\.findElement\(By\.\w+\((['"`])([^'"`]*)$/);
    if (argMatch) {
      return { format, stage: 'argument', prefix: argMatch[2], argIndex: 0 };
    }
  }

  return { format, stage: 'selector', prefix: partial };
}

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

/**
 * Find candidates within a given Levenshtein distance of the input value.
 */
export function findTypoCorrections(
  value: string,
  candidates: string[],
  maxDistance: number
): Array<{ candidate: string; distance: number }> {
  const results: Array<{ candidate: string; distance: number }> = [];
  const lower = value.toLowerCase();

  for (const c of candidates) {
    const dist = levenshtein(lower, c.toLowerCase());
    if (dist <= maxDistance) {
      results.push({ candidate: c, distance: dist });
    }
  }

  return results.sort((a, b) => a.distance - b.distance);
}

/**
 * Search all page elements for a given value in any attribute.
 * Returns which element and attribute contain the value.
 */
export function findAttributeElsewhere(
  value: string,
  pageElements: PageElement[]
): Array<{ element: PageElement; attribute: string }> {
  const results: Array<{ element: PageElement; attribute: string }> = [];
  const lower = value.toLowerCase();

  for (const el of pageElements) {
    const checks: Array<[string, string]> = [
      ['testId', el.testId],
      ['id', el.id],
      ['role', el.role],
      ['ariaLabel', el.ariaLabel],
      ['name', el.name],
      ['placeholder', el.placeholder],
      ['title', el.title],
      ['altText', el.altText],
      ['text', el.text],
    ];

    for (const [attr, val] of checks) {
      if (val && val.toLowerCase().includes(lower)) {
        results.push({ element: el, attribute: attr });
        break;
      }
    }
  }

  return results;
}
