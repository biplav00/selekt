# Locator Generator - Chrome Extension

A test automation locator generation tool for Chrome that generates XPath, CSS, and framework-specific selectors (Playwright, Cypress, Selenium).

## Features

- **Click-to-Select**: Click any element on a webpage to generate locators
- **Multi-format Output**: XPath, CSS, Playwright, Cypress, Selenium
- **Interactive Builder**: Test and refine selectors
- **History**: Save and manage previously generated locators
- **Export**: Copy to clipboard or export as JSON

## Tech Stack

- **Framework**: WXT (Chrome Extension Framework)
- **UI**: React + TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS

## Development Stages

| Stage | Description | Status |
|-------|-------------|--------|
| 1 | Project Setup & Skills Installation | [ ] |
| 2 | WXT Project Scaffolding | [ ] |
| 3 | Core Locator Generation Logic | [ ] |
| 4 | Element Picker (Content Script) | [ ] |
| 5 | Popup UI Components | [ ] |
| 6 | Multi-format Export | [ ] |
| 7 | History & Storage | [ ] |
| 8 | Build & Testing | [ ] |

See [STAGES.md](./STAGES.md) for detailed stage-by-stage progress.

## Getting Started

```bash
# Install dependencies
npm install

# Start development with hot reload
npm run dev

# Build for production
npm run build

# Load extension in Chrome
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the dist folder
```

## Usage

1. Click the extension icon in Chrome toolbar
2. Click "Pick Element" button
3. Click any element on the webpage
4. View generated locators in multiple formats
5. Copy individual locators or export as JSON
