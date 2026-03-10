# Locator Generator - Technical Specification

## Overview
A Chrome extension for test automation that generates robust, reliable locators (XPath, CSS, and framework-specific) for any element on a webpage.

## Core Functionality

### 1. Element Selection
- User clicks "Pick Element" button in popup
- Content script activates, adding hover highlighting to all elements
- User clicks desired element
- Element information is captured and sent back to popup

### 2. Locator Generation
The extension generates multiple locator types:

| Format | Example |
|--------|---------|
| XPath (absolute) | `/html/body/div[2]/div[1]/button` |
| XPath (relative) | `//button[@data-testid='submit']` |
| CSS | `button[data-testid="submit"]` |
| Playwright | `page.locator('button[data-testid="submit"]')` |
| Cypress | `cy.get('button[data-testid="submit"]')` |
| Selenium | `By.css("button[data-testid='submit']")` |

### 3. Locator Priority
The system prefers locators in this order:
1. `data-testid` or `data-test` attributes
2. `id` attribute
3. `name` attribute
4. `aria-label` or `aria-labelledby`
5. Unique combination of tag + class + text content
6. Structural XPath (with `contains()`, `starts-with()`)

## UI/UX Specification

### Popup Layout
- **Width**: 400px
- **Height**: 500px (expandable)
- **Sections**:
  1. Header with extension name and settings icon
  2. "Pick Element" primary action button
  3. Selected element info (tag, text preview)
  4. Locator display tabs (XPath | CSS | Playwright | Cypress | Selenium)
  5. Copy buttons for each format
  6. History panel (collapsible)
  7. Export button (JSON)

### Visual Design
- **Primary Color**: #3B82F6 (Blue 500)
- **Secondary Color**: #1E293B (Slate 800)
- **Background**: #0F172A (Slate 900)
- **Text**: #F8FAFC (Slate 50)
- **Accent**: #10B981 (Emerald 500) for success states

### Typography
- **Font Family**: Inter, system-ui, sans-serif
- **Headings**: 16px semibold
- **Body**: 14px regular
- **Code/Locators**: 13px monospace (Fira Code or JetBrains Mono)

## Architecture

### Entry Points
```
entrypoints/
├── popup/
│   └── Main.tsx          # Main popup component
├── background/
│   └── index.ts         # Service worker
└── content/
    └── index.ts         # Element picker script
```

### Source Structure
```
src/
├── components/
│   ├── LocatorDisplay.tsx
│   ├── HistoryPanel.tsx
│   ├── ExportPanel.tsx
│   └── ElementPicker.tsx
├── hooks/
│   ├── useElementPicker.ts
│   └── useLocatorHistory.ts
├── utils/
│   ├── locatorGenerator.ts
│   ├── formats/
│   │   ├── playwright.ts
│   │   ├── cypress.ts
│   │   └── selenium.ts
│   └── storage.ts
└── types/
    └── index.ts
```

### Message Protocol
Communication between popup and content script:

```typescript
// Messages from popup to content
type PopupMessage =
  | { type: 'START_PICKING' }
  | { type: 'STOP_PICKING' };

// Messages from content to popup
type ContentMessage =
  | { type: 'ELEMENT_SELECTED'; element: ElementInfo };
```

## Storage Schema

### History Item
```typescript
interface HistoryItem {
  id: string;
  timestamp: number;
  element: {
    tagName: string;
    text: string;
    attributes: Record<string, string>;
  };
  locators: {
    xpathAbsolute: string;
    xpathRelative: string;
    css: string;
    playwright: string;
    cypress: string;
    selenium: string;
  };
}
```

### User Preferences
```typescript
interface Preferences {
  defaultFormat: 'xpath' | 'css' | 'playwright' | 'cypress' | 'selenium';
  showAbsoluteXPath: boolean;
  historyLimit: number;
}
```

## Acceptance Criteria

### Must Have
- [ ] Extension loads in Chrome without errors
- [ ] "Pick Element" mode activates on click
- [ ] Hovering elements shows visual highlight
- [ ] Clicking element generates all locator types
- [ ] Copy buttons work for each format
- [ ] Locators are valid and work in respective frameworks

### Should Have
- [ ] History saves generated locators
- [ ] JSON export includes all formats
- [ ] Preferences persist across sessions
- [ ] Keyboard shortcut to activate picker (Ctrl+Shift+L)

### Nice to Have
- [ ] Locator quality score/robustness indicator
- [ ] Automatic locator testing on page
- [ ] Bookmarklets for non-extension use
