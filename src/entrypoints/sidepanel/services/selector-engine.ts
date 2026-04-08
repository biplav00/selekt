import { getAllSpecialists, getSpecialist } from '@/specialists/registry';
import type {
  ActionableWarning,
  GenerateResult,
  ProactiveSuggestion,
  SpecialistScore,
} from '@/specialists/types';
import type { RichElementData, ScoredSelector, SelectorFormat } from '@/types';

// Re-export shared utilities for backward compatibility
export {
  cssEscape,
  escapeCssAttrValue,
  escapeDoubleQuoteJs,
  escapeSingleQuoteJs,
  escapeXPathValue,
} from '@/specialists/helpers/escaping';
export { isDynamicClass } from '@/specialists/helpers/dynamic-detect';
export { extractTestable } from '@/shared/selector-core';

/**
 * Generate scored selectors across all formats for a given element.
 * Delegates to per-format specialists.
 */
export function generateScoredSelectors(element: RichElementData): {
  selectors: ScoredSelector[];
  proactive: ProactiveSuggestion[];
} {
  const allSelectors: ScoredSelector[] = [];
  const allProactive: ProactiveSuggestion[] = [];

  for (const specialist of getAllSpecialists()) {
    const result = specialist.generate(element);
    allSelectors.push(...result.selectors);
    allProactive.push(...result.proactive);
  }

  // Deduplicate by format::selector
  const seen = new Set<string>();
  const deduped = allSelectors.filter((s) => {
    const key = `${s.format}::${s.selector}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    selectors: deduped.sort((a, b) => b.score - a.score),
    proactive: allProactive,
  };
}

/**
 * Score a single selector string using its format's specialist.
 */
export function scoreSelector(selector: string, format: SelectorFormat): SpecialistScore {
  return getSpecialist(format).score(selector);
}
