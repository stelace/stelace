require('dotenv').config()

const test = require('ava')
const request = require('supertest')

const { before, beforeEach, after } = require('../../lifecycle')
const { getAccessTokenHeaders } = require('../../auth')
const {
  computeDate,
  getObjectEvent,
  testEventMetadata,
  checkOffsetPaginationScenario
} = require('../../util')

test.before(async t => {
  await before({ name: 'availability' })(t)
  await beforeEach()(t)
})
// test.beforeEach(beforeEach()) // Concurrent tests are much faster
test.after(after())

// availability graph logic is tested in unit test
// test/unit/util/availability.spec.js
test('get availabilities graph', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['availability:list:all'] })

  const { body: graph } = await request(t.context.serverUrl)
    .get('/availabilities/graph?assetId=ast_0TYM7rs1OwP1gQRuCOwP')
    .set(authorizationHeaders)
    .expect(200)

  t.true(typeof graph.defaultQuantity === 'number')
  t.true(typeof graph.totalUsedQuantity === 'number')
  t.true(Array.isArray(graph.graphDates))

  graph.graphDates.forEach(graphDate => {
    t.true(typeof graphDate.date === 'string')
    t.true(typeof graphDate.usedQuantity === 'number')
    t.true(typeof graphDate.availableQuantity === 'number')
  })
})

// need serial to ensure there is no insertion/deletion during pagination scenario
test.serial('list availabilities with pagination', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['availability:list:all'] })

  await checkOffsetPaginationScenario({
    t,
    endpointUrl: '/availabilities?assetId=ast_0TYM7rs1OwP1gQRuCOwP',
    authorizationHeaders,
  })
})

test('creates an availability with a fixed quantity', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['availability:create:all'] })

  const now = new Date().toISOString()

  const startDate = computeDate(now, '10 days')
  const endDate = computeDate(now, '14 days')

  const result = await request(t.context.serverUrl)
    .post('/availabilities')
    .set(authorizationHeaders)
    .send({
      assetId: 'ast_0TYM7rs1OwP1gQRuCOwP',
      startDate,
      endDate,
      quantity: 1,
      metadata: { dummy: true }
    })
    .expect(200)

  const availability = result.body

  t.is(availability.startDate, startDate)
  t.is(availability.endDate, endDate)
  t.is(availability.quantity, 1)
  t.is(availability.assetId, 'ast_0TYM7rs1OwP1gQRuCOwP')
  t.is(availability.metadata.dummy, true)
})

test('creates an availability with a relative quantity', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['availability:create:all'] })

  const now = new Date().toISOString()

  const startDate = computeDate(now, '10 days')
  const endDate = computeDate(now, '14 days')

  const result = await request(t.context.serverUrl)
    .post('/availabilities')
    .set(authorizationHeaders)
    .send({
      assetId: 'ast_0TYM7rs1OwP1gQRuCOwP',
      startDate,
      endDate,
      quantity: '+1',
      metadata: { dummy: true }
    })
    .expect(200)

  const availability = result.body

  t.is(availability.startDate, startDate)
  t.is(availability.endDate, endDate)
  t.is(availability.quantity, '+1')
  t.is(availability.assetId, 'ast_0TYM7rs1OwP1gQRuCOwP')
  t.is(availability.metadata.dummy, true)
})

test('creates an availability with fixed quantity recurring available periods', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['availability:create:all'] })

  const now = new Date().toISOString()

  const startDate = computeDate(now, '10 days')
  const endDate = computeDate(now, '20 days')

  const result = await request(t.context.serverUrl)
    .post('/availabilities')
    .set(authorizationHeaders)
    .send({
      assetId: 'ast_0TYM7rs1OwP1gQRuCOwP',
      startDate,
      endDate,
      quantity: 1,
      recurringPattern: '0 0 * * 2',
      recurringDuration: { d: 2 },
      recurringTimezone: 'Europe/London',
      metadata: { dummy: true }
    })
    .expect(200)

  const availability = result.body

  t.is(availability.startDate, startDate)
  t.is(availability.endDate, endDate)
  t.is(availability.quantity, 1)
  t.is(availability.assetId, 'ast_0TYM7rs1OwP1gQRuCOwP')
  t.is(availability.recurringPattern, '0 0 * * 2')
  t.is(availability.recurringTimezone, 'Europe/London')
  t.deepEqual(availability.recurringDuration, { d: 2 })
  t.is(availability.metadata.dummy, true)
})

