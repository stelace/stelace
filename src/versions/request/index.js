const VersionTransformer = require('../transformer')
const { apiVersions, transformConfigsIntoChanges } = require('../util')

const listRequestChangeConfigs = [
  require('./beforeAll'),

  require('./workflow'),
]

const changes = transformConfigsIntoChanges(listRequestChangeConfigs)

const requestTransformer = new VersionTransformer('Request', 'up', {
  apiVersions,
  changes
})

async function applyRequestChanges ({ target, fromVersion, toVersion, params }) {
  const newParams = await requestTransformer.applyChanges({ target, fromVersion, toVersion, params })
  return newParams
}

function registerRequestChanges (configChanges) {
  requestTransformer.addChanges(
    transformConfigsIntoChanges(configChanges)
  )
}

module.exports = {
  applyRequestChanges,
  registerRequestChanges
}
