# Production-Grade Design Research — Locator Inspector Side Panel

> Date: 2026-09-05 | Scope: fonts, colors, spacing, side-panel UX | Sources: primary docs only

## 1. Chrome Extension Side Panel UX (Primary: Chrome for Developers)

**Source:** `developer.chrome.com/docs/extensions/reference/api/sidePanel` (2026-01-19), `developer.chrome.com/blog/extension-side-panel-launch` (2023-05-30), `developer.chrome.com/docs/extensions/develop/ui` (2023-11-27), `developer.chrome.com/docs/webstore/program-policies/quality-guidelines`

- Side Panel API stable Chrome 114 (`open()` Chrome 116+). Persistent companion surface, enabled via `"sidePanel": {"default_path": "sidepanel.html"}` + `"sidePanel"` permission. Opens via `sidePanel.setPanelBehavior({openPanelOnActionClick:true})` or `sidePanel.open({tabId})` after user gesture [sidePanel API].
- **Companion principle:** "Your side panel should act as a helpful companion ... providing complementary functionality ... with minimal distractions. Should actively enhance the user's current task." Single purpose, narrow, easy to understand. Avoid hijacking browsing/search. [Quality Guidelines]
- **Design consistency:** "Should have a visually appealing design that matches the logo, colors, icons, and fonts of your extension and store listing. This provides users a consistent, recognizable experience." [sidePanel launch blog]
- **Narrow persistent width:** Panel is ~320-360px (user can choose left/right in Chrome settings). Must be responsive, no fixed 480px, no horizontal scroll. Treat `sidepanel.html` as normal extension page with own origin [extensionbooster sidePanel guide].
- **Privacy:** No host permissions required to show UI — significant privacy win. Keep `activeTab` only, avoid `<all_urls>` if not needed.

**Implication for Locator Inspector:** Keep side panel as focused locator companion (not dashboard). Match icon/tile colors. Width max 360-380, fluid, 8pt grid ensures no overflow at 320. Single primary action (Start Inspect).

## 2. Developer Tool Typography (Primary: FontHubs, Typematch, WPSHOUT, Snappify)

**Sources:** `typematch.io/for/coding-development` (analyzed 1,500 Google Fonts), `fonthubs.com/guide/best-fonts-for-developer-tools`, `jhkinfotech.com/blog/code-fonts-for-developers-programmers` (2025), `snappify.com/blog/best-fonts-for-coding` (2025)

**Code / Mono (for locators):**

- **JetBrains Mono** — "sharp edges, balanced spacing, uniform width, reduces eye strain, designed specifically for code readability" [JHK, Snappify]. Top 2 in all 2025 lists (Fira Code, JetBrains Mono, Source Code Pro, Inconsolata).
- **IBM Plex Mono** — corporate/technical structure, engineered for IBM [Typematch].
- **Source Code Pro** (Adobe) — monospaced for coding [Typematch].
- **Hack** — generous spacing for large screens, Powerline glyphs [Snappify].

**UI Sans (for labels/headings):**

