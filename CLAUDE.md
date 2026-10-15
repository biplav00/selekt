# CLAUDE.md — Selekt

Project-specific guidance for Claude. Read before editing.

## What this is

Chrome extension that generates test-automation selectors. User clicks an
element on a page; selekt outputs CSS / XPath / Playwright / Cypress /
Selenium locators ranked by quality. Also has a "freeform" mode where users
type a selector and selekt scores it.

## Stack

- **Framework**: WXT (`wxt.config.ts`) — MV3 Chrome extension.
- **UI**: Lit (`lit@3`). Vanilla TS otherwise. No React.
- **Lint/format**: Biome (`biome.json`).
- **Unit tests**: Vitest (`vitest.config.ts`, `tests/`).
- **E2E**: Playwright (`playwright.config.ts`, `tests-e2e/`).
- **Node**: ≥ 20.
- **Path alias**: `@/` → `src/`.

## Repo layout

```
src/
  entrypoints/
    background.ts          # service worker
    content.ts, content/   # injected into pages — picker, hover, DOM walk
    sidepanel/             # main UI (Lit components)
      components/build-tab.ts   # freeform + structured selector input
      services/selector-engine.ts  # dispatcher to specialists
  specialists/             # one file per output format
    playwright.ts          # 1.1k LOC — generate / score / chain / suggest / validate
    css.ts xpath.ts cypress.ts selenium.ts
    autocomplete.ts        # tokenizer for live suggestions
    registry.ts            # format → specialist lookup
    helpers/
      aria.ts              # implicit roles, accessible name
      chaining.ts          # ancestor-walk helpers (shared)
      dynamic-detect.ts    # CSS-in-JS class detection
      escaping.ts          # cssEscape, escapeSingleQuoteJs
      page-data.ts suggestions.ts
  shared/selector-core.ts
  utils/                   # debounce, content-script bridge
docs/
  plans/                   # design + implementation docs (date-prefixed)
  superpowers/
tests/                     # vitest, mirrors src layout
tests-e2e/                 # playwright
```

## Specialist contract (`src/specialists/types.ts`)

Every specialist exports `specialist: SelectorSpecialist` with:

- `generate(element)` → `{ selectors, proactive }` — emit ranked candidates
  for a picked element.
- `score(selector)` → `SpecialistScore { score, factors }` — rate any
  selector string. Score range 0–100 (higher = better). Used by both
  generation pipeline and freeform input.
- `chain(element, matchCount)` → disambiguation variants when multiple
  elements match.
- `suggest(partial, pageData)` — autocomplete completions.
- `validateAndFix(selector)` — syntax check + auto-fix.
- `warn(selector, element)` — actionable warnings.

Registry (`registry.ts`) maps `SelectorFormat` → specialist.

## Scoring conventions

- **Higher = better, max 100, min 0.** Do not flip the scale.
- Tests pin specific bands (e.g. testid ≥ 90, role+name ≥ 80, CSS < 70).
  Check `tests/specialists/*.test.ts` before changing constants.
- `factors[]` array is shown to the user in the UI — descriptions matter.
- Negative-impact factors are surfaced as warnings via
  `specialistScoreToScoredSelector` in `selector-engine.ts`.

## Playwright specialist alignment

Playwright specialist is calibrated against upstream
`microsoft/playwright`'s `selectorGenerator.ts` (the engine behind `npx
playwright codegen`). See
`docs/plans/2026-05-09-playwright-intelligence-harvest-design.md` for the
mapping table and what we deliberately diverge on (exact-match reward,
score-scale direction).

Key divergences from upstream:
- **Higher = better** (upstream: lower = better).
- **Exact match rewards** the score (upstream: penalty).

## Conventions

- **Don't break the freeform path.** Anything that changes
  `specialist.score()` shows up in user-typed selector scoring via
  `build-tab.ts → specialistScoreToScoredSelector`. Run the playwright /
  css / xpath specialist tests after touching any `scoreSelector`.
- **Shared helpers in `helpers/`** are used by ≥ 2 specialists. Don't
  silently change their signatures — check usages first
  (`grep -rn 'findScopingAncestor' src`).
- **MV3 quirks.** Service worker has no DOM. All DOM-reading code lives in
  content scripts (`src/entrypoints/content/`) or the sidepanel. Don't
  import DOM utilities into `background.ts`.
- **Lit components.** Use `@state` for local state, `@property` for
  parent-passed props. CSS goes in the static `styles` template.

## Commands

```bash
npm run dev          # wxt dev — hot reload extension
npm run build        # wxt build — produces output/chrome-mv3
npm test             # vitest run
npm run test:watch   # vitest watch mode
npm run test:e2e     # playwright e2e
npm run lint         # biome check .
npm run lint:fix     # biome check --write .
```

Pre-commit: husky runs `lint:fix` + tests. Don't bypass with `--no-verify`.

## Testing checklist before claiming work complete

1. `npx vitest run` — all green.
2. `npx biome check .` — no errors.
3. For UI changes: `npm run dev`, load `output/chrome-mv3` in Chrome,
   actually click the picker on a real page.
4. For specialist changes: spot-check freeform input scoring in build tab.

## What NOT to do

- Don't add a new specialist without registering in
  `specialists/registry.ts` and adding tests under
  `tests/specialists/`.
- Don't widen the SelectorSpecialist interface without updating all 5
  implementations.
- Don't write CSS-in-JS class detection by hand — extend
  `helpers/dynamic-detect.ts`.
- Don't introduce React, Tailwind, or a new bundler. Stack is fixed.
- Don't commit `output/` or `.DS_Store`. `.gitignore` already covers them
  but watch for accidental adds.

## Useful entry points when ramping

- `src/specialists/types.ts` — full contract.
- `src/specialists/playwright.ts` — most complete reference impl.
- `src/entrypoints/sidepanel/services/selector-engine.ts` — dispatcher.
- `tests/specialists/playwright.test.ts` — score band expectations.
- `docs/plans/` — recent design decisions in date order.
