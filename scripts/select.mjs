#!/usr/bin/env node
/**
 * select.mjs — Playwright locator selector demo
 * Usage:
 *   node scripts/select.mjs "page.getByTestId('submit')"
 *   node scripts/select.mjs "#my-id"
 *   node scripts/select.mjs "//div[@id='test']"
 *
 * This script demonstrates how the extension's `parseManualLocator` logic
 * converts Playwright/CSS/XPath locators to DOM queries.
 * In a real browser you would use the sidepanel manual field; this is a
 * Node.js demo using jsdom for CI / unit testing.
 */
import { JSDOM } from 'jsdom';
import { generateLocators } from '../utils/locators.ts';

const input = process.argv[2];
if (!input) {
  console.log('Usage: node scripts/select.mjs "<locator>"');
  console.log('Examples:');
  console.log('  node scripts/select.mjs "page.getByTestId(\'submit\')"');
  console.log('  node scripts/select.mjs "#my-id"');
  console.log('  node scripts/select.mjs "//div[@id=\'test\']"');
  process.exit(1);
}

// Demo DOM
const dom = new JSDOM(`<!DOCTYPE html><body>
  <button data-testid="submit">Submit</button>
  <div id="my-id">Hello</div>
  <input placeholder="Enter name" />
</body></html>`);
global.document = dom.window.document;
global.window = dom.window;
global.CSS = dom.window.CSS;
global.Node = dom.window.Node;
global.Element = dom.window.Element;
global.HTMLElement = dom.window.HTMLElement;

// Demo: generate locators for an element
const el = document.querySelector('[data-testid="submit"]');
if (el) {
  console.log('Input locator:', input);
  console.log('\nGenerated locators for [data-testid="submit"] button:');
  const locs = generateLocators(el);
  locs.slice(0, 5).forEach((l) => console.log(`  - [${l.kind}] ${l.value} (score ${l.score})`));
}

// Demo: parse manual locator (simplified)
console.log(`\nManual input "${input}" would be parsed as:`);
if (input.includes('getByTestId')) {
  const m = input.match(/getByTestId\(['"](.*)['"]\)/);
  console.log(`  → query: [data-testid="${m?.[1]}"]`);
} else if (input.startsWith('#') || input.startsWith('.') || input.startsWith('[')) {
  console.log(`  → query: document.querySelectorAll("${input}")`);
} else if (input.startsWith('//')) {
  console.log(`  → query: document.evaluate("${input}", document)`);
} else {
  console.log(`  → raw: ${input}`);
}
