require('dotenv').config()

const test = require('ava')
const request = require('supertest')

const { before, beforeEach, after } = require('../../lifecycle')
const { getAccessTokenHeaders } = require('../../auth')
const { computeDate, checkStatsObject, checkHistoryObject } = require('../../util')

test.before(async t => {
  await before({ name: 'event' })(t)
  await beforeEach()(t)
})
// test.beforeEach(beforeEach()) // Concurrent tests are much faster
test.after(after())

const dateFilterErrorRegexp = /createdDate value cannot be lower than \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/i

// run this test serially because there is no filter and some other tests create events
// that can turn the check on `count` property incorrect
test.serial('get events history', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:stats:all',
      'event:list:all'
    ]
  })

  const { body: { results: events } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const groupByValues = ['hour', 'day', 'month']

  for (const groupBy of groupByValues) {
    const { body: dayObj } = await request(t.context.serverUrl)
      .get(`/events/history?groupBy=${groupBy}`)
      .set(authorizationHeaders)
      .expect(200)

    checkHistoryObject({
      t,
      obj: dayObj,
      groupBy,
      results: events
    })
  }
})

test('get events history with filters', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:stats:all',
      'event:list:all'
    ]
  })

  const objectType = 'transaction'
  const objectId = 'trn_Wm1fQps1I3a1gJYz2I3a'
  const filters = `objectType=${objectType}&objectId=${objectId}`

  const { body: { results: events } } = await request(t.context.serverUrl)
    .get(`/events?${filters}`)
    .set(authorizationHeaders)
    .expect(200)

  const groupBy = 'day'

  const { body: obj } = await request(t.context.serverUrl)
    .get(`/events/history?groupBy=${groupBy}&${filters}`)
    .set(authorizationHeaders)
    .expect(200)

  checkHistoryObject({
    t,
    obj,
    groupBy,
    results: events
  })
})

test('get events history with date filter', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:stats:all',
      'event:list:all'
    ]
  })

  const now = new Date().toISOString()

  const objectType = 'transaction'
  const objectId = 'trn_Wm1fQps1I3a1gJYz2I3a'
  const minCreatedDate = computeDate(now, '-10d')
  const filters = `objectType=${objectType}&objectId=${objectId}&createdDate[gte]=${minCreatedDate}`

  const { body: { results: events } } = await request(t.context.serverUrl)
    .get(`/events?${filters}`)
    .set(authorizationHeaders)
    .expect(200)

  const groupBy = 'day'

  const { body: obj } = await request(t.context.serverUrl)
    .get(`/events/history?groupBy=${groupBy}&${filters}`)
    .set(authorizationHeaders)
    .expect(200)

  checkHistoryObject({
    t,
    obj,
    groupBy,
    results: events
  })
})

// run this test serially because there is no filter and some other tests create events
// that can turn the check on `count` property incorrect
test.serial('can apply filters only with created date within the retention log period', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:stats:all',
      'event:list:all'
    ]
  })

  const now = new Date().toISOString()

  const objectType = 'transaction'
  const objectId = 'trn_Wm1fQps1I3a1gJYz2I3a'
  const oldCreatedDate = computeDate(now, '-1y')
  const filters = `objectType=${objectType}&objectId=${objectId}&createdDate[gte]=${oldCreatedDate}`

  const groupBy = 'day'

  await request(t.context.serverUrl)
    .get(`/events/history?groupBy=${groupBy}&${filters}`)
    .set(authorizationHeaders)
    .expect(400)

  const minCreatedDate = computeDate(now, '-10d')

  const { body: { results: events } } = await request(t.context.serverUrl)
    .get(`/events?createdDate[gte]=${minCreatedDate}`)
    .set(authorizationHeaders)
    .expect(200)

  const { body: obj } = await request(t.context.serverUrl)
    .get(`/events/history?groupBy=${groupBy}&createdDate[gte]=${minCreatedDate}`)
    .set(authorizationHeaders)
    .expect(200)

  checkHistoryObject({
    t,
    obj,
    groupBy,
    results: events
  })
})

