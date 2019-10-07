const log = require('roarr').default
const { serializeError } = require('serialize-error')
const apm = require('elastic-apm-node')
const _ = require('lodash')

const params = {
  application: 'stelace-core'
}

if (process.env.INSTANCE_ID) {
  params.instanceId = process.env.INSTANCE_ID
}

const RoarrLogger = log.child(params)

// const PROD = process.env.NODE_ENV === 'production'

/**
 * This function is only used to log metrics in server.js
 * The arguments map to Roarr trace function arguments
 * https://github.com/gajus/roarr#roarr-api-trace
 *
 * Usually:
 * @param {Object} context
 * @param {String} message
 *
 * This function won't log into APM server (unlike logError)
 * because APM request transactions are more precise than manually metrics build
 */
function logTrace (...args) {
  RoarrLogger.trace(...args)
}

/**
 * Log error to help debugging
 * In non-prod environment, it logs via Roarr and APM.
 * In prod environment, only to APM server.
 * We keep using Roarr to debug easily without starting an APM server during development
 *
 * Options’ user, custom and labels are special metadata for APM monitoring
 * User and labels context are indexed data so they are searchable in APM.
 * https://www.elastic.co/guide/en/apm/get-started/current/metadata.html
 *
 * WARNING: Quote from the above documentation link
 * Avoid defining too many user-specified labels. Defining too many unique fields in an index is a condition
 * that can lead to a mapping explosion.
 *
 * @param {Error}   error
 * @param {Object}  options
 * @param {Object}  [options.message] - error logger message,
 *   it's more a context error message (e.g. 'Fail to create event asset__created')
 *   rather than a precise technical error (e.g. a native database error message)
 *   If not provided, it fallbacks to `error.message`
 * @param {Object}  [options.user] - indexed data (only allowed fields: `user.id`, `user.email`, `user.name`)
 * @param {Object}  [options.custom] - non-indexed data
 * @param {Object}  [options.labels] - indexed data
 * @param {String}  [options.platformId] - pass it to automatically fill APM contexts
 * @param {String}  [options.env] - pass it to automatically fill APM contexts
 * @param {Boolean} [options.enableApmLog = true] - can be useful to disable APM logs
 * @param {Boolean} [options.enableRoarr = true] - can be useful to disable Roarr logger
 */
function logError (error, {
  user,
  custom,
  labels,
  message,
  platformId,
  env,
  enableApmLog = true,
  enableRoarr = true
} = {}) {
  let defaultUser
  let defaultCustom
  let defaultLabels

  if (platformId) {
    defaultLabels = defaultLabels || {}
    defaultLabels.platformId = platformId // add it to label for convenience (next to env)

    defaultUser = defaultUser || {}
    defaultUser.id = platformId
  }
  if (env) {
    defaultLabels = defaultLabels || {}
    defaultLabels.env = env
  }

  const newUser = defaultUser || user ? Object.assign({}, defaultUser, user) : undefined
  const newCustom = defaultCustom || custom ? Object.assign({}, defaultCustom, custom) : undefined
  const newLabels = defaultLabels || labels ? Object.assign({}, defaultLabels, labels) : undefined

  // TODO: remove the comment only once we align APM error logs with Logstash's
  if (/* !PROD && */ enableRoarr) {
    RoarrLogger.error({
      err: serializeError(error),
      user: newUser,
      custom: newCustom,
      labels: newLabels
    }, message || error.message) // message required for Roarr
  }

  if (enableApmLog) {
    // If additional properties are stored into Error object, like in InternalAvailability model:
    // `throw createError(`Unfound asset type (ID ${asset.assetTypeId})`, { assetTypeId: asset.assetTypeId })`
    // Without errorData, we lose `assetTypeId` information, because `apm.captureError()` won't store it
    let errorData
    if (error instanceof Error) {
      const omittedErrorFields = [
        'message',
        'stack',
        'statusCode',
        'expose'
      ]
      errorData = _.pick(error, _.difference(Object.keys(error), omittedErrorFields))
    }

    // passed context overrides default context properties
    apm.captureError(error, {
      user: removeUndefinedValues(newUser),
      custom: removeUndefinedValues(Object.assign({ errorData }, newCustom)),
      labels: removeUndefinedValues(newLabels),
      message
    })
  }
}

function removeUndefinedValues (json) {
  return _.pickBy(json, value => !_.isUndefined(value))
}

module.exports = {
  logTrace,
  logError
}
