const nodemailer = require('nodemailer')
const _ = require('lodash')
const createError = require('http-errors')

const cachedTransporter = {}

function isSameEmailConfig (configA, configB) {
  return _.isEqual(configA.transport, configB.transport) &&
    _.isEqual(configA.defaults, configB.defaults)
}

async function getTransporter ({ platformId, env, emailConfig }) {
  const transport = getTransport(emailConfig)
  if (!transport) throw createError(422, 'Missing email config')

  const defaults = getDefaults(emailConfig)
  const key = _getPlatformKey({ platformId, env })

  const needReplaceTransport = cachedTransporter[key] &&
    isSameEmailConfig(cachedTransporter[key], { transport, defaults })

  if (!needReplaceTransport) {
    const transporter = nodemailer.createTransport(transport, defaults)
    cachedTransporter[key] = {
      transport,
      defaults,
      transporter
    }
  }

  return cachedTransporter[key].transporter
}

function getTransport (emailConfig) {
  if (!emailConfig.host) return null

  return _.pick(emailConfig, [
    'host',
    'port',
    'secure',
    'ignoreTLS',
    'requireTLS',
    'auth'
  ])
}

function getDefaults (emailConfig) {
  return _.pick(emailConfig.defaults, [
    'from',
    'cc',
    'bcc',
    'replyTo'
  ])
}

function _getPlatformKey ({ platformId, env }) {
  return `${platformId}_${env}`
}

module.exports = {
  getTransporter,
  isSameEmailConfig,

  getTransport,
  getDefaults
}