test('can apply type filter beyond the retention log period', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:stats:all',
    ]
  })

  const now = new Date().toISOString()
  const oldCreatedDate = computeDate(now, '-1y')

  const groupBy = 'day'

  const filtersWithType = `createdDate[gte]=${oldCreatedDate}&type[]=transaction__created&type[]=custom_event`

  const { body: objWithType } = await request(t.context.serverUrl)
    .get(`/events/history?groupBy=${groupBy}&${filtersWithType}`)
    .set(authorizationHeaders)
    .expect(200)

  // cannot check with `checkHistoryObject()` utility function
  // because individual events cannot be retrieved if the date filter is beyond the retention log period
  t.true(typeof objWithType === 'object')
  t.true(typeof objWithType.nbResults === 'number')
  t.true(typeof objWithType.nbPages === 'number')
  t.true(typeof objWithType.page === 'number')
  t.true(typeof objWithType.nbResultsPerPage === 'number')
  t.true(Array.isArray(objWithType.results))

  objWithType.results.forEach(result => {
    t.true(typeof result === 'object')
    t.true(typeof result[groupBy] === 'string')
    t.true(typeof result.count === 'number')
  })
})

// run this test serially because there is no filter and some other tests create events
// that can turn the check on `count` property incorrect
test.serial('get simple events stats', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:stats:all',
      'event:list:all'
    ]
  })

  const { body: { results: events } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const groupBy = 'type'

  const { body: obj } = await request(t.context.serverUrl)
    .get(`/events/stats?groupBy=${groupBy}`)
    .set(authorizationHeaders)
    .expect(200)

  checkStatsObject({
    t,
    obj,
    groupBy,
    results: events
  })
})

test('get simple events stats with nested groupBy', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:stats:all',
      'event:list:all'
    ]
  })

  const { body: { results: events } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const groupBy = 'object.status'

  const { body: obj } = await request(t.context.serverUrl)
    .get(`/events/stats?groupBy=${groupBy}`)
    .set(authorizationHeaders)
    .expect(200)

  checkStatsObject({
    t,
    obj,
    groupBy,
    results: events
  })
})

test('get aggregated field stats', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:stats:all',
      'event:list:all'
    ]
  })

  const { body: { results: events } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const groupBy = 'object.status'
  const field = 'object.value'
  const avgPrecision = 5

  const { body: obj } = await request(t.context.serverUrl)
    .get(`/events/stats?groupBy=${groupBy}&field=${field}&avgPrecision=${avgPrecision}`)
    .set(authorizationHeaders)
    .expect(200)

  checkStatsObject({
    t,
    obj,
    groupBy,
    field,
    avgPrecision,
    results: events
  })
})

test('get aggregated field stats with filters', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:stats:all',
      'event:list:all'
    ]
  })

  const objectType = 'transaction'
  const objectId = 'trn_Wm1fQps1I3a1gJYz2I3a'
  const filters = `objectType=${objectType}&objectId=${objectId}`

  const { body: { results: events } } = await request(t.context.serverUrl)
    .get(`/events?${filters}`)
    .set(authorizationHeaders)
    .expect(200)

  const groupBy = 'object.status'
  const field = 'object.value'

  const { body: obj } = await request(t.context.serverUrl)
    .get(`/events/stats?groupBy=${groupBy}&field=${field}&${filters}`)
    .set(authorizationHeaders)
    .expect(200)

  checkStatsObject({
    t,
    obj,
    groupBy,
    field,
    results: events
  })
})

