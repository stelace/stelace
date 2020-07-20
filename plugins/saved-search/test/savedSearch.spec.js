require('dotenv').config()

const test = require('ava')
const request = require('supertest')

const {
  testTools: {
    lifecycle,
    auth,
    fixtures: { search: searchFixtures },
    util: { checkOffsetPaginationScenario }
  },
  utils: {
    time: { computeDate }
  }
} = require('../../serverTooling')

const { before, beforeEach, after } = lifecycle
const { getAccessTokenHeaders } = auth
const { initElasticsearch, fixturesParams } = searchFixtures

const savedSearchIds = {}
let initNow
const {
  ownerId,
  assetsIds,
} = fixturesParams

test.before(async t => {
  await before({ name: 'savedSearch' })(t)
  await beforeEach()(t)

  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'savedSearch:create:all',
    ],
    userId: ownerId
  })

  initNow = await initElasticsearch({ t })

  const { body: savedSearch1 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      name: 'Saved search 1',
      query: 'Toyota',
      assetTypeId: ['typ_MnkfQps1I3a1gJYz2I3a'],
      save: true
    })
    .expect(200)

  savedSearchIds.savedSearch1 = savedSearch1.id

  const { body: savedSearch2 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      name: 'Saved search 2',
      // match assets 6 and 8
      customAttributes: { options: 'sunroof' },
      createdBefore: computeDate(initNow, '1h'),
      createdAfter: computeDate(initNow, '-1h'),
      save: true
    })
    .expect(200)

  savedSearchIds.savedSearch2 = savedSearch2.id

  await new Promise(resolve => setTimeout(resolve, 300))
})
// test.beforeEach(beforeEach()) // Concurrent tests are much faster
test.after(after())

// need serial to ensure there is no insertion/deletion during pagination scenario
test.serial('lists saved searches with pagination', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['savedSearch:list:all'] })

  await checkOffsetPaginationScenario({
    t,
    endpointUrl: '/search',
    authorizationHeaders,
  })
})

test('lists saved searches with id filter', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['savedSearch:list:all'] })

  const result = await request(t.context.serverUrl)
    .get('/search?id=sch_2l7fQps1I3a1gJYz2I3a,sch_emdfQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .expect(200)

  const obj = result.body

  t.is(typeof obj, 'object')
  t.is(obj.nbResults, 2)
  t.is(obj.nbPages, 1)
  t.is(obj.page, 1)
  t.is(typeof obj.nbResultsPerPage, 'number')
  t.is(obj.results.length, 2)

  obj.results.forEach(savedSearch => {
    t.true(['sch_2l7fQps1I3a1gJYz2I3a', 'sch_emdfQps1I3a1gJYz2I3a'].includes(savedSearch.id))
  })
})

test('lists saved searches with advanced filter', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['savedSearch:list:all'] })

  const result1 = await request(t.context.serverUrl)
    .get('/search?userId=usr_WHlfQps1I3a1gJYz2I3a,user-external-id')
    .set(authorizationHeaders)
    .expect(200)

  const obj1 = result1.body

  t.is(obj1.results.length, obj1.nbResults)
  obj1.results.forEach(savedSearch => {
    t.true(['usr_WHlfQps1I3a1gJYz2I3a', 'user-external-id'].includes(savedSearch.userId))
  })

  const result2 = await request(t.context.serverUrl)
    .get('/search?userId[]=usr_WHlfQps1I3a1gJYz2I3a&userId[]=user-external-id')
    .set(authorizationHeaders)
    .expect(200)

  const obj2 = result2.body

  t.is(obj2.results.length, obj2.nbResults)
  obj2.results.forEach(savedSearch => {
    t.true(['usr_WHlfQps1I3a1gJYz2I3a', 'user-external-id'].includes(savedSearch.userId))
  })
})

