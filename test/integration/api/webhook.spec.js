require('dotenv').config()

const test = require('ava')
const request = require('supertest')
const express = require('express')
const bodyParser = require('body-parser')
const _ = require('lodash')

const userServer = express()
let userServerPort
const userServerCalls = {}
let userApp

const { before, beforeEach, after } = require('../../lifecycle')
const { getAccessTokenHeaders } = require('../../auth')
const {
  testEventDelay,
  computeDate,

  checkCursorPaginationScenario,
  checkCursorPaginatedListObject,
} = require('../../util')
const { apiVersions } = require('../../../src/versions')

let userWebhookUrl

const defaultTestDelay = 4000

let createdWebhooks

/* eslint-disable no-template-curly-in-string */

async function createWebhookLogs (t) {
  if (createdWebhooks) return createdWebhooks

  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'webhookLog:list:all',
      'webhook:create:all',
      'category:create:all',
      'entry:create:all',
      'message:create:all',
    ]
  })

  // should create webhooks that listen to events that are not triggered by any tests below

  const { body: messageWebhook } = await request(t.context.serverUrl)
    .post('/webhooks')
    .set(authorizationHeaders)
    .send({
      name: 'Webhook for message creation',
      event: 'message__created',
      targetUrl: userWebhookUrl + 'messageCreation',
    })
    .expect(200)

  const { body: entryWebhook } = await request(t.context.serverUrl)
    .post('/webhooks')
    .set(authorizationHeaders)
    .send({
      name: 'Webhook for entry creation',
      event: 'entry__created',
      targetUrl: userWebhookUrl + 'entryCreation',
    })
    .expect(200)

  createdWebhooks = _.keyBy([
    messageWebhook,
    entryWebhook,
  ], 'event')

  await request(t.context.serverUrl)
    .post('/messages')
    .set(authorizationHeaders)
    .send({
      topicId: 'ast_2l7fQps1I3a1gJYz2I3a',
      receiverId: 'user-external-id',
      content: 'Good',
    })
    .expect(200)

  await request(t.context.serverUrl)
    .post('/entries')
    .set(authorizationHeaders)
    .send({
      collection: 'someCollection',
      locale: 'en-US',
      name: 'nameExample',
      fields: {
        title: 'Random title',
        content: 'Random content',
        nestedContent: {
          random1: {
            random2: 'hello'
          },
          random3: 'bye'
        }
      }
    })
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, defaultTestDelay))
}

test.before(async (t) => {
  await before({ name: 'webhook' })(t)
  await beforeEach()(t)

  userServer.use(bodyParser.json())
  userServer.post('/error', function (req, res) {
    res.status(500).json({ message: 'Webhook target server error' })
  })
  userServer.post('*', function (req, res) {
    const webhookName = req.path.replace('/', '')

    if (!Array.isArray(userServerCalls[webhookName])) userServerCalls[webhookName] = []
    userServerCalls[webhookName].unshift(req.body)

    res.json({ ok: true })
  })

  await new Promise((resolve, reject) => {
    userApp = userServer.listen((err) => {
      if (err) return reject(err)

      // dynamically get a free port
      userServerPort = userApp.address().port

      userWebhookUrl = `http://localhost:${userServerPort}/`

      resolve()
    })
  })

  await createWebhookLogs(t)
})
// test.beforeEach(beforeEach()) // concurrent tests are much faster
test.after(async (t) => {
  await after()(t)
  await userApp.close()
})

// need serial to ensure there is no insertion/deletion during pagination scenario
test.serial('list webhooks', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['webhook:list:all'] })

  await checkCursorPaginationScenario({
    t,
    endpointUrl: '/webhooks',
    authorizationHeaders,
  })
})

test('list webhooks with advanced filters', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['webhook:list:all'] })

  const minDate = '2019-01-01T00:00:00.000Z'

  const { body: obj } = await request(t.context.serverUrl)
    .get(`/webhooks?createdDate[gte]=${encodeURIComponent(minDate)}&active=true`)
    .set(authorizationHeaders)
    .expect(200)

  const checkResultsFn = (t, webhook) => {
    t.true(webhook.active)
    t.true(webhook.createdDate >= minDate)
  }

  checkCursorPaginatedListObject(t, obj, { checkResultsFn })
})

