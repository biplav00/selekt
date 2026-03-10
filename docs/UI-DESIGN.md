# Locator Generator - UI Design Specification

## Overview
Comprehensive UI design for a Chrome extension sidebar with multiple color themes and screen states.

## Theme Palette

### Dark Themes
| Theme | Primary | Secondary | Accent | Background | Surface |
|-------|---------|------------|---------|------------|----------|
| Blue | #3b82f6 | #1e293b | #22c55e | #0f172a | #1e293b |
| Purple | #8b5cf6 | #1e1b2e | #22c55e | #0f0a1a | #1e1b2e |
| Orange | #f97316 | #1e1a14 | #22c55e | #0f0a08 | #1e1a14 |
| Green | #10b981 | #142e25 | #22c55e | #0a1812 | #142e25 |

### Light Themes
| Theme | Primary | Secondary | Accent | Background | Surface |
|-------|---------|------------|---------|------------|----------|
| Blue | #3b82f6 | #eff6ff | #10b981 | #ffffff | #f8fafc |
| Green | #10b981 | #f0fdf4 | #3b82f6 | #ffffff | #f8fafc |

---

## Screen States

### 1. Pick Screen (Default State)
- Header with logo, settings icon, stats bar
- Tabs: Pick | Build | History
- Large "Pick Element" button
- Empty state message

### 2. Pick Screen (Picking State)
- Pick button shows "Click element on page..."
- Cursor changes to crosshair
- Elements highlighted on hover with tooltip

### 3. Pick Screen (Element Selected State)
- Element info card showing tag, attributes
- All 5 locator formats displayed as cards:
  - CSS Selector
  - XPath
  - Playwright
  - Cypress
  - Selenium
- Copy button on each locator
- Footer: Export All + Test buttons

### 4. Build Screen
- Tag dropdown selector
- ID input field
- Class input field
- Custom attribute name/value inputs
- "Test on Page" button
- Generated locator preview

### 5. History Screen
- List of previously picked elements
- Each item shows: tag, primary locator
- Click to reload
- "Clear History" button

### 6. Settings Modal
- Default format dropdown (XPath/CSS/Playwright/Cypress/Selenium)
- History limit (10/25/50/100)
- Theme toggle (Dark/Light)
- Color theme selector (when light)

---

## Color Themes Detail

### Dark Blue (Default)
```
Primary: #3b82f6 (Blue 500)
Secondary: #1e293b (Slate 800)
Background: #0f172a (Slate 900)
Surface: #1e293b (Slate 800)
Accent: #22c55e (Green 500)
Text Primary: #f8fafc (Slate 50)
Text Secondary: #94a3b8 (Slate 400)
Border: #334155 (Slate 700)
```

### Dark Purple
```
Primary: #8b5cf6 (Violet 500)
Secondary: #1e1b2e
Background: #0f0a1a
Surface: #1e1b2e
Accent: #22c55e (Green 500)
Text Primary: #f8fafc
Text Secondary: #94a3b8
Border: #3730a3 (Violet 800)
```

### Dark Orange
```
Primary: #f97316 (Orange 500)
Secondary: #1e1a14
Background: #0f0a08
Surface: #1e1a14
Accent: #22c55e (Green 500)
Text Primary: #f8fafc
Text Secondary: #9a8a78
Border: #451a03 (Orange 900)
```

### Dark Green
```
Primary: #10b981 (Emerald 500)
Secondary: #142e25
Background: #0a1812
Surface: #142e25
Accent: #22c55e (Green 500)
Text Primary: #f8fafc
Text Secondary: #6b8a7a
Border: #064e3b (Emerald 900)
```

### Light Blue
```
Primary: #3b82f6 (Blue 500)
Secondary: #eff6ff (Blue 50)
Background: #ffffff
Surface: #f8fafc (Slate 50)
Accent: #10b981 (Emerald 500)
Text Primary: #0f172a (Slate 900)
Text Secondary: #64748b (Slate 500)
Border: #e2e8f0 (Slate 200)
```

### Light Green
```
Primary: #10b981 (Emerald 500)
Secondary: #f0fdf4 (Green 50)
Background: #ffffff
Surface: #f8fafc (Slate 50)
Accent: #3b82f6 (Blue 500)
Text Primary: #0f172a (Slate 900)
Text Secondary: #64748b (Slate 500)
Border: #e2e8f0 (Slate 200)
```

---

## Component Specifications

### Header
- Height: 90px
- Background: Surface color
- Contains: Logo (icon + text), settings button, stats bar

### Stats Bar
- Shows: "X elements picked" | "Y formats"
- Font size: 11px
- Text color: Secondary

### Tab Bar
- Height: 48px
- 3 tabs: Pick, Build, History
- Active tab: Primary color underline (2px)
- Inactive: Secondary text color

### Pick Button
- Height: 48px
- Full width with 16px horizontal padding
- Border radius: 10px
- Background: Primary color
- Text: White, 14px, semibold

### Element Card
- Border radius: 8px
- Border: 1px solid Border color
- Background: Surface color
- Contains: Tag name, path, attributes as chips

### Locator Card
- Border radius: 8px
- Header: Background darker than card, contains type label + copy button
- Body: Locator code in monospace font
- Type label: Primary color, 11px, bold

### Footer Action Buttons
- Height: 40px
- Border radius: 6px
- Background: Surface color with border

---

## Typography

### Font Families
- Primary: Inter, system-ui, sans-serif
- Code: Fira Code, JetBrains Mono, monospace

### Font Sizes
- Logo: 15px, semibold
- Tab: 13px, medium
- Button: 14px, semibold
- Body: 13px, regular
- Code: 11-12px, monospace
- Caption: 11px, regular
- Stats: 11px, regular

---

## Spacing System
- Base unit: 4px
- XS: 4px
- SM: 8px
- MD: 12px
- LG: 16px
- XL: 20px
- 2XL: 24px

---

## Screen Dimensions
- Sidebar width: 360-380px (recommended: 360px)
- Sidebar height: Full viewport height (min 500px)

---

## Implementation Notes

1. Theme should be stored in chrome.storage.local
2. Theme toggle should persist across sessions
3. Color themes can be CSS variables for easy switching
4. All interactive elements need hover states
5. Copy feedback: show toast notification
6. Keyboard shortcut: Ctrl+Shift+L to activate picker
