const redis = require('redis')
const _ = require('lodash')
const bluebird = require('bluebird')

bluebird.promisifyAll(redis)

const { isValidPlatformId } = require('stelace-util-keys')
const { isValidEnvironment } = require('./util/environment')

const isTestEnv = process.env.NODE_ENV === 'test'

let client
const dataKeys = [
  'auth',
  'elasticsearch',
  'plan',
  'postgresql',
  'sparkpost', // DEPRECATED
  'version'
]

// keys only available in test environment
const testDataKeys = [
  'custom',
  'custom2'
]

function getRedisConnection () {
  const params = {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    db: process.env.REDIS_DBNUM,
    password: process.env.REDIS_PASSWORD || undefined
  }

  if (process.env.REDIS_TLS === 'true') {
    params.tls = { servername: process.env.REDIS_HOST }
  }

  return params
}

function isCompleteRedisConnection (connection) {
  const {
    host,
    db
  } = connection

  return host && db
}

// Set exclusive to true to create a new client that won’t be reused (useful for pub/sub)
function getRedisClient ({ exclusive = false } = {}) {
  if (client && exclusive !== true) return client

  const params = getRedisConnection()

  if (!isCompleteRedisConnection(params)) {
    throw new Error('Missing Redis config')
  }

  const connection = Object.assign({}, params, {
    retry_strategy: (options) => {
      if (options.times_connected === 0) {
        client.end(true)
        client = null
      }
    }
  })

  const newClient = redis.createClient(connection)

  if (exclusive === true) return newClient

  client = newClient
  return client
}

async function getPlatforms () {
  const client = getRedisClient()

  const res = await client.smembersAsync('platforms')
  return res
}

async function hasPlatform (platformId) {
  const client = getRedisClient()

  const res = await client.sismemberAsync('platforms', platformId)
  return !!res
}

async function getPlatformId () {
  const client = getRedisClient()

  const res = await client.incrAsync('id:platforms')
  return '' + res // returns a string
}

async function setPlatformId (id) {
  if (typeof id === 'string') {
    const numberId = parseInt(id, 10)

    if (id !== '' + numberId) {
      throw new Error('A string number is expected')
    } else {
      id = numberId
    }
  }
  if (typeof id !== 'number') {
    throw new Error('A number is expected')
  }

  const client = getRedisClient()
  await client.setAsync('id:platforms', id)
}

async function addPlatform (platformId) {
  const client = getRedisClient()

  let id = platformId

  if (!id) id = await getPlatformId()

  await client.saddAsync('platforms', id)

  return { id }
}

async function removePlatform (platformId) {
  const client = getRedisClient()

  const dataKeys = await client.keysAsync(`data:${platformId}:*`)
  await client.delAsync(dataKeys.join(' '))

  await client.sremAsync('platforms', platformId)
}

/**
 * Get platform info from redis.
 * For improved end-user response time, note that `key` can be an array.
 * Keys currently available, mapping to objects unless stated otherwise:
 * - auth
 * - elasticsearch
 * - plan
 * - postgresql
 * - sparkpost // DEPRECATED
 * - version (string)
 * @param {String} platformId
 * @param {String} env - Currently 'live' or 'test'
 * @param {String|String[]} key - Key(s) of which values should be fetched from redis store.
 *   Use wilcard '*' to fetch all keys
 * @returns {Object|String} Single data object,
 *   or object whose keys map to each data object/string when passing `key` array.
 */
async function getPlatformEnvData (platformId, env, key) {
  const client = _getClient({ platformId, env })
  let res

  if (key === '*') {
    const keysPattern = `data:${platformId}:${env}:`

    const redisKeys = await client.keysAsync(`${keysPattern}*`)
    if (!redisKeys.length) return {}

    const objects = await client.mgetAsync(redisKeys)

    res = objects.reduce((r, o, i) => {
      if (!o) return r

      const extractedKey = redisKeys[i].slice(keysPattern.length)
      r[extractedKey] = JSON.parse(o)
      return r
    }, {})
  } else if (Array.isArray(key)) {
    const redisKeys = _getRedisDataKeys(key, { platformId, env })
    const objects = await client.mgetAsync(redisKeys)

    res = objects.reduce((r, o, i) => {
      r[key[i]] = JSON.parse(o)
      return r
    }, {})
  } else {
    res = JSON.parse(await client.getAsync(`data:${platformId}:${env}:${key}`))
  }

  if (_.isEmpty(res)) {
    // Optimistic lookup: only check marketplace existence when we find no data
    // for minimal response time.
    const exists = await hasPlatform(platformId)
    if (!exists) throw new Error(`Platform ${platformId} does not exist.`)
  }

  return res
}

