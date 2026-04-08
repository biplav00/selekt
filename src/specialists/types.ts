import type { PageElement, RichElementData, ScoredSelector, SelectorFormat } from '@/types';

export interface ActionableWarning {
  message: string;
  severity: 'info' | 'warning' | 'error';
  fix?: {
    label: string;
    selector: string;
  };
}

export interface SpecialistScore {
  score: number;
  factors: ScoreFactor[];
}

export interface ScoreFactor {
  name: string;
  impact: number;
  description: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  fix?: {
    label: string;
    selector: string;
  };
}

export interface Suggestion {
  selector: string;
  label: string;
  description: string;
  score: number;
  kind: 'autocomplete' | 'alternative' | 'fix' | 'scoped';
  matchCount?: number;
  selectorType?: 'css' | 'xpath' | 'role';
}

export interface ProactiveSuggestion {
  message: string;
  currentSelector: string;
  betterSelector: string;
  reason: string;
}

export interface GenerateResult {
  selectors: ScoredSelector[];
  proactive: ProactiveSuggestion[];
}

export interface TokenContext {
  format: SelectorFormat;
  stage: 'method' | 'argument' | 'option-key' | 'option-value' | 'selector';
  prefix: string;
  methodName?: string;
  argIndex?: number;
}

export interface RichPageData {
  ids: string[];
  classes: string[];
  testIds: string[];
  roles: string[];
  ariaLabels: string[];
  names: string[];
  placeholders: string[];
  texts: string[];
  tags: Record<string, number>;
  elements: PageElement[];
}

export interface SelectorSpecialist {
  format: SelectorFormat;
  displayName: string;

  generate(element: RichElementData): GenerateResult;
  score(selector: string, element?: RichElementData): SpecialistScore;
  warn(selector: string, element: RichElementData): ActionableWarning[];
  chain(element: RichElementData, matchCount: number): ScoredSelector[];
  suggest(partial: string, pageData: RichPageData): Suggestion[];
  didYouMean(selector: string, pageData: RichPageData): Suggestion[];
  validateAndFix(selector: string): ValidationResult;
}