test('creates an availability with relative quantity recurring available periods', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['availability:create:all'] })

  const now = new Date().toISOString()

  const startDate = computeDate(now, '10 days')
  const endDate = computeDate(now, '20 days')

  const result = await request(t.context.serverUrl)
    .post('/availabilities')
    .set(authorizationHeaders)
    .send({
      assetId: 'ast_0TYM7rs1OwP1gQRuCOwP',
      startDate,
      endDate,
      quantity: '+1',
      recurringPattern: '0 0 * * 2',
      recurringDuration: { d: 2 },
      recurringTimezone: 'Europe/London',
      metadata: { dummy: true }
    })
    .expect(200)

  const availability = result.body

  t.is(availability.startDate, startDate)
  t.is(availability.endDate, endDate)
  t.is(availability.quantity, '+1')
  t.is(availability.assetId, 'ast_0TYM7rs1OwP1gQRuCOwP')
  t.is(availability.recurringPattern, '0 0 * * 2')
  t.is(availability.recurringTimezone, 'Europe/London')
  t.deepEqual(availability.recurringDuration, { d: 2 })
  t.is(availability.metadata.dummy, true)
})

test('fails to create a recurring period availability with a very distant end date', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['availability:create:all'] })

  const now = new Date().toISOString()

  const startDate = computeDate(now, '10 days')
  const endDate = computeDate(now, '400 days')

  await request(t.context.serverUrl)
    .post('/availabilities')
    .set(authorizationHeaders)
    .send({
      assetId: 'ast_0TYM7rs1OwP1gQRuCOwP',
      startDate,
      endDate,
      quantity: '+1',
      recurringPattern: null,
      recurringTimezone: null,
      recurringDuration: null,
      metadata: { dummy: true }
    })
    .expect(200)

  await request(t.context.serverUrl)
    .post('/availabilities')
    .set(authorizationHeaders)
    .send({
      assetId: 'ast_0TYM7rs1OwP1gQRuCOwP',
      startDate,
      endDate,
      quantity: '+1',
      recurringPattern: '0 0 * * 2',
      recurringDuration: { d: 2 },
      recurringTimezone: 'Europe/London',
      metadata: { dummy: true }
    })
    .expect(422)

  t.pass()
})

test('fails to create an availability with invalid recurring periods parameters', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['availability:create:all'] })

  const now = new Date().toISOString()

  const startDate = computeDate(now, '10 days')
  const endDate = computeDate(now, '20 days')

  await request(t.context.serverUrl)
    .post('/availabilities')
    .set(authorizationHeaders)
    .send({
      assetId: 'ast_0TYM7rs1OwP1gQRuCOwP',
      startDate,
      endDate,
      quantity: '+1',
      recurringPattern: '* * * * 2', // pattern in seconds while duration in days (overlapped periods)
      recurringTimezone: 'Europe/London',
      recurringDuration: { d: 2 },
      metadata: { dummy: true }
    })
    .expect(422)

  await request(t.context.serverUrl)
    .post('/availabilities')
    .set(authorizationHeaders)
    .send({
      assetId: 'ast_0TYM7rs1OwP1gQRuCOwP',
      startDate,
      endDate,
      quantity: '+1',
      recurringPattern: '0 0 * * 2',
      recurringTimezone: 'Europe/Unknown', // invalid timezone
      recurringDuration: { d: 2 },
      metadata: { dummy: true }
    })
    .expect(400)

  await request(t.context.serverUrl)
    .post('/availabilities')
    .set(authorizationHeaders)
    .send({
      assetId: 'ast_0TYM7rs1OwP1gQRuCOwP',
      startDate,
      endDate,
      quantity: '+1',
      recurringPattern: '0 0 * * 2', // missing recurring parameters
      metadata: { dummy: true }
    })
    .expect(400)

  t.pass()
})

