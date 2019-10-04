// https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-reindex.html
// https://www.elastic.co/guide/en/elasticsearch/reference/current/reindex-upgrade-inplace.html
// https://dzone.com/articles/elasticsearch-fault-tolerance-reindexing-need-and-1

const _ = require('lodash')
const { getRedisClient } = require('./redis')

const {
  getIndex,
  createIndex,
  getClient,
  getCurrentIndex,
  getMapping
} = require('./elasticsearch')

const isTestEnv = process.env.NODE_ENV === 'test'

const {
  autoExpandReplicas,
  getCustomAttributesMapping
} = require('./elasticsearch-templates')

async function shouldReindex ({ platformId, env, newCustomAttributeName, newCustomAttributeType }) {
  const customAttributesMapping = getCustomAttributesMapping([{
    name: newCustomAttributeName,
    type: newCustomAttributeType
  }])

  // get the type that will be used in Elasticsearch
  const esType = customAttributesMapping.properties[newCustomAttributeName].type

  const currentMapping = await getMapping({ platformId, env })

  const existingCustomAttribute = currentMapping.properties.customAttributes.properties &&
    currentMapping.properties.customAttributes.properties[newCustomAttributeName]

  // compare if the existing ES type and the new ES type is the same (no conflict)
  return !!(existingCustomAttribute && existingCustomAttribute.type !== esType)
}

async function checkReindexing ({ COMMUNICATION_ID }) {
  const tasks = await getPendingReindexingTasks()
  if (!tasks) return

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]

    const {
      platformId,
      env,
      taskId,
      fromIndex,
      toIndex,
      COMMUNICATION_ID: taskCommunicationId
    } = task

    // only takes care of reindexing tasks initiated by this instance of server
    if (isTestEnv && taskCommunicationId !== COMMUNICATION_ID) return

    const client = await getClient({ platformId, env })

    const result = await client.tasks.get({ taskId })
    if (result && result.completed) {
      await _endReindexingProcess({
        platformId,
        env,
        fromIndex,
        toIndex
      })
    }
  }
}

async function startReindexingProcess ({ platformId, env, customAttributes, newCustomAttributeName, COMMUNICATION_ID }) {
  const client = await getClient({ platformId, env })

  const fromIndex = await getCurrentIndex({ platformId, env })

  const toIndex = await createIndex({
    platformId,
    env,
    customAttributes,
    useAlias: true,
    aliasTag: 'new',
    customBodyFn: (body) => {
      // put this settings to speed up reindexing
      // https://www.elastic.co/guide/en/elasticsearch/reference/current/reindex-upgrade-inplace.html
      _.set(body, 'settings.index.number_of_replicas', 0)
      _.set(body, 'settings.index.auto_expand_replicas', false)
      _.set(body, 'settings.index.refresh_interval', -1)
      return body
    }
  })

  const reindexResult = await client.reindex({
    body: {
      conflicts: 'proceed',
      source: {
        index: fromIndex
      },
      dest: {
        index: toIndex,
        version_type: 'external',

        // only create if missing documents so there will be no conflicts with sync process
        op_type: 'create'
      }
    },
    waitForCompletion: false // default on ES v6.
    // The task has to be destroyed manually after completion
  })

  const taskId = reindexResult.task

  const data = {
    platformId,
    env,
    taskId,
    fromIndex,
    toIndex,
    newCustomAttributeName,
    COMMUNICATION_ID
  }

  await createReindexingTask({ platformId, env, data })
}

async function _endReindexingProcess ({ platformId, env, fromIndex, toIndex }) {
  const client = await getClient({ platformId, env })

  const fromIndexExists = await client.indices.exists({ index: fromIndex })
  const toIndexExists = await client.indices.exists({ index: toIndex })

  if (!fromIndexExists || !toIndexExists) return

  const fromIndexSettings = await client.indices.getSettings({
    index: fromIndex
  })
  const fromSettings = fromIndexSettings[fromIndex].settings

  const defaultNumberReplicas = env === 'test' ? 1 : null

  await client.indices.putSettings({
    index: toIndex,
    body: {
      index: {
        auto_expand_replicas: env === 'live' ? autoExpandReplicas : false,
        number_of_replicas: fromSettings.index.number_of_replicas || defaultNumberReplicas,
        refresh_interval: fromSettings.index.refresh_interval || null
      }
    }
  })

  await new Promise(resolve => setTimeout(resolve, 100))

  const currentAlias = getIndex({ platformId, env })
  const newAlias = getIndex({ platformId, env, tag: 'new' })

  await client.indices.updateAliases({
    body: {
      actions: [
        { add: { index: toIndex, alias: currentAlias } },
        { remove: { index: fromIndex, alias: currentAlias } }
      ]
    }
  })

  await new Promise(resolve => setTimeout(resolve, 2000))

  await removeReindexingTask({ platformId, env })

  // do not delete the source index right now to let the time for the sync process
  // to not have errors on old index not found
  setTimeout(async () => {
    try {
      await client.indices.updateAliases({
        body: {
          actions: [
            { remove: { index: toIndex, alias: newAlias } }
          ]
        }
      })

      await client.indices.delete({ index: fromIndex })
    } catch (err) {
      // do nothing
    }
  }, 1000)
}

async function getPendingReindexingTask ({ platformId, env }) {
  if (!platformId) {
    throw new Error('Missing platform ID')
  }
  if (!env) {
    throw new Error('Missing environment')
  }

  const client = getRedisClient()

  const res = await client.hgetAsync('esReindexing', `${platformId}_${env}`)
  if (!res) return res

  return JSON.parse(res)
}

async function getPendingReindexingTasks () {
  const client = getRedisClient()

  const res = await client.hgetallAsync('esReindexing')
  if (!res) return []

  return Object.keys(res).map(key => {
    const value = res[key]
    return JSON.parse(value)
  }, [])
}

async function createReindexingTask ({ platformId, env, data }) {
  if (!platformId) {
    throw new Error('Missing platform ID')
  }
  if (!env) {
    throw new Error('Missing environment')
  }
  if (typeof data !== 'object') {
    throw new Error('Data object expected')
  }

  const client = getRedisClient()

  await client.hsetAsync('esReindexing', `${platformId}_${env}`, JSON.stringify(data))
}

async function removeReindexingTask ({ platformId, env }) {
  if (!platformId) {
    throw new Error('Missing platform ID')
  }
  if (!env) {
    throw new Error('Missing environment')
  }

  const client = getRedisClient()

  await client.hdelAsync('esReindexing', `${platformId}_${env}`)
}

module.exports = {
  shouldReindex,
  startReindexingProcess,
  checkReindexing,

  getPendingReindexingTask,
  getPendingReindexingTasks,
  createReindexingTask,
  removeReindexingTask
}
