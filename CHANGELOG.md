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