test('updates an availability with a fixed quantity', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['availability:edit:all'] })

  const now = new Date().toISOString()
  const startDate = computeDate(now, '1 day')

  const result = await request(t.context.serverUrl)
    .patch('/availabilities/avl_ZnRfQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .send({
      startDate,
      quantity: 0,
      metadata: { dummy: true }
    })
    .expect(200)

  const availability = result.body

  t.is(availability.id, 'avl_ZnRfQps1I3a1gJYz2I3a')
  t.is(availability.startDate, startDate)
  t.is(availability.quantity, 0)
  t.is(availability.assetId, 'ast_0TYM7rs1OwP1gQRuCOwP')
  t.is(availability.metadata.dummy, true)
})

test('updates an availability with a relative quantity', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['availability:edit:all'] })

  const now = new Date().toISOString()
  const startDate = computeDate(now, '1 day')

  const availabilityId = 'avl_2Rm9Ane1tQD1iMCaltQC'

  const result = await request(t.context.serverUrl)
    .patch(`/availabilities/${availabilityId}`)
    .set(authorizationHeaders)
    .send({
      startDate,
      quantity: '+2',
      metadata: { dummy: true }
    })
    .expect(200)

  const availability = result.body

  t.is(availability.id, availabilityId)
  t.is(availability.startDate, startDate)
  t.is(availability.quantity, '+2')
  t.is(availability.assetId, 'ast_lCfxJNs10rP1g2Mww0rP')
  t.is(availability.metadata.dummy, true)
})

test('updates an availability with recurring available periods parameters', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['availability:edit:all'] })

  const now = new Date().toISOString()
  const startDate = computeDate(now, '1 day')

  const result = await request(t.context.serverUrl)
    .patch('/availabilities/avl_AGW3Dge1x1M1iPnjox1L')
    .set(authorizationHeaders)
    .send({
      startDate,
      quantity: '+1',
      recurringPattern: '0 0 * * 2',
      recurringTimezone: 'Europe/London',
      recurringDuration: { d: 2 },
      metadata: { dummy: true }
    })
    .expect(200)

  const availability = result.body

  t.is(availability.id, 'avl_AGW3Dge1x1M1iPnjox1L')
  t.is(availability.startDate, startDate)
  t.is(availability.quantity, '+1')
  t.is(availability.assetId, 'ast_lCfxJNs10rP1g2Mww0rP')
  t.is(availability.recurringPattern, '0 0 * * 2')
  t.is(availability.recurringTimezone, 'Europe/London')
  t.deepEqual(availability.recurringDuration, { d: 2 })
  t.is(availability.metadata.dummy, true)
})

test('fails to update an availability with invalid recurring periods', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['availability:edit:all'] })

  await request(t.context.serverUrl)
    .patch('/availabilities/avl_m7Gq0Fe13L71hW6Cn3L6')
    .set(authorizationHeaders)
    .send({
      quantity: '+1',
      recurringPattern: '* * * * *', // pattern in seconds while duration in days (overlapped periods)
      recurringTimezone: 'Europe/London',
      recurringDuration: { d: 2 },
      metadata: { dummy: true }
    })
    .expect(422)

  await request(t.context.serverUrl)
    .patch('/availabilities/avl_m7Gq0Fe13L71hW6Cn3L6')
    .set(authorizationHeaders)
    .send({
      quantity: '+1',
      recurringPattern: '0 0 * * 2',
      recurringTimezone: 'Europe/Unknown', // invalid timezone
      recurringDuration: { d: 2 },
      metadata: { dummy: true }
    })
    .expect(400)

  await request(t.context.serverUrl)
    .patch('/availabilities/avl_m7Gq0Fe13L71hW6Cn3L6')
    .set(authorizationHeaders)
    .send({
      quantity: '+1',
      recurringPattern: '0 0 * * 2', // missing recurring parameters
      metadata: { dummy: true }
    })
    .expect(400)

  t.pass()
})

