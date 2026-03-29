# Selekt Overhaul — Design Spec

## Overview

Full overhaul of the Selekt Chrome extension: architecture migration to Lit, intelligent selector ranking with fragility analysis, redesigned Pick tab with scored results, enhanced Build tab, new Workspace tab replacing History, and page change detection.

## Goals

- **Code quality:** Replace the 2100-line `main.ts` monolith with focused Lit components and a services layer
- **Intelligence:** Generate multiple selector strategies per element, ranked by stability score with fragility warnings
- **Usability:** Smarter Pick flow, real-time feedback in Build, lightweight Workspace for saved selectors
- **Reliability:** Detect page changes that break saved selectors

## Architecture

### Tech Stack Changes

- **Add:** Lit (~5KB) for reactive Web Components in the sidepanel
- **Keep:** Vanilla TypeScript for content script and background script
- **Keep:** WXT framework, Biome, existing build pipeline

### File Structure

```
src/
├── entrypoints/
│   ├── background.ts              (keep as-is)
│   ├── content.ts                 (enhance with MutationObserver, richer element data)
│   └── sidepanel/
│       ├── index.html             (minimal shell, loads app)
│       ├── main.ts                (bootstraps Lit app)
│       ├── app.ts                 (root component: tabs, theme, settings)
│       ├── components/
│       │   ├── pick-tab.ts        (element picker UI + ranked results)
│       │   ├── build-tab.ts       (freeform + structured builder)
│       │   ├── workspace-tab.ts   (saved selectors with favorites/search)
│       │   ├── selector-card.ts   (shared: displays selector with score + warnings)
│       │   ├── dom-tree.ts        (shared: collapsible DOM viewer)
│       │   ├── settings-modal.ts  (settings dialog)
│       │   └── toast.ts           (notification system)
│       ├── services/
│       │   ├── messaging.ts       (chrome messaging abstraction)
│       │   ├── storage.ts         (chrome.storage wrapper)
│       │   ├── selector-engine.ts (ranking, fragility analysis, generation)
│       │   └── dom-monitor.ts     (page change detection coordination)
│       └── styles/
│           ├── theme.ts           (CSS custom properties, dark/light)
│           └── shared.ts          (reusable Lit CSS)
├── types.ts                       (keep, extend)
└── utils/
    └── content-script.ts          (keep as-is)
```

### Design Decisions

- **Services layer** separates business logic from UI. Components render; services compute.
- **`messaging.ts`** wraps `chrome.tabs.sendMessage` / `chrome.runtime.onMessage` so components don't call Chrome APIs directly.
- **`selector-card.ts`** is shared across Pick, Build, and Workspace for consistent selector display.
- **Content script stays vanilla.** It runs in page context where Lit adds no value. Already clean at ~430 lines.
- **Lit chosen over Preact/Solid** because Web Components are native to Chrome extensions, Shadow DOM provides style isolation, and tagged template literals need no JSX transform.

## Selector Intelligence

### Stability Scoring (0–100)

Each generated selector receives a stability score based on weighted signals:

| Signal | Impact | Example |
|--------|--------|---------|
| Uses `data-testid` / `data-test` | +40 | `[data-testid="login-btn"]` |
| Uses `id` (non-dynamic) | +35 | `#submit-form` |
| Uses `role` + accessible name | +30 | `getByRole('button', {name: 'Submit'})` |
| Uses `aria-label` | +25 | `[aria-label="Close"]` |
| Short selector (few combinators) | +15 | `.login-btn` |
| Uses semantic tag | +10 | `button` vs `div` |
| Deep nesting (>3 levels) | −20 | `div > div > ul > li > a` |
| Uses `nth-child` / `nth-of-type` | −15 | `li:nth-child(3)` |
| Dynamic-looking class | −25 | `.css-1a2b3c`, `.sc-dkPtRN` |
| Index-based positioning | −15 | `.nth(2)`, XPath `[3]` |

Score is clamped to 0–100. Multiple positive signals stack (e.g., `data-testid` on a `button` = 40 + 10 = 50 base, plus short selector bonus).

### Fragility Warnings

Selectors scoring below 50 receive a warning badge with an explanation:

- "Relies on dynamic class names that may change between builds"
- "Deep nesting — layout changes could break this"
- "Position-dependent — adding/removing siblings will break this"

### Dynamic Class Detection

Heuristic: classes matching patterns like `css-[a-z0-9]+`, `sc-[a-zA-Z]+`, `_[a-z]+_[a-z0-9]+` (CSS Modules), or classes shorter than 6 chars that are all alphanumeric are flagged as potentially dynamic.

## Pick Tab

### Flow

1. **Pick element** — button click or ⌘⇧L keyboard shortcut (unchanged trigger)
2. **Element info card** — tag, key attributes, text content preview
3. **Ranked selector results** — multiple strategies across all 5 formats, sorted by stability score
   - Each result: format badge, selector text, score (green 70+, yellow 40–69, red <40), copy button
   - Fragility warnings inline on low-scoring selectors
   - Top 5 shown by default, "Show all" expands
4. **Quick actions per selector:** click to copy, test on page (highlight matches), save to workspace (star)
5. **DOM tree** — secondary view via toggle, same lazy-loading approach

### Content Script Enhancement

The content script returns richer element data to support better ranking:
- All attributes (not just a suggested selector)
- Parent chain context (up to 3 levels)
- Sibling context (tag names of adjacent siblings)
- Text content and accessible name
- `data-testid`, `data-test`, `role`, `aria-*` attributes explicitly

