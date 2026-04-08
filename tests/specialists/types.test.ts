import type {
  ActionableWarning,
  GenerateResult,
  ProactiveSuggestion,
  ScoreFactor,
  SelectorSpecialist,
  SpecialistScore,
  Suggestion,
  TokenContext,
  ValidationResult,
} from '@/specialists/types';
import { describe, expect, it } from 'vitest';

describe('specialist types', () => {
  it('ActionableWarning has correct shape', () => {
    const w: ActionableWarning = {
      message: 'Dynamic class',
      severity: 'warning',
      fix: { label: 'Use testid', selector: '[data-testid="x"]' },
    };
    expect(w.severity).toBe('warning');
    expect(w.fix?.selector).toBe('[data-testid="x"]');
  });

  it('GenerateResult has selectors and proactive', () => {
    const r: GenerateResult = {
      selectors: [{ selector: '#x', format: 'css', score: 90, warnings: [] }],
      proactive: [
        {
          message: 'Better',
          currentSelector: '#x',
          betterSelector: '[data-testid]',
          reason: 'stable',
        },
      ],
    };
    expect(r.selectors).toHaveLength(1);
    expect(r.proactive).toHaveLength(1);
  });

  it('SpecialistScore has factors array', () => {
    const s: SpecialistScore = {
      score: 85,
      factors: [{ name: 'hasTestId', impact: 45, description: 'Uses data-testid' }],
    };
    expect(s.factors[0].impact).toBe(45);
  });

  it('Suggestion has kind field', () => {
    const s: Suggestion = {
      selector: '#foo',
      label: 'ID selector',
      description: 'Matches element with id foo',
      score: 80,
      kind: 'autocomplete',
    };
    expect(s.kind).toBe('autocomplete');
  });

  it('ValidationResult can have fix', () => {
    const v: ValidationResult = {
      valid: false,
      error: 'Unclosed bracket',
      fix: { label: 'Add ]', selector: '[data-testid="x"]' },
    };
    expect(v.valid).toBe(false);
    expect(v.fix?.label).toBe('Add ]');
  });
});
