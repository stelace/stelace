require('dotenv').config()
require('../src/secure-env').config()

const restify = require('restify')
const debug = require('debug')('stelace:api')
const http = require('http')
const _ = require('lodash')
const createError = require('http-errors')
const { serializeError } = require('serialize-error')
const Uuid = require('uuid')
const corsMiddleware = require('restify-cors-middleware2')
const socketIO = require('socket.io')
const apm = require('elastic-apm-node')
const { isActive: isApmActive, addRequestContext } = require('./apm')
const { applyIntlPolyfill } = require('../src/util/intl')

const cors = corsMiddleware({
  origin: ['*'], // default, only appropriate domain is included in response
  // we can’t use middleware `credentials: true` option with wildcard
  allowHeaders: [
    'x-api-key',
    'x-stelace-version',
    'authorization',
    'user-agent',
    'x-stelace-organization-id'
  ],
  exposeHeaders: [
    'x-stelace-version',
    'x-request-id'
  ]
})

const { getPlugins, loadPlugin } = require('../plugins')

const { getLoggingContext } = require('../src/util/logging')

const polyfills = require('../src/util/polyfills')
polyfills.initErrors()

const Base = require('../src/models/Base')

const { parseKey: parseApiKey } = require('stelace-util-keys')

const database = require('../src/database')
const elasticsearch = require('../src/elasticsearch')
const elasticsearchReindex = require('../src/elasticsearch-reindex')
const elasticsearchSync = require('../src/elasticsearch-sync')
const elasticsearchTemplates = require('../src/elasticsearch-templates')
const models = require('../src/models')

const {
  communication,
  permissions,
  redis,
  roles,
  versions,

  logger,
  utils,
} = require('../index')

const { logTrace, logError } = logger

const { registerPermission } = permissions
const { getPlatformEnvData, setPlatformEnvData } = redis

const {
  apiVersions,
  validator,
  applyRequestChanges,
  applyResponseChanges,

  registerValidationVersions,
  registerRequestChanges,
  registerResponseChanges,
  registerObjectChanges
} = versions

const auth = require('../src/auth')
const {
  loadStrategies,
  checkPermissions,
  allowSystem,
  parseAuthorizationHeader,
  getLocalInstanceKey,
  isSystem,
  defaultSystemKeyHashFunction,
  setSystemKeyHashPassphrase,
  setSystemKeyHashWithFunction,
  getSystemKeyHashFunction
} = auth

const {
  environment: {
    isValidEnvironment,
    getDefaultEnvironment
  }
} = utils

const middlewares = require('../src/middlewares')
const routes = require('../src/routes')
const services = require('../src/services')
const crons = require('../src/crons')

const { name, version } = require('../package.json')

const PROD = process.env.NODE_ENV === 'production'
const TEST = process.env.NODE_ENV === 'test'

/*
SYSTEM_HASH_FUNCTION_PASSPHRASE is a sensitive information
used to get/set system key hash function, protecting system endpoints such as private config.
It’s removed from process.env just after being set in memory,
so that other plugins can’t read it so easily when it has been set by some private plugin.
*/
const systemHashPassphrase = process.env.SYSTEM_HASH_FUNCTION_PASSPHRASE
if (process.env.SYSTEM_HASH_FUNCTION_PASSPHRASE) {
  setSystemKeyHashPassphrase(process.env.SYSTEM_HASH_FUNCTION_PASSPHRASE)
  process.env.SYSTEM_HASH_FUNCTION_PASSPHRASE = '' // safeguard
}
delete process.env.SYSTEM_HASH_FUNCTION_PASSPHRASE

let systemHashFunction

const getIp = (req) => {
  return req.headers['x-forwarded-for'] || req.connection.remoteAddress
}

process.on('uncaughtException', (err) => {
  logError(err, { message: 'Uncaught exception' })
})

const restifyAuthorizationParser = restify.plugins.authorizationParser()
const stelaceTooling = {
  // utility functions often used
  logError,
  createError,
  getCurrentUserId: utils.user.getCurrentUserId,
  handleRemoteNotFoundError: communication.handleRemoteNotFoundError,

  systemHash: {
    setSystemKeyHashWithFunction,
    defaultSystemKeyHashFunction,
  },

  isSystem,

  // core functionalities
  communication,
  database,
  elasticsearch,
  elasticsearchReindex,
  elasticsearchSync,
  elasticsearchTemplates,
  models,

  permissions,
  redis,
  roles,
  versions,

  middlewares: {
    checkPermissions,
    restifyAuthorizationParser
  },

  routes: {
    getRouteRequestContext,
    wrapAction
  },

  // useful to create a new model
  BaseModel: Base,

  utils,

  // Sharing apm singleton to let external plugins use the same transactions,
  // as long as they don’t `require('elastic-apm-node')` on their own.
  apm,
}

function loadServer () {
  const server = restify.createServer({ name, version })

  server.on('after', restify.plugins.metrics({ server }, (err, metrics, req/*, res, route */) => {
    if (err) {
      // do nothing
    }

    const requestContext = getLoggingContext(req)
    const loggingParams = Object.assign({}, requestContext, {
      metrics
    })

    // clean for garbage collection
    req.apmSpans = {}

    logTrace(loggingParams, 'Metrics')
  }))

  // create an object that can be used to store any APM spans
  server.use((req, res, next) => {
    req.apmSpans = {}

    req.apmSpans.restifyPlugins = apm.startSpan('Restify plugins')
    next()
  })

  server.pre(restify.plugins.pre.context())

  server.use(restify.plugins.acceptParser(server.acceptable))
  server.use(restify.plugins.queryParser())
  server.use(restify.plugins.gzipResponse())
  server.use(restify.plugins.bodyParser())

  server.pre(cors.preflight)
  server.use(cors.actual)

  applyIntlPolyfill()

  const allowedErrorFields = [
    'message',
    'code',
    'public',
    'statusCode' // must be present because it is used by Restify to display custom error fields
  ]
  const indexedErrorFields = _.keyBy(allowedErrorFields)

  // Errors can have a property `expose` (which is automatically created by http-errors)
  // if `expose` is true, the error message is displayed as is
  // otherwise the standard HTTP error message is displayed: https://nodejs.org/api/http.html#http_http_status_codes
  // This is to prevent leaking unwanted internal information outside

  // By default, `expose` is false if status code >= 500
  // but this behaviour can be overriden by `createError(500, 'My custom error message', { expose: true })

  // If an error has the property `public`, the server will convert it into `data` and expose it
  // even if `expose` is false.
  function getFormattedError (err, statusCode) {
    const alt = serializeError(err)

    Object.getOwnPropertyNames(alt).forEach(key => {
      if (!indexedErrorFields[key]) {
        delete alt[key]
      }
    })

    // if the error object have a field `public` (data that can be exposed to public)
    // rename it into `data` for API response
    if (err.public) {
      alt.data = err.public
      delete alt.public
    }

    // Show the error stack if the environment isn't PROD
    if (!PROD && err.stack) {
      alt._stack = err.stack.split('\n')
    }

    // Hide the error message if the error isn't exposed
    if (!err.expose) {
      if (!PROD) {
        alt._message = err.message
      }
      alt.message = http.STATUS_CODES[statusCode]
    }

    return alt
  }

  function logRequestError (req, res, err) {
    const requestContext = getLoggingContext(req)
    const metrics = {
      statusCode: res.statusCode,
      method: req.method,
      path: req.path()
    }

    logError(err, {
      custom: {
        metrics, // manually rebuild the metrics object to have the same fields as the real metrics
        requestContext
      },
      enableApmLog: false, // disable APM logs here, as errors are already handled by APM connect middleware
      message: 'Error'
    })
  }

  server.on('restifyError', function (req, res, err, next) {
    const statusCode = err.statusCode || 500
    err.statusCode = statusCode

    res.status(statusCode)

    if (statusCode === 401) {
      // https://tools.ietf.org/html/draft-ietf-httpbis-p7-auth-19#section-4.4
      const realm = 'Stelace API'
      const realmAsUser = `${realm} as a user`
      res.header('www-authenticate',
        // Returning Basic scheme first
        // http://test.greenbytes.de/tech/tc/httpauth/#multibasicunknown
        `Basic realm="${realm}", Bearer realm="${realmAsUser}", Stelace-v1 realm="${realmAsUser}"`
      )
    }

    // Prevents 'undefined' string from showing up in APM route errors
    // https://github.com/elastic/apm-agent-nodejs/blob/v2.17.0/lib/parsers.js#L26
    err.params = err.params || []

    if (typeof err === 'object' && !(err instanceof Error)) {
      logRequestError(req, res, err)

      const newError = getFormattedError(err, statusCode)

      const keys = _.uniq(Object.getOwnPropertyNames(err).concat(Object.keys(newError)))

      // copy newError into err
      keys.forEach(key => {
        if (newError[key]) {
          err[key] = newError[key]
        } else {
          delete err[key]
        }
      })

      res.send(err)
      return next()
    }

    err.toJSON = () => {
      logRequestError(req, res, err)

      // only expose body (used in Restify validation error)
      if (typeof err.body === 'object') {
        return err.body
      }

      return getFormattedError(err, statusCode)
    }

    res.send(err)
    return next()
  })

  try {
    // plugins can use Stelace core dependencies if they provide a function
    const injectStelaceTooling = (pluginObject) => {
      if (typeof pluginObject === 'function') return pluginObject(stelaceTooling)
      else return pluginObject
    }

    // Let external plugins self-load using command line for tests.
    // Please refer to docs/plugins.md.
    const toLoad = (process.env.STELACE_PLUGINS_PATHS || '')
      // Comma-separated list of plugin absolute paths to load before starting server.
      .split(',')
      .filter(Boolean)
      .map(s => s.trim())
    if (Array.isArray(toLoad) && toLoad.length) toLoad.forEach(loadPlugin)

    // Register all plugins
    const plugins = getPlugins()

    plugins.forEach(plugin => {
      if (plugin.routes) {
        const name = plugin.name
        routes.registerRoutes(name, plugin.routes)
      }
      if (plugin.middlewares) {
        middlewares.register(injectStelaceTooling(plugin.middlewares))
      }
      if (plugin.versions) {
        if (plugin.versions.validation) {
          plugin.versions.validation.forEach(v => {
            registerValidationVersions(injectStelaceTooling(v))
          })
        }
        if (plugin.versions.request) {
          plugin.versions.request.forEach(change => {
            registerRequestChanges(injectStelaceTooling(change))
          })
        }
        if (plugin.versions.response) {
          plugin.versions.response.forEach(change => {
            registerResponseChanges(injectStelaceTooling(change))
          })
        }
        if (plugin.versions.object) {
          plugin.versions.object.forEach(change => {
            registerObjectChanges(injectStelaceTooling(change))
          })
        }
      }
      if (plugin.permissions) {
        plugin.permissions.forEach(permission => {
          registerPermission(injectStelaceTooling(permission))
        })
      }
    })
  } catch (err) {
    logError(err, { message: 'Loading plugins error' })
    process.exit(1)
  }

  server.use((req, res, next) => {
    req.apmSpans.restifyPlugin && req.apmSpans.restifyPlugins.end()
    req.apmSpans.restifyPlugins = null

    req.apmSpans.requestInit = apm.startSpan('Request initialization')

    req._requestId = Uuid.v4()
    req._ip = getIp(req)

    // set this header for CORS
    res.header('access-control-allow-credentials', true)

    next()
  })

  // Add any routes here that don't need a platform ID
  server.use((req, res, next) => {
    const isSystemUrl = req.url.startsWith('/system/')
    const isStoreUrl = req.url.startsWith('/store/')
    const isRobotsTxtUrl = req.url === '/robots.txt'
    const isHomeUrl = req.url === '/'
    const isTokenConfirmCheckUrl = req.url.startsWith('/token/check/') && req.url !== '/token/check/request'
    const isSSOUrl = req.url.startsWith('/auth/sso')

    const { spec: { optionalApiKey, manualAuth } } = req.getRoute() || { spec: {} }
    req._optionalApiKeyRoute = Boolean(optionalApiKey) // Authorization header may still be required (e.g. token)
    req._manualAuthRoute = Boolean(manualAuth) // no Authorization info required at all

    req._allowMissingPlatformId = isSystemUrl ||
      isStoreUrl ||
      isRobotsTxtUrl ||
      isHomeUrl ||
      req._optionalApiKeyRoute ||
      req._manualAuthRoute ||
      isTokenConfirmCheckUrl ||
      isSSOUrl

    req.apmSpans.requestInit && req.apmSpans.requestInit.end()
    req.apmSpans.requestInit = null

    next()
  })

  // /////// //
  // WARNING //
  // /////// //

  // Updating the below code must be done with extra care
  // because it allows the API requester to override the default behaviour
  // (getting platform information from public/secret API key)

  // Only few use cases need that override behaviour:
  // - test environment
  // - workflows
  server.use(async (req, res, next) => {
    const apmSpan = apm.startSpan('System headers')

    try {
      const rawSystemKey = req.headers['x-stelace-system-key']
      if (rawSystemKey) {
        if (!systemHashFunction) {
          systemHashFunction = getSystemKeyHashFunction(systemHashPassphrase)
        }

        // store the system hash so any service can determine if the request comes from system
        req._systemHash = systemHashFunction(rawSystemKey)
      }

      const rawWorkflowHeader = req.headers['x-stelace-workflow-key']
      const workflowKey = getLocalInstanceKey()

      // Detect workflow requests, currently executed by same instance only.
      // Unlike HTTP host, req.connection is hard to spoof.
      // https://github.com/expressjs/express/issues/2518
      const isLocal = req.connection.localAddress === req.connection.remoteAddress

      if (rawWorkflowHeader && workflowKey === rawWorkflowHeader && isLocal) {
        // could be turned into an object with additional metadata in the future
        req._workflow = true
      }

      // If the header 'x-platform-id' or 'x-stelace-env' are present and allowed to be used
      // they override the platformId and env usually set by API key.
      // TODO: use API Key in tests to align with 'production' NODE_ENV (cf. test/auth.js getAccessTokenHeaders)
      const usePlatformHeaders = TEST || Boolean(req._workflow) || isSystem(req._systemHash)

      const rawPlatformIdHeader = req.headers['x-platform-id']
      const rawEnvHeader = req.headers['x-stelace-env']

      if (rawPlatformIdHeader && usePlatformHeaders) {
        req.platformId = rawPlatformIdHeader
      }
      if (rawEnvHeader && usePlatformHeaders) {
        req.env = rawEnvHeader
      }

      next()
    } catch (err) {
      next(err)
    } finally {
      apmSpan && apmSpan.end()
    }
  })

  // Get platform information (platformId, env, version, plan…) from API key
  server.use(async (req, res, next) => {
    const apmSpan = apm.startSpan('Parse Authorization and get platform info')

    try {
      parseAuthorizationHeader(req)
    } catch (err) { // still trying to parse authorization header for convenience when not required
      if (!req._manualAuthRoute) {
        apmSpan && apmSpan.end()
        return next(err)
      }
    }

    try {
      const setPlanAndVersion = async ({ errParams } = {}) => {
        try {
          const info = await getPlatformEnvData(req.platformId, req.env, [
            'plan', // can be set by some plugin
            'version'
          ])
          req._plan = info ? info.plan : null
          req._platformVersion = info ? info.version : null
        } catch (err) {
          if (Array.isArray(errParams)) throw createError(...errParams)
          else throw err
        }
      }

      const rawApiKey = req.authorization.apiKey || req.headers['x-api-key']
      // get the platformId from the api key
      if (!req.platformId && rawApiKey) {
        const parsedApiKey = parseApiKey(rawApiKey)
        if (_.get(parsedApiKey, 'hasValidFormat')) {
          req.platformId = parsedApiKey.platformId
          req.env = parsedApiKey.env

          await setPlanAndVersion({
            platformId: req.platformId,
            env: req.env,
            errParams: [401, 'Invalid API Key']
          })
        }
      }

      // Do not load the plan for routes where platformId and env can be omitted:
      // - general routes (e.g. /system/health, /robots.txt)
      // - public routes like SSO
      // - some plugin routes
      const shouldSetPlan = !req._plan && req.platformId && req.env
      if (shouldSetPlan) {
        await setPlanAndVersion({ errParams: [400, 'Invalid platformId or env'] })
      }

      if (!req.env) {
        const defaultEnv = getDefaultEnvironment()
        if (defaultEnv) {
          req.env = defaultEnv
        }
      }

      if ((!req.platformId || !req.env) && !req._allowMissingPlatformId) {
        if (rawApiKey) throw createError(401, 'Invalid API key')
        else throw createError(401, 'Please provide a secret or publishable API key')
      }

      if (req.env && !isValidEnvironment(req.env)) {
        throw createError(400, `Environment "${req.env}" not supported'`)
      }

      next()
    } catch (err) {
      next(err)
    } finally {
      apmSpan && apmSpan.end()
    }
  })

  server.use(async (req, res, next) => {
    const apmSpan = apm.startSpan('Stelace version')
    const { platformId, env } = req

    try {
      const selectedVersion = req.headers['x-stelace-version']

      if (selectedVersion && !apiVersions.includes(selectedVersion)) {
        throw createError(400, `Invalid Stelace version '${selectedVersion}'`, {
          public: { versionsAvailable: apiVersions }
        })
      }

      req._apiVersions = apiVersions
      req._latestVersion = apiVersions[0]
      req._selectedVersion = selectedVersion || req._platformVersion || req._latestVersion

      // Update the platform default API version if not set yet
      if (!req._platformVersion && platformId && env) {
        await setPlatformEnvData(platformId, env, 'version', req._latestVersion)
      }

      next()
    } catch (err) {
      next(err)
    } finally {
      apmSpan && apmSpan.end()
    }
  })

  loadStrategies(server)

  server.use((req, res, next) => {
    addRequestContext(apm, req)

    next()
  })

  server.use(validator())

  // ensure request compatibility
  server.use(async (req, res, next) => {
    try {
      const fromVersion = req._selectedVersion
      const toVersion = req._latestVersion
      const target = req.route.spec.name

      await applyRequestChanges({ target, fromVersion, toVersion, params: { req } })

      next()
    } catch (err) {
      next(err)
    }
  })

  // Dismiss polite bots
  server.get('/robots.txt', function (req, res, next) {
    res.set({
      'Content-Type': 'text/plain'
    })
    res.send('User-Agent: *\nDisallow: /')
    next() // need to call next to have metrics correctly populated
  })

  server.get('/', (req, res, next) => {
    res.json({
      message: 'Welcome to Stelace API. Please have a look at https://stelace.com/docs to see what we can build together.'
    })
    next()
  })

  middlewares.beforeRoutes(server, stelaceTooling)

  routes.init(server, {
    middlewares: {
      allowSystem,
      checkPermissions,
      restifyAuthorizationParser,
      ...middlewares.getAll() // shared between all plugins and core server
    },
    helpers: {
      wrapAction,
      populateRequesterParams,
      getRequestContext: getRouteRequestContext
    }
  })

  // must be the last middleware before error middleware
  if (isApmActive) {
    server.use(apm.middleware.connect())
  }

  return server
}

function getAuthorizationParams (req) {
  return {
    _userId: req.auth && (req.auth.sub || req.auth.userId),
    _targetUserId: req.targetUserId,
    _organizationId: req.organizationId,
    _realOrganizationId: req.realOrganizationId,
    _apiKeyId: req.apiKey && req.apiKey.id,
    _matchedPermissions: req.matchedPermissions,
    _missingPlanPermissions: req.missingPlanPermissions,
    _roles: req.roles,
    _readNamespaces: req.readNamespaces,
    _editNamespaces: req.editNamespaces,
    _stelaceAuthToken: !!req._stelaceAuthToken,
    _ip: req._ip,
    _userAgent: req.headers['user-agent'],
    _requestId: req._requestId,
    platformId: req.platformId,
    env: req.env,
    _systemHash: req._systemHash,
    _plan: req._plan, // can be set by some plugin
    _selectedVersion: req._selectedVersion,
    _workflow: req._workflow,
    _useOffsetPagination: req._useOffsetPagination,
  }
}

function getRouteRequestContext (req) {
  return Object.assign({}, getAuthorizationParams(req))
}

function populateRequesterParams (req) {
  return function (params) {
    const routeContext = getRouteRequestContext(req)
    return Object.assign(routeContext, params)
  }
}

function wrapAction (fn, { routeAction = true } = {}) {
  return async (req, res, next) => {
    try {
      const apmSpan = apm.startSpan('Route action')

      const result = await fn(req, res)

      apmSpan && apmSpan.end()

      // Custom actions if the response object has properties `_redirectUrl` or `_rawResponse`
      // A JSON object is expected to be returned from services
      // because of Côte.js requester/responder network calls
      // In service, there is no `res.redirect()` for redirection for instance.

      // handles redirection with API
      if (_.isObjectLike(result) && result._redirectUrl) {
        res.redirect(301, result._redirectUrl, next)
        return
      }
      // can provide a response configuration from services
      // to return non-json response
      if (_.isObjectLike(result) && _.isObjectLike(result._rawResponse)) {
        const raw = result._rawResponse
        res.send(
          raw.statusCode || 200,
          raw.content,
          raw.headers || {}
        )
        next()
        return
      }

      // No cache by default.
      // Routes can opt-out individually and cache results using cache middleware
      if (!res.header('cache-control')) res.header('cache-control', 'no-store')

      // ensure response compatibility
      if (routeAction) {
        const fromVersion = req._latestVersion
        const toVersion = req._selectedVersion
        const target = req.route.spec.name

        const transformed = await applyResponseChanges({ target, fromVersion, toVersion, params: { req, result } })
        const { result: newResult } = transformed

        res.header('x-stelace-version', toVersion)
        res.header('x-request-id', req._requestId)

        res.json(newResult)
      }

      next()
    } catch (err) {
      if (typeof err === 'object') {
        // Restify requires an error to have a name
        err.name = err.name || 'Internal Server Error'
        next(err)
      } else {
        const newError = new Error('Error is not an object')
        newError.origError = err

        next(newError)
      }
    }
  }
}

let configRequester
let stl // keeping track of server (last one if several were started)

/**
 * @param {Boolean} [enableSignal = true] - has an impact on performance and can be disabled
 * @param {Boolean} [useFreePort = false] - if true, will find a free port by itself
 * @param {String}  [communicationEnv] - sets an environment for communication between services (useful for testing)
 */
function start ({
  useFreePort,
  enableSignal = true,
  communicationEnv
} = {}) {
  return new Promise((resolve, reject) => {
    const server = loadServer()
    stl = server

    if (communicationEnv) {
      communication.setEnvironment(communicationEnv)
    }

    let app
    let stelaceIO

    if (useFreePort) {
      app = server.listen(onStarted)
    } else {
      app = server.listen(process.env.SERVER_PORT || 4100, onStarted)
    }

    function onStarted (err) {
      if (err) return reject(err)

      if (enableSignal) {
        stelaceIO = socketIO.listen(app, { path: '/signal' })
        server.stelaceIO = stelaceIO
      }

      const serverPort = server.address().port

      communication.setServerPort(serverPort)

      const startParams = Object.assign({}, stelaceTooling, {
        serverPort,
        stelaceIO
      })

      auth.start(startParams)
      services.start(startParams)
      middlewares.start(startParams)
      routes.start(startParams)
      crons.start(startParams)

      configRequester = communication.getRequester({
        name: 'Config requester',
        key: 'config'
      })

      // add testing function to server so tests can manipulate time
      if (TEST) {
        const sinon = require('sinon')

        server._startCrons = () => crons.start(startParams)
        server._stopCrons = () => crons.stop()

        server._initClock = (config) => {
          server._clock = sinon.useFakeTimers(config)
        }
      }

      debug('%s listening at %s', server.name, server.url)

      resolve(server)
    }
  })
}

/**
 * @param {Object} [server] - Server to stop, defaults to server started last
 * @param {Number} [gracefulStopDuration] - in milliseconds
 */
function stop ({
  server: serverToStop = stl,
  gracefulStopDuration = 1000
} = {}) {
  return new Promise((resolve) => {
    ;(serverToStop.stelaceIO || serverToStop).close(() => {
      auth.stop()
      services.stop()
      routes.stop()
      middlewares.stop()
      crons.stop()

      configRequester.close()
      configRequester = null

      // delay a little moment for sockets to have time to properly close
      setTimeout(resolve, gracefulStopDuration)
    })
  })
}

module.exports = {
  start,
  stop
}
