const coreRoutes = {
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

const customRoutes = {}

function init (...args) {
  const routesObj = getRoutes()

  Object.keys(routesObj).forEach(key => {
    const route = routesObj[key]
    route.init(...args)
  })
}

function start (...args) {
  const routesObj = getRoutes()

  Object.keys(routesObj).forEach(key => {
    const route = routesObj[key]
    route.start(...args)
  })
}

function stop (...args) {
  const routesObj = getRoutes()

  Object.keys(routesObj).forEach(key => {
    const route = routesObj[key]
    route.stop(...args)
  })
}

function getRoutes () {
  return Object.assign({}, coreRoutes, customRoutes)
}

function registerRoutes (name, routesConfig) {
  Object.keys(routesConfig).forEach(routeKey => {
    const routeConfig = routesConfig[routeKey]
    const routeName = name + '.' + routeKey

    if (typeof routeConfig.init !== 'function') {
      throw new Error(`Route registration: missing init function for route "${routeName}"`)
    }
    if (typeof routeConfig.start !== 'function') {
      throw new Error(`Route registration: missing start function for route "${routeName}"`)
    }
    if (typeof routeConfig.stop !== 'function') {
      throw new Error(`Route registration: missing stop function for route "${routeName}"`)
    }

    customRoutes[routeName] = routeConfig
  })
}

module.exports = {
  init,
  start,
  stop,

  registerRoutes
}
