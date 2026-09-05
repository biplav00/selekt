# Locator Inspector — What Can Be Improved

> Generated 2026-09-05 from exhaustive edge-case matrix (48 unit tests), multi-persona browser tests (headless + headed), and side-panel UX audits.

## Quick Wins (next sprint)

| #   | Area                     | Current                                                                                    | Improvement                                                                    | Impact | Effort |
| --- | ------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------ | ------ |
| 1   | **Uniqueness badge**     | `getUniquenessCount` exists but not shown; BEST may be non-unique (`getByText` duplicates) | Show `⚠ 3 matches` + demote score, add `.first()` hint when >1                | High   | Small  |
| 2   | **Shadow DOM / iframe**  | `allFrames:false`, no pierce — picker misses Stripe/CodePen                                | Enable `allFrames:true` + `composedPath` piercing + `shadowRoot` helper (V1.2) | High   | Medium |
| 3   | **Dynamic ID filtering** | Heuristic `isDynamicId` covers `radix/:r*` but misses `next-abc123`                        | Expand deny-list + length check, add UI warning for positional fallback        | Medium | Small  |
| 4   | **Copy history**         | No history — user loses previous locators                                                  | Store last 20 in `storage.local`, show in Manual tab as recent pills           | Medium | Small  |
| 5   | **Export**               | Copy one by one                                                                            | Add `Export all` → clipboard as `await page.…` block + download `.ts`          | Medium | Small  |
| 6   | **Highlight all toggle** | Only single overlay                                                                        | Toggle to highlight all matches for current locator (count badge)              | Medium | Small  |

## Medium-Term (polish + a11y + perf)

| #   | Area                                  | Detail                                                                                                                                                                                                        |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | **Dark mode**                         | Sidepanel is light only (`--bg #fcfcfc`). Add `prefers-color-scheme` + `.dark` tokens (zinc-900 bg) for Chrome dark mode users.                                                                               |
| 8   | **Search within locators**            | Filter locators list by kind/text as you type (e.g., `testId` filter).                                                                                                                                        |
| 9   | **Large DOM perf**                    | `getCssSelector` does `querySelectorAll('#id')` per level O(n) on 10k nodes. Cache uniqueness in `WeakMap` + throttle `mouseover` already 32ms — add `ResizeObserver` to reposition overlay without re-query. |
| 10  | **a11y — heading level**              | Already emits `getByRole('heading', {level})` for H1-H6 but UI doesn't surface it distinctively — add level badge.                                                                                            |
| 11  | **a11y — aria-hidden**                | `isInAccessibilityTree` filters but no UI hint — show ` (hidden)` dim + tooltip when picking hidden nodes.                                                                                                    |
| 12  | **Settings**                          | `testId` attribute is hardcoded `data-testid` — add Options page to configure `data-testid` / `data-test` / custom.                                                                                           |
| 13  | **Keyboard**                          | `Alt+Shift+C` fixed — allow custom shortcut via `chrome.commands` UI + show in sidepanel footer.                                                                                                              |
| 14  | **Manual — `getByRole` without name** | Currently demoted to 40 but still shown as BEST when no better — should show warning `needs name` and suggest adding `name` via placeholder.                                                                  |
| 15  | **Error messages**                    | `Invalid selector — try CSS like #id...` is generic — surface `DOMException.message` for CSS/XPath errors.                                                                                                    |
| 16  | **Font self-host**                    | Google Fonts `Space Grotesk`/`JetBrains Mono` cause FOIT offline — self-host in `public/fonts` with `font-display: swap`.                                                                                     |

## Long-Term (features)

| #   | Area                           | Detail                                                                                                                     |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 17  | **Recorder**                   | Add `playwright-crx` JSONL recorder/player (requires `debugger` permission) — V3 roadmap when `allFrames` stable.          |
| 18  | **Codegen language switch**    | Generate locators in JS/TS/Python/Java (currently JS only).                                                                |
| 19  | **Locator strength indicator** | Score 100→20 is internal — surface as `Strong`/`Moderate`/`Fragile` with color, hide raw score.                            |
| 20  | **Team sync**                  | Sync `storage.sync` for history + settings across devices.                                                                 |
| 21  | **Analytics (opt-in)**         | No telemetry now — add opt-in to learn most-copied kinds and improve ranking.                                              |
| 22  | **Visual regression**          | Highlight diff when locator matches multiple — show all with numbered badges (manual already does 1…n, picker should too). |

## Already Fixed (for reference)

- ✅ Picker blocks all interactions (`mousedown`→`submit` 11 events) + single amber overlay `1.5px solid #facc15` visible on light/dark vs old blue wash.
- ✅ Playwright-only (no raw `#id`/`//xpath`), `CSS.escape` + `truncateForLocator`, dynamic ID deny-list, heading level, `alt` for images, `label` > `placeholder` ranking, `aria-labelledby` multi, bare role demoted to 40.
- ✅ Sidepanel as tab vs real sidePanel (`tabs.query` http fallback), `tabs` permission added, `manual:result` relay via `background.ts`.
- ✅ Deslopified to Linear Clean (Geist/Geist Mono, zinc+blue, `radius 10`, `8pt` grid), icon-copy `28×28` saves 22px/row, separate `Inspect`/`Manual` tabs + `Reset`.
- ✅ Manual live search as you type (300ms debounce) + dropdown with static + dynamic suggestions from page.

## How to Prioritize

1. **Immediate:** 1,2,4 (uniqueness + history) — biggest flakiness reduction.
2. **Short-term:** 5,6,12 (export + highlight all + settings).
3. **Medium:** 7,8,11,14 (dark mode + search + hidden hint).
4. **Long:** 17-22 (recorder, i18n).

All items are small vertical slices — each can be a single PR with `vitest` + `agent-browser` headless verification as done for picker/manual.
