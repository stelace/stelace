# Plugins

You can extend the functionality of Stelace API server with plugins, built on top of all core services to add:

- `routes` with `versions`
- `middlewares`
- new `permissions`
- test `fixtures`

__This means plugins are very powerful and should be installed with care if they’re not officially supported.__

## Import

All official plugins are currently included in `plugins` directory of Stelace server repository and automatically loaded on startup.

You can:

- Exclude local plugins with `IGNORED_LOCAL_PLUGINS` environment variable
- `npm install` any additional plugins and add them to `INSTALLED_PLUGINS` environment variable

_Note: during continuous integration with circleCI, missing `INSTALLED_PLUGINS` are automatically installed using `installExternalPlugins.js` script, which updates package.json with `--save` option._

## Develop

Have a look at official `rating` plugin to get a complete working example.

Plugins are expected to export the following properties from `index.js` file, in addition to optional properties mentioned in the intro above:

- `name`
- `version`
- `supportedServerVersions`

### External repository

When developing a plugin in an external repository, you can `yarn add -D stelace-server` as a devDependency to be able to use exports from `server.js`. This can be useful to ensure your plugin does not break the server too, using `yarn test:server`.

An external plugin blueprint will be available soon.