test('finds a saved search', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['savedSearch:read:all'] })

  const { body: savedSearch } = await request(t.context.serverUrl)
    .get('/search/sch_2l7fQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .expect(200)

  t.is(savedSearch.id, 'sch_2l7fQps1I3a1gJYz2I3a')
  t.is(savedSearch.userId, 'user-external-id')
  t.is(savedSearch.name, 'My saved search')
  t.is(savedSearch.search.assetTypeId, 'typ_RFpfQps1I3a1gJYz2I3a')
  t.is(savedSearch.active, true)
  t.deepEqual(savedSearch.metadata.existingData, [true])
})

test('creates a saved search', async (t) => {
  const userId = 'user-external-id'

  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['savedSearch:create:all'],
    userId
  })

  const search = {
    query: 'Honda',
    assetTypeId: ['typ_rL6IBMe1wlK1iJ9NNwlK'],
    location: {
      latitude: 0,
      longitude: 0
    },
    quantity: 2,
  }

  const payload = {
    ...search,
    name: 'My cars',
    save: true,
    metadata: { dummy: true }
  }

  const { body: savedSearch } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send(payload)
    .expect(200)

  t.is(savedSearch.name, payload.name)
  t.is(savedSearch.userId, userId)
  t.deepEqual(savedSearch.search, search)
  t.is(savedSearch.active, true)
  t.is(savedSearch.metadata.dummy, true)
})

test('fails to create a saved search with an invalid query', async (t) => {
  const userId = 'user-external-id'

  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: ['savedSearch:create:all'],
    userId
  })

  const payload = {
    name: 'Invalid saved search query',
    customAttributes: { licensePlate: { invalid: true } }, // expecting string
    save: true,
    metadata: { dummy: true }
  }

  const { body: error } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send(payload)
    .expect(422)

  t.regex(error.message, /invalid value .* text/i)
})

test('triggers a search with a saved query', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'search:list:all',
      'savedSearch:list:all'
    ],
    userId: ownerId
  })

  const { body: { results: results1 } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      savedSearch: {
        ids: [savedSearchIds.savedSearch1]
      }
    })
    .expect(200)

  t.is(results1.length, 1)
  t.truthy(results1.find(result => result.id === assetsIds.asset6))
  results1.forEach(result => {
    t.deepEqual(result.savedSearchIds, [savedSearchIds.savedSearch1])
  })

  const { body: { results: results2 } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      savedSearch: {
        ids: [savedSearchIds.savedSearch2]
      }
    })
    .expect(200)

  t.is(results2.length, 2)
  t.truthy(results2.find(result => result.id === assetsIds.asset6))
  t.truthy(results2.find(result => result.id === assetsIds.asset8))
  results2.forEach(result => {
    t.deepEqual(result.savedSearchIds, [savedSearchIds.savedSearch2])
  })

  const { body: { results: results3 } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      savedSearch: {
        ids: [savedSearchIds.savedSearch1, savedSearchIds.savedSearch2]
      }
    })
    .expect(200)

  t.is(results3.length, 2)
  t.truthy(results3.find(result => result.id === assetsIds.asset6))
  t.truthy(results3.find(result => result.id === assetsIds.asset8))

  const results3Asset = results3.find(result => result.id === assetsIds.asset6)
  t.true(results3Asset.savedSearchIds.includes(savedSearchIds.savedSearch1))
  t.true(results3Asset.savedSearchIds.includes(savedSearchIds.savedSearch2))

  // same as previous search on saved searches 1 and 2
  const { body: { results: results4 } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      savedSearch: {
        userId: ownerId
      }
    })
    .expect(200)

  t.is(results4.length, 2)
  t.truthy(results4.find(result => result.id === assetsIds.asset6))
  t.truthy(results4.find(result => result.id === assetsIds.asset8))

  const results4Asset = results4.find(result => result.id === assetsIds.asset6)
  t.true(results4Asset.savedSearchIds.includes(savedSearchIds.savedSearch1))
  t.true(results4Asset.savedSearchIds.includes(savedSearchIds.savedSearch2))

  // filter on user saved search AND provided IDs
  const { body: { results: results5 } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      savedSearch: {
        userId: ownerId,
        ids: [savedSearchIds.savedSearch1]
      }
    })
    .expect(200)

  t.is(results5.length, 1)
  t.truthy(results5.find(result => result.id === assetsIds.asset6))

  // combine with createdDate range filter
  const { body: { results: results6 } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      createdAfter: computeDate(initNow, '1h'),
      savedSearch: {
        userId: ownerId,
        ids: [savedSearchIds.savedSearch1]
      }
    })
    .expect(200)

  t.is(results6.length, 0)
})

