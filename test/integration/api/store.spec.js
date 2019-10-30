require('dotenv').config()

const test = require('ava')
const request = require('supertest')

const { before, beforeEach, after } = require('../../lifecycle')
const { getSystemKey } = require('../../auth')
const { getEnvironments } = require('../../../src/util/environment')
const { getPostgresqlConnection, getElasticsearchConnection } = require('../../connection')

const instanceEnv = getEnvironments()[0] || 'test'

test.before(async t => {
  await before({ name: 'store' })(t)
  await beforeEach()(t)
})
// test.beforeEach(beforeEach()) // Concurrent tests are much faster
test.after(after())

const isNonEmptyIntegerString = (value) => !!(
  value &&
  typeof value === 'string' &&
  '' + parseInt(value, 10) === value
)

// Must run serially as it has impact on all env data keys
test.serial('gets, updates and removes platform env data', async (t) => {
  const systemKey = getSystemKey()

  const platformId = t.context.platformId

  const connection = {
    host: 'example.com',
    port: 5432,
    user: 'user',
    password: null,
    database: 'test'
  }
  const connection2 = {
    host: 'example2.com',
    port: 5432,
    user: 'user',
    password: null,
    database: 'test'
  }

  const { body: beforeCreateData } = await request(t.context.serverUrl)
    .get(`/store/platforms/${platformId}/data/${instanceEnv}`)
    .set({ 'x-stelace-system-key': systemKey })
    .expect(200)

  t.truthy(beforeCreateData) // is truthy because database credentials are set

  const { body: createdData } = await request(t.context.serverUrl)
    .put(`/store/platforms/${platformId}/data/${instanceEnv}`)
    .set({ 'x-stelace-system-key': systemKey })
    .send({ custom: connection, custom2: connection2 })
    .expect(200)

  t.deepEqual(createdData.custom, connection)
  t.deepEqual(createdData.custom2, connection2)

  const { body: data } = await request(t.context.serverUrl)
    .get(`/store/platforms/${platformId}/data/${instanceEnv}`)
    .set({ 'x-stelace-system-key': systemKey })
    .expect(200)

  t.deepEqual(data.custom, connection)
  t.deepEqual(data.custom2, connection2)

  // replace the whole old data object
  const { body: createdData2 } = await request(t.context.serverUrl)
    .put(`/store/platforms/${platformId}/data/${instanceEnv}`)
    .set({ 'x-stelace-system-key': systemKey })
    .send({
      custom: { randomData: true },
      custom2: { randomData2: true }
    })
    .expect(200)

  t.deepEqual(createdData2.custom, { randomData: true })
  t.deepEqual(createdData2.custom2, { randomData2: true })

  await request(t.context.serverUrl)
    .delete(`/store/platforms/${platformId}/data/${instanceEnv}`)
    .set({ 'x-stelace-system-key': systemKey })
    .expect(200)

  const { body: afterRemoveData } = await request(t.context.serverUrl)
    .get(`/store/platforms/${platformId}/data/${instanceEnv}`)
    .set({ 'x-stelace-system-key': systemKey })
    .expect(200)

  t.deepEqual(afterRemoveData, {})

  // reset Database credentials for other tests
  await request(t.context.serverUrl)
    .put(`/store/platforms/${platformId}/data/${instanceEnv}`)
    .set({ 'x-stelace-system-key': systemKey })
    .send(beforeCreateData)
    .expect(200)
})

test('gets, sets and removes platform env data by key', async (t) => {
  const systemKey = getSystemKey()

  const connection = {
    host: 'example.com',
    port: 5432,
    user: 'user',
    password: null,
    database: 'test'
  }

  const platformId = t.context.platformId

  const { body: beforeCreateData } = await request(t.context.serverUrl)
    .get(`/store/platforms/${platformId}/data/${instanceEnv}/custom`)
    .set({ 'x-stelace-system-key': systemKey })
    .expect(200)

  t.is(beforeCreateData, null)

  const { body: createdData } = await request(t.context.serverUrl)
    .put(`/store/platforms/${platformId}/data/${instanceEnv}/custom`)
    .set({ 'x-stelace-system-key': systemKey })
    .send(connection)
    .expect(200)

  t.deepEqual(createdData, connection)

  const { body: data } = await request(t.context.serverUrl)
    .get(`/store/platforms/${platformId}/data/${instanceEnv}/custom`)
    .set({ 'x-stelace-system-key': systemKey })
    .expect(200)

  t.deepEqual(data, connection)

  // replace the whole old data object
  const { body: createdData2 } = await request(t.context.serverUrl)
    .put(`/store/platforms/${platformId}/data/${instanceEnv}/custom`)
    .set({ 'x-stelace-system-key': systemKey })
    .send({ randomData: true })
    .expect(200)

  t.deepEqual(createdData2, { randomData: true })

  await request(t.context.serverUrl)
    .delete(`/store/platforms/${platformId}/data/${instanceEnv}/custom`)
    .set({ 'x-stelace-system-key': systemKey })
    .expect(200)

  const { body: afterRemoveData } = await request(t.context.serverUrl)
    .get(`/store/platforms/${platformId}/data/${instanceEnv}/custom`)
    .set({ 'x-stelace-system-key': systemKey })
    .expect(200)

  t.is(afterRemoveData, null)
})

