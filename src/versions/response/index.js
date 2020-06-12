const _ = require('lodash')
const VersionTransformer = require('../transformer')
const { transformConfigsIntoChanges } = require('../util')

const listResponseChangeConfigs = [
  require('./webhook'),
  require('./workflow'),
]

const changes = transformConfigsIntoChanges(listResponseChangeConfigs)

const responseTransformer = new VersionTransformer('Response', 'down', { changes })

async function applyResponseChanges ({ target, fromVersion, toVersion, params }) {
  if (_.isNil(params.result)) return params

  const newParams = await responseTransformer.applyChanges({ target, fromVersion, toVersion, params })
  return newParams
}

function registerResponseChanges (configChanges) {
  responseTransformer.addChanges(
    transformConfigsIntoChanges(configChanges)
  )
}

module.exports = {
  applyResponseChanges,
  registerResponseChanges
}