test('list webhooks with custom namespace', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['webhook:list:all'],
    readNamespaces: ['custom']
  })

  const { body: obj } = await request(t.context.serverUrl)
    .get('/webhooks')
    .set(authorizationHeaders)
    .expect(200)

  checkCursorPaginatedListObject(t, obj)

  const webhooks = obj.results

  let hasAtLeastOneCustomNamespace = false
  webhooks.forEach(webhook => {
    hasAtLeastOneCustomNamespace = typeof webhook.platformData._custom !== 'undefined'
  })

  t.true(hasAtLeastOneCustomNamespace)
})

test('finds a webhook', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['webhook:read:all'] })

  const { body: webhook } = await request(t.context.serverUrl)
    .get('/webhooks/whk_SEIfQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .expect(200)

  t.is(webhook.id, 'whk_SEIfQps1I3a1gJYz2I3a')
  t.is(webhook.name, 'Test webhook')
})

test('creates a webhook', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'webhook:create:all',
      'webhook:read:all',
      'asset:create:all',
      'platformData:edit:all'
    ]
  })

  const { body: webhook } = await request(t.context.serverUrl)
    .post('/webhooks')
    .set(authorizationHeaders)
    .send({
      name: 'Custom webhook',
      targetUrl: userWebhookUrl + 'webhook1',
      event: 'asset__created'
    })
    .expect(200)

  t.is(webhook.name, 'Custom webhook')
  t.is(webhook.apiVersion, apiVersions[0]) // we don't specify the api version, so it's the latest
  t.is(userServerCalls.webhook1, undefined)

  const { body: asset } = await request(t.context.serverUrl)
    .post('/assets')
    .set(authorizationHeaders)
    .send({
      name: 'Asset triggering webhook 1',
      assetTypeId: 'typ_MWNfQps1I3a1gJYz2I3a',
      quantity: 0,
      price: 20,
      platformData: {
        platformDataField: 'test'
      }
    })
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, testEventDelay))

  t.is(userServerCalls.webhook1.length, 1)
  t.is(userServerCalls.webhook1[0].event.objectId, asset.id)
  t.is(userServerCalls.webhook1[0].event.object.platformData.platformDataField, 'test')

  const { body: webhookAfterCall } = await request(t.context.serverUrl)
    .get(`/webhooks/${webhook.id}?logs=`)
    .set(authorizationHeaders)
    .expect(200)

  t.is(webhookAfterCall.logs.length, 1)
  t.is(webhookAfterCall.logs[0].status, 'success')
  t.is(webhookAfterCall.logs[0].metadata.eventObjectId, asset.id)
})

test('creates a webhook with specified API version', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'webhook:create:all',
      'webhook:read:all',
      'assetType:create:all',
      'platformData:edit:all'
    ]
  })

  const apiVersion = '2019-05-20'

  const { body: webhook } = await request(t.context.serverUrl)
    .post('/webhooks')
    .set(authorizationHeaders)
    .send({
      name: 'Webhook with version',
      targetUrl: userWebhookUrl + 'webhook2',
      apiVersion,
      event: 'asset_type__created'
    })
    .expect(200)

  t.is(webhook.name, 'Webhook with version')
  t.is(webhook.apiVersion, apiVersion)
  t.is(userServerCalls.webhook2, undefined)

  const { body: assetType } = await request(t.context.serverUrl)
    .post('/asset-types')
    .set(authorizationHeaders)
    .send({
      name: 'Asset type triggering webhook 2',
      timeBased: false,
      infiniteStock: false,
      platformData: {
        platformDataField: 'test'
      }
    })
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, testEventDelay))

  t.is(userServerCalls.webhook2.length, 1)
  t.is(userServerCalls.webhook2[0].event.objectId, assetType.id)
  t.is(userServerCalls.webhook2[0].event.object.platformData.platformDataField, 'test')
  t.truthy(userServerCalls.webhook2[0].event.object.platformData.platformDataField, 'test')

  const { body: webhookAfterCall } = await request(t.context.serverUrl)
    .get(`/webhooks/${webhook.id}?logs=`)
    .set(authorizationHeaders)
    .expect(200)

  t.is(webhookAfterCall.logs.length, 1)
  t.is(webhookAfterCall.logs[0].status, 'success')
  t.is(webhookAfterCall.logs[0].metadata.eventObjectId, assetType.id)
})

