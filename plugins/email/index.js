module.exports = {
  name: 'email',
  version: '0.0.1',

  routes: require('./routes'),
  versions: require('./versions'),

  permissions: [
    'email:send:all'
  ]
}
