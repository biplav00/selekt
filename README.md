# Selekt

A Chrome extension for test automation that generates XPath, CSS, and framework-specific selectors (Playwright, Cypress, Selenium).

## Features

- **Click-to-Select**: Click any element on a webpage to generate locators
- **Multi-format Output**: XPath, CSS, Playwright, Cypress, Selenium
- **Interactive Builder**: Build and test selectors
- **History**: Save and manage previously generated locators
- **Export**: Copy to clipboard or export as JSON
- **Keyboard Shortcuts**: Cmd+Shift+L to toggle picker

## Tech Stack

- **Framework**: [WXT](https://wxt.dev/) (Chrome Extension Framework)
- **UI**: Vanilla TypeScript
- **Build**: Vite

## Getting Started

```bash
# Install dependencies
npm install

# Start development with hot reload
npm run dev

# Build for production
npm run build
```

## Loading the Extension

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `output/chrome-mv3` folder

## Usage

1. Click the extension icon in Chrome toolbar (or use Cmd+Shift+L)
2. Click "Pick Element" button
3. Click any element on the webpage
4. View generated locators in multiple formats
5. Copy individual locators or export as JSON

## Version

See [CHANGELOG.md](./CHANGELOG.md) for version history.
