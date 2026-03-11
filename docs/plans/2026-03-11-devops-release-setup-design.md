# DevOps & Release Setup for Selekt

**Date:** 2026-03-11  
**Status:** Approved

---

## 1. CI/CD with Conventional Commits

### Overview
Use semantic-release with GitHub Actions to automate version bumps and releases based on conventional commit messages.

### Workflow
1. Developer pushes to `main` branch
2. GitHub Actions triggers semantic-release
3. semantic-release analyzes commits using conventional-changelog-conventionalcommits
4. Version bumped (patch/minor/major) based on commit types
5. GitHub Release created with changelog
6. Build artifact uploaded for manual Chrome Web Store upload

### Commit Types
| Type | Description | Version Bump |
|------|-------------|--------------|
| feat | New feature | Minor |
| fix | Bug fix | Patch |
| perf | Performance | Patch |
| docs | Documentation | None |
| style | Formatting | None |
| refactor | Code restructure | None |
| test | Tests | None |
| chore | Maintenance | None |
| BREAKING CHANGE | Major change | Major |

### Files
- `.github/workflows/release.yml`
- `.releaserc.json`
- `package.json` - add release scripts

---

## 2. Security (Free & Advanced)

### Overview
Use Dependabot for dependency updates + npm audit for vulnerability scanning.

### Dependabot
- Check for updates weekly
- Create PRs for version updates
- Auto-merge minor/patch updates (optional)

### npm audit
- Run on every push
- Fail workflow if critical vulnerabilities
- Post results as PR annotations

### Files
- `.github/dependabot.yml`
- `.github/workflows/security.yml`

---

## 3. Code Analysis with Biome

### Overview
Use Biome as all-in-one linter and formatter.

### Configuration
- JSON format
- Strict linting rules
- Format on save enabled
- Pre-commit hook for staged files

### CI Workflow
- Run biome on every PR
- Fail if linting errors
- Auto-format on merge to main

### Files
- `biome.json`
- `.github/workflows/lint.yml`
- `package.json` - add format/lint scripts + husky

---

## 4. Chrome Web Store Preparation

### Icons Required
| Size | Use |
|------|-----|
| 16x16 | Toolbar icon |
| 48x48 | Extensions page |
| 128x128 | Store listing |

### Privacy Policy
Required for Chrome Web Store approval. Will include:
- Data collection statement
- Extension functionality
- Contact information

### Manifest Updates
- Add `icons` field to wxt.config.ts
- Reference icon paths

### Files
- `src/icons/` - 16.png, 48.png, 128.png
- `docs/privacy-policy.md`
- `wxt.config.ts` - add icons
- `LICENSE` - MIT

---

## Summary

| Category | Tools | Files |
|----------|-------|-------|
| CI/CD | semantic-release, GitHub Actions | 3 workflow files, .releaserc |
| Security | Dependabot, npm audit | 2 files |
| Code Analysis | Biome, husky | biome.json, 1 workflow |
| Store Prep | - | 3 icons, privacy policy, LICENSE |
| Package | - | package.json updates |

---

## Implementation Priority

1. package.json updates (scripts, husky)
2. biome.json + lint workflow
3. security workflow + dependabot
4. release workflow + .releaserc
5. Chrome store files (icons, privacy, license)
