require('dotenv').config()
require('../src/secure-env').config()

process.env.ELASTIC_APM_DISABLED = true

const bluebird = require('bluebird')
const _ = require('lodash')

const request = require('superagent')
const store = require('./store')
const database = require('./database')
const data = require('./fixtures/data')
const getInstantData = require('./fixtures/instant-data')
const elasticsearch = require('./elasticsearch')
const debug = require('debug')('stelace:test')
const Uuid = require('uuid')
const { apiKey: { generateKey } } = require('stelace-util-keys')

const { getSystemKey } = require('./auth')

const { getPlugins } = require('../plugins')

const {
  getPostgresqlConnection,
  getElasticsearchConnection,
  getAuthenticationSettings
} = require('./connection')

// use two environments to test that one server can handle multiple environments at the same time
const testingEnvs = ['test', 'live']
const defaultTestingEnv = testingEnvs[0]

async function getDataFixtures (env) {
  const plugins = getPlugins()

  let fixtures
  if (process.env.INSTANT_DATA === 'true') {
    const apiKeys = {}

    if (process.env.HARD_CODED_API_KEYS !== 'true') {
      const platformId = '1'
      apiKeys.secret = await generateKey({ type: 'seck', env, platformId })
      apiKeys.publishable = await generateKey({ type: 'pubk', env, platformId })
    }

    fixtures = Object.assign({}, getInstantData(env, apiKeys))
  } else {
    fixtures = Object.assign({}, data)
  }

  plugins.forEach(plugin => {
    if (plugin.fixtures && process.env.INSTANT_DATA !== 'true') {
      Object.keys(plugin.fixtures).forEach(modelName => {
        const models = plugin.fixtures[modelName]
        fixtures[modelName] = (fixtures[modelName] || []).concat(models)
      })
    }
  })

  return fixtures
}

// clean databases before tests (instead of after)
// to ease test debugging by viewing database data after failure
async function dropTestPlatforms () {
  const { serverUrl } = await createServer({ enableSignal: false })

  const systemKey = getSystemKey()

  const { body: platformIds } = await request
    .get(`${serverUrl}/store/platforms`)
    .set(getAuthorizationHeaders({ systemKey }))

  // remove each existing platform workspace
  await bluebird.each(platformIds, async (platformId) => {
    if (platformId === '1') return // Don’t destroy development data

    for (const env of testingEnvs) {
      await request
        .post(`${serverUrl}/store/platforms/${platformId}/database/drop`)
        .set(getAuthorizationHeaders({ systemKey, env }))
        .catch(handleDropDatabaseError)

      await request
        .post(`${serverUrl}/store/platforms/${platformId}/elasticsearch/drop`)
        .set(getAuthorizationHeaders({ systemKey, env }))
        .catch(handleDropDatabaseError)
    }

    await request
      .delete(`${serverUrl}/store/platforms/${platformId}`)
      .set(getAuthorizationHeaders({ systemKey }))
      .catch(handleDropDatabaseError)
  })

  await store.reset()

  // Some tests need to have a specific platform ID (like apiKey.spec.js).
  // By setting a start platformId to a number superior to 1 (like 10), we keep room
  // to assign a specific platform ID below this number to a test suite in the future
  // as platformId is incremented for each test suite
  await store.setPlatformId(10)
}

function before ({ name, platformId, env, enableSignal = true, useFreePort } = {}) {
  const fn = async (t) => {
    const systemKey = getSystemKey()

    const result = await createServer({ enableSignal, useFreePort })
    const server = result.server
    const serverPort = result.serverPort

    if (name) {
      debug(`Starting test suite "${name}" with platformId ${platformId}`)
    }

    t.context.name = name
    t.context.serverUrl = `http://127.0.0.1:${serverPort}`
    t.context.serverPort = serverPort
    t.context.server = server

    let existingPlatformId = false

    if (platformId) {
      platformId = '' + platformId // platformId can be passed as an integer

      const { body: platformIds } = await request
        .get(`${t.context.serverUrl}/store/platforms`)
        .set(getAuthorizationHeaders({ systemKey }))

      existingPlatformId = platformIds.includes(platformId)
    }

    if (!existingPlatformId) {
      const { body: { id: newPlatformId } } = await request
        .post(`${t.context.serverUrl}/store/platforms`)
        .send({ platformId })
        .set(getAuthorizationHeaders({ systemKey }))

      platformId = newPlatformId
    }

    if (env && !testingEnvs.includes(env)) {
      throw new Error('Environment not supported')
    }

    if (!env) env = defaultTestingEnv

    for (const env of testingEnvs) {
      await initSettings({
        serverUrl: t.context.serverUrl,
        platformId,
        env,
        systemKey
      })
    }

    t.context.platformId = platformId
    t.context.env = env
  }

  return fn
}