test('get aggregated field stats with deeply nested properties', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:stats:all',
      'event:list:all'
    ]
  })

  const objectType = 'transaction'
  const filters = `objectType=${objectType}`

  const { body: { results: events } } = await request(t.context.serverUrl)
    .get(`/events?${filters}`)
    .set(authorizationHeaders)
    .expect(200)

  const groupBy = 'object.metadata.otherObject.status'
  const field = 'object.metadata.someObject.someValue'

  const { body: obj } = await request(t.context.serverUrl)
    .get(`/events/stats?groupBy=${groupBy}&field=${field}&${filters}`)
    .set(authorizationHeaders)
    .expect(200)

  checkStatsObject({
    t,
    obj,
    groupBy,
    field,
    results: events
  })

  const groupBy2 = 'object.metadata.otherObject.arrayStatuses[0]'
  const field2 = 'object.metadata.someObject.arrayValues[0].deepArrayValue[0]'

  const { body: obj2 } = await request(t.context.serverUrl)
    .get(`/events/stats?groupBy=${groupBy2}&field=${field2}&${filters}`)
    .set(authorizationHeaders)
    .expect(200)

  checkStatsObject({
    t,
    obj: obj2,
    groupBy: groupBy2,
    field: field2,
    results: events
  })
})

test('get aggregated field stats with complex filters', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:stats:all',
      'event:list:all'
    ]
  })

  const objectType = 'asset'
  const filters = `objectType=${objectType}&metadata[nested][string]=true`

  const { body: { results: events } } = await request(t.context.serverUrl)
    .get(`/events?${filters}`)
    .set(authorizationHeaders)
    .expect(200)

  const groupBy = 'type'
  const field = 'object.price'

  const { body: obj } = await request(t.context.serverUrl)
    .get(`/events/stats?groupBy=${groupBy}&field=${field}&${filters}`)
    .set(authorizationHeaders)
    .expect(200)

  checkStatsObject({
    t,
    obj,
    groupBy,
    field,
    results: events
  })

  const supersetOf = {
    someTags: ['Brown'],
    nested: { object: true },
    name: 'DMC-12'
  }

  const encode = obj => encodeURIComponent(JSON.stringify(obj))

  const filters2 = `objectType=${objectType}&metadata=${encode(supersetOf)}`

  const { body: { results: events2 } } = await request(t.context.serverUrl)
    .get(`/events?${filters2}`)
    .set(authorizationHeaders)
    .expect(200)

  const { body: obj2 } = await request(t.context.serverUrl)
    .get(`/events/stats?groupBy=${groupBy}&field=${field}&${filters2}`)
    .set(authorizationHeaders)
    .expect(200)

  checkStatsObject({
    t,
    obj: obj2,
    groupBy,
    field,
    results: events2
  })

  const assetSupersetOf = {
    customAttributes: {
      seatingCapacity: 4
    },
    validated: true
  }

  const filters3 = `objectType=${objectType}&object=${encode(assetSupersetOf)}`

  const { body: { results: events3 } } = await request(t.context.serverUrl)
    .get(`/events?${filters3}`)
    .set(authorizationHeaders)
    .expect(200)

  const { body: obj3 } = await request(t.context.serverUrl)
    .get(`/events/stats?groupBy=${groupBy}&field=${field}&${filters3}`)
    .set(authorizationHeaders)
    .expect(200)

  checkStatsObject({
    t,
    obj: obj3,
    groupBy,
    field,
    results: events3
  })
})

test('fails to get aggregated stats with non-number field', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:stats:all'
    ]
  })

  const objectType = 'transaction'
  const filters = `objectType=${objectType}`

  const groupBy = 'object.status'
  const field = 'object.createdDate'

  const { body: error } = await request(t.context.serverUrl)
    .get(`/events/stats?groupBy=${groupBy}&field=${field}&${filters}`)
    .set(authorizationHeaders)
    .expect(422)

  t.true(error.message.includes(`Non-number value was found for field "${field}"`))
})

test('aggregation works even if the specified nested property does not exist', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:stats:all'
    ]
  })

  const groupBy = 'object.unknown'
  const field = 'object.unknown2'

  const { body: obj } = await request(t.context.serverUrl)
    .get(`/events/stats?groupBy=${groupBy}&field=${field}`)
    .set(authorizationHeaders)
    .expect(200)

  t.true(typeof obj === 'object')
  t.is(obj.nbResults, 0)
})

