# Pipeline Checklist — Locator Inspector

> Every push to `main`/`develop`/`feat/*` → auto-build. Tag `v*.*.*` → auto-release.

## 1. Local (pre-push) — `scripts/push.sh` does this

- [ ] **Format:** `npm run format` — Prettier 3, 100 printWidth, LF
- [ ] **Lint:** `npm run lint` — ESLint 9 + `typescript-eslint` + `react`/`react-hooks`, 0 errors (warnings for `any` okay)
- [ ] **Typecheck:** `npm run typecheck` — `tsc --noEmit` with `skipLibCheck` (strict false for now, will be `strict:true`)
- [ ] **Test:** `npm run test` — Vitest 48 tests (locators, a11y, exhaustive) across jsdom
- [ ] **Build:** `npm run build` — `wxt build` → `.output/chrome-mv3` (MV3, 220-260k)
- [ ] **Zip:** `npm run zip` — `.output/*.zip` (79k) + `unzip -l` verify manifest
- [ ] **Manual smoke:** Load unpacked `.output/chrome-mv3` in `chrome://extensions`, test Inspect + Manual on `http://localhost:8765/test-page.html` and `https://demo.playwright.dev/todomvc`

Run: `./scripts/push.sh "feat: ..." main` — does all 6 + `git commit` + `push`.

## 2. CI (GitHub Actions) — `.github/workflows/ci.yml`

- [ ] **Trigger:** `push` to `main`/`develop`/`feat/*`/`fix/*`, `pull_request` to `main`/`develop`, or manual `workflow_dispatch`
- [ ] **Concurrency:** cancel previous run on same ref
- [ ] **Quality job** (single `npm ci` — cached):
  - [ ] `npm run prepare` → `.wxt/tsconfig.json` before typecheck
  - [ ] `npm run lint`
  - [ ] `npm run format` (`prettier --check .`)
  - [ ] `npm run typecheck`
  - [ ] `npm run test` (48)
- [ ] **Build job** (needs `quality`):
  - [ ] `npm run build` (chrome-mv3)
  - [ ] `npm run zip`
  - [ ] `ls -lh .output/*.zip && unzip -l` verify
  - [ ] `upload-artifact` `locator-inspector-${sha}.zip` (14d) + `chrome-mv3/` dir (3d)
- [ ] **Artifacts:** Check `Actions → CI → Artifacts` — zip should be ~79k, manifest `side_panel.default_path`

## 3. Release — `.github/workflows/release.yml`

- [ ] **Tag:** `git tag v0.2.0 && git push origin v0.2.0` (semver `v*.*.*`)
- [ ] **Trigger:** `on.push.tags` runs: `lint → typecheck → test → build → zip → softprops/action-gh-release` (auto notes + `.zip` attached)
- [ ] **Verify:** `Releases` page shows new release with zip, `generate_release_notes: true`

## 4. Chrome Web Store (optional, needs secrets)

- [ ] Set secrets in `Settings → Secrets → Actions`: `CWS_EXTENSION_ID`, `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN` (from `https://chrome.google.com/webstore/devconsole`)
- [ ] Enable `publish` job in `ci.yml` (uncomment) — publishes on `tags/v*` after `build`
- [ ] After publish, check `chrome.google.com/webstore/devconsole` → new version pending review

## 5. Local Setup for New Contributors

- [ ] `npm ci` (Node 20, uses `wxt prepare` postinstall)
- [ ] `npm run dev` → loads `.output/chrome-mv3` with HMR, open `chrome://extensions` → Load unpacked
- [ ] `npm run lint:fix` + `npm run format:fix` before commit (or let `push.sh` do it)
- [ ] `npm run select "page.getByTestId('x')"` demo for manual locator logic

## 6. Failure Handling

- [ ] **Lint fail:** `npm run lint:fix`, commit
- [ ] **Typecheck fail:** `tsc --noEmit` shows file:line — fix, never loosen `strict` without ADR
- [ ] **Test fail:** `npm run test -- --run` shows which of 48 — add case to `docs/EDGE_CASE_MATRIX.md` if new edge
- [ ] **Build fail:** `vite` version mismatch — keep `vite@6.3.4` + `vitest@2.1.8` + `wxt@0.21.4` + `@wxt-dev/module-react@1.1.5` with `--legacy-peer-deps`, check `wxt prepare` before `typecheck`
- [ ] **Zip missing:** `ls .output/*.zip` — ensure `wxt.config.ts` has `zip` script and `web-ext` installed

## 7. Definition of Done for a PR

- [ ] All 6 local checks green (`push.sh` passed)
- [ ] CI green (both jobs) + artifact uploaded
- [ ] Manual smoke on 2 demo sites (`test-page.html` + `todomvc`) — picker single amber overlay, click blocked, copy icon works, manual `as you type` shows `Found N`
- [ ] No new `vibecop` `god-function` errors (keep `App` <100 lines via hooks)
- [ ] `docs/improvements.md` updated if new debt added