function beforeEach ({ minimumFixtures = false } = {}) {
  const fn = async (t) => {
    const platformId = t.context.platformId

    for (const env of testingEnvs) {
      await startPlatformDatabases({
        platformId,
        env,
        serverUrl: t.context.serverUrl,
        minimumFixtures,
      })
    }
  }

  return fn
}

async function startPlatformDatabases ({ serverUrl, platformId, env, minimumFixtures }) {
  const systemKey = getSystemKey()

  await request
    .post(`${serverUrl}/store/platforms/${platformId}/database/drop`)
    .set(getAuthorizationHeaders({ systemKey, env }))
    .catch(handleDropDatabaseError)

  await request
    .post(`${serverUrl}/store/platforms/${platformId}/database/migrate`)
    .set(getAuthorizationHeaders({ systemKey, env }))

  let fixtures = await getDataFixtures(env)

  if (minimumFixtures) {
    fixtures = _.pick(fixtures, [
      'config',
      'roles',
      'user'
    ])
  }

  const connection = getPostgresqlConnection({ platformId, env })
  await database.createFixture({ platformId, env, connection, data: fixtures })

  await elasticsearch.init({ platformId, env })
}

function after () {
  const fn = async (t) => {
    await stopServer(t.context.server)
  }

  return fn
}

async function createPlatform ({ t, minimumFixtures = false }) {
  const systemKey = getSystemKey()

  const { body: { id: platformId } } = await request
    .post(`${t.context.serverUrl}/store/platforms`)
    .set(getAuthorizationHeaders({ systemKey }))

  for (const env of testingEnvs) {
    await initSettings({
      serverUrl: t.context.serverUrl,
      platformId,
      env,
      systemKey
    })

    await startPlatformDatabases({
      serverUrl: t.context.serverUrl,
      platformId,
      env,
      minimumFixtures,
    })
  }

  return {
    platformId,
    context: {
      platformId,
      env: t.context.env,
    },
  }
}

async function createServer ({ enableSignal, useFreePort = true }) {
  const { start } = require('../server')

  const server = await start({
    useFreePort,
    communicationEnv: Uuid.v4(),
    enableSignal
  })

  const serverPort = server.address().port
  const serverUrl = `http://127.0.0.1:${serverPort}`

  return {
    server,
    serverPort,
    serverUrl
  }
}

async function stopServer (server) {
  const { stop } = require('../server')

  await stop({ server })
}

// use endpoints to set databases credentials and some other settings
// this is to check if platforms are correctly initialized
async function initSettings ({ serverUrl, platformId, env, systemKey }) {
  await request
    .put(`${serverUrl}/store/platforms/${platformId}/data/${env}`)
    .set(getAuthorizationHeaders({ systemKey }))
    .send({
      postgresql: getPostgresqlConnection({ platformId, env }),
      elasticsearch: getElasticsearchConnection(),
      auth: getAuthenticationSettings()
    })
}

function handleDropDatabaseError (err) {
  const errorMessage = _.get(err, 'response.body._message')

  if (!errorMessage) throw err

  // credentials are missing, databases cannot be dropped
  // (can happen if there is an error in the .before() lifecycle method)
  if (errorMessage && !errorMessage.includes('missing environment variables')) {
    throw err
  }
}

function getAuthorizationHeaders ({ env, systemKey }) {
  const headers = {}
  if (!_.isUndefined(systemKey)) headers['x-stelace-system-key'] = systemKey
  if (!_.isUndefined(env)) headers['x-stelace-env'] = env
  return headers
}

module.exports = {
  testingEnvs,
  defaultTestingEnv,
  dropTestPlatforms,
  createPlatform,

  before,
  beforeEach,
  after
}