test('creates a webhook with a custom event type', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'webhook:create:all',
      'webhook:read:all',
      'event:create:all'
    ]
  })

  const { body: webhook } = await request(t.context.serverUrl)
    .post('/webhooks')
    .set(authorizationHeaders)
    .send({
      name: 'Custom webhook',
      targetUrl: userWebhookUrl + 'customEvent',
      event: 'asset_viewed'
    })
    .expect(200)

  t.is(webhook.name, 'Custom webhook')
  t.is(userServerCalls.customEvent, undefined)

  const { body: event } = await request(t.context.serverUrl)
    .post('/events')
    .set(authorizationHeaders)
    .send({
      type: 'asset_viewed'
    })
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, testEventDelay))

  t.is(userServerCalls.customEvent.length, 1)
  t.is(userServerCalls.customEvent[0].event.id, event.id)

  const { body: webhookAfterCall } = await request(t.context.serverUrl)
    .get(`/webhooks/${webhook.id}?logs=`)
    .set(authorizationHeaders)
    .expect(200)

  t.is(webhookAfterCall.logs.length, 1)
  t.is(webhookAfterCall.logs[0].status, 'success')
})

test('creates a webhook with targetUrl server returning errors', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'webhook:create:all',
      'webhook:read:all',
      'category:create:all'
    ]
  })

  const { body: webhook } = await request(t.context.serverUrl)
    .post('/webhooks')
    .set(authorizationHeaders)
    .send({
      name: 'Custom webhook with targetUrl error',
      targetUrl: userWebhookUrl + 'error',
      event: 'category__created'
    })
    .expect(200)

  const { body: category } = await request(t.context.serverUrl)
    .post('/categories')
    .set(authorizationHeaders)
    .send({
      name: 'Category triggering webhook with targetUrl error',
    })
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, testEventDelay))

  const { body: webhookAfterCall } = await request(t.context.serverUrl)
    .get(`/webhooks/${webhook.id}?logs=`)
    .set(authorizationHeaders)
    .expect(200)

  t.is(webhookAfterCall.logs.length, 1)
  t.is(webhookAfterCall.logs[0].status, 'error')
  t.is(webhookAfterCall.logs[0].metadata.eventObjectId, category.id)
})

test('cannot create a webhook with a invalid event', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['webhook:create:all'] })

  await request(t.context.serverUrl)
    .post('/webhooks')
    .set(authorizationHeaders)
    .send({
      name: 'Custom webhook',
      targetUrl: 'https://example.com',
      event: 'incorrect__event_type'
    })
    .expect(422)

  t.pass()
})

test('updates a webhook', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['webhook:edit:all'] })

  const { body: webhook } = await request(t.context.serverUrl)
    .patch('/webhooks/whk_SEIfQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .send({
      active: true,
      event: 'asset__deleted'
    })
    .expect(200)

  t.is(webhook.id, 'whk_SEIfQps1I3a1gJYz2I3a')
  t.is(webhook.event, 'asset__deleted')
})

test('removes a webhook', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'webhook:read:all',
      'webhook:create:all',
      'webhook:remove:all'
    ]
  })

  const { body: webhook } = await request(t.context.serverUrl)
    .post('/webhooks')
    .set(authorizationHeaders)
    .send({
      name: 'Webhook to remove',
      targetUrl: userWebhookUrl + 'webhookToRemove',
      event: 'category__created'
    })
    .expect(200)

  const { body: payload } = await request(t.context.serverUrl)
    .delete(`/webhooks/${webhook.id}`)
    .set(authorizationHeaders)
    .expect(200)

  t.is(payload.id, webhook.id)

  await request(t.context.serverUrl)
    .get(`/webhooks/${webhook.id}`)
    .set(authorizationHeaders)
    .expect(404)
})

// need serial to ensure there is no insertion/deletion during pagination scenario
test.serial('list webhook logs', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['webhookLog:list:all'] })

  await checkCursorPaginationScenario({
    t,
    endpointUrl: '/webhook-logs',
    authorizationHeaders,
  })
})

test('list webhook logs with id filter', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['webhookLog:list:all'] })

  const { body: { results: webhookLogs } } = await request(t.context.serverUrl)
    .get('/webhook-logs')
    .set(authorizationHeaders)
    .expect(200)

  const webhookLog = webhookLogs[0]

  const { body: obj } = await request(t.context.serverUrl)
    .get(`/webhook-logs?id=${webhookLog.id}`)
    .set(authorizationHeaders)
    .expect(200)

  checkCursorPaginatedListObject(t, obj)
  t.is(obj.results.length, 1)
})

