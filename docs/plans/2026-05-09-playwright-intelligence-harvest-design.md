# Playwright Intelligence Harvest — Design

## 1. Goal

Align selekt's Playwright specialist with upstream `microsoft/playwright`'s
selector generator algorithm (the engine behind `npx playwright codegen` and
`playwright-crx`'s recorder). Harvest the high-leverage parts — scoring
constants, length penalty, multi-ancestor parent walk — without vendoring the
full ~1.5k-LOC injected script. Selekt keeps its own architecture; only the
*numbers* and *strategies* change.

## 2. Source

- Upstream file: `packages/playwright-core/src/server/injected/selectorGenerator.ts`
  @ `microsoft/playwright` `release-1.49`.
- Wrapper context: `ruifigueira/playwright-crx` (Playwright running inside an
  MV3 extension via `chrome.debugger`). Same generator algorithm, exposed via
  the recorder UI.

## 3. Upstream Scoring Model (verbatim constants)

Lower = better. Selekt uses higher = better; we map priorities, not scale.

| Constant | Value | Selector kind |
|---|---|---|
| `kTestIdScore` | 1 | configured testIdAttributeName |
| `kOtherTestIdScore` | 2 | data-test, data-cy, data-qa, etc. |
| `kIframeByAttributeScore` | 10 | iframe by attribute |
| `kPlaceholderScore` | 100 | getByPlaceholder |
| `kLabelScore` | 120 | getByLabel |
| `kRoleWithNameScore` | 140 | getByRole + name |
| `kAltTextScore` | 160 | getByAltText |
| `kTextScore` | 180 | getByText |
| `kTitleScore` | 200 | getByTitle |
| `kCSSIdScore` | 500 | `#id` |
| `kRoleWithoutNameScore` | 510 | getByRole bare |
| `kCSSTagNameScore` | 530 | tag |
| `kNthScore` | 10000 | `.nth(n)` (kill-switch tier) |
| `kCSSFallbackScore` | 10000000 | full CSS fallback path |
| `kExactPenalty` | +5 (worse) | `{ exact: true }` is *less* preferred |

Two upstream behaviors of note:
- **Exact = penalty.** Upstream treats `exact: true` as slightly worse (it's
  brittle). Selekt tests pin the opposite (exact > non-exact). We **keep
  selekt's behavior** — selekt is a test-author tool, exactness is intentional.
- **Combined score** for chained selectors: `sum(score[i] * (length - i))`,
  i.e. earlier tokens (ancestors) weigh more.

## 4. Changes Adopted

### 4.1 Scoring (`src/specialists/playwright.ts` `scoreSelector`)

| Change | Before | After | Rationale |
|---|---|---|---|
| `.nth()` penalty | -15 | **-25** | Upstream rates 10000 (kill-switch). Tighten. |
| Length penalty | none | **-1 per 20 chars over 80, cap -3** | Mirrors `penalizeScoreForLength`. Long = brittle. |
| Testid-like attrs | not separated | **+35** for `[data-test\|data-cy\|data-qa\|data-test-id="..."]` | Mirrors `kOtherTestIdScore` tier. |

Bands kept stable; selekt's existing test thresholds (testid ≥ 90, role+name
≥ 80, locator CSS < 70, nth < 70, exact > non-exact, alt/title ≥ 70) all
hold.

### 4.2 Generation (`generate()` step 2)

Was: emit `[data-test=...]` only. Now: loop over
`['data-test', 'data-test-id', 'data-cy', 'data-qa']` and emit one selector
per present attribute. Each is auto-recognized by the new testid-like
scoring rule.

### 4.3 Multi-Ancestor Walk

**Before:** `findScopingAncestor(parentChain)` — single-shot, returns first
viable ancestor (id-anchored or stable-class anchored).

**After:** `findAllScopingAncestors(parentChain)` returns *all* viable
ancestors with `kind: 'id' | 'class'`. Caller picks 2:
1. Nearest viable ancestor (closest scope).
2. Best id-anchored ancestor (most stable, regardless of depth) — only if
   different from #1.

Used in two paths:
- `generate()` step 11: emits chained variants for both picks.
- `chain()`: emits chained variants for both picks, with bonus +7 for
  id-anchored, +5 for class-anchored.

The original `findScopingAncestor` is **kept untouched** — still used by
css/cypress/selenium/xpath specialists. Only the playwright specialist
upgrades to multi-ancestor.

## 5. Boundaries — What's NOT Changed

- **Score scale not flipped.** Selekt keeps higher = better; constants
  recalibrated, not inverted. Avoids cascading test/UI changes.
- **Exact-match logic preserved.** Upstream penalizes; selekt rewards.
  Different audience priors.
- **No vendoring of upstream injected script.** Needs `injectedScript`
  evaluator + DOM access not available in selekt's content-script data flow.
- **Other specialists untouched.** css.ts / xpath.ts / cypress.ts /
  selenium.ts continue using single-ancestor `findScopingAncestor`. Future
  work could extend.
- **Freeform path** (`build-tab.ts` → `specialistScoreToScoredSelector`)
  inherits scoring changes automatically via the shared `score:` export. No
  generation-side wiring needed for freeform — freeform scores user-typed
  strings, doesn't generate.

## 6. Verification

- `vitest run` — 234/234 pass.
- `biome check .` — clean.
- Spot-check freeform inheritance:
  - `nth(2)`: 65 → **45**
  - `[data-cy="..."]`: 60 → **95**
  - long `combobox.filter.first()`: 88 → **85**
  - short `getByLabel('x', { exact: true })`: 82 (unchanged).

## 7. Future

- Apply length penalty + nth tightening to css/cypress/selenium/xpath.
- Multi-ancestor walk for css.ts (highest leverage after playwright).
- Consider full `combineScores` weighting (`score * (length - i)`) for chain
  ordering once selekt has multi-token chains.
- Optional: lift `playwright-crx` recorder/inspect-mode UI patterns for
  selekt's floating picker (separate work).