/**
 * Store platform info in redis for faster retrieval of frequently required user data.
 * Keys currently available, for which JSON.stringify is used internally:
 * - auth
 * - elasticsearch
 * - plan
 * - postgresql
 * - sparkpost // DEPRECATED
 * - version, string value expected
 * - TODO: lastVersion, lastVersionChangeDate strings
 *
 * Note that all object values are stringified internally, and that you can’t update partially,
 * unless we introduce Lua scripting in the future.
 *
 * @param {String} platformId
 * @param {String} env - Currently 'live' or 'test'
 * @param {String|Object} key - Key(s) to set in redis store
 * @param {Object|String} data - When `key` is passed as an array of keys,
 *   `data` must be an object with same keys mapping to their own objects,
 *   like `{ auth: {…}, version: {…} }`.
 *   You can also pass string value(s) to directly store in redis (JSON.stringified too).
 */
async function setPlatformEnvData (platformId, env, key, data) {
  if (!_.isPlainObject(data) && typeof data !== 'string') {
    throw new Error('Data object or string expected')
  }

  const client = _getClient({ platformId, env })

  if (Array.isArray(key)) {
    const redisKeys = _getRedisDataKeys(key, { data, platformId, env })
    // Node-redis expects [key1, data1, key2, data2, …] array
    const keyDataPairs = _.flatMap(redisKeys, (k, i) => [k, JSON.stringify(data[key[i]])])
    await client.msetAsync(keyDataPairs)
  } else {
    await client.setAsync(`data:${platformId}:${env}:${key}`, JSON.stringify(data))
  }
}

function _getRedisDataKeys (keys, { data, platformId, env }) {
  const validKeys = dataKeys.concat(isTestEnv ? testDataKeys : [])
  const invalidKeys = _.difference(keys, validKeys)
  if (invalidKeys.length) throw new Error(`${invalidKeys.join(', ')} do(es) not exist.`)

  if (_.isObjectLike(data)) {
    const keysWithNoData = _.difference(keys, Object.keys(data))
    if (keysWithNoData.length) throw new Error(`Missing data for ${invalidKeys.join(', ')}`)
  }

  return keys.map(k => `data:${platformId}:${env}:${k}`)
}

function _getClient ({ platformId, env } = {}) {
  if (!isValidEnvironment(env)) throw new Error('Missing environment')
  if (!isValidPlatformId(platformId)) throw new Error('Missing platformId')

  return getRedisClient()
}

/**
 * @param {String} platformId
 * @param {String} env
 * @param {String} key - can be the wildcard '*' to remove all keys
 */
async function removePlatformEnvData (platformId, env, key) {
  const client = _getClient({ platformId, env })

  if (key === '*') {
    const redisKeys = await client.keysAsync(`data:${platformId}:${env}:*`)
    await client.delAsync(redisKeys)
  } else {
    await client.delAsync(`data:${platformId}:${env}:${key}`)
  }
}

/**
 * Returns all platform metrics, useful for pricing or logging.
 * Object values stored and returned must be parsed manually using JSON.parse
 * @param  {String} platformId
 * @param  {String} env
 * @returns {Object} Metrics object
 */
async function getPlatformMetrics (platformId, env) {
  const client = _getClient({ platformId, env })

  const res = await client.hgetallAsync(`metrics:${platformId}`)
  return res
}

/**
 * Sets platform metrics into redis store hash, allowing partial updates / increments
 * with additional functions to come.
 * Object values in `metrics` must be stringified.
 * @param  {String} platformId
 * @param  {String} env
 * @param  {Object} metrics
 */
async function setPlatformMetrics (platformId, env, metrics = {}) {
  const client = _getClient({ platformId, env })

  const res = await client.hmsetAsync(`metrics:${platformId}:${env}:keys:objects`, metrics)
  return res
}

/**
 * Returns all Stelace tasks, that generate events based on schedule config
 * @param {String} [platformId] - optional filter
 * @param {String} [env] - optional filter
 */
async function getAllStelaceTasks ({ platformId, env } = {}) {
  // Avoid loading tasks of all platforms in memory at once
  const platformRegex = new RegExp(`"platformId":"${platformId}"`)
  const envRegex = new RegExp(`"env":"${env}"`)
  return _scanAndFilterTasks({
    filterFn: r =>
      (!platformId || platformRegex.test(r)) && (!env || envRegex.test(r))
  })
}

/**
 * Add/Replace Stelace task by ID
 * @param {String} platformId
 * @param {String} env
 * @param {Object} task
 */
async function setStelaceTask ({ platformId, env, task }) {
  if (!task.id) {
    throw new Error('Expected Task ID')
  }

  const client = _getClient({ platformId, env })

  const payload = {
    platformId,
    env,
    task
  }

  await client.hsetAsync('stelace_tasks', task.id, JSON.stringify(payload))
}

