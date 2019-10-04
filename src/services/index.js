const services = {
  store: require('./store'),
  batch: require('./batch'),

  apiKey: require('./apiKey'),
  assessment: require('./assessment'),
  asset: require('./asset'),
  assetType: require('./assetType'),
  authentication: require('./authentication'),
  authorization: require('./authorization'),
  availability: require('./availability'),
  category: require('./category'),
  config: require('./config'),
  customAttribute: require('./customAttribute'),
  document: require('./document'),
  entry: require('./entry'),
  event: require('./event'),
  message: require('./message'),
  namespace: require('./namespace'),
  order: require('./order'),
  role: require('./role'),
  search: require('./search'),
  signal: require('./signal'),
  task: require('./task'),
  transaction: require('./transaction'),
  user: require('./user'),
  webhook: require('./webhook'),
  workflow: require('./workflow')
}

function init (...args) {
  Object.keys(services).forEach(key => {
    const route = services[key]
    route.init(...args)
  })
}

function start (...args) {
  Object.keys(services).forEach(key => {
    const route = services[key]
    route.start(...args)
  })
}

function stop (...args) {
  Object.keys(services).forEach(key => {
    const route = services[key]
    route.stop(...args)
  })
}

module.exports = {
  init,
  start,
  stop,

  services
}