test('sync elasticsearch', async (t) => {
  const systemKey = getSystemKey()

  const platformId = t.context.platformId

  const result = await request(t.context.serverUrl)
    .post(`/store/platforms/${platformId}/elasticsearch/sync`)
    .set({
      'x-stelace-system-key': systemKey,
      'x-stelace-env': t.context.env
    })
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, 1000))

  const obj = result.body

  t.true(obj.success)
})

test('sync cache', async (t) => {
  const systemKey = getSystemKey()

  const platformId = t.context.platformId

  const { body: { cache: { ok: beforeCheck } } } = await request(t.context.serverUrl)
    .get(`/store/platforms/${platformId}/check`)
    .set({
      'x-stelace-system-key': systemKey,
      'x-stelace-env': t.context.env
    })
    .expect(200)

  t.false(beforeCheck)

  // synchronize existing active tasks
  await request(t.context.serverUrl)
    .post(`/store/platforms/${platformId}/cache/sync`)
    .set({
      'x-stelace-system-key': systemKey,
      'x-stelace-env': 'test'
    })
    .expect(200)

  await request(t.context.serverUrl)
    .post(`/store/platforms/${platformId}/cache/sync`)
    .set({
      'x-stelace-system-key': systemKey,
      'x-stelace-env': 'live'
    })
    .expect(200)

  const { body: { cache: { ok: afterCheck } } } = await request(t.context.serverUrl)
    .get(`/store/platforms/${platformId}/check`)
    .set({
      'x-stelace-system-key': systemKey,
      'x-stelace-env': t.context.env
    })
    .expect(200)

  t.true(afterCheck)

  // delete all tasks from cache
  await request(t.context.serverUrl)
    .post(`/store/platforms/${platformId}/cache/delete`)
    .set({
      'x-stelace-system-key': systemKey,
      'x-stelace-env': t.context.env
    })
    .expect(200)

  const { body: { cache: { ok: checkAfterDelete } } } = await request(t.context.serverUrl)
    .get(`/store/platforms/${platformId}/check`)
    .set({
      'x-stelace-system-key': systemKey,
      'x-stelace-env': t.context.env
    })
    .expect(200)

  t.false(checkAfterDelete)
})

test('creates a platform, init and reset databases', async (t) => {
  const systemKey = getSystemKey()

  const { body: { id: platformId } } = await request(t.context.serverUrl)
    .post('/store/platforms')
    .set({ 'x-stelace-system-key': systemKey })
    .expect(200)

  t.true(isNonEmptyIntegerString(platformId))

  const env = t.context.env

  const areDatabasesUp = async ({ postgresql, elasticsearch }) => {
    const postgresqlStatus = postgresql ? 200 : 500
    const elasticsearchStatus = postgresql
      // index not found, queries to PostgreSQL still work, so this isn't an error status 500
      ? (elasticsearch ? 200 : 404)
      : 500

    await request(t.context.serverUrl)
      .get('/api-keys')
      .set({
        'x-stelace-system-key': systemKey,
        'x-platform-id': platformId,
        'x-stelace-env': env
      })
      .expect(postgresqlStatus)

    await request(t.context.serverUrl)
      .post('/search')
      .send({ query: 'random' })
      .set({
        'x-stelace-system-key': systemKey,
        'x-platform-id': platformId,
        'x-stelace-env': env
      })
      .expect(elasticsearchStatus)
  }

  // error because databases aren't initialized and database connection settings are missing
  await areDatabasesUp({ postgresql: false, elasticsearch: false })

  await request(t.context.serverUrl)
    .put(`/store/platforms/${platformId}/data/${env}/postgresql`)
    .set({ 'x-stelace-system-key': systemKey })
    .send(getPostgresqlConnection({ platformId, env }))
    .expect(200)

  await request(t.context.serverUrl)
    .put(`/store/platforms/${platformId}/data/${env}/elasticsearch`)
    .set({ 'x-stelace-system-key': systemKey })
    .send(getElasticsearchConnection())
    .expect(200)

  await request(t.context.serverUrl)
    .post(`/store/platforms/${platformId}/init`)
    .set({
      'x-stelace-system-key': systemKey,
      'x-stelace-env': env
    })
    .expect(200)

  // api keys and assets can be retrieved
  await areDatabasesUp({ postgresql: true, elasticsearch: true })

  await request(t.context.serverUrl)
    .post(`/store/platforms/${platformId}/elasticsearch/drop`)
    .set({
      'x-stelace-system-key': systemKey,
      'x-stelace-env': env
    })
    .expect(200)

  // search doesn't work because Elasticsearch is dropped
  await areDatabasesUp({ postgresql: true, elasticsearch: false })

  await request(t.context.serverUrl)
    .post(`/store/platforms/${platformId}/database/drop`)
    .set({
      'x-stelace-system-key': systemKey,
      'x-stelace-env': env
    })
    .expect(200)

  // api keys and search don't work anymore, all databases dropped
  await areDatabasesUp({ postgresql: false, elasticsearch: false })

  // init databases one by one (instead of the global init)
  await request(t.context.serverUrl)
    .post(`/store/platforms/${platformId}/database/migrate`)
    .set({
      'x-stelace-system-key': systemKey,
      'x-stelace-env': env
    })
    .expect(200)

  await areDatabasesUp({ postgresql: true, elasticsearch: false })

  await request(t.context.serverUrl)
    .post(`/store/platforms/${platformId}/elasticsearch/init`)
    .set({
      'x-stelace-system-key': systemKey,
      'x-stelace-env': env
    })
    .expect(200)

  await areDatabasesUp({ postgresql: true, elasticsearch: true })

  t.pass()
})
