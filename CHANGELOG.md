## [1.1.0](https://github.com/biplav00/selekt/compare/v1.0.1...v1.1.0) (2026-03-29)

### Features

* Add extension icon assets ([6f6ecf9](https://github.com/biplav00/selekt/commit/6f6ecf99f044fcdb7c35745cebe0032665af3795))
* add Lit dependency for sidepanel component migration ([245c8cc](https://github.com/biplav00/selekt/commit/245c8cc8d10fb38fbdaf210cd9afaf9408e0c2d3))
* add MutationObserver-based selector watching to content script ([56acf1c](https://github.com/biplav00/selekt/commit/56acf1c072bc4208a3b1b3310ae51b55d428e174))
* add types for selector intelligence, workspace, and DOM monitoring ([10bd38b](https://github.com/biplav00/selekt/commit/10bd38bbbe987b4746b7fa3bb41af96abe9d3ded))
* create build-tab Lit component with freeform/structured modes and real-time scoring ([e28b9c4](https://github.com/biplav00/selekt/commit/e28b9c4786a5ad24d2283eba7e73668e10006e2d))
* create dom-monitor service for page change detection coordination ([4195a65](https://github.com/biplav00/selekt/commit/4195a65c0ad9f84e3cf7f1f1fcdfda7a581b7c28))
* create dom-tree Lit component with lazy-loading, search, and hover highlight ([8dc3b87](https://github.com/biplav00/selekt/commit/8dc3b8788a52f9e867fc5b4a4f5f8a5c6dedac2e))
* create Lit app shell with header, tab navigation, and theme toggle ([4cb37aa](https://github.com/biplav00/selekt/commit/4cb37aa1574fa9b6af98b5c178fe09157b6497a7))
* create Lit theme system with dark/light CSS custom properties ([4071685](https://github.com/biplav00/selekt/commit/40716850eec637cfafc2926a91b60a99a4753d5a))
* create messaging service abstracting Chrome extension APIs ([28aeed2](https://github.com/biplav00/selekt/commit/28aeed26dbc77e9468bda3776c92ea48cabcf0ef))
* create pick-tab component with ranked selector results and scoring ([8632cc3](https://github.com/biplav00/selekt/commit/8632cc32623ca3026538547893fa646e2d8ea113))
* create selector engine with stability scoring and fragility analysis ([5717730](https://github.com/biplav00/selekt/commit/5717730729cf01340426b3adccb1c0a1c23584ff))
* create selector-card Lit component with score, format badge, and actions ([eae9c6b](https://github.com/biplav00/selekt/commit/eae9c6bc5b834d06ef69ba168578a7245680ea9d))
* create settings-modal Lit component with format and history limit options ([da5c09e](https://github.com/biplav00/selekt/commit/da5c09e6e94fa483c13782e1a7ee85e997aab21d))
* create shared Lit CSS for badges, buttons, inputs, and cards ([d498645](https://github.com/biplav00/selekt/commit/d498645b16b87d9b9c417c37fc6866ca8795e061))
* create storage service for settings, workspace, and history migration ([bf35e4e](https://github.com/biplav00/selekt/commit/bf35e4e395ffb2b463ba7bb1f536ad0ac0fe0df0))
* create toast notification Lit component ([ad6d4c5](https://github.com/biplav00/selekt/commit/ad6d4c5e21b5a39c49f6869da79916c71234fc85))
* create workspace-tab with favorites, recents, search, and format filtering ([178c39f](https://github.com/biplav00/selekt/commit/178c39fc5e4e2d010d64cd8bad0ed094fa9d9df8))
* Enhance content script with DOM tree lazy-loading and element highlighting ([9153980](https://github.com/biplav00/selekt/commit/915398034e7b07e6d96f361b38848f54a228fd6b))
* intelligent format-aware suggestions and code editor behavior ([7aa99d5](https://github.com/biplav00/selekt/commit/7aa99d5bc0e0f6dab97f5fde0d1779733a52551b))
* Redesign Build tab HTML — simplified freeform, framework-specific structured ([e2efa7e](https://github.com/biplav00/selekt/commit/e2efa7e27ce260b57abe36a815a558961db26313))
* Redesign Build tab JS — auto-detect freeform type, per-framework structured generators ([e7e2521](https://github.com/biplav00/selekt/commit/e7e25216c289dbb1b745f79c6eaef304c58c5fdd))
* upgrade page scraper to return rich element data for all locator formats ([bdc7b78](https://github.com/biplav00/selekt/commit/bdc7b78804bf0a4dfc6158205f48a298c5954155))

### Bug Fixes

* add error handling to app init to prevent silent failures ([1eb7f7b](https://github.com/biplav00/selekt/commit/1eb7f7bd5a1032647d90cd8a3cf3f31bb9b1a8f0))
* enable legacy decorators for Lit 3.x compatibility ([22e96b1](https://github.com/biplav00/selekt/commit/22e96b1b593c5bff269804baf33c54eecc47b2fb))
* Ensure content script injection before toggling picker via shortcut ([3118fc7](https://github.com/biplav00/selekt/commit/3118fc7e90b9b24ae484cec0e40cb593c43c06b2))
* freeform mode works for all locator types ([08d6724](https://github.com/biplav00/selekt/commit/08d6724438b27bb094be194dd72cc2287a808656))
* prevent element activation during picking and fix Test on Page ([6253c2c](https://github.com/biplav00/selekt/commit/6253c2c58c0cfce108b797b87f3c7cc372ffe904))
* resolve Biome lint errors in app.ts assignment expressions ([f4c00aa](https://github.com/biplav00/selekt/commit/f4c00aa9686a0f844558bd82b624106d2f65a9f3))

## [1.0.1](https://github.com/biplav00/selekt/compare/v1.0.0...v1.0.1) (2026-03-11)

### Bug Fixes

* Add PING handler and SELECTOR_TESTED listener for locator testing ([f57053a](https://github.com/biplav00/selekt/commit/f57053abd1a962d96524e863db4bb933a77d27cb))

## 1.0.0 (2026-03-11)

### Features

* Add DevOps setup with CI/CD, security, and code analysis ([4fae456](https://github.com/biplav00/selekt/commit/4fae45626ca809304110fe7b9f6bdb73618e863b))
* Initial Selekt extension release ([92d010a](https://github.com/biplav00/selekt/commit/92d010a4b75cb6c35b87fa21eebec7b69231c0ac))
* update sidepanel css to match mockup v2 ([b3665d7](https://github.com/biplav00/selekt/commit/b3665d75f539e1bf2709459795f2bdb82f551454))
* update sidepanel css to match mockup v2 ([3275afc](https://github.com/biplav00/selekt/commit/3275afc4c6e63fa57209955caa93b57f85c176d3))
* update sidepanel html structure to match mockup v2 ([15b97db](https://github.com/biplav00/selekt/commit/15b97db6078822d2d2b1dc5fb1f9378dd5258533))
* visual verification and functional testing of UI update ([9a81a29](https://github.com/biplav00/selekt/commit/9a81a291692068c830ac2481a4af60136d0139c0))

### Bug Fixes

* Add conventional-changelog-conventionalcommits dependency ([7ddb895](https://github.com/biplav00/selekt/commit/7ddb895aa8fd10633644e864815a84f75c14dca2))
* Add missing semantic-release plugins ([a745853](https://github.com/biplav00/selekt/commit/a74585342de351bcd6dd02bc64bd587a2594eae7))
* Correct biome format check command in lint workflow ([afbf1f5](https://github.com/biplav00/selekt/commit/afbf1f549af3036b433bc1d06d711027e44c5ba8))
* Fix husky pre-commit to not fail on empty staged files ([2d489dd](https://github.com/biplav00/selekt/commit/2d489dd2b5015d88181a9543cd095239b262e4c8))
* Remove biome format check from lint workflow ([f602f95](https://github.com/biplav00/selekt/commit/f602f95128b60d2624a06c77445fff4ee1ad42c6))
* update main.ts to use element-card-header class ([f266d3b](https://github.com/biplav00/selekt/commit/f266d3b1eb28bfca4cb6c62cd1bf74c02e4f6018))
* update selectors and remove unused buildModeToggle reference ([26aff73](https://github.com/biplav00/selekt/commit/26aff7395dfa487e4eedf5362f985abdbb2bc117))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-11

### Added
- Initial release as **Selekt**
- Element picker with click-to-select functionality
- Multi-format locator generation (CSS, XPath, Playwright, Cypress, Selenium)
- Interactive builder with structured and freeform modes
- History management with persistent storage
- Export to JSON
- DOM tree viewer
- Settings modal (default format, history limit)
- Keyboard shortcuts (Cmd+Shift+L)
- Dark theme UI matching mockup-v2 design
