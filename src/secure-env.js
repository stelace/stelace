const awsParamStore = require('aws-param-store')

function getParams (service, { region } = {}) {
  const servicePath = '/' + service

  const results = awsParamStore.getParametersByPathSync(servicePath, { region })

  return results.reduce((memo, obj) => {
    const {
      Name: name,
      Value: value
    } = obj

    const key = getKey(name)
    if (key) {
      memo[key] = value
    }

    return memo
  }, {})
}

function getKey (name) {
  const parts = name.split('/')
  if (!parts.length) return

  return parts[parts.length - 1].toUpperCase()
}

function setEnv (...args) {
  const params = getParams(...args)

  Object.keys(params).forEach(key => {
    process.env[key] = params[key]
  })
}

function config () {
  if (process.env.SECURE_ENV !== 'true') return

  const service = process.env.SECURE_ENV_SERVICE
  const region = process.env.AWS_REGION

  if (!service) {
    throw new Error('Missing SECURE_ENV_SERVICE')
  }
  if (!region) {
    throw new Error('Missing AWS_REGION')
  }

  const services = service.split(',')

  services.forEach(service => {
    setEnv(service, { region })
  })
}

module.exports = {
  getParams,
  setEnv,
  config
}
