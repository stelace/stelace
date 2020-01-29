# Plugins

You can extend the functionality of Stelace API server with plugins, built on top of all core services to add:

- `routes` with `versions`
- `middlewares`
- new `permissions`
- own `test` folder and `fixtures`

__This means plugins are very powerful and should be installed with care if they’re not officially supported.__

## Import

Most official plugins are currently included in `plugins` directory of Stelace server repository and automatically loaded on startup.

You can:

- Exclude local plugins with `IGNORED_LOCAL_PLUGINS` environment variable
- `npm install`/`yarn add` any additional plugins (added to package.json) and add them to `INSTALLED_PLUGINS` environment variable
- or simply add Github repository URLs to `INSTALLED_PLUGINS` comma-separated list and run `yarn plugins`

When using `INSTALLED_PLUGINS` and `yarn plugins`, this runs two commands internally, supporting __private plugins__:

- `yarn plugins:install` adds `INSTALLED_PLUGINS` to node_modules without updating package.json, unless you pass `--save` flag. Modules are then copied to `plugins/installed` `.gitignore`’d directory to avoid tampering with node_modules.
- `yarn plugins:prepare` rewrites `require('stelace-server')` calls to use local server.

## Develop

Have a look at official `rating` plugin to get a complete working example.

Search filter Domain-Specific Language is also enabled by [a standalone plugin](https://github.com/stelace/stelace-search-filter-dsl-parser), as another working example.

Plugins are expected to export the following properties from `index.js` file, in addition to optional properties mentioned in the intro above:

- `name`
- `version`
- `supportedServerVersions`

### External repository

When developing a plugin as an external repository, you can `yarn add -D https://github.com/stelace/stelace.git` as a devDependency to be able to use exports from `server.js` using `require('stelace-server')`.

Look at official [Search filter DSL parser plugin](https://github.com/stelace/stelace-search-filter-dsl-parser) for a blueprint.

#### Running plugin tests

You can easily run external plugin tests with 'stelace-server' as a devDependency.

Add this script to package.json file in your plugin repository:

```json
// plugin loads itself before starting tests
"scripts": {
  "test": "cross-env STELACE_PLUGINS_PATHS=$(shx pwd) NODE_ENV=test ava --c $(node -p 'Math.max(os.cpus().length - 1, 1)')",
}
```

Include the following lines at the beginning of `test/*.spec.js` files:

```js
const test = require('ava')

const {
  testTools: {
    lifecycle,
    /* … */
  }
} = require('stelace-server')

const { before, beforeEach, after } = lifecycle

test.before(before({ name: 'event' }))
test.beforeEach(beforeEach())
test.after(after())

test('Some test name', async (t) => {
  /* … */
})
// …
```

And run plugin tests with `yarn test` on the command line.

#### Running plugin & server tests

You can also ensure your plugin does not break the server using the following command with stelace-server:

```sh
STELACE_PLUGINS_PATHS=/path/to/local/plugin/repo yarn test:server
```

_Note: you can make use of `npm explore` to use this from within your plugin repository with stelace-server installed as a devDependency._

## Continuous integration and tests

During continuous integration with circleCI:

- missing `INSTALLED_PLUGINS` are automatically installed using `yarn plugins:install --save` script, which updates package.json before building Docker image.
- After build, `yarn plugins:prepare` rewrites some `require('stelace-server')` calls to run all of server and plugin tests with local server before ending CI process.

To support private plugins, `Dockerfile.prod` is configured to accept SSH key from ssh-agent as a secret during circleCI build.
This way it does not leak into any Docker image layer.

Please refer to `.circleci/config.yml` file for more details.
