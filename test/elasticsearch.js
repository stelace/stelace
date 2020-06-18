const { isIndexExisting, createIndex, getClient, getIndex, isReady } = require('../src/elasticsearch')

const { getModels } = require('../src/models')

async function init ({ platformId, env }) {
  const exists = await isIndexExisting({ platformId, env })

  if (!exists) {
    const { CustomAttribute } = await getModels({ platformId, env })

    const customAttributes = await CustomAttribute.query()

    await createIndex({ platformId, env, useAlias: true, customAttributes })
  }
}

async function reset ({ platformId, env }) {
  const client = await getClient({ platformId, env })

  const indexPattern = getIndex({ platformId, env }) + '*'

  const result = await client.indices.getAlias({
    index: indexPattern
  })

  Object.keys(result).forEach(async (index) => {
    await client.indices.delete({
      index
    }).catch(() => null)
  })
}

module.exports = {
  init,
  reset,
  isReady,
}
