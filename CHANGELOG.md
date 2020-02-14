# Changelog

All notable changes to Stelace server are documented in this file, using [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

## [1.0.0-beta.5](https://github.com/stelace/stelace/compare/v1.0.0-beta.4...v1.0.0-beta.5) (2020-02-14)

### BREAKING CHANGES

* enable Elasticsearch security feature ([80e5a92](https://github.com/stelace/stelace/commit/80e5a92))

### Bug Fixes

* incorrect Elasticsearch configuration after [#158](https://github.com/stelace/stelace/issues/158) ([bd90a64](https://github.com/stelace/stelace/commit/bd90a64))
* enable Elasticsearch security feature ([80e5a92](https://github.com/stelace/stelace/commit/80e5a92))

## [1.0.0-beta.4](https://github.com/stelace/stelace/compare/v1.0.0-beta.3...v1.0.0-beta.4) (2020-02-13)

### BREAKING CHANGES

* bump node version to v12.14 ([c620022](https://github.com/stelace/stelace/commit/c620022))
* remove deprecated Stripe plugin ([c7d6e83](https://github.com/stelace/stelace/commit/c7d6e83)), replaced with new [stelace-stripe plugin](https://github.com/stelace/stelace-stripe)

### Bug Fixes

* broken commands after [#138](https://github.com/stelace/stelace/issues/138) ([8d22588](https://github.com/stelace/stelace/commit/8d22588))
* ES6 path-to-regexp module ([1791088](https://github.com/stelace/stelace/commit/1791088))
* missing `removeWebhook()` call after [#159](https://github.com/stelace/stelace/issues/159) ([611af91](https://github.com/stelace/stelace/commit/611af91))
* obsolete package.json path ([1d6d354](https://github.com/stelace/stelace/commit/1d6d354))

### Features

* verify and decrypt authentication information ([#127](https://github.com/stelace/stelace/issues/127)) ([bad191c](https://github.com/stelace/stelace/commit/bad191c))

## [1.0.0-beta.3](https://github.com/stelace/stelace/compare/v1.0.0-beta.2...v1.0.0-beta.3) (2019-10-25)

### Features

* Intl polyfill to localize dates ([#45](https://github.com/stelace/stelace/issues/45)) ([b8fc2bf](https://github.com/stelace/stelace/commit/b8fc2bf))
* **Event:** jsonb filters and aggregations ([#36](https://github.com/stelace/stelace/issues/36)) ([7ce879a](https://github.com/stelace/stelace/commit/7ce879a))

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