/**
 * Remove Stelace task(s)
 * @param {String} platformId
 * @param {String} env
 * @param {String|String[]} taskId - Can be wildcard '*' string to remove all tasks
 * @returns {Array} taskIds removed, potentially needed to clean up stelace_tasks_execution_date
 */
async function removeStelaceTask ({ platformId, env, taskId }) {
  if (!taskId) throw new Error('Expected Task ID or wildcard "*"')

  const client = _getClient({ platformId, env })
  let taskIds = _.flatten([taskId])

  if (taskId === '*') {
    const platformRegex = new RegExp(`"platformId":"${platformId}"`)
    taskIds = await _scanAndFilterTasks({
      client,
      filterFn: r => platformRegex.test(r),
      mapFn: t => t.task.id
    })
  }

  // Array of args for HDEL: https://github.com/NodeRedis/node_redis/issues/369
  if (taskIds.length) await client.hdelAsync('stelace_tasks', ...taskIds)
  return taskIds
}

/**
 * Checks if a task has been executed at provided date
 * @param {String} taskId
 * @param {String} executionDate
 */
async function didStelaceTaskExecute ({ taskId, executionDate }) {
  if (!taskId) {
    throw new Error('Expected Task ID')
  }

  const client = getRedisClient()

  const res = await client.zrankAsync(`stelace_tasks_execution_date:${taskId}`, executionDate)
  return res !== null
}

/**
 * Add a new execution date for Stelace task
 * If the date has already been added, only a unique date is saved
 * @param {String} taskId
 * @param {String} executionDate
 * @param {String} [nbSavedDates = 5] - only keep this number of dates to save space
 */
async function addStelaceTaskExecutionDate ({ taskId, executionDate, nbSavedDates = 5 }) {
  if (!taskId) {
    throw new Error('Expected Task ID')
  }

  const client = getRedisClient()

  const timestamp = new Date(executionDate).getTime()

  const key = `stelace_tasks_execution_date:${taskId}`

  await client.zaddAsync(key, [timestamp, executionDate])

  // keep only `nbSavedDates` in the Redis SET to save space
  await client.zremrangebyrankAsync(key, 0, -nbSavedDates - 1)
}

/**
 * Remove Stelace task saved execution dates
 * @param {String|String[]} taskId
 */
async function removeStelaceTaskExecutionDates ({ taskId }) {
  if (!taskId) throw new Error('Expected Task ID(s)')
  const client = getRedisClient()

  const keys = _.flatten([taskId]).map(id => `stelace_tasks_execution_date:${id}`)
  if (keys.length) await client.delAsync(keys)
}

/**
 * Use HSCAN to retrieve redis `stelace_tasks` hash values matching `filterFn`.
 * @param {Function} [filterFn] - Invoked over all tasks of __all__ platforms,
 *   so that you have to pay attention to performance.
 * @param {Function} [mapFn] - Optional transformation of task objects
 * @param {Object} [redisClient] - redis client
 * @private
 */
async function _scanAndFilterTasks ({ filterFn = _ => _, mapFn = _ => _, client }) {
  let tasks = []
  const cl = client || getRedisClient()

  const getTasks = async (start = 0) => {
    // Using HSCAN for performance, for it is non-blocking unlike KEYS
    // and we avoid loading all tasks of all platforms in memory (COUNT).
    // https://redis.io/commands/scan
    // Unfortunately can’t use MATCH pattern option for hash values so we filter manually
    const res = await cl.hscanAsync('stelace_tasks', start, 'COUNT', 100)
    let [cursor, results] = res
    // probably faster than using JSON.parse
    const platformTasks = results
      // TODO: use idPrefix of task model when migrating task related redis functions to Task plugin.
      .filter(r => !r.startsWith('task_') && filterFn(r))
      .map(JSON.parse)

    cursor = parseInt(cursor, 10)
    tasks = [...tasks, ...platformTasks.map(mapFn)]
    if (cursor !== 0) await getTasks(cursor)
  }
  await getTasks()

  return tasks
}

module.exports = {
  getRedisConnection,
  isCompleteRedisConnection,
  getRedisClient,

  getPlatformId,
  setPlatformId,

  getPlatforms,
  hasPlatform,
  addPlatform,
  removePlatform,

  getPlatformEnvData,
  setPlatformEnvData,
  removePlatformEnvData,

  getPlatformMetrics,
  setPlatformMetrics,

  getAllStelaceTasks,
  setStelaceTask,
  removeStelaceTask,

  didStelaceTaskExecute,
  addStelaceTaskExecutionDate,
  removeStelaceTaskExecutionDates
}
