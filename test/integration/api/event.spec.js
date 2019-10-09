require('dotenv').config()

const test = require('ava')
const request = require('supertest')

const { before, beforeEach, after } = require('../../lifecycle')
const { getAccessTokenHeaders } = require('../../auth')
const { computeDate } = require('../../util')

test.before(async t => {
  await before({ name: 'event' })(t)
  await beforeEach()(t)
})
// test.beforeEach(beforeEach()) // Concurrent tests are much faster
test.after(after())

test('list events', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['event:list:all'] })

  const result = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const obj = result.body

  t.true(typeof obj === 'object')
  t.true(typeof obj.nbResults === 'number')
  t.true(typeof obj.nbPages === 'number')
  t.true(typeof obj.page === 'number')
  t.true(typeof obj.nbResultsPerPage === 'number')
  t.true(Array.isArray(obj.results))
})

test('list events with id filter', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['event:list:all'] })

  const result = await request(t.context.serverUrl)
    .get('/events?id=evt_WWRfQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .expect(200)

  const obj = result.body

  t.is(typeof obj, 'object')
  t.is(obj.nbResults, 1)
  t.is(obj.nbPages, 1)
  t.is(obj.page, 1)
  t.is(typeof obj.nbResultsPerPage, 'number')
  t.is(obj.results.length, 1)
})

test('list events with filters', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['event:list:all'] })

  const now = new Date().toISOString()

  const result1 = await request(t.context.serverUrl)
    .get('/events?objectType=asset')
    .set(authorizationHeaders)
    .expect(200)

  const obj1 = result1.body

  t.is(obj1.results.length, obj1.nbResults)
  obj1.results.forEach(event => {
    t.true(['asset'].includes(event.objectType))
  })

  const result2 = await request(t.context.serverUrl)
    .get('/events?objectId[]=ast_lCfxJNs10rP1g2Mww0rP')
    .set(authorizationHeaders)
    .expect(200)

  const obj2 = result2.body

  t.is(obj2.results.length, obj2.nbResults)
  t.true(obj2.results.length >= 1)
  obj2.results.forEach(event => {
    t.true(['ast_lCfxJNs10rP1g2Mww0rP'].includes(event.objectId))
  })

  const result3 = await request(t.context.serverUrl)
    .get('/events?objectType=asset')
    .set(authorizationHeaders)
    .expect(200)

  const obj3 = result3.body

  t.is(obj3.results.length, obj3.nbResults)
  t.true(obj3.results.length >= 1)
  obj3.results.forEach(event => {
    t.is(event.objectType, 'asset')
  })

  const result4 = await request(t.context.serverUrl)
    .get('/events?emitter=custom')
    .set(authorizationHeaders)
    .expect(200)

  const obj4 = result4.body

  t.is(obj4.results.length, obj4.nbResults)
  t.true(obj4.results.length >= 1)
  obj4.results.forEach(event => {
    t.is(event.emitter, 'custom')
  })

  const minCreatedDate = computeDate(now, '-1d')

  const result5 = await request(t.context.serverUrl)
    .get(`/events?objectType=asset&createdDate[gte]=${minCreatedDate}`)
    .set(authorizationHeaders)
    .expect(200)

  const obj5 = result5.body

  t.is(obj5.results.length, obj5.nbResults)
  obj5.results.forEach(event => {
    t.true(['asset'].includes(event.objectType))
    t.true(event.createdDate >= minCreatedDate)
  })

  const futureDate = computeDate(now, '5y')
  const encode = obj => encodeURIComponent(JSON.stringify(obj))

  const { body: obj5b } = await request(t.context.serverUrl)
    .get(`/events?createdDate=${encode({ gte: futureDate })}`) // alternative list query syntax
    .set(authorizationHeaders)
    .expect(200)

  t.is(obj5b.nbResults, 1)
  obj5b.results.forEach(event => {
    t.true(event.createdDate >= futureDate)
  })

  const { body: obj6 } = await request(t.context.serverUrl)
    .get('/events?emitterId=random')
    .set(authorizationHeaders)
    .expect(200)

  t.is(obj6.results.length, obj6.nbResults)
  obj6.results.forEach(event => {
    t.true(['random'].includes(event.emitterId))
  })

  const { body: obj7 } = await request(t.context.serverUrl)
    .get('/events?type=future_event')
    .set(authorizationHeaders)
    .expect(200)

  t.is(obj7.results.length, obj7.nbResults)
  obj7.results.forEach(event => {
    t.is(event.type, 'future_event')
  })
})

