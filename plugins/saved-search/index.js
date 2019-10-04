module.exports = {
  name: 'saved-search',
  version: '0.1.0',

  // semver range expected (https://github.com/npm/node-semver)
  supportedServerVersions: '>=4.3.0',

  routes: require('./routes'),
  versions: require('./versions'),
  middlewares: require('./middlewares'),

  permissions: [
    'savedSearch:list',
    'savedSearch:list:all',
    'savedSearch:read',
    'savedSearch:read:all',
    'savedSearch:create',
    'savedSearch:create:all',
    'savedSearch:edit',
    'savedSearch:edit:all',
    'savedSearch:remove',
    'savedSearch:remove:all'
  ],

  fixtures: require('./test/fixtures')
}
