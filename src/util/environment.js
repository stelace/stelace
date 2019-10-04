const _ = require('lodash')

let environments

function getDefaultEnvironment () {
  loadEnvironments()

  if (environments.length !== 1) return null
  return environments[0]
}

function isValidEnvironment (env) {
  loadEnvironments()
  return environments.includes(env)
}

function getEnvironments () {
  loadEnvironments()
  return environments
}

/**
 * Parse INSTANCE_ENV from .env file and convert it into array of environments
 * (environments can be comma separated)
 * e.g. INSTANCE_ENV=test,live => environments = ['test', 'live']
 *      INSTANCE_ENV=staging => environments = ['staging']
 */
function loadEnvironments () {
  if (environments) return

  if (!process.env.INSTANCE_ENV || typeof process.env.INSTANCE_ENV !== 'string') {
    environments = []
  } else {
    environments = _.uniq(_.compact(process.env.INSTANCE_ENV.split(',')))
  }
}

module.exports = {
  getDefaultEnvironment,
  isValidEnvironment,
  getEnvironments
}
