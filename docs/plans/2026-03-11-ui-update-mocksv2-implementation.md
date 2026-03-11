# UI Update (Mocks v2) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fully implement the UI mockups from `docs/mockup-v2.html` into the existing WXT Chrome extension sidebar.

**Architecture:** Replace CSS and HTML structure in `src/entrypoints/sidepanel/index.html` to match `mockup-v2.html`. Update `main.ts` if class names change. Maintain existing logic for state management and Chrome API interactions.

**Tech Stack:** WXT, Vanilla TypeScript, CSS Variables.

---

### Task 1: Update Sidepanel CSS (Index.html)

**Files:**
- Modify: `src/entrypoints/sidepanel/index.html:1-377` (Styles section)

**Step 1: Backup current styles**
Copy the existing `<style>` block to a temporary location (clipboard or file) just in case.

**Step 2: Replace CSS with Mockup v2 CSS**
Copy the entire `<style>` block from `docs/mockup-v2.html` (lines 9-686) and replace the existing style block in `src/entrypoints/sidepanel/index.html`.

*Note:* Ensure the `:root` variables match the ones in `mockup-v2.html` exactly.

**Step 3: Adjust specific styles for extension context**
The mockup assumes a standalone panel. The extension sidepanel might have specific constraints (width, height).
- Ensure `body` width is set to `380px` (or `100%` if sidepanel handles it).
- Ensure `min-height` is appropriate.

**Step 4: Commit**
```bash
git add src/entrypoints/sidepanel/index.html
git commit -m "feat: update sidepanel css to match mockup v2"
```

### Task 2: Update HTML Structure (Index.html)

**Files:**
- Modify: `src/entrypoints/sidepanel/index.html:379-531` (Body section)

**Step 1: Align Header Structure**
Current header:
```html
<div class="header">
  <div class="logo-group">...</div>
  <div class="stats">...</div> <!-- inline stats -->
  <button class="settings-btn">...</button>
</div>
```
Mockup v2 header:
```html
<div class="header">...</div>
<div class="stats-bar">...</div> <!-- separate stats bar -->
```
Update `index.html` to move the stats into a separate `.stats-bar` div immediately after `.header`.

**Step 2: Update Tabs**
Ensure tab buttons have the correct classes (`.tab`, `.active`) and structure (badges for history count).

**Step 3: Update Content Areas**
Ensure the Pick, Build, and History views have the correct IDs and classes as expected by `main.ts` and the new CSS.

**Step 4: Commit**
```bash
git add src/entrypoints/sidepanel/index.html
git commit -m "feat: update sidepanel html structure to match mockup v2"
```

### Task 3: Verify and Update main.ts Selectors

**Files:**
- Modify: `src/entrypoints/sidepanel/main.ts`

**Step 1: Check DOM References**
Review `main.ts` lines 103-122 (DOM References). Ensure IDs and classes match the new HTML structure.
- If `.stats` became `.stats-bar`, update `elementCount` selector.
- If any element IDs changed, update them.

**Step 2: Check Event Listeners**
Ensure event listeners attach to correct elements (e.g., `.copy-btn`, `.locator-row`).

**Step 3: Fix Lint Errors (if any)**
Address any TypeScript errors found during compilation.
- `src/entrypoints/sidepanel/main.ts:128:10` (forEach return value issue - likely false positive or minor).
- `src/entrypoints/sidepanel/main.ts:129:11` (Same).
- `src/entrypoints/sidepanel/main.ts:686:43` (Same).
- `src/entrypoints/sidepanel/main.ts:826:12` (Same).

**Step 4: Commit**
```bash
git add src/entrypoints/sidepanel/main.ts
git commit -m "fix: update selectors and fix minor lint issues in main.ts"
```

### Task 4: Visual Verification

**Files:**
- Run: `npm run dev` (or build and load extension)

**Step 1: Start Development Server**
Run `npm run dev` to start WXT in dev mode.

**Step 2: Open Sidepanel**
Open the extension sidepanel in a browser tab.

**Step 3: Compare with Mockup**
Visually compare the sidepanel with `docs/mockup-v2.html` (open in another tab).
Check:
- Colors (background, text, accents)
- Spacing (padding, margins)
- Typography (font families, sizes)
- Component states (hover, active)

**Step 4: Functional Test**
- Pick an element.
- Verify locators generate.
- Copy a locator.
- Check history tab.
- Open settings modal.

**Step 5: Commit**
```bash
git add .
git commit -m "feat: visual verification and functional testing of UI update"
```

---

**Execution Handoff:**
Plan complete and saved to `docs/plans/2026-03-11-ui-update-mocksv2-implementation.md`.

**Which approach?**
1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration
2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints