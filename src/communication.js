const Cote = require('cote')
const apm = require('elastic-apm-node')
const Uuid = require('uuid')
const _ = require('lodash')
const request = require('superagent')
const createError = require('http-errors')

const CustomRequester = require('./cote/CustomRequester')
const CustomResponder = require('./cote/CustomResponder')

const COMMUNICATION_ID = Uuid.v4()
let serverPort = process.env.SERVER_PORT || 4100

let environment = process.env.COTE_ENV

const coteEnvInstances = {}

Cote.CustomRequester = CustomRequester
Cote.CustomResponder = CustomResponder

function getRequester (params) {
  const cloneParams = _.cloneDeep(params)
  const env = cloneParams.env || environment

  const cote = _getCote(env)

  delete cloneParams.env

  return new cote.CustomRequester(cloneParams)
}

function getResponder (params) {
  const cloneParams = _.cloneDeep(params)
  const env = cloneParams.env || environment

  const cote = _getCote(env)

  delete cloneParams.env

  return new cote.CustomResponder(cloneParams)
}

function getPublisher (params) {
  const cloneParams = _.cloneDeep(params)
  const env = cloneParams.env || environment

  const cote = _getCote(env)

  delete cloneParams.env

  return new cote.Publisher(cloneParams)
}

function getSubscriber (params) {
  const cloneParams = _.cloneDeep(params)
  const env = cloneParams.env || environment

  const cote = _getCote(env)

  delete cloneParams.env

  return new cote.Subscriber(cloneParams)
}

function getSockend (io, params) {
  const cloneParams = _.cloneDeep(params)
  const env = cloneParams.env || environment

  const cote = _getCote(env)

  delete cloneParams.env

  return new cote.Sockend(io, cloneParams)
}

function setEnvironment (env) {
  environment = env
}

function _getCote (env) {
  let cote = coteEnvInstances[env]
  if (!cote) {
    const enableLogging = process.env.COTE_LOGGING === 'true'

    cote = Cote({
      environment: env,
      log: enableLogging
    })

    coteEnvInstances[env] = cote
  }

  return cote
}

function handleRemoteNotFoundError (err) {
  if (err && err.statusCode === 404) {
    return null
  } else {
    throw err
  }
}

// will be used to generate the API base URL in testing (dynamic port)
// in Stelace API internal request
function setServerPort (port) {
  serverPort = port
}

/**
 * Helper function to send Stelace API request to any service endpoint.
 * @param {String} endpointUri - (e.g. '/users')
 * @param {Object} params
 * @param {String} params.platformId
 * @param {String} params.env
 * @param {String} [params.method]
 * @param {Object} [params.payload] - converted to query string when using GET method
 * @param {Object} [params.headers] - customize the headers
 * @param {Boolean} [params.asyncIterator] - Returns an async iterator to use in `for await` loop.
 *   Can only be used with list endpoints. Cannot be used simultaneously with `leafThroughResults`.
 * @param {Number} [params.leafThroughResults] - using iterator internally to leaf trough all pages.
 *   Can only be used with list endpoints. Returns last read page object with merged `results` array.
 *   Iterator stops when reaching this number of results, that cannot exceed 10000.
 */
async function stelaceApiRequest (endpointUri, {
  platformId,
  env,
  method = 'GET', // superagent default
  payload,
  headers,

  asyncIterator,
  leafThroughResults,
}) {
  let apmSpan
  let pageApmSpan
  if (apm.currentTransaction) apmSpan = apm.startSpan('Internal HTTP API request')

  const apiBaseUrl = getApiBaseUrl({ serverPort })

  const defaultHeaders = {
    'x-platform-id': platformId,
    'x-stelace-env': env,
    'x-stelace-system-key': process.env.SYSTEM_KEY
  }

  const headersToSend = Object.assign({}, defaultHeaders, headers || {})

  const endpointUrl = `${apiBaseUrl}${endpointUri}`
  const stelaceRequest = (params) => request[method.toLowerCase()](endpointUrl, params)
    .set(headersToSend)
    .catch(propagateStelaceApiError)

  if (leafThroughResults) {
    const MAX_ARRAY_SIZE = 10000
    if (!_.isFinite(leafThroughResults) || leafThroughResults > MAX_ARRAY_SIZE) {
      throw createError(`Can’t automatically leaf through pages beyond ${
        MAX_ARRAY_SIZE
      }. Please use asyncIterator, or pass a number below ${MAX_ARRAY_SIZE}.`)
    }
    const results = []
    const nbResultsPerPage = 100 // maximum value
    let lastPage
    const params = Object.assign(payload || {}, { nbResultsPerPage })

    for await (const res of iterator(params)) {
      results.push(..._.take(res.results, leafThroughResults - results.length))
      lastPage = res
      if (results.length >= leafThroughResults) break
    }
    if (apmSpan) apmSpan.end()
    return Object.assign(lastPage, { results })
  } else if (asyncIterator) {
    return iterator
  }

  const { body: result } = await stelaceRequest(payload)
  if (apmSpan) apmSpan.end()
  return result

  function iterator (params = {}) {
    const state = {
      page: _.isFinite(params.page) ? params.page - 1 : 0
    }

    return {
      [Symbol.asyncIterator]: () => ({
        next () {
          if (state.done) {
            if (apmSpan) apmSpan.end()
            return Promise.resolve({ done: true })
          }
          state.page++

          if (apmSpan && state.page > 1) {
            pageApmSpan = apm.startSpan('Paging through Internal HTTP API')
          }

          return stelaceRequest(Object.assign({}, params, { page: state.page }))
            .then(({ body: response }) => {
              if (!hasNextPage(response)) state.done = true
              return { value: response }
            })
            .finally(() => {
              if (pageApmSpan) pageApmSpan.end()
            })
        }
      })
    }
  }

  function hasNextPage (response) {
    const { page, nbPages } = response
    return page && nbPages && page < nbPages
  }
}

function getApiBaseUrl ({ serverPort }) {
  const isTestEnv = process.env.NODE_ENV === 'test'
  const apiUrl = process.env.STELACE_API_URL
  let apiBase

  // in test environment, all batch steps are sent to the same server than the one receiving the batch request
  // that's because in parallel testing, hosts are dynamic
  if (isTestEnv || !apiUrl) {
    apiBase = `http://localhost:${serverPort}`
  } else {
    apiBase = apiUrl
  }

  return apiBase
}

// this function handles error from Stelace API to propagate
// the correct data and error status
// Without it, errors will be considered to be status 500
function propagateStelaceApiError (err) {
  if (err.response) {
    const status = err.response.status
    const sourceError = err.response.body

    throw createError(status, sourceError.message, {
      code: sourceError.code,
      public: sourceError.data,
      _sourceStack: sourceError._stack
    })
  } else {
    throw err
  }
}

module.exports = {
  getRequester,
  getResponder,
  getPublisher,
  getSubscriber,
  getSockend,

  setEnvironment,
  COMMUNICATION_ID,

  handleRemoteNotFoundError,
  setServerPort,
  stelaceApiRequest,
  getApiBaseUrl,
  propagateStelaceApiError
}