test('list events with metadata object filters', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['event:list:all'] })

  const { body: obj1 } = await request(t.context.serverUrl)
    .get('/events?metadata[name]=DMC-12')
    .set(authorizationHeaders)
    .expect(200)

  t.is(obj1.results.length, obj1.nbResults)
  t.is(obj1.nbResults, 1)
  obj1.results.forEach(event => {
    t.is(event.metadata.name, 'DMC-12')
  })

  const { body: obj2 } = await request(t.context.serverUrl)
    .get('/events?metadata[nested][string]=true')
    .set(authorizationHeaders)
    .expect(200)

  t.is(obj2.results.length, obj2.nbResults)
  t.is(obj2.nbResults, 2)
  obj2.results.forEach(event => {
    t.is(event.metadata.nested.string, 'true')
  })

  const { body: obj3 } = await request(t.context.serverUrl)
    .get('/events?metadata[name]=DMC-12&metadata[nested][string]=true')
    .set(authorizationHeaders)
    .expect(200)

  t.is(obj3.results.length, obj3.nbResults)
  t.is(obj3.nbResults, 1)
  obj3.results.forEach(event => {
    t.is(event.metadata.name, 'DMC-12')
    t.is(event.metadata.nested.string, 'true')
  })

  const { body: obj4 } = await request(t.context.serverUrl)
    .get('/events?metadata[name]=DMC-12&metadata[nested][string]=false')
    .set(authorizationHeaders)
    .expect(200)

  t.is(obj4.results.length, obj4.nbResults)
  t.is(obj4.nbResults, 0)

  const supersetOf = {
    someTags: ['Brown'],
    nested: { object: true },
    name: 'DMC-12'
  }
  const encode = obj => encodeURIComponent(JSON.stringify(obj))
  const checkEvent = event => {
    t.is(event.metadata.name, 'DMC-12')
    t.true(supersetOf.someTags.every(t => event.metadata.someTags.includes(t)))
    t.is(event.metadata.nested.object, supersetOf.nested.object)
  }

  const { body: obj5 } = await request(t.context.serverUrl)
    .get(`/events?metadata=${encode(supersetOf)}`)
    .set(authorizationHeaders)
    .expect(200)

  t.is(obj5.results.length, obj5.nbResults)
  t.is(obj5.nbResults, 1)
  obj5.results.forEach(checkEvent)

  await request(t.context.serverUrl)
    // can’t mix syntaxes
    .get(`/events?metadata=${encode(supersetOf)}&metadata[nested][string]=true`)
    .set(authorizationHeaders)
    .expect(400)

  supersetOf.nested.object = 'true' // string instead of boolean
  const { body: obj6 } = await request(t.context.serverUrl)
    .get(`/events?metadata=${encode(supersetOf)}`)
    .set(authorizationHeaders)
    .expect(200)

  t.is(obj6.results.length, obj6.nbResults)
  t.is(obj6.nbResults, 0)

  supersetOf.nested.object = false // false instead of true
  const { body: obj7 } = await request(t.context.serverUrl)
    .get(`/events?metadata=${encode(supersetOf)}`)
    .set(authorizationHeaders)
    .expect(200)

  t.is(obj7.results.length, obj7.nbResults)
  t.is(obj7.nbResults, 0)
})

test('finds an event', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['event:read:all'] })

  const result = await request(t.context.serverUrl)
    .get('/events/evt_WWRfQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .expect(200)

  const event = result.body

  t.is(event.id, 'evt_WWRfQps1I3a1gJYz2I3a')
})

test('creates an event', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['event:create:all']
  })

  const { body: event } = await request(t.context.serverUrl)
    .post('/events')
    .set(authorizationHeaders)
    .send({
      type: 'asset_viewed',
      metadata: {
        assetId: 'ast_2l7fQps1I3a1gJYz2I3a'
      }
    })
    .expect(200)

  t.is(event.type, 'asset_viewed')
  t.is(event.emitter, 'custom')
  t.is(event.emitterId, null)
  t.is(event.metadata.assetId, 'ast_2l7fQps1I3a1gJYz2I3a')
  t.is(event.objectType, null)
})

test('creates an event with an objectId', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'asset:read:all',
      'event:create:all'
    ]
  })

  const assetId = 'ast_2l7fQps1I3a1gJYz2I3a'

  const { body: asset } = await request(t.context.serverUrl)
    .get(`/assets/${assetId}`)
    .set(authorizationHeaders)
    .expect(200)

  const { body: event } = await request(t.context.serverUrl)
    .post('/events')
    .set(authorizationHeaders)
    .send({
      type: 'asset_viewed',
      objectId: assetId
    })
    .expect(200)

  t.is(event.type, 'asset_viewed')
  t.is(event.emitter, 'custom')
  t.is(event.emitterId, null)
  t.is(event.objectId, assetId)
  t.true(typeof event.object === 'object')
  t.truthy(event.object)
  t.is(event.objectType, 'asset')

  t.is(event.object.id, asset.id)
  t.is(event.object.name, asset.name)
})

test('creates an event with an emitterId', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'asset:read:all',
      'event:create:all'
    ]
  })

  const assetId = 'ast_2l7fQps1I3a1gJYz2I3a'

  const { body: asset } = await request(t.context.serverUrl)
    .get(`/assets/${assetId}`)
    .set(authorizationHeaders)
    .expect(200)

  const { body: event } = await request(t.context.serverUrl)
    .post('/events')
    .set(authorizationHeaders)
    .send({
      type: 'asset_viewed',
      objectId: assetId,
      emitterId: 'random-emitter'
    })
    .expect(200)

  t.is(event.type, 'asset_viewed')
  t.is(event.emitter, 'custom')
  t.is(event.emitterId, 'random-emitter')
  t.is(event.objectId, assetId)
  t.true(typeof event.object === 'object')
  t.truthy(event.object)
  t.is(event.objectType, 'asset')

  t.is(event.object.id, asset.id)
  t.is(event.object.name, asset.name)
})

test('cannot create an event with a core format type', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['event:create:all']
  })

  await request(t.context.serverUrl)
    .post('/events')
    .set(authorizationHeaders)
    .send({
      type: 'asset__viewed',
      metadata: {
        assetId: 'ast_2l7fQps1I3a1gJYz2I3a'
      }
    })
    .expect(422)

  t.pass()
})

// ////////// //
// VALIDATION //
// ////////// //

test('fails to create an event if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/events')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // missing required parameters
  result = await request(t.context.serverUrl)
    .post('/events')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({})
    .expect(400)

  error = result.body
  t.true(error.message.includes('"type" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/events')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      type: true,
      objectId: true,
      emitterId: true,
      metadata: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"type" must be a string'))
  t.true(error.message.includes('"objectId" must be a string'))
  t.true(error.message.includes('"emitterId" must be a string'))
  t.true(error.message.includes('"metadata" must be of type object'))
})
