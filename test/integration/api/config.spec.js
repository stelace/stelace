require('dotenv').config()

const test = require('ava')
const request = require('supertest')

const { apiVersions } = require('../../../src/versions')

const { before, beforeEach, after } = require('../../lifecycle')
const { getAccessTokenHeaders, getSystemKey } = require('../../auth')

test.before(async t => {
  await before({ name: 'config' })(t)
  await beforeEach()(t)
})
// test.beforeEach(beforeEach()) // Concurrent tests are much faster
test.after(after())

test('gets config', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['config:read'] })

  const { body: config } = await request(t.context.serverUrl)
    .get('/config')
    .set(authorizationHeaders)
    .expect(200)

  t.is(typeof config.stelace, 'object')
  t.is(typeof config.custom, 'object')
  t.is(typeof config.theme, 'object')

  const authorizationHeaders2 = await getAccessTokenHeaders({ t, permissions: ['config:read:all'] })
  const { body: config2 } = await request(t.context.serverUrl)
    .get('/config')
    .set(authorizationHeaders2)
    .expect(200)

  t.is(typeof config2.stelace, 'object')
})

test('updates config', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['config:edit'] })
  const payload = {
    stelace: {
      instant: {
        locale: 'fr'
      }
    }
  }

  const { body: config } = await request(t.context.serverUrl)
    .patch('/config')
    .set(authorizationHeaders)
    .send(payload)
    .expect(200)

  t.is(typeof config.stelace, 'object')
  t.is(config.stelace.instant.locale, 'fr')

  const authorizationHeaders2 = await getAccessTokenHeaders({ t, permissions: ['config:edit:all'] })
  payload.stelace.instant.locale = 'en'
  const { body: config2 } = await request(t.context.serverUrl)
    .patch('/config')
    .set(authorizationHeaders2)
    .send(payload)
    .expect(200)

  t.is(config2.stelace.instant.locale, 'en')
})

test('changes default and whitelist roles in config', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['config:edit'] })

  const { body: config } = await request(t.context.serverUrl)
    .patch('/config')
    .set(authorizationHeaders)
    .send({
      stelace: {
        roles: {
          default: ['user'],
          whitelist: ['provider']
        }
      }
    })
    .expect(200)

  t.is(typeof config.stelace, 'object')
  t.deepEqual(config.stelace.roles.default, ['user'])
  t.deepEqual(config.stelace.roles.whitelist, ['provider'])
})

test('cannot provide an unknown role', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['config:edit'] })

  await request(t.context.serverUrl)
    .patch('/config')
    .set(authorizationHeaders)
    .send({
      stelace: {
        roles: {
          default: ['unknownRole']
        }
      }
    })
    .expect(422)

  t.pass()
})

test('cannot provide dev role in roles whitelist', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['config:edit'] })

  await request(t.context.serverUrl)
    .patch('/config')
    .set(authorizationHeaders)
    .send({
      stelace: {
        roles: {
          whitelist: ['dev', 'user']
        }
      }
    })
    .expect(422)

  t.pass()
})

test('cannot provide dev role in default roles list', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['config:edit'] })

  await request(t.context.serverUrl)
    .patch('/config')
    .set(authorizationHeaders)
    .send({
      stelace: {
        roles: {
          default: ['dev', 'user']
        }
      }
    })
    .expect(422)

  t.pass()
})

test('updates config theme', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['config:edit'] })

  const { body: config } = await request(t.context.serverUrl)
    .patch('/config')
    .set(authorizationHeaders)
    .send({
      theme: {
        primaryColor: 'blue'
      }
    })
    .expect(200)

  t.is(config.theme.primaryColor, 'blue')
})

test('gets the private config', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['config:read:all'] })

  const { body: config } = await request(t.context.serverUrl)
    .get('/config/private')
    .set(authorizationHeaders)
    .expect(200)

  t.is(typeof config.stelace, 'object')
  t.is(typeof config.stelace.workflow, 'object')
})

test('updates the private config', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['config:edit:all'] })

  const { body: config } = await request(t.context.serverUrl)
    .patch('/config/private')
    .set(authorizationHeaders)
    .send({
      stelace: {
        stelaceAuthRefreshTokenExpiration: { d: 14 }
      }
    })
    .expect(200)

  t.deepEqual(config.stelace.stelaceAuthRefreshTokenExpiration, { d: 14 })
})

test('gets the system config', async (t) => {
  const systemKey = getSystemKey()

  const { body: config } = await request(t.context.serverUrl)
    .get('/config/system')
    .set({
      'x-stelace-system-key': systemKey,
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(200)

  t.is(typeof config.stelace, 'object')
  t.is(typeof config.custom, 'object')
})

test('updates the system config', async (t) => {
  const systemKey = getSystemKey()

  const { body: config } = await request(t.context.serverUrl)
    .patch('/config/system')
    .set({
      'x-stelace-system-key': systemKey,
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      stelace: {
        // change API version, propagates to redis internally
        stelaceVersion: apiVersions[0]
      },
      custom: {
        anySystemProtectedValue: { system: true }
      }
    })
    .expect(200)

  t.is(config.stelace.stelaceVersion, apiVersions[0])
  t.deepEqual(config.custom.anySystemProtectedValue, { system: true })
})

// ////////// //
// VALIDATION //
// ////////// //

test('fails to update the config if missing parameters', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['config:edit'] })

  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .patch('/config')
    .set(authorizationHeaders)
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .patch('/config')
    .set(authorizationHeaders)
    .send({
      stelace: true,
      custom: true,
      theme: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"stelace" must be an object'))
  t.true(error.message.includes('"custom" must be an object'))
  t.true(error.message.includes('"theme" must be an object'))
})

test('fails to update the private config if missing parameters', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['config:edit:all'] })

  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .patch('/config/private')
    .set(authorizationHeaders)
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .patch('/config/private')
    .set(authorizationHeaders)
    .send({
      stelace: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"stelace" must be an object'))
})
