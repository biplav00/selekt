# Locator Generator - UI Update (Mocks v2) Design

> **For Claude:** This is the validated design document. The next step is to invoke the `writing-plans` skill to generate the implementation plan based on this design.

## 1. Goal
Fully implement the UI mockups from `docs/mockup-v2.html` into the existing WXT Chrome extension sidebar.

## 2. Architecture
The current implementation in `src/entrypoints/sidepanel/index.html` and `main.ts` is structurally correct but visually outdated compared to `mockup-v2.html`. The update will:
1. Replace the CSS in `index.html` with the refined CSS from `mockup-v2.html`.
2. Update the HTML structure in `index.html` to match the exact DOM structure and class names used in the mockups.
3. Ensure `main.ts` correctly targets the new DOM elements and class names.

## 3. Tech Stack
- WXT (Chrome Extension Framework)
- Vanilla TypeScript (no framework)
- CSS Variables (for theming)

---

## Design Details

### A. Visual Style (from `mockup-v2.html`)
- **Theme**: Dark mode (`#09090b` background).
- **Typography**: Inter (UI) and JetBrains Mono (Code).
- **Components**:
  - **Header**: Logo + Settings icons (no stats bar in v2 header).
  - **Stats Bar**: A distinct row below the header showing connection status, picked count, and format count.
  - **Tabs**: Active tab has an accent-colored bottom border.
  - **Pick Button**: Gradient background, icon, and keyboard shortcut hint.
  - **Element Card**: Shows tag name badge and selector. Uses attribute chips.
  - **Locator Rows**: Distinct badges for each format (CSS, XPath, PW, CY, SE) with specific colors.
  - **Footer Actions**: Export, Test, DOM Tree buttons.
  - **Modals**: Settings modal with overlay.

### B. Structural Changes
1.  **Stats Bar**: Move from inside `.header` to a separate `.stats-bar` element immediately after the header.
2.  **Tabs**: Update tab styling to match the "pill" or "underline" active state in v2.
3.  **Locator Rows**: Update the badge styling (background colors, text colors) to match the exact hex codes in v2.
4.  **Copy Buttons**: Update opacity and hover states (hidden by default, visible on row hover).

### C. Functional Requirements
- All existing functionality (picking, history, build) must remain intact.
- The UI must be responsive to the 380px width defined in the mockups.
- Keyboard shortcuts (Cmd+Shift+L) must still work.
- Settings modal must open/close correctly.

### D. Files to Modify
1.  `src/entrypoints/sidepanel/index.html` (CSS and HTML structure)
2.  `src/entrypoints/sidepanel/main.ts` (DOM selectors and event bindings if class names change)

### E. Files to Create
None (overwriting existing UI).

### F. Validation
- Visual verification against `docs/mockup-v2.html`.
- Functional testing: Pick element, copy locator, check history, open settings.

## 4. Implementation Steps (High Level)
1.  **Extract CSS**: Copy CSS from `mockup-v2.html` into `index.html`, replacing the old `<style>` block.
2.  **Update HTML Structure**: Modify `index.html` to match the class names and hierarchy of the mockup (e.g., `.mock-panel` -> `.sidebar`, `.locator-row` structure).
3.  **Update JS Selectors**: Ensure `main.ts` uses the correct class names for finding elements (e.g., `.copy-btn`, `.locator-row`).
4.  **Test**: Build and verify visual alignment.