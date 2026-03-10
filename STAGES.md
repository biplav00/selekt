# Development Stages Tracker

## Stage 1: Project Setup & Skills Installation
**Status**: ✅ Completed

- [x] Install Chrome extension development skill
- [x] Install WXT Chrome extension skill
- [x] Create project documentation (README.md, SPEC.md)

---

## Stage 2: WXT Project Scaffolding
**Status**: ✅ Completed

- [x] Initialize WXT project with TypeScript
- [x] Configure Tailwind CSS
- [x] Set up project structure
- [x] Verify build works (`)

**Note**:npm run build` Dev mode has a known issue with WXT 0.20. Use `npm run build` for development.

---

## Stage 3: Core Locator Generation Logic
**Status**: ⏳ Pending

- [ ] Create locator generator utility
- [ ] Implement XPath generation (absolute & relative)
- [ ] Implement CSS selector generation
- [ ] Add attribute-based selector logic

**Files to create**:
- `src/utils/locatorGenerator.ts`

**Deliverables**:
- Function to generate XPath for any DOM element
- Function to generate CSS selectors
- Support for id, class, data-testid, aria-label attributes

---

## Stage 4: Element Picker (Content Script)
**Status**: ✅ Completed

- [x] Create content script for element selection
- [x] Implement visual element highlighting on hover
- [x] Add click handler to capture selected element
- [x] Communicate selected element to popup

**Files created**:
- `entrypoints/content/index.ts`

---

## Stage 5: Popup UI Components
**Status**: ✅ Completed (Basic)

- [x] Create main popup layout
- [x] Add "Pick Element" button
- [x] Display element info on selection
- [ ] Add full locator display panel
- [ ] Add copy-to-clipboard functionality

**Files created**:
- `entrypoints/popup/index.html`
- `entrypoints/popup/main.ts`

---

## Stage 6: Multi-format Export
**Status**: ⏳ Pending

- [ ] Implement Playwright format
- [ ] Implement Cypress format
- [ ] Implement Selenium format
- [ ] Add JSON export functionality

**Files to create**:
- `src/utils/formats/playwright.ts`
- `src/utils/formats/cypress.ts`
- `src/utils/formats/selenium.ts`

---

## Stage 7: History & Storage
**Status**: ⏳ Pending

- [ ] Implement local storage for history
- [ ] Create history panel UI
- [ ] Add clear history functionality
- [ ] Persist user preferences

**Files to create**:
- `src/utils/storage.ts`
- `src/components/HistoryPanel.tsx`

---

## Stage 8: Build & Testing
**Status**: ⏳ In Progress

- [x] Build production extension
- [ ] Test in Chrome
- [ ] Verify all features work

**Commands**:
```bash
npm run build
# Load .output/chrome-mv3 folder in Chrome
```

---

## Project Status

**Current Progress**: ~40% complete

**Working Features**:
- Basic popup UI
- Element picker (content script)
- Hover highlighting
- Basic message passing

**Next Steps**:
1. Implement locator generation logic (Stage 3)
2. Add full locator display and copy features (Stage 5)
3. Add multi-format export (Stage 6)

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run build` | Build production extension |
| `npm run preview` | Preview built extension |
