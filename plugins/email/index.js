module.exports = {
  name: 'email',
  version: '0.1.0',

  // semver range expected (https://github.com/npm/node-semver)
  supportedServerVersions: '>=1.0.0-beta.0',

  routes: require('./routes'),
  versions: require('./versions'),

  permissions: [
    'email:send:all'
  ]
}