// run this test serially because some other tests create events
// that can turn the check on `count` property incorrect
test.serial('get events stats with date filter only works within the rentention log period', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:stats:all',
      'event:list:all'
    ]
  })

  const { body: { results: events } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const groupBy = 'type'

  const now = new Date().toISOString()

  const invalidMinCreatedDate = computeDate(now, '-200d')
  const validMinCreatedDate = computeDate(now, '-10d')
  const encode = obj => encodeURIComponent(JSON.stringify(obj))

  await request(t.context.serverUrl)
    .get(`/events/stats?groupBy=${groupBy}&createdDate[gte]=${invalidMinCreatedDate}`)
    .set(authorizationHeaders)
    .expect(400)

  await request(t.context.serverUrl)
    .get(`/events/stats?groupBy=${groupBy}&createdDate=${encode({ gte: invalidMinCreatedDate })}`)
    .set(authorizationHeaders)
    .expect(400)

  const { body: error } = await request(t.context.serverUrl)
    .get(`/events/stats?groupBy=${groupBy}&createdDate=${invalidMinCreatedDate}`)
    .set(authorizationHeaders)
    .expect(400)

  t.true(dateFilterErrorRegexp.test(error.message))

  const { body: obj } = await request(t.context.serverUrl)
    .get(`/events/stats?groupBy=${groupBy}&createdDate[gte]=${validMinCreatedDate}`)
    .set(authorizationHeaders)
    .expect(200)

  checkStatsObject({
    t,
    obj,
    groupBy,
    results: events.filter(e => e.createdDate >= validMinCreatedDate)
  })
})

test('get events stats only within retention log period', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:stats:all',
    ]
  })

  const groupBy = 'type'

  const { body: obj } = await request(t.context.serverUrl)
    .get(`/events/stats?groupBy=${groupBy}&type=compressed_event`)
    .set(authorizationHeaders)
    .expect(200)

  t.is(obj.nbResults, 0)
})

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

test('list events with date filter only works within the rentention log period', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['event:list:all'] })

  const now = new Date().toISOString()

  const invalidMinCreatedDate = computeDate(now, '-200d')
  const validMinCreatedDate = computeDate(now, '-10d')
  const encode = obj => encodeURIComponent(JSON.stringify(obj))

  const { body: error1 } = await request(t.context.serverUrl)
    .get(`/events?createdDate[gte]=${invalidMinCreatedDate}`)
    .set(authorizationHeaders)
    .expect(400)

  t.true(dateFilterErrorRegexp.test(error1.message))

  const { body: error2 } = await request(t.context.serverUrl)
    .get(`/events?createdDate=${encode({ gte: invalidMinCreatedDate })}`)
    .set(authorizationHeaders)
    .expect(400)

  t.true(dateFilterErrorRegexp.test(error2.message))

  const { body: error3 } = await request(t.context.serverUrl)
    .get(`/events?createdDate=${invalidMinCreatedDate}`)
    .set(authorizationHeaders)
    .expect(400)

  t.true(dateFilterErrorRegexp.test(error3.message))

  const { body: obj } = await request(t.context.serverUrl)
    .get(`/events?createdDate[gte]=${validMinCreatedDate}`)
    .set(authorizationHeaders)
    .expect(200)

  t.is(obj.results.length, obj.nbResults)
  obj.results.forEach(event => {
    t.true(event.createdDate >= validMinCreatedDate)
  })
})

test('list events only within retention log period by default', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['event:list:all'] })

  const { body: obj } = await request(t.context.serverUrl)
    .get('/events?type=compressed_event')
    .set(authorizationHeaders)
    .expect(200)

  t.is(obj.nbResults, 0)
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

  const assetSupersetOf = {
    customAttributes: {
      seatingCapacity: 4
    },
    validated: true
  }

  const checkAssetEvent = event => {
    t.is(event.object.customAttributes.seatingCapacity, 4)
    t.is(event.object.validated, true)
  }

  const { body: obj8 } = await request(t.context.serverUrl)
    .get(`/events?object=${encode(assetSupersetOf)}`)
    .set(authorizationHeaders)
    .expect(200)

  t.is(obj8.results.length, obj8.nbResults)
  t.is(obj8.nbResults, 3)
  obj8.results.forEach(checkAssetEvent)
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
