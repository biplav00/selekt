# Locator Inspector — Exhaustive Edge-Case Matrix

Date: 2026-09-05 | Mode: build | Playwright-only

## 1. Positive (Happy) Cases — must generate correct `page.getBy*` as rank 1

| #   | Scenario                  | Element                                        | Expected Top Locator                     | Why                |
| --- | ------------------------- | ---------------------------------------------- | ---------------------------------------- | ------------------ |
| P1  | `data-testid`             | `<button data-testid="submit">Submit</button>` | `getByTestId('submit')`                  | 100 score, stable  |
| P2  | `data-testid` with quotes | `data-testid="a'b\"c"`                         | escaped                                  | escaping           |
| P3  | Button with text          | `<button>Click me</button>`                    | `getByRole('button', {name:'Click me'})` | 95                 |
| P4  | Input placeholder         | `<input placeholder="Enter name">`             | `getByPlaceholder('Enter name')`         | 75 (when no label) |
| P5  | Input + `<label for>`     | `<label for="e">Email</label><input id="e">`   | `getByLabel('Email')`                    | 88 > placeholder   |
| P6  | Wrapped label             | `<label>Accept<input type=checkbox></label>`   | `getByLabel` or role                     | —                  |
| P7  | Heading level             | `<h2>Title</h2>`                               | `getByRole('heading', {level:2})`        | 96                 |
| P8  | Link with href            | `<a href="/">Go</a>`                           | `getByRole('link', {name:'Go'})`         | —                  |
| P9  | Img alt                   | `<img alt="Logo">`                             | `getByAltText('Logo')`                   | 88                 |
| P10 | Checkbox aria-label       | `<input type=checkbox aria-label="Accept">`    | `getByRole('checkbox', {name:'Accept'})` | 95                 |
| P11 | Text leaf                 | `<span>Hello</span>`                           | `getByText('Hello')`                     | 75 leaf only       |
| P12 | Exact text                | same                                           | `getByText('Hello', {exact:true})`       | 70                 |
| P13 | Stable ID                 | `<div id="my-id">`                             | `page.locator('#my-id')`                 | 60 non-dynamic     |
| P14 | CSS fallback              | `<span>` in `<div id="parent">`                | `page.locator('...')`                    | 50                 |

## 2. Negative (Must NOT break, must gracefully handle)

| #   | Scenario                                                               | Expected Behaviour                                                                     |
| --- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| N1  | `chrome://extensions`, `chrome://` , PDF, `file://` without permission | picker `sendMessage` fails → console warn, button reverts, no crash, overlay not stuck |
| N2  | Detached element (`document.createElement` not in DOM)                 | `generateLocators` does not throw, returns css/xpath fallback                          |
| N3  | Empty / whitespace text ` <button>  </button>`                         | no `getByText` with empty, falls to `getByRole('button')` demoted 40                   |
| N4  | Very long text >80 chars                                               | truncate to 77+`...` and demote score, still Playwright syntax                         |
| N5  | Special chars: `' " \ \n \r` in testId/name                            | correctly escaped `\'`, `\\`, `\n`, `\r`                                               |
| N6  | Duplicate `getByText('Add to cart')` ×8 in grid                        | still generates `getByText`, UI must not claim BEST unique (future count badge)        |
| N7  | Dynamic ID `radix-:r1:`, `ember123`, `__next`, `:r2:`                  | filtered via `isDynamicId`, no `id` locator, falls to css                              |
| N8  | Hidden `display:none`, `hidden`, `aria-hidden="true"`                  | not in a11y tree → no role+name 95, only css/xpath low, overlay skipped                |
| N9  | `aria-hidden` ancestor                                                 | same as N8                                                                             |
| N10 | `role="presentation"` / `none`                                         | returns null, no role locator                                                          |
| N11 | Disabled `<button disabled>`                                           | still `getByRole('button', {name})` but should not claim hidden                        |
| N12 | SVG `<text>`                                                           | leaf text works via textContent fallback, no crash                                     |
| N13 | `CSS.escape` edge: id with `:` or `.`                                  | escaped via `CSS.escape`                                                               |
| N14 | Wrapped `<label><input>Text</label>`                                   | `getByLabel` via `closest('label')`                                                    |
| N15 | `aria-labelledby="id1 id2"` multi                                      | join with space `First Second`                                                         |
| N16 | Page with 10k nodes                                                    | no O(n) jank: throttled hover, cached uniqueness                                       |
| N17 | Rapid toggle `Start Inspect` → `ESC` → `Start`                         | listeners cleaned, cursor reset, no leak                                               |
| N18 | Copy fails (no clipboard permission)                                   | fallback to `execCommand`, shows `Copy failed` live region                             |
| N19 | `alt` on non-img ignored                                               | only `img` generates `getByAltText`                                                    |
| N20 | `<a>` without `href`                                                   | not `link` role, no `getByRole('link')`                                                |

## 3. Edge Cases — Real-World Usage

| #   | Scenario                                                       | Expected                                                                    |
| --- | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| E1  | Shadow DOM `<my-element shadowRoot><button>Shadow</button>`    | `composedPath()[0]` + piercing needed (V1 known limit, ensure not crash)    |
| E2  | Iframe (Stripe, CodePen)                                       | `allFrames:false` top only (V1 limit, document)                             |
| E3  | SPA navigation `history.pushState` / hash `#/active` (TodoMVC) | `ctx.onInvalidated` + `popstate` teardown, cursor not stuck                 |
| E4  | Scroll while inspecting                                        | `scroll` → hideHighlight                                                    |
| E5  | Zero-area `display:none` element hover                         | skip `getBoundingClientRect` 0×0                                            |
| E6  | Nested `<button><span>Submit</span></button>`                  | `getByRole` on button, not `getByText` leaf restriction (children.length>0) |
| E7  | Long locator value >80 chars in UI                             | wordBreak `break-all` in `<code>`, not overflow                             |
| E8  | Many locators (8+) in narrow 320px panel                       | no horizontal scroll, grid `48px 1fr auto` wraps, copy button stays         |
| E9  | Font load failure (offline)                                    | fallback `ui-monospace` via CSS, still readable, no FOIT block              |
| E10 | Dark page (GitHub dark) overlay contrast                       | 1.5px zinc-900 border visible on dark? Should be 1.5px + amber left? Check  |
| E11 | Keyboard only: Tab → Start Inspect → Enter → ESC               | `aria-pressed`, `aria-controls`, focus moves to `#locator-list`, ESC works  |
| E12 | Click outside sidepanel while inspecting                       | overlay stays until element clicked or ESC                                  |
| E13 | Duplicate IDs in DOM (invalid HTML)                            | `querySelectorAll('#id').length>1` → not unique, css fallback via parents   |
| E14 | `title` attribute only                                         | `getAccessibleName` → title fallback, score 95 if role present              |
| E15 | `input type=hidden`                                            | `getRoleForElement` returns null, no locator spam                           |

## 4. UI / Visual Edge

| #   | Check                                                                   |
| --- | ----------------------------------------------------------------------- |
| U1  | Narrow 320px: no overflow, code wraps, copy button not clipped          |
| U2  | 360px (default sidePanel) vs 480 max: fluid, centered                   |
| U3  | 10 locators staggered animation 24ms, respects `prefers-reduced-motion` |
| U4  | Selection `::selection` amber visible                                   |
| U5  | Focus ring `1.5px` visible on button/code                               |
| U6  | Empty state dashed border contrast 4.5:1?                               |
| U7  | Live region announces on copy / locators                                |

This matrix drives the exhaustive tests below.
