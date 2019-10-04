const _ = require('lodash')
const VersionTransformer = require('../transformer')
const { transformConfigsIntoChanges } = require('../util')

const listObjectChangeConfigs = [

]

const changes = transformConfigsIntoChanges(listObjectChangeConfigs)

const objectTransformer = new VersionTransformer('Object', 'down', { changes })

async function applyObjectSingleChange ({ target, version, params }) {
  if (_.isNil(params.result)) return params

  const newParams = await objectTransformer.applySingleChange({ target, version, params })
  return newParams
}

async function applyObjectChanges ({ target, fromVersion, toVersion, params }) {
  if (_.isNil(params.result)) return params

  const newParams = await objectTransformer.applyChanges({ target, fromVersion, toVersion, params })
  return newParams
}

function registerObjectChanges (configChanges) {
  objectTransformer.addChanges(
    transformConfigsIntoChanges(configChanges)
  )
}

module.exports = {
  applyObjectSingleChange,
  applyObjectChanges,
  registerObjectChanges
}