test('fails to update an availability with a very distant end date', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'availability:create:all',
      'availability:edit:all'
    ]
  })

  const now = new Date().toISOString()

  const endDate = computeDate(now, '400 days')

  await request(t.context.serverUrl)
    .patch('/availabilities/avl_m7Gq0Fe13L71hW6Cn3L6')
    .set(authorizationHeaders)
    .send({
      quantity: '+1',
      endDate,
      metadata: { dummy: true }
    })
    .expect(200)

  const { body: recurringAvailability } = await request(t.context.serverUrl)
    .post('/availabilities')
    .set(authorizationHeaders)
    .send({
      assetId: 'ast_0TYM7rs1OwP1gQRuCOwP',
      startDate: now,
      endDate: computeDate(now, '10d'),
      quantity: '+1',
      recurringPattern: '0 0 * * 2',
      recurringDuration: { d: 2 },
      recurringTimezone: 'Europe/London',
      metadata: { dummy: true }
    })
    .expect(200)

  await request(t.context.serverUrl)
    .patch(`/availabilities/${recurringAvailability.id}`)
    .set(authorizationHeaders)
    .send({
      quantity: '+1',
      endDate,
      metadata: { dummy: true }
    })
    .expect(422)

  t.pass()
})

test('removes an availability', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'availability:list:all',
      'availability:create:all',
      'availability:remove:all'
    ]
  })

  const now = new Date().toISOString()

  const { body: availability } = await request(t.context.serverUrl)
    .post('/availabilities')
    .set(authorizationHeaders)
    .send({
      assetId: 'ast_0TYM7rs1OwP1gQRuCOwP',
      startDate: computeDate(now, '-4 days'),
      endDate: computeDate(now, '-2 days'),
      quantity: 0,
      metadata: { dummy: true }
    })
    .expect(200)

  const result = await request(t.context.serverUrl)
    .delete(`/availabilities/${availability.id}`)
    .set(authorizationHeaders)
    .expect(200)

  const payload = result.body

  t.is(payload.id, availability.id)

  const { body: { results: availabilityAfterRemoval } } = await request(t.context.serverUrl)
    .get('/availabilities?assetId=ast_0TYM7rs1OwP1gQRuCOwP')
    .set(authorizationHeaders)
    .expect(200)

  t.falsy(availabilityAfterRemoval.find(av => av.id === availability.id))
})

// ////////// //
// VALIDATION //
// ////////// //

test('fails to create an availability if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/availabilities')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // missing required parameters
  result = await request(t.context.serverUrl)
    .post('/availabilities')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({})
    .expect(400)

  error = result.body
  t.true(error.message.includes('"assetId" is required'))
  t.true(error.message.includes('"startDate" is required'))
  t.true(error.message.includes('"endDate" is required'))
  t.true(error.message.includes('"quantity" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/availabilities')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      assetId: true,
      startDate: 10,
      endDate: 10,
      quantity: 'test',
      recurringPattern: true,
      recurringTimezone: true,
      recurringDuration: true,
      metadata: true,
      platformData: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"startDate" must be a string'))
  t.true(error.message.includes('"endDate" must be a string'))
  t.regex(error.message, /"quantity" .* fails to match the signed number pattern/)
  t.true(error.message.includes('"recurringPattern" must be a string'))
  t.true(error.message.includes('"recurringTimezone" must be a string'))
  t.true(error.message.includes('"recurringDuration" must be of type object'))
  t.true(error.message.includes('"metadata" must be of type object'))
  t.true(error.message.includes('"platformData" must be of type object'))
})

test('fails to update an availability if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .patch('/availabilities/avl_ZnRfQps1I3a1gJYz2I3a')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .patch('/availabilities/avl_ZnRfQps1I3a1gJYz2I3a')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      startDate: 10,
      endDate: 10,
      quantity: -1,
      recurringPattern: true,
      recurringTimezone: true,
      recurringDuration: true,
      metadata: true,
      platformData: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"startDate" must be a string'))
  t.true(error.message.includes('"endDate" must be a string'))
  t.true(error.message.includes('"quantity" must be larger than or equal to 0'))
  t.true(error.message.includes('"recurringPattern" must be a string'))
  t.true(error.message.includes('"recurringTimezone" must be a string'))
  t.true(error.message.includes('"recurringDuration" must be of type object'))
  t.true(error.message.includes('"metadata" must be of type object'))
  t.true(error.message.includes('"platformData" must be of type object'))
})

// ////// //
// EVENTS //
// ////// //