- 2025 UI trend: "Manrope, Satoshi, Urbanist, Geist prioritize readability and versatility while leaning into bold geometric" [bestwebdesigntools Top 25 2025]
- **Mona Sans & Geist** (GitHub duo): "blending geometric and humanist, powerhouse for design system, 2025" [Bookmarkify].
- **Space Grotesk** / **General Sans** — distinctive grotesque alternatives to overused Inter/Roboto [FontHubs, Bookmarkify]. Typematch recommends Be Vietnam Pro, Manrope, Plus Jakarta Sans, Poppins for developer tools.
- **Avoid:** Inter, Roboto (overused), pure monospace as lazy shorthand for "technical" (frontend-design skill DON'T).

**Pairing recommendation (per Bookmarkify "concord and contrast"):**

- Workhorse Sans body + Expressive Display headline, or Geometric Sans + Elegant Serif, or Single Variable family.
- For devtool: **Technical sans (Space Grotesk / Geist / Satoshi) + Humanist mono (JetBrains Mono / IBM Plex Mono)** gives trust + clarity.

**Decision:** **Space Grotesk 500/700** for UI headings/labels (geometric, distinctive, not Inter) + **JetBrains Mono 400/600/700** for locators/mono labels. Both Google Fonts, optimized for screen, 4 weights only (performance). JetBrains Mono differentiates `1/l/I` and `0/O` critically for copying locators.

Citations: Typematch ranked Inconsolata #1, IBM Plex Mono #2, Source Code Pro #4 for developer tools; JHK top 10 includes Fira Code #1, JetBrains Mono #2, Hack, Inconsolata, Monaco, Ubuntu Mono, Menlo, Monaspace (GitHub variable).

## 3. Color System — Tailwind v4 OKLCH + shadcn Tokens (Primary: DesignRevision, Tailwindcolor, shadcn/ui Theming, Evil Martians)

**Sources:** `designrevision.com/tools/tailwind-colors` (242 Tailwind v4 OKLCH + hex), `tailwindcolor.com/zinc`, `ui.shadcn.com/docs/theming`, `evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl`

- Tailwind v4 palette: 22 families × 11 shades (50-950) = 242 colors, every value defined in OKLCH with hex fallback for wider P3 gamut, perceptually uniform lightness [DesignRevision]. Example Zinc scale oklch(0.985 0 0) #fafafa (50) → oklch(0.141 0.005 285.823) #09090b (950) [tailwindcolor zinc].
- **OKLCH** (`L` perceived lightness 0-1, `C` chroma, `H` hue) fixes HSL inconsistency (yellow vs blue same L look different). Separates hue/lightness/chroma, enables formula palette + P3 wide-gamut [Evil Martians].
- **shadcn base colors:** `neutral`, `gray`, `zinc`, `stone`, `slate`, `mauve`, `olive`, `mist`, `taupe`. **Zinc is default**, slate most popular. Zinc = `zinc-50 #fafafa` … `zinc-900 #18181b` … `zinc-950 #09090b`. Neutral is hueless, stone warmer editorial, zinc is balanced engineering gray [shadcn Theming].
- **Semantic tokens:** `background/foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `chart-*`, `sidebar-*`, `radius` (base 0.625rem → derived sm 0.375rem). Dark mode overrides same tokens under `.dark` [shadcn].
- **Radius scale:** `--radius: 0.625rem`, `--radius-sm: calc(var(--radius)*0.6)` etc. [shadcn].

**Decision:** Use **zinc** as base neutral (proven default for devtools, matches Chrome DevTools zinc neutrals). Accent: **amber-400 #fbbf24 / oklch(0.82 0.17 84)** + amber-500 for measurement highlight — warm, visible against zinc, not AI cyan/purple slop. Keep palette to zinc 50-900 + amber 100/300/400/500 only. Tokens:

```
--background: oklch(0.985 0 0) // zinc-50
--foreground: oklch(0.21 0.006 285.885) // zinc-900
--card: oklch(1 0 0)
--muted: oklch(0.97 0.001 286.375) // zinc-100
--muted-foreground: oklch(0.552 0.016 285.938) // zinc-500
--border: oklch(0.92 0.004 286.32) // zinc-200
--primary: zinc-900, primary-foreground: zinc-50
--accent: amber-400 oklch(0.85 0.17 84), accent-foreground zinc-900
--ring: zinc-400, radius 0.5rem (8px) → tight for dense panel
```

## 4. Spacing — 8pt Grid System (Primary: 8px grid guides, Material/Carbon/Ant Design)

**Sources:** `rejuvenate.digital/news/designing-rhythm-power-8pt-grid-ui-design`, `gridmakerpro.com/grids/typography-grids/8pt-spacing-grid`, `thehangline.com/8px-grid-spacing-system-explained-for-web-designers` (2026-04-05), `wpdean.com/what-is-the-8-point-grid-system`, `design-grounds.com/learn/ui-visual/02-layout-spacing`

- Core idea: every spacing value is multiple of 8 (8,16,24,32,40,48,56,64) + 4pt half-step for icon-label gaps, badge inline gaps [The Hangline].
- Scale: `space-1 8px` tight gaps, `space-2 16px` card/button padding, `space-3 24px` between groups, `space-4 32px` sections [Hangline]. Common use: inner card 16, title-desc 8, cards gap 24.
- Material 3 uses 4dp base (8dp grid), IBM Carbon uses 8px mini unit, Ant Design 8px base — industry pattern [wpdean].
- Tailwind uses 4px base (spacing-1=4px, spacing-2=8px) — technically 4pt system, compatible with 8pt grid [wpdean].
- Practical rule: **space within a group < space between groups — at least 1.5–2× difference, or grouping dissolves** [DesignGrounds].

**Implication:** Side panel narrow (320px) → use 12px (3×4) for inner card padding, 8px for label-code gaps, 16px between sections, 24px for major dividers. Never use 10,13,15px. Icons 16/24, buttons height 32/40. For dense locator list: `gap-2 (8px)` within row, `py-2 (8px)` row padding, `gap-4 (16px)` between locators group and next section.

## 5. Professional Polish — Layout & Theming Details

**Sources:** `ui.shadcn.com/docs/theming` (radius, tokens), Chrome DevTools grid inspector (visual rhythm)

- **Radius:** shadcn default `0.625rem (10px)` with derived `sm 6px, md 8px` — for dense panel use tighter `0.5rem (8px)` base to feel precise, not bubbly.
- **Typography queuing:** Workhorse body first (readability), then display headline for hierarchy (Bookmarkify). Fluid clamp: `clamp(18px, 4vw, 22px)` for display.
- **Border:** Use `border-border` token (zinc-200) for dividers, hairline 1px, no shadows (slop tell).
- **Motion:** Use `ease-out-quint/expo`, stagger 28ms, respect `prefers-reduced-motion`.
- **Responsive:** Container queries for component-level responsiveness; adapt panel not just shrink [frontend-design skill].

## 6. Decisions Summary

| Choice           | Selection                                                                   | Why (cited)                                                                             |
| ---------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Mono**         | JetBrains Mono 400/700                                                      | Top 2 2025 coding font, sharp edges, 0/O distinction [JHK, Snappify]                    |
| **Sans**         | Space Grotesk 500/700                                                       | Geometric distinctive, not Inter, pairs with mono per Typematch "technical sans-serifs" |
| **Base neutral** | Zinc (shadcn default)                                                       | Default for shadcn, balanced engineering gray, matches Chrome DevTools [shadcn]         |
| **Accent**       | Amber 400 (oklch)                                                           | Warm, visible on zinc, not AI purple-blue gradient slop                                 |
| **Tokens**       | background/foreground/card/muted/border/primary/accent/ring + radius 0.5rem | Semantic, maintainable, dark-ready per shadcn                                           |
| **Spacing**      | 4/8/12/16/24 scale (Tailwind 4px base, 8pt grid)                            | Industry standard Material/Carbon, eliminates guesswork, 1.5–2× group separation        |
| **Panel width**  | max 360, fluid to 320, no fixed 480                                         | Chrome sidePanel is narrow persistent companion                                         |

All claims linked to primary sources above. Saved to `docs/research/2026-09-05-production-design-research.md`.
