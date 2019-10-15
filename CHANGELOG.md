# Changelog

All notable changes to Stelace server are documented in this file, using [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

New [Stelace API versions](https://docs.api.stelace.com/?version=latest#7fc05fea-be99-413b-8dd9-660bba01b6e9) are denoted as such:

__API version `yyyy-mm-dd`__

__Latest version: `2019-05-20`__

## [1.0.0-beta.2](https://github.com/stelace/stelace/compare/v1.0.0-beta.1...v1.0.0-beta.2) (2019-10-15)

### BREAKING CHANGES

* enforcing UTC in Transaction and Availability APIs (#35)
* **routes:** move route flags to route objects (#23)

### Bug Fixes

* inconsistent moment timezone instead of UTC ([#35](https://github.com/stelace/stelace/issues/35)) ([ade85dc](https://github.com/stelace/stelace/commit/ade85dc))
* **pricing:** edge cases with division by zero ([#18](https://github.com/stelace/stelace/issues/18)) ([1475d47](https://github.com/stelace/stelace/commit/1475d47))
* **pricing:** takerFeesPercent not applied to base price ([#19](https://github.com/stelace/stelace/issues/19)) ([f353cf7](https://github.com/stelace/stelace/commit/f353cf7)), closes [#17](https://github.com/stelace/stelace/issues/17)

* **routes:** move route flags to route objects ([#23](https://github.com/stelace/stelace/issues/23)) ([c2ef5fe](https://github.com/stelace/stelace/commit/c2ef5fe))

### Features

* **Authorization:** expose missingPlanPermissions ([2ba7815](https://github.com/stelace/stelace/commit/2ba7815))
* **Event:** metadata filter ([#22](https://github.com/stelace/stelace/issues/22)) ([357b1a2](https://github.com/stelace/stelace/commit/357b1a2))
* **plugins:** expose restifyAuthorizationParser ([fa4cee0](https://github.com/stelace/stelace/commit/fa4cee0))
* **Workflow:** add req object flag ([a3d7768](https://github.com/stelace/stelace/commit/a3d7768))

## [1.0.0-beta.1](https://github.com/stelace/stelace/compare/v1.0.0-beta.0...v1.0.0-beta.1) (2019-10-07)

### Bug Fixes

* **validation:** not coercing common URL query strings to objects ([14c1cb4](https://github.com/stelace/stelace/commit/14c1cb4))

## 1.0.0-beta.0 (Initial release)

__API Version `2019-05-20`__
