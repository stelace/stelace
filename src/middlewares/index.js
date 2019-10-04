const _ = require('lodash')

const coreMiddlewares = {
  cache: require('./cache')
}

const pluginMiddlewares = {}

module.exports = {
  beforeRoutes,
  start,
  stop,

  register,
  getAll
}

/**
 * Plugin middlewares must be exposed by this hook to be available in routes.
 * We may introduce an afterRoutes hook in the future,
 * which would require some refactoring of wrapAction middleware.
 */
function beforeRoutes (...args) {
  hook('beforeRoutes', ...args)
}

function start (...args) {
  hook('start', ...args)
}

function stop (...args) {
  hook('stop', ...args)
}

function register (middlewares) {
  Object.assign(pluginMiddlewares, _.mapValues(middlewares, wrapInObj))
}

function getAll () {
  const mObjects = getMiddlewaresAndHooks()
  const omitHooks = m => _.omit(wrapInObj(m), ['beforeRoutes', 'start', 'stop'])

  return _.transform(mObjects, (middlewares, v) => {
    Object.assign(middlewares, { ...omitHooks(v) })
  }, {})
}

function getMiddlewaresAndHooks () {
  return Object.assign({}, coreMiddlewares, pluginMiddlewares)
}

/**
 * This util function allows to import plain middleware function from plugins
 * or a middleware config object with beforeRoutes/start/stop hooks as well, for complex needs.
 * @param {Object|Function} m - can be:
 *   - middleware config object with hooks and one or more middleware functions
 *   - or a middleware function itself
 */
function wrapInObj (m) {
  if (typeof m === 'function') return { [m.name]: m }
  else return m
}

function hook (hook, ...args) {
  const middlewares = getMiddlewaresAndHooks()

  Object.keys(middlewares).forEach(key => {
    const m = wrapInObj(middlewares[key])
    if (typeof m[hook] === 'function') m[hook](...args)
  })
}
