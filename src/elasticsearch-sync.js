const bluebird = require('bluebird')
const _ = require('lodash')

const { logError } = require('../logger')

const {
  getIndex,
  getClient
} = require('./elasticsearch')

const {
  getPendingReindexingTask
} = require('./elasticsearch-reindex')

let assetActionsQueue = []
let assetsSync = false

const syncQueueDurationMs = 300
const maxItemsInBulk = 500 // do not use 1000 items as during reindexing, items can be duplicated

function syncAssetsWithElasticsearch ({ assetId, asset, action, platformId, env }) {
  assetActionsQueue.push({ assetId, asset, action, platformId, env })

  setTimeout(() => _syncAssets(), syncQueueDurationMs)
}

async function _syncAssets () {
  if (assetsSync) return

  if (!assetActionsQueue.length) {
    assetsSync = false
    return
  }

  assetsSync = true

  try {
    const chunks = assetActionsQueue.splice(0, maxItemsInBulk)

    const chunksByPlatform = _.groupBy(chunks, 'platformId')

    const platformsIds = Object.keys(chunksByPlatform)

    await bluebird.map(platformsIds, async (platformId) => {
      try {
        // check the string 'undefined' created by the above function _.groupBy()
        if (platformId === 'undefined') {
          platformId = undefined
        }

        const chunks = chunksByPlatform[platformId]

        // separate the platform chunks by environment
        const chunksByEnv = _.groupBy(chunks, 'env')
        const environments = Object.keys(chunksByEnv)

        for (let env of environments) {
          const reindexingTask = await getPendingReindexingTask({ platformId, env })
          const body = getUpdateBulkBody(platformId, env, chunksByEnv[env], reindexingTask)

          await bulkUpdate(platformId, env, body)
            .catch(err => {
              logError(err, { platformId, env, message: 'Fail to bulk update assets into elasticsearch' })
            })
        }
      } catch (err) {
        logError(err, { platformId, message: 'Fail to bulk update assets into elasticsearch' })
      }
    }, { concurrency: 100 })
  } catch (err) {
    logError(err, { message: 'Fail to synchronize assets with elasticsearch' })
  } finally {
    assetsSync = false
  }

  if (assetActionsQueue.length) {
    setTimeout(() => _syncAssets(), syncQueueDurationMs)
  }
}

async function bulkUpdate (platformId, env, body) {
  const client = await getClient({ platformId, env })
  await client.bulk({ body })
}

function getUpdateBulkBody (platformId, env, chunks, reindexingTask) {
  const body = []

  const index = getIndex({ platformId, env })
  const newIndex = getIndex({ platformId, env, tag: 'new' })

  chunks.forEach(chunk => {
    if (!chunk || !chunk.action || !chunk.assetId) return

    const { assetId, asset, action } = chunk

    if (action === 'delete') {
      body.push({ delete: { _index: index, _id: assetId } })

      // if reindexing, copy to the new index too
      if (reindexingTask) {
        body.push({ delete: { _index: newIndex, _id: assetId } })
      }
    } else {
      if (!asset) return

      const { doc, reindexingDoc } = transformAssetIntoDoc(asset, reindexingTask)

      body.push({ update: { _index: index, _id: assetId } })
      body.push({ doc, doc_as_upsert: true })

      // if reindexing, copy to the new index too
      if (reindexingTask) {
        body.push({ update: { _index: newIndex, _id: assetId } })
        body.push({ doc: reindexingDoc, doc_as_upsert: true })
      }
    }
  })

  return body
}

function transformAssetIntoDoc (asset, reindexingTask) {
  const fields = [
    'createdDate',
    'name',
    'ownerId',
    'description',
    'categoryId',
    'validated',
    'active',
    'assetTypeId',
    'quantity',
    'price',
    'currency',
    'customAttributes',
    'metadata',
    'platformData'
  ]

  const doc = _.pick(asset, fields)

  doc.rawLocations = asset.locations
  doc.locations = (asset.locations || []).map(location => {
    return {
      lat: location.latitude,
      lon: location.longitude
    }
  })

  if (!reindexingTask) {
    return {
      doc,
      reindexingDoc: doc
    }
  } else {
    const reindexingDoc = _.cloneDeep(doc)

    // cannot index the new custom attribute with the old index (type conflict)
    // doc can be a partial document so no custom attributes object (asset update)
    if (reindexingTask.newCustomAttributeName && _.isPlainObject(doc.customAttributes)) {
      delete doc.customAttributes[reindexingTask.newCustomAttributeName]
    }

    return {
      doc,
      reindexingDoc
    }
  }
}

module.exports = {
  syncAssetsWithElasticsearch
}