test('createdDate range filter in root query overrides saved searches one’s', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'search:list:all',
      'savedSearch:list:all'
    ],
    userId: ownerId
  })

  const { body: { results: result1 } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      savedSearch: {
        ids: [savedSearchIds.savedSearch2] // createdDate filter in the saved search
      }
    })
    .expect(200)

  t.is(result1.length, 2)

  const { body: { results: result2 } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      savedSearch: {
        ids: [savedSearchIds.savedSearch2] // createdDate filter in the saved search
      },
      createdAfter: computeDate(initNow, '1h')
    })
    .expect(200)

  t.is(result2.length, 0)
})

test('cannot trigger a search with a saved query from another user', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'search:list:all',
      'savedSearch:list'
    ],
    userId: 'random-user-id'
  })

  await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      savedSearch: {
        ids: [savedSearchIds.savedSearch1]
      }
    })
    .expect(403)

  await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      savedSearch: {
        userId: ownerId
      }
    })
    .expect(403)

  t.pass()
})

test('updates a saved search', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'savedSearch:create:all',
      'savedSearch:edit:all'
    ]
  })

  const createPayload = {
    name: 'My cars',
    query: 'Honda',
    assetTypeId: ['typ_rL6IBMe1wlK1iJ9NNwlK'],
    location: {
      latitude: 0,
      longitude: 0
    },
    quantity: 2,
    save: true,
    metadata: { dummy: true }
  }

  const updatePayload = {
    name: 'My cars 2',
    metadata: { dummy2: true }
  }

  const { body: savedSearch } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send(createPayload)
    .expect(200)

  const { body: updatedSavedSearch } = await request(t.context.serverUrl)
    .patch(`/search/${savedSearch.id}`)
    .set(authorizationHeaders)
    .send(updatePayload)
    .expect(200)

  t.is(updatedSavedSearch.name, updatePayload.name)
  t.truthy(updatedSavedSearch.userId)
  t.is(updatedSavedSearch.metadata.dummy2, true)
})

test('removes a saved search', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'savedSearch:read:all',
      'savedSearch:create:all',
      'savedSearch:remove:all'
    ]
  })

  const { body: savedSearch } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      name: 'Saved search to remove',
      query: 'random query',
      save: true
    })
    .expect(200)

  const { body: payload } = await request(t.context.serverUrl)
    .delete(`/search/${savedSearch.id}`)
    .set(authorizationHeaders)
    .expect(200)

  t.is(payload.id, savedSearch.id)

  await request(t.context.serverUrl)
    .get(`/search/${savedSearch.id}`)
    .set(authorizationHeaders)
    .expect(404)

  t.pass()
})

// ////////// //
// VALIDATION //
// ////////// //

test('fails to update a saved search if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .patch('/search/sch_UEZfQps1I3a1gJYz2I3a')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .patch('/search/sch_UEZfQps1I3a1gJYz2I3a')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      name: true,
      userId: true,
      search: true,
      active: 'invalid',
      metadata: true,
      platformData: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"name" must be a string'))
  t.true(error.message.includes('"search" is not allowed'))
  t.true(error.message.includes('"active" must be a boolean'))
  t.true(error.message.includes('"metadata" must be of type object'))
  t.true(error.message.includes('"platformData" must be of type object'))
})
