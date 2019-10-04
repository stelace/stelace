require('dotenv').config()

const test = require('ava')
const request = require('supertest')
const _ = require('lodash')

const { before, beforeEach, after } = require('../../lifecycle')
const { getAccessTokenHeaders } = require('../../auth')

test.before(async (t) => {
  await before({ name: 'batch' })(t)
  await beforeEach()(t)
})
test.after(after())

test('creates a successful batch', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'asset:list:all',
      'asset:read:all',
      'asset:edit:all'
    ]
  })

  const assetId1 = 'ast_2l7fQps1I3a1gJYz2I3a'
  const assetId2 = 'ast_dmM034s1gi81giDergi8'

  const { body: { results: beforeAssets } } = await request(t.context.serverUrl)
    .get(`/assets?id=${assetId1},${assetId2}`)
    .set(authorizationHeaders)
    .expect(200)

  const beforeAsset1 = beforeAssets.find(asset => asset.id === assetId1)
  const beforeAsset2 = beforeAssets.find(asset => asset.id === assetId2)

  t.truthy(beforeAsset1)
  t.is(beforeAsset1.active, false)

  t.truthy(beforeAsset2)
  t.is(beforeAsset2.validated, false)

  const { body: batchResult } = await request(t.context.serverUrl)
    .post('/batch')
    .set(authorizationHeaders)
    .send({
      objectType: 'asset',
      method: 'PATCH',
      objects: [
        {
          objectId: 'ast_2l7fQps1I3a1gJYz2I3a',
          payload: {
            active: true
          }
        },
        {
          objectId: 'ast_dmM034s1gi81giDergi8',
          payload: {
            validated: true
          }
        }
      ]
    })
    .expect(200)

  t.is(typeof batchResult.processingTime, 'number')
  t.is(batchResult.success, true)
  t.true(_.isEmpty(_.difference(
    batchResult.completed,
    ['ast_2l7fQps1I3a1gJYz2I3a', 'ast_dmM034s1gi81giDergi8']
  )))
  t.deepEqual(batchResult.errors, [])

  const { body: { results: afterAssets } } = await request(t.context.serverUrl)
    .get(`/assets?id=${assetId1},${assetId2}`)
    .set(authorizationHeaders)
    .expect(200)

  const afterAsset1 = afterAssets.find(asset => asset.id === assetId1)
  const afterAsset2 = afterAssets.find(asset => asset.id === assetId2)

  t.truthy(afterAsset1)
  t.is(afterAsset1.active, true)

  t.truthy(afterAsset2)
  t.is(afterAsset2.validated, true)
})

test('creating a batch with failed steps returns formatted error', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'asset:edit:all'
    ]
  })

  const { body: batchResult } = await request(t.context.serverUrl)
    .post('/batch')
    .set(authorizationHeaders)
    .send({
      objectType: 'asset',
      method: 'PATCH',
      objects: [
        {
          objectId: 'ast_lCfxJNs10rP1g2Mww0rP',
          payload: {
            active: true
          }
        },
        {
          objectId: 'ast_g29VxDs1DEa1gEk9KDEa',
          payload: {
            validated: '1' // validation error
          }
        },
        {
          objectId: 'ast_QT1QJcs1m0N1gnVvem0N',
          payload: {
            categoryId: 'unknown' // not existing category
          }
        }
      ]
    })
    .expect(400) // has the error status from the first error

  t.is(typeof batchResult.processingTime, 'number')
  t.is(batchResult.success, false)
  t.deepEqual(batchResult.completed, ['ast_lCfxJNs10rP1g2Mww0rP'])
  t.is(batchResult.errors.length, 2)
  t.is(batchResult.errors[0].objectId, 'ast_g29VxDs1DEa1gEk9KDEa')
  t.is(batchResult.errors[1].objectId, 'ast_QT1QJcs1m0N1gnVvem0N')
})

// ////////// //
// VALIDATION //
// ////////// //

test('fails to create a batch if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/batch')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // missing required parameters
  result = await request(t.context.serverUrl)
    .post('/batch')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({})
    .expect(400)

  error = result.body
  t.true(error.message.includes('"objectType" is required'))
  t.true(error.message.includes('"method" is required'))
  t.true(error.message.includes('"objects" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/batch')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      objectType: true,
      method: true,
      objects: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"objectType" must be a string'))
  t.true(error.message.includes('"method" must be a string'))
  t.true(error.message.includes('"objects" must be an array'))
})

test('cannot provide too many batch objects', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'asset:edit:all'
    ]
  })

  // maximum is 100
  const objects = _.times(200, () => {
    return {
      objectId: 'ast_2l7fQps1I3a1gJYz2I3a',
      payload: {
        active: true
      }
    }
  })

  const { body: error } = await request(t.context.serverUrl)
    .post('/batch')
    .set(authorizationHeaders)
    .send({
      objectType: 'asset',
      method: 'PATCH',
      objects
    })
    .expect(400)

  t.true(error.message.includes('"objects" must contain less than'))
})