test('list webhook logs with advanced filters', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['webhookLog:list:all'] })

  const now = new Date().toISOString()
  const minDate = computeDate(now, '-10d')

  const {
    entry__created: entryWorkflow,
    message__created: messageWorkflow,
  } = createdWebhooks

  const params = `createdDate[gte]=${encodeURIComponent(minDate)}` +
    `&webhookId[]=${entryWorkflow.id}` +
    `&webhookId[]=${messageWorkflow.id}`

  const { body: obj } = await request(t.context.serverUrl)
    .get(`/webhook-logs?${params}`)
    .set(authorizationHeaders)
    .expect(200)

  const checkResultsFn = (t, webhookLog) => {
    t.true(webhookLog.createdDate >= minDate)
    t.true([entryWorkflow.id, messageWorkflow.id].includes(webhookLog.webhookId))
  }

  checkCursorPaginatedListObject(t, obj, { checkResultsFn })
})

test('finds a webhook log', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'webhookLog:list:all',
      'webhookLog:read:all'
    ]
  })

  const { body: { results: webhookLogs } } = await request(t.context.serverUrl)
    .get('/webhook-logs')
    .set(authorizationHeaders)
    .expect(200)

  const { body: webhookLog } = await request(t.context.serverUrl)
    .get(`/webhook-logs/${webhookLogs[0].id}`)
    .set(authorizationHeaders)
    .expect(200)

  t.is(webhookLog.id, webhookLogs[0].id)
})

// ////////// //
// VALIDATION //
// ////////// //

test('fails to create a webhook if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/webhooks')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // missing required parameters
  result = await request(t.context.serverUrl)
    .post('/webhooks')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({})
    .expect(400)

  error = result.body
  t.true(error.message.includes('"name" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/webhooks')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      name: true,
      targetUrl: true,
      event: true,
      active: 'invalid',
      metadata: true,
      platformData: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"name" must be a string'))
  t.true(error.message.includes('"targetUrl" must be a string'))
  t.true(error.message.includes('"event" must be a string'))
  t.true(error.message.includes('"active" must be a boolean'))
  t.true(error.message.includes('"metadata" must be of type object'))
  t.true(error.message.includes('"platformData" must be of type object'))
})

test('fails to create a webhook with an invalid API version', async (t) => {
  await request(t.context.serverUrl)
    .post('/webhooks')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      name: 'Invalid API version webhook',
      apiVersion: '2016-01-01'
    })
    .expect(400)

  t.pass()
})

test('fails to update a webhook if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .patch('/webhooks/webh_SEIxTFR4SHMx7koS0txovaA3HlHHMxJ')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .patch('/webhooks/webh_SEIxTFR4SHMx7koS0txovaA3HlHHMxJ')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      name: true,
      event: true,
      active: 'invalid',
      metadata: true,
      platformData: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"name" must be a string'))
  t.true(error.message.includes('"event" must be a string'))
  t.true(error.message.includes('"active" must be a boolean'))
  t.true(error.message.includes('"metadata" must be of type object'))
  t.true(error.message.includes('"platformData" must be of type object'))
})

test('fails to update a webhook with an invalid API version', async (t) => {
  await request(t.context.serverUrl)
    .patch('/webhooks/webh_SEIxTFR4SHMx7koS0txovaA3HlHHMxJ')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      apiVersion: '2016-01-01'
    })
    .expect(400)

  t.pass()
})

// //////// //
// VERSIONS //
// //////// //

test('2019-05-20: list webhooks', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    apiVersion: '2019-05-20',
    t,
    permissions: ['webhook:list:all']
  })

  const { body: webhooks } = await request(t.context.serverUrl)
    .get('/webhooks')
    .set(authorizationHeaders)
    .expect(200)

  t.true(Array.isArray(webhooks))
})

test('2019-05-20: list webhooks with custom namespace', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    apiVersion: '2019-05-20',
    t,
    permissions: ['webhook:list:all'],
    readNamespaces: ['custom']
  })

  const { body: webhooks } = await request(t.context.serverUrl)
    .get('/webhooks')
    .set(authorizationHeaders)
    .expect(200)

  t.true(Array.isArray(webhooks))

  let hasAtLeastOneCustomNamespace = false
  webhooks.forEach(webhook => {
    hasAtLeastOneCustomNamespace = typeof webhook.platformData._custom !== 'undefined'
  })

  t.true(hasAtLeastOneCustomNamespace)
})
