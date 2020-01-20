const apm = require('elastic-apm-node')
const _ = require('lodash')

const { getCurrentUserId } = require('../src/util/user')
const { isSystem } = require('../src/auth')

const serverUrl = process.env.ELASTIC_APM_SERVER_URL
const secretToken = process.env.ELASTIC_APM_SECRET_TOKEN
const isDisabled = process.env.ELASTIC_APM_DISABLED // generally, we don't want APM to send metrics during tests

const isActive = !isDisabled && !!serverUrl

// for debugging, reveal some characters in sensitive information
const defaultNbRevealedChars = 4
const apiKeyRegex = /^((?:.+)_(?:test|live)_)(.+)$/i

// https://www.elastic.co/guide/en/apm/agent/nodejs/current/agent-api.html#apm-add-filter
apm.addFilter(payload => {
  // remove sensitive header values by replacing the value by '[REDACTED]'
  const requestHeaders = _.get(payload, 'context.request.headers')

  if (requestHeaders) {
    if (requestHeaders['x-api-key']) {
      requestHeaders['x-api-key'] = obfuscateSensitiveInfo(requestHeaders['x-api-key'], { prefixRegex: apiKeyRegex })
    }
    if (requestHeaders['x-stelace-system-key']) {
      requestHeaders['x-stelace-system-key'] = obfuscateSensitiveInfo(requestHeaders['x-stelace-system-key'])
    }
    if (requestHeaders['x-stelace-workflow-key']) {
      requestHeaders['x-stelace-workflow-key'] = obfuscateSensitiveInfo(requestHeaders['x-stelace-workflow-key'])
    }
  }

  const userContext = _.get(payload, 'context.user')
  if (userContext && userContext.username && apiKeyRegex.test(userContext.username)) {
    // APM client automatically uses Authorization `username:password`
    // and sends it via user context to APM server
    delete userContext.username
  }

  return payload
})

function obfuscateSensitiveInfo (value, { nbRevealedChars = defaultNbRevealedChars, prefixRegex } = {}) {
  const ellipsisChar = '…'
  let obfuscatedValue

  if (prefixRegex) {
    const match = value.match(prefixRegex)
    if (match && match.length === 3) {
      const prefix = match[1]
      const valueToObfuscate = match[2]
      obfuscatedValue = prefix + valueToObfuscate.slice(0, nbRevealedChars)
    } else {
      obfuscatedValue = value.slice(0, nbRevealedChars)
    }
  } else {
    obfuscatedValue = value.slice(0, nbRevealedChars)
  }

  return obfuscatedValue + ellipsisChar
}

function start () {
  if (!isActive) return

  // For advanced configuration: https://www.elastic.co/guide/en/apm/agent/nodejs/current/configuration.html
  apm.start({
    serverUrl,
    secretToken,

    // https://www.elastic.co/guide/en/apm/agent/nodejs/current/configuration.html#log-level
    logLevel: 'fatal' // set to 'fatal' so APM agent won't be too chatty in stdout
  })
}

function removeUndefinedValues (json) {
  return _.pickBy(json, value => !_.isUndefined(value))
}

function getUserContextFromRequest (req) {
  return removeUndefinedValues({
    id: req.platformId
  })
}

function getCustomContextFromRequest (req) {
  return removeUndefinedValues({
    selectedVersion: req._selectedVersion,
    platformVersion: req._platformVersion,
    latestVersion: req._latestVersion
  })
}

function getLabelsFromRequest (req) {
  return removeUndefinedValues({
    platformId: req.platformId,
    env: req.env,
    organizationId: req._organizationId,
    userId: getCurrentUserId(req),
    isSystem: isSystem(req._systemHash),
    requestId: req._requestId,
    instanceId: process.env.INSTANCE_ID
  })
}

function addRequestContext (apmAgent, req) {
  apmAgent.setUserContext(getUserContextFromRequest(req))
  apmAgent.setCustomContext(getCustomContextFromRequest(req))
  apmAgent.addLabels(getLabelsFromRequest(req))
}

module.exports = {
  start,
  isActive,

  addRequestContext,
  getUserContextFromRequest,
  getCustomContextFromRequest,
  getLabelsFromRequest
}