The `selector-engine.ts` service uses this data to generate and rank multiple selector strategies.

## Build Tab

### Freeform Mode

- Text input with auto-detection (CSS, XPath, Playwright, Cypress, Selenium) — existing behavior
- **New:** Real-time stability score display as you type
- **New:** Inline fragility warnings
- **New:** Score-ranked alternative suggestions when typing a low-scoring selector
- Match count + test on page stays

### Structured Mode

- Framework-specific generators stay (Playwright methods, CSS fields, XPath axes, Cypress methods, Selenium strategies)
- Chain steps for complex locators stays
- **New:** Stability score + warnings shown after generation
- **New:** "Improve" button — runs the generated selector through `selector-engine.ts` and, if the score is below 70, suggests the highest-scoring alternative strategy for the same element (using the element data from the last Pick or from a fresh page query)

### Shared Actions

- Save to workspace
- Test on page with match count

## Workspace Tab (replaces History)

### Two Sections

1. **Favorites** — explicitly saved selectors, no cap, persistent
2. **Recent** — auto-saved from Pick (top selector), capped at configurable limit (25–200)

### Each Saved Item Shows

- Selector text (monospace)
- Format badge (CSS/XPath/PW/Cypress/Selenium)
- Stability score
- Source page URL
- Timestamp

### Features

- **Search:** text search across all saved selectors
- **Filter:** by format
- **Quick actions:** copy, test on page, delete
- **Auto-save:** picking an element saves the top selector to Recent automatically

### Storage

`chrome.storage.local` — same as current. Schema:

```typescript
interface WorkspaceData {
  favorites: SavedSelector[];
  recent: SavedSelector[];
}

interface SavedSelector {
  id: string;
  selector: string;
  format: 'css' | 'xpath' | 'playwright' | 'cypress' | 'selenium';
  score: number;
  warnings: string[];
  pageUrl: string;
  elementTag: string;
  createdAt: number;
}
```

## Page Change Detection

### Content Script Side

- `MutationObserver` watches `childList`, `attributes`, `subtree` on `document.body`
- Debounced at 500ms to batch mutations from animations/dynamic rendering
- On mutation batch, re-evaluates watched selectors (CSS via `querySelectorAll`, XPath via `document.evaluate`)
- Reports changes via `SELECTOR_STATUS_CHANGED` message

### New Message Types

| Message | Direction | Payload |
|---------|-----------|---------|
| `WATCH_SELECTORS` | sidepanel → content | `{ selectors: { id, selector, type }[] }` |
| `UNWATCH_SELECTORS` | sidepanel → content | `{ ids: string[] }` |
| `SELECTOR_STATUS_CHANGED` | content → sidepanel | `{ id, oldCount, newCount }` |

### Sidepanel Side (`dom-monitor.ts`)

- Manages which selectors to watch: active Pick results + Workspace favorites for the current tab's URL
- Sends `WATCH_SELECTORS` when selectors become visible, `UNWATCH_SELECTORS` when they leave view
- Handles incoming `SELECTOR_STATUS_CHANGED`:
  - Match count changed: info badge on selector card ("Match count changed: 1 → 3")
  - Element gone (count → 0): warning badge ("Element no longer found on page")
  - Toast notification for breaking changes

### Scope

Only monitors selectors visible in the sidepanel + workspace favorites matching the active tab URL. Not a background scanning process.

## Visual Design

**Direction:** Refined Dark — evolve the current dark aesthetic with tighter spacing, score badges, cleaner cards.

- Keep the existing dark/light theme toggle
- Dark mode default: `#09090b` primary, `#111114` secondary, `#3b82f6` accent
- Score badges: green (`#22c55e`) for 70+, yellow (`#eab308`) for 40–69, red (`#ef4444`) for <40
- Format badges: color-coded per framework (CSS blue, XPath orange, Playwright purple, Cypress green, Selenium cyan)
- Tab navigation: pill-style segment control with background indicator
- Cards: subtle borders, rounded corners, compact spacing
- Monospace font for selector text
- Warning icons (⚠) inline on fragile selectors

## Migration Strategy

Incremental migration — each phase produces a working extension.

### Phase 1 — Foundation

- Install Lit, configure WXT bundling
- App shell (`app.ts`): theme system, tab navigation, shared styles
- Services layer: `messaging.ts`, `storage.ts`
- Empty placeholder tabs

### Phase 2 — Pick Tab + Selector Engine

- `selector-engine.ts`: ranking algorithm, fragility analysis, multi-strategy generation
- `pick-tab.ts` and `selector-card.ts` components
- Content script enhancement: richer element data response
- Highest-value phase — smart rankings are the headline feature

### Phase 3 — Build Tab

- Migrate freeform and structured modes to Lit
- Wire up real-time scoring and fragility warnings
- Keep existing framework-specific generators

### Phase 4 — Workspace Tab

- `workspace-tab.ts`: favorites + recents sections
- Storage schema migration
- Search and filter

### Phase 5 — Page Change Detection

- Content script: `MutationObserver`, `WATCH_SELECTORS` / `UNWATCH_SELECTORS` / `SELECTOR_STATUS_CHANGED` messages
- `dom-monitor.ts` service
- Status indicators on selector cards

### Phase 6 — Polish

- Settings modal migration
- Toast system
- DOM tree viewer
- Dark/light theme refinement
- Keyboard shortcuts
- Edge cases