// Event tests must run serially before the other tests
test.serial('generates availability__* events', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'availability:create:all',
      'availability:edit:all',
      'availability:remove:all',
      'event:list:all'
    ],
    readNamespaces: ['custom'],
    editNamespaces: ['custom']
  })

  const assetId = 'ast_0TYM7rs1OwP1gQRuCOwP'
  const now = new Date().toISOString()

  const startDate = computeDate(now, '10 days')
  const endDate = computeDate(now, '14 days')
  const newEndDate = computeDate(now, '18 days')

  const { body: availability } = await request(t.context.serverUrl)
    .post('/availabilities')
    .set(authorizationHeaders)
    .send({
      assetId,
      startDate,
      endDate,
      quantity: 1,
      metadata: { _custom: { hasDataInNamespace: true } }
    })
    .expect(200)

  const patchPayload = {
    startDate,
    endDate: newEndDate,
    quantity: 2,
    metadata: { _custom: { hasAdditionalDataInNamespace: true } }
  }

  const { body: availabilityUpdated } = await request(t.context.serverUrl)
    .patch(`/availabilities/${availability.id}`)
    .set(authorizationHeaders)
    .send(patchPayload)
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, 300))

  const { body: { results: events } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const availabilityCreatedEvent = getObjectEvent({
    events,
    eventType: 'availability__created',
    objectId: availability.id
  })
  await testEventMetadata({
    event: availabilityCreatedEvent,
    object: availability,
    t
  })
  /* // EXAMPLE: testEventMetadata replaces
  t.truthy(availabilityCreatedEvent)
  t.is(availabilityCreatedEvent.objectType, 'availability')
  t.is(availabilityCreatedEvent.objectId, availability.id)
  t.is(availabilityCreatedEvent.object.id, availability.id)
  t.deepEqual(availabilityCreatedEvent.metadata, availability.metadata)
  t.deepEqual(availabilityCreatedEvent.platformData, availability.platformData)
  t.is(availabilityCreatedEvent.changesRequested, null)
  t.is(availabilityCreatedEvent.relatedObjectsIds.assetId, assetId) */
  t.is(availabilityCreatedEvent.object.quantity, availability.quantity)
  t.is(availabilityCreatedEvent.object.startDate, availability.startDate)
  t.is(availabilityCreatedEvent.object.endDate, availability.endDate)
  t.is(availabilityCreatedEvent.object.metadata._custom.hasDataInNamespace, true)
  t.not(availabilityCreatedEvent.object.metadata._custom.hasAdditionalDataInNamespace, true)

  const availabilityUpdatedEvent = getObjectEvent({
    events,
    eventType: 'availability__updated',
    objectId: availabilityUpdated.id
  })
  await testEventMetadata({
    event: availabilityUpdatedEvent,
    object: availabilityUpdated,
    t,
    patchPayload
  })
  /* // EXAMPLE: testEventMetadata replaces
  t.truthy(availabilityUpdatedEvent)
  t.is(availabilityUpdatedEvent.objectType, 'availability')
  t.is(availabilityUpdatedEvent.objectId, availability.id)
  t.is(availabilityUpdatedEvent.object.id, availability.id)
  t.is(availabilityUpdatedEvent.object.id, availabilityUpdated.id)
  t.deepEqual(availabilityUpdatedEvent.metadata, availabilityUpdated.metadata)
  t.deepEqual(availabilityUpdatedEvent.platformData,
    availabilityUpdated.platformData)
  t.deepEqual(availabilityUpdatedEvent.changesRequested, patchPayload)
  t.is(availabilityUpdatedEvent.relatedObjectsIds.assetId, assetId) */
  t.is(availabilityUpdatedEvent.object.quantity, availabilityUpdated.quantity)
  t.is(availabilityUpdatedEvent.object.startDate, availabilityUpdated.startDate)
  t.is(availabilityUpdatedEvent.object.endDate, availabilityUpdated.endDate)
  t.is(availabilityUpdatedEvent.object.metadata._custom.hasDataInNamespace, true)
  t.is(availabilityUpdatedEvent.object.metadata._custom.hasAdditionalDataInNamespace, true)

  await request(t.context.serverUrl)
    .delete(`/availabilities/${availabilityUpdated.id}`)
    .set(authorizationHeaders)
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, 300))

  const { body: { results: eventsAfterDelete } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const availabilityDeletedEvent = getObjectEvent({
    events: eventsAfterDelete,
    eventType: 'availability__deleted',
    objectId: availabilityUpdated.id
  })
  await testEventMetadata({
    event: availabilityDeletedEvent,
    object: availabilityUpdated,
    t
  })
})
