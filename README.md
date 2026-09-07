# Selekt — Playwright-first Side Panel

Locator Inspector rebranded as **Selekt**. Incremental WXT + React 19 extension. **V1 MVP:** Side-panel picker → hover highlight → click lock → ranked `getByRole` / `getByTestId` / `getByText` locators + Copy.

Built greenfield with WXT, borrowing selector ideas from [`ruifigueira/playwright-crx`](https://github.com/ruifigueira/playwright-crx) (Apache-2.0 — see `LICENSE` / `NOTICE`).

## Quick Start

```bash
npm install
npm run dev        # HMR, load .output/chrome-mv3 unpacked
npm run build      # production build in .output/chrome-mv3
npm run zip        # extension-only package in .output/selekt-<version>-chrome.zip
npm run zip:firefox # extension-only package in .output/selekt-<version>-firefox.zip
```

## Install from Releases (free, no store account)

No paid Chrome Web Store listing — Chrome one-click install requires a $5 dev account, so Releases use free sideload instead.

**Chrome:**

1. Download `selekt-<version>-chrome.zip` from **Releases** and unzip it.
2. Go to `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the unzipped folder.
3. From source instead: `npm run build` → `chrome://extensions` → Developer mode → Load unpacked → `.output/chrome-mv3`.

**Firefox (temporary load):**

1. Download `selekt-<version>-firefox.zip` from **Releases**.
2. Go to `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select the zip.

## Usage

1. Click extension icon → Side Panel opens (action auto-opens sidePanel)
2. In panel click **Start Inspect** → hover page (blue dashed overlay) → click element
3. Panel shows ranked locators (green **BEST** badge) → **Copy** → paste into Playwright test
4. `Alt+Shift+C` toggles picker · `Esc` cancels

## Incremental Roadmap

- **V0** scaffolding — done
- **V1** MVP picker + Playwright ranking — done
- **V1.1** validation: uniqueness count + highlight-all — next
- **V1.2** shadowDOM/iframe, options (`data-testid` attr), `getByLabel` polish
- **V2** history (last 20) + export
- **V3** recorder (adds `playwright-crx` lib + `debugger` permission when needed)

## Project Structure

```
entrypoints/background.ts   // sidePanel open + picker relay + commands
entrypoints/content.ts      // overlay + generateLocators → runtime message
utils/locators.ts           // Playwright ranking: testId > role > placeholder > text > css
entrypoints/sidepanel/      // React UI: toggle, preview, BEST badge, copy
wxt.config.ts               // manifest: storage, sidePanel, activeTab, scripting
```

## Tech

WXT 0.21 + React 19 + TypeScript + Vite, `chrome.sidePanel` (114+). No `chrome.debugger` in V1.

## License

Apache-2.0 (see `LICENSE`). Retain `NOTICE` for playwright-crx / Playwright / Google attributions.
