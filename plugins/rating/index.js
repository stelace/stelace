module.exports = {
  name: 'rating',
  version: '0.0.1',

  routes: require('./routes'),
  versions: require('./versions'),
  middlewares: require('./middlewares'),

  permissions: [
    'rating:stats:all',
    'rating:list',
    'rating:list:all',
    'rating:read',
    'rating:read:all',
    'rating:create',
    'rating:create:all',
    'rating:edit',
    'rating:edit:all',
    'rating:remove',
    'rating:remove:all'
  ],

  fixtures: require('./test/fixtures')
}
