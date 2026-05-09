import type { PageElement } from '@/types';
import type { RichPageData } from '../types';

/**
 * Build RichPageData from a list of PageElements.
 * Extracts all unique attribute values for fast autocomplete.
 */
export function buildRichPageData(elements: PageElement[]): RichPageData {
  const ids = new Set<string>();
  const classes = new Set<string>();
  const testIds = new Set<string>();
  const roles = new Set<string>();
  const ariaLabels = new Set<string>();
  const names = new Set<string>();
  const placeholders = new Set<string>();
  const texts = new Set<string>();
  const tags: Record<string, number> = {};

  for (const el of elements) {
    if (el.id) ids.add(el.id);
    for (const cls of el.classes) {
      if (cls) classes.add(cls);
    }
    if (el.testId) testIds.add(el.testId);
    if (el.role) roles.add(el.role);
    if (el.ariaLabel) ariaLabels.add(el.ariaLabel);
    if (el.name) names.add(el.name);
    if (el.placeholder) placeholders.add(el.placeholder);
    if (el.text) texts.add(el.text);
    tags[el.tag] = (tags[el.tag] || 0) + (el.matchCount || 1);
  }

  return {
    ids: Array.from(ids),
    classes: Array.from(classes),
    testIds: Array.from(testIds),
    roles: Array.from(roles),
    ariaLabels: Array.from(ariaLabels),
    names: Array.from(names),
    placeholders: Array.from(placeholders),
    texts: Array.from(texts),
    tags,
    elements,
  };
}

/** Create an empty RichPageData (for initial state / fallback). */
export function emptyPageData(): RichPageData {
  return {
    ids: [],
    classes: [],
    testIds: [],
    roles: [],
    ariaLabels: [],
    names: [],
    placeholders: [],
    texts: [],
    tags: {},
    elements: [],
  };
}
