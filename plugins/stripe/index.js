module.exports = {
  name: 'stripe',
  version: '0.0.1',

  routes: require('./routes'),
  versions: require('./versions'),

  noApiKeyRoutes: [
    { startsWith: '/providers/stripe/webhooks/' }
  ]
}
