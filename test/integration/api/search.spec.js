require('dotenv').config()

const test = require('ava')
const request = require('supertest')

const { before, beforeEach, after } = require('../../lifecycle')
const { getAccessTokenHeaders } = require('../../auth')
const { initElasticsearch, fixturesParams } = require('../../fixtures/search')

const {
  computeDate,
  nullOrUndefinedFallback,
  testEventMetadata
} = require('../../util')

let initNow
const {
  assetsIds,
  transactionIds,
  lowSeatingCapacity,
  uniqueSeatingCapacity,
  // useful for string ordering tests
  lowestTextValue,
  highestTextValue,
  // useful for number ordering tests
  lowestNumberValue,
  highestNumberValue,
  maxDistance,
} = fixturesParams

test.before(async (t) => {
  await before({ name: 'search' })(t)
  await beforeEach()(t)

  initNow = await initElasticsearch({ t })
})
test.after(after())

test('returns a search object with results and pagination parameters', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const result = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({})
    .expect(200)

  const searchResult = result.body

  t.true(typeof searchResult === 'object')
  t.true(typeof searchResult.page === 'number')
  t.true(typeof searchResult.nbResultsPerPage === 'number')
  t.true(typeof searchResult.nbResults === 'number')
  t.true(typeof searchResult.nbPages === 'number')
  t.true(typeof searchResult.exhaustiveNbResults === 'boolean')
  t.true(Array.isArray(searchResult.results))
})

test('synchronizes assets when there are any changes', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const result = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      query: 'ford'
    })
    .expect(200)

  const searchResult = result.body

  t.true(searchResult.results.length === 2)
  t.truthy(searchResult.results.find(asset => asset.name === 'Ford' && assetsIds.asset3 === asset.id))
  t.truthy(searchResult.results.find(asset => asset.name === 'Custom Ford' && assetsIds.asset2 === asset.id))

  // Check that asset deleted in before hook for consistency across tests
  // does not show up in results here
  const result2 = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      query: 'Honda'
    })
    .expect(200)

  const searchResult2 = result2.body

  t.true(searchResult2.results.length === 0)
})

test('returns only assets within the search area', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const result = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      query: 'ford',
      location: { latitude: 2, longitude: 2 },
      maxDistance: 10000
    })
    .expect(200)

  const searchResult = result.body

  t.true(searchResult.results.length === 1)
  t.truthy(searchResult.results.find(asset => asset.name === 'Custom Ford' && assetsIds.asset2 === asset.id))

  searchResult.results.forEach(result => {
    t.true(typeof result.locations[0].latitude === 'number')
    t.true(typeof result.locations[0].longitude === 'number')
  })
})

test('returns assets filtered by created date', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: { results: resultsWithoutCreatedFilter } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      query: 'ford',
      location: { latitude: 2, longitude: 2 },
      maxDistance: 10000
    })
    .expect(200)

  t.true(resultsWithoutCreatedFilter.length > 0)

  const { body: { results: resultsWithCreatedBeforeFilter } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      query: 'ford',
      location: { latitude: 2, longitude: 2 },
      maxDistance: 10000,
      createdBefore: computeDate(initNow, '-1h')
    })
    .expect(200)

  t.true(resultsWithCreatedBeforeFilter.length === 0)

  const { body: { results: resultsWithCreatedAfterFilter } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      query: 'ford',
      location: { latitude: 2, longitude: 2 },
      maxDistance: 10000,
      createdAfter: computeDate(resultsWithoutCreatedFilter[0].createdDate, '1ms')
    })
    .expect(200)

  t.falsy(resultsWithCreatedAfterFilter.find(asset => resultsWithoutCreatedFilter[0].id === asset.id))
})

test('returns similar assets', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['asset:read:all', 'search:list:all'] })

  const { body: asset8 } = await request(t.context.serverUrl)
    .get(`/assets/${assetsIds.asset8}`)
    .set(authorizationHeaders)
    .expect(200)

  const { body: search } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      similarTo: [assetsIds.asset7]
    })
    .expect(200)

  // Assume match based on 'car' in name and 'Somehow, I will…' in description
  t.true(search.results.length >= 1)
  // Making it easier to debug this test in CI by printing name or description
  t.is(search.results[0].name, asset8.name)
  t.is(search.results[0].description, asset8.description)
  t.is(search.results[0].id, assetsIds.asset8)
})

test('returns assets in specified categories', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: search } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      categoryId: 'ctgy_ejQQps1I3a1gJYz2I3a'
    })
    .expect(200)

  t.is(search.results.length, 1)
  t.true(search.results.every(a => a.id === assetsIds.asset6))

  const { body: search2 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      categoryId: ['ctgy_ejQQps1I3a1gJYz2I3a', 'ctgy_N1FQps1I3a1gJYz2I3a']
    })
    .expect(200)

  t.is(search2.results.length, 2)
  t.true(search2.results.some(a => a.id === assetsIds.asset6))
  t.true(search2.results.some(a => a.id === assetsIds.asset7))
})

test('returns assets without specified ids', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const result = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      active: null, // considering all assets including inactive ones
      without: [assetsIds.asset4, assetsIds.asset7] // asset4 deleted in before hook anyway
    })
    .expect(200)

  const searchResult = result.body

  t.is(searchResult.results.length, Object.keys(assetsIds).length - 2)
  t.false(searchResult.results.some(asset => asset.id === assetsIds.asset7))
})

test('returns only assets with the specified asset types', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: legacySearch } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      assetTypeId: ['typ_RFpfQps1I3a1gJYz2I3a']
    })
    .expect(200)

  t.true(legacySearch.results.length === 2)
  t.truthy(legacySearch.results.find(asset => assetsIds.asset1 === asset.id))
  t.truthy(legacySearch.results.find(asset => assetsIds.asset3 === asset.id))
})

test('does not return assets that are not available by default', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const result1 = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '3 days'),
      endDate: computeDate(initNow, '6 days'),
      location: {
        latitude: 50,
        longitude: 50
      },
      maxDistance
    })
    .expect(200)

  const searchResult1 = result1.body

  t.true(searchResult1.results.length === 0)

  const result2 = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '3 days'),
      endDate: computeDate(initNow, '6 days'),
      location: {
        latitude: 50,
        longitude: 50
      },
      maxDistance,
      availabilityFilter: {
        enabled: true
      }
    })
    .expect(200)

  const searchResult2 = result2.body

  t.true(searchResult2.results.length === 0)
})

test('returns assets with available attribute when availability filters are disabled', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const result = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '3 days'),
      endDate: computeDate(initNow, '6 days'),
      location: {
        latitude: 50,
        longitude: 50
      },
      availabilityFilter: {
        enabled: false
      }
    })
    .expect(200)

  const searchResult = result.body

  t.true(searchResult.results.length !== 0)
  t.is(typeof searchResult.results[0].available, 'boolean')
})

test('return assets that are available including past date in query', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const result = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '-2 days'),
      endDate: computeDate(initNow, '2 days'),
      location: {
        latitude: 50,
        longitude: 50
      },
      maxDistance
    })
    .expect(200)

  const searchResult = result.body

  t.true(searchResult.results.length === 1)
  t.truthy(searchResult.results.find(asset => assetsIds.asset5 === asset.id))
})

test('returns assets that are available during the full searched period by default', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const result1 = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '3 days'),
      endDate: computeDate(initNow, '6 days'),
      quantity: 2,
      location: {
        latitude: 50,
        longitude: 50
      }
    })
    .expect(200)

  const searchResult1 = result1.body

  t.true(searchResult1.results.length === 0)

  const result2 = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '3 days'),
      endDate: computeDate(initNow, '6 days'),
      quantity: 2,
      location: {
        latitude: 50,
        longitude: 50
      },
      availabilityFilter: {
        fullPeriod: true
      }
    })
    .expect(200)

  const searchResult2 = result2.body

  t.true(searchResult2.results.length === 0)
})

test('returns assets partially available during the searched period', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const result = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '3 days'),
      endDate: computeDate(initNow, '6 days'),
      quantity: 2,
      location: {
        latitude: 50,
        longitude: 50
      },
      availabilityFilter: {
        fullPeriod: false
      }
    })
    .expect(200)

  const searchResult = result.body

  t.true(searchResult.results.length !== 0)
})

test('assets are available if their associated transactions have not the status validated or completed', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const result = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '11 days'),
      endDate: computeDate(initNow, '14 days'),
      quantity: 5,
      location: {
        latitude: 50,
        longitude: 50
      },
      maxDistance,
      availabilityFilter: {
        enabled: false
      }
    })
    .expect(200)

  const searchResult = result.body

  t.true(searchResult.results.length === 1)
  t.true(searchResult.results[0].available)
})

test('transactions block availability based on availabilityFilters.unavailableWhen parameter', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const result = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '11 days'),
      endDate: computeDate(initNow, '14 days'),
      quantity: 5,
      location: {
        latitude: 50,
        longitude: 50
      },
      maxDistance,
      availabilityFilter: {
        enabled: false,
        unavailableWhen: 'draft' // use a string
      }
    })
    .expect(200)

  const searchResult = result.body

  t.true(searchResult.results.length === 1)
  t.false(searchResult.results[0].available)

  const sameResult = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '11 days'),
      endDate: computeDate(initNow, '14 days'),
      quantity: 5,
      location: {
        latitude: 50,
        longitude: 50
      },
      maxDistance,
      availabilityFilter: {
        enabled: false,
        unavailableWhen: ['draft'] // use an array
      }
    })
    .expect(200)

  const sameSearchResult = sameResult.body

  t.true(sameSearchResult.results.length === 1)
  t.false(sameSearchResult.results[0].available)
})

test('transactions block availability based on asset type unavailableWhen parameter', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'search:list:all',
      'assetType:edit:all',
      'transaction:create:all',
      'transaction:edit:all',
      'transaction:config:all'
    ]
  })

  // Objective of this test: compare the availability of two different assets
  // with two different asset types

  // Start situation: The two assets are available
  const { body: startSearchResult1 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '11 days'),
      endDate: computeDate(initNow, '14 days'),
      quantity: 5,
      location: {
        latitude: 50,
        longitude: 50
      },
      maxDistance,
      availabilityFilter: {
        enabled: false
      }
    })
    .expect(200)

  t.true(startSearchResult1.results.length === 1)
  t.true(startSearchResult1.results[0].available)

  const { body: startSearchResult2 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '5 days'),
      endDate: computeDate(initNow, '7 days'),
      quantity: 1,
      location: {
        latitude: 20,
        longitude: 20
      },
      maxDistance,
      availabilityFilter: {
        enabled: false
      }
    })
    .expect(200)

  t.true(startSearchResult2.results.length === 1)
  t.true(startSearchResult2.results[0].available)

  // Scenario 1: update transactions to 'confirmed' status
  // First asset (hereafter 'Asset 1') must become unavailable
  // While second asset ('Asset 2') isn't affected by this change

  await request(t.context.serverUrl)
    .patch(`/transactions/${transactionIds.transaction5}`)
    .set(authorizationHeaders)
    .send({ status: 'confirmed' })
    .expect(200)

  await request(t.context.serverUrl)
    .patch(`/transactions/${transactionIds.transaction3}`)
    .set(authorizationHeaders)
    .send({ status: 'confirmed' })
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, 1000))

  await request(t.context.serverUrl)
    .patch('/asset-types/typ_ZU9fQps1I3a1gJYz2I3a')
    .set(authorizationHeaders)
    .send({
      unavailableWhen: ['draft']
    })
    .expect(200)

  const { body: scenario1SearchResult1 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '11 days'),
      endDate: computeDate(initNow, '14 days'),
      quantity: 5,
      location: {
        latitude: 50,
        longitude: 50
      },
      maxDistance,
      availabilityFilter: {
        enabled: false
      }
    })
    .expect(200)

  t.true(scenario1SearchResult1.results.length === 1)
  t.false(scenario1SearchResult1.results[0].available)
  t.true(startSearchResult1.results[0].id === scenario1SearchResult1.results[0].id)

  const { body: scenario1SearchResult2 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '5 days'),
      endDate: computeDate(initNow, '7 days'),
      quantity: 1,
      location: {
        latitude: 20,
        longitude: 20
      },
      maxDistance,
      availabilityFilter: {
        enabled: false
      }
    })
    .expect(200)

  t.true(scenario1SearchResult2.results.length === 1)
  t.true(scenario1SearchResult2.results[0].available)
  t.true(startSearchResult2.results[0].id === scenario1SearchResult2.results[0].id)

  // Scenario 2: update transactions to 'validated' status
  // Asset 1 should be not available
  // Asset 2 should be not available

  await request(t.context.serverUrl)
    .patch(`/transactions/${transactionIds.transaction5}`)
    .set(authorizationHeaders)
    .send({ status: 'validated' })
    .expect(200)

  await request(t.context.serverUrl)
    .patch(`/transactions/${transactionIds.transaction3}`)
    .set(authorizationHeaders)
    .send({ status: 'validated' })
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, 1000))

  const { body: scenario2SearchResult1 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '11 days'),
      endDate: computeDate(initNow, '14 days'),
      quantity: 5,
      location: {
        latitude: 50,
        longitude: 50
      },
      maxDistance,
      availabilityFilter: {
        enabled: false
      }
    })
    .expect(200)

  t.true(scenario2SearchResult1.results.length === 1)
  t.false(scenario2SearchResult1.results[0].available)
  t.true(startSearchResult1.results[0].id === scenario2SearchResult1.results[0].id)

  const { body: scenario2SearchResult2 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '5 days'),
      endDate: computeDate(initNow, '7 days'),
      quantity: 1,
      location: {
        latitude: 20,
        longitude: 20
      },
      maxDistance,
      availabilityFilter: {
        enabled: false
      }
    })
    .expect(200)

  t.true(scenario2SearchResult2.results.length === 1)
  t.false(scenario2SearchResult2.results[0].available)
  t.true(startSearchResult2.results[0].id === scenario2SearchResult2.results[0].id)

  // Scenario 3: update transactions to 'cancelled' status
  // Asset 1 should be available
  // Asset 2 should be available

  await request(t.context.serverUrl)
    .patch(`/transactions/${transactionIds.transaction5}`)
    .set(authorizationHeaders)
    .send({ status: 'cancelled' })
    .expect(200)

  await request(t.context.serverUrl)
    .patch(`/transactions/${transactionIds.transaction3}`)
    .set(authorizationHeaders)
    .send({ status: 'cancelled' })
    .expect(200)

  const { body: scenario3SearchResult1 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '11 days'),
      endDate: computeDate(initNow, '14 days'),
      quantity: 5,
      location: {
        latitude: 50,
        longitude: 50
      },
      maxDistance,
      availabilityFilter: {
        enabled: false
      }
    })
    .expect(200)

  t.true(scenario3SearchResult1.results.length === 1)
  t.true(scenario3SearchResult1.results[0].available)
  t.true(startSearchResult1.results[0].id === scenario3SearchResult1.results[0].id)

  const { body: scenario3SearchResult2 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '5 days'),
      endDate: computeDate(initNow, '7 days'),
      quantity: 1,
      location: {
        latitude: 20,
        longitude: 20
      },
      maxDistance,
      availabilityFilter: {
        enabled: false
      }
    })
    .expect(200)

  t.true(scenario3SearchResult2.results.length === 1)
  t.true(scenario3SearchResult2.results[0].available)
  t.true(startSearchResult2.results[0].id === scenario3SearchResult2.results[0].id)
})

test('transactions are not taken into account for availability if unavailableWhen is empty or null', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const result = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '11 days'),
      endDate: computeDate(initNow, '14 days'),
      quantity: 5,
      location: {
        latitude: 50,
        longitude: 50
      },
      maxDistance,
      availabilityFilter: {
        enabled: false,
        unavailableWhen: null
      }
    })
    .expect(200)

  const searchResult = result.body

  t.true(searchResult.results.length === 1)
  t.true(searchResult.results[0].available)

  const sameResult = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '11 days'),
      endDate: computeDate(initNow, '14 days'),
      quantity: 5,
      location: {
        latitude: 50,
        longitude: 50
      },
      maxDistance,
      availabilityFilter: {
        enabled: false,
        unavailableWhen: []
      }
    })
    .expect(200)

  const sameSearchResult = sameResult.body

  t.true(sameSearchResult.results.length === 1)
  t.true(sameSearchResult.results[0].available)
})

test('does not return assets that does not have enough quantity', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const result = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '8 days'),
      endDate: computeDate(initNow, '12 days'),
      quantity: 10,
      location: {
        latitude: 50,
        longitude: 50
      }
    })
    .expect(200)

  const searchResult = result.body

  t.true(searchResult.results.length === 0)
})

test('filters assets based on active and validated parameters', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: searchResults } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      validated: true
      // active is true by default
    })
    .expect(200)

  t.falsy(searchResults.results.find(asset => assetsIds.asset9 === asset.id))

  const { body: searchResults2 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      validated: true,
      active: false
    })
    .expect(200)

  t.true(searchResults2.results.length === 1)
  t.truthy(searchResults2.results.find(asset => assetsIds.asset9 === asset.id))

  const { body: searchResults3 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      query: 'Ford',
      validated: true,
      active: false
    })
    .expect(200)

  t.true(searchResults3.results.length === 0)

  const { body: searchResults4 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({ // active filter is disabled
      active: null
    })
    .expect(200)

  t.is(searchResults4.results.length, Object.keys(assetsIds).length - 1) // 1 asset removed before tests
  t.truthy(searchResults4.results.find(asset => asset.active === true))
  t.truthy(searchResults4.results.find(asset => asset.active === false))
  t.truthy(searchResults4.results.find(asset => asset.validated === true))
})

test('filters assets within the search period and wanted quantity', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const result = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      startDate: computeDate(initNow, '8 days'),
      endDate: computeDate(initNow, '12 days'),
      quantity: 2,
      location: {
        latitude: 50,
        longitude: 50
      }
    })
    .expect(200)

  const searchResult = result.body

  t.true(searchResult.results.length === 1)
  t.truthy(searchResult.results.find(asset => assetsIds.asset5 === asset.id))
})

test('returns assets with queried custom attributes (strict equality)', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: searchResult1 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      customAttributes: {
        seatingCapacity: uniqueSeatingCapacity
      }
    })
    .expect(200)

  t.true(searchResult1.results.length === 1)
  t.truthy(searchResult1.results.find(asset => assetsIds.asset8 === asset.id))

  const { body: searchResult2 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      customAttributes: {
        automaticTransmission: false
      }
    })
    .expect(200)

  t.true(searchResult2.results.length === 2)
  t.truthy(searchResult2.results.find(asset => assetsIds.asset7 === asset.id))
  t.truthy(searchResult2.results.find(asset => assetsIds.asset8 === asset.id))

  const { body: searchResult3 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      customAttributes: {
        make: 'Chevrolet'
      }
    })
    .expect(200)

  t.true(searchResult3.results.length === 1)
  t.truthy(searchResult3.results.find(asset => assetsIds.asset7 === asset.id))
})

test('returns assets with queried custom attributes (range for numbers)', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: { results: searchResults } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      customAttributes: {
        seatingCapacity: {
          gt: lowSeatingCapacity
        }
      }
    })
    .expect(200)

  const hasOnlyAssetsWithHigherCapacity = searchResults.reduce((has, asset) => {
    return has && asset.customAttributes.seatingCapacity > lowSeatingCapacity
  }, true)

  t.is(hasOnlyAssetsWithHigherCapacity, true)

  const { body: { results: searchResults2 } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      customAttributes: {
        seatingCapacity: {
          gte: uniqueSeatingCapacity,
          lt: uniqueSeatingCapacity + 1
        }
      }
    })
    .expect(200)

  t.true(searchResults2.length === 1)
  t.truthy(searchResults2.find(asset => assetsIds.asset8 === asset.id))
})

test('returns assets with queried custom attributes of several types', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: searchResult } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      customAttributes: {
        seatingCapacity: uniqueSeatingCapacity,
        automaticTransmission: false
      }
    })
    .expect(200)

  t.true(searchResult.results.length === 1)
  t.truthy(searchResult.results.find(asset => assetsIds.asset8 === asset.id))
})

test('returns assets with queried custom attribute of "tags" type (one element match)', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: legacySearch } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      customAttributes: {
        options: 'sunroof'
      }
    })
    .expect(200)

  t.true(legacySearch.results.length === 2)
  t.truthy(legacySearch.results.find(asset => assetsIds.asset6 === asset.id))
  t.truthy(legacySearch.results.find(asset => assetsIds.asset8 === asset.id))
})

test('returns assets with queried custom attribute of "select" type (match one of provided elements)', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: legacySearch } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      customAttributes: {
        make: ['Toyota', 'Chevrolet']
      }
    })
    .expect(200)

  t.true(legacySearch.results.length === 3)
  t.truthy(legacySearch.results.find(asset => assetsIds.asset6 === asset.id))
  t.truthy(legacySearch.results.find(asset => assetsIds.asset7 === asset.id))
  t.truthy(legacySearch.results.find(asset => assetsIds.asset8 === asset.id))
})

test('returns assets with queried custom attribute of "tags" type', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: legacySearch1 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      customAttributes: {
        options: ['sunroof', 'gps']
      }
    })
    .expect(200)

  t.true(legacySearch1.results.length === 1)
  t.truthy(legacySearch1.results.find(asset => assetsIds.asset6 === asset.id))

  const { body: searchResult2 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      customAttributes: {
        options: ['sunroof']
      }
    })
    .expect(200)

  t.true(searchResult2.results.length === 2)
  t.truthy(searchResult2.results.find(asset => assetsIds.asset6 === asset.id))
  t.truthy(searchResult2.results.find(asset => assetsIds.asset8 === asset.id))
})

test('returns assets with queried custom attributes (match an exact text)', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: searchResult1 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      customAttributes: {
        licensePlate: '123456789'
      }
    })
    .expect(200)

  t.true(searchResult1.results.length === 1)
  t.truthy(searchResult1.results.find(asset => assetsIds.asset6 === asset.id))
})

test('returns assets with full-text search in a custom attribute', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: search } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      query: 'modern car'
    })
    .expect(200)

  const matchedAssetsIds = [
    // 'modern car' perfect match
    assetsIds.asset6,
    // partial match on 'car'
    assetsIds.asset7,
    assetsIds.asset8,
    // modell > modern: Levenshtein distance is 2 and we have a match
    // since default fuziness is 2 starting from 6 chars.
    assetsIds.asset12
  ]

  t.is(search.results.length, matchedAssetsIds.length)
  t.true(search.results.every(a => matchedAssetsIds.includes(a.id)))

  t.is(search.results[0].id, matchedAssetsIds[0])
  const lastIndex = search.results.length - 1
  t.is(search.results[lastIndex].id, matchedAssetsIds[lastIndex])
})

test('sorts assets by price', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: priceSort } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: [{ _price: 'asc' }]
    })
    .expect(200)

  // Some test assets may have no price (0 by default)
  t.true(priceSort.results.length >= 3)
  t.true(priceSort.results.reduce((higherPrice, asset, i, assets) => {
    return higherPrice && asset.price >= assets[Math.max(i - 1, 0)].price
  }, true))

  const { body: priceSort2 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: [{ _price: 'desc' }]
    })
    .expect(200)

  t.true(priceSort2.results.length >= 3)
  t.true(priceSort2.results.reduce((lowerPrice, asset, i, assets) => {
    return lowerPrice && asset.price <= assets[Math.max(i - 1, 0)].price
  }, true))
})

test('accepts unique sort step object instead of array of sort steps', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: priceSort } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: { _price: 'asc' }
    })
    .expect(200)

  t.true(priceSort.results.length >= 3)
  t.true(priceSort.results.reduce((higherPrice, asset, i, assets) => {
    return higherPrice && asset.price >= assets[Math.max(i - 1, 0)].price
  }, true))
})

test('availability sorting should always come first', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: [
        { _available: 'desc' },
        { seatingCapacity: 'asc' },
        { _price: 'desc' }
      ]
    })
    .expect(200)

  await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: [
        { seatingCapacity: 'asc' },
        { _price: 'desc' },
        { _available: 'desc' } // third position
      ]
    })
    .expect(422)

  t.pass()
})

test('sorts assets by availability and price', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: { results: searchResults } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: [
        { _available: 'asc' },
        { _price: 'desc' }
      ],
      availabilityFilter: {
        enabled: false
      },
      startDate: computeDate(initNow, '11 days'),
      endDate: computeDate(initNow, '14 days'),
      quantity: 3
    })
    .expect(200)

  let availabilities = []
  const isOrderedByAscendingAvailability = searchResults.reduce((memo, asset, index) => {
    const assetAvailable = asset.available
    const previousAssetAvailable = searchResults[Math.max(0, index - 1)].available

    availabilities.push(assetAvailable)

    return memo && assetAvailable >= previousAssetAvailable
  }, true)

  // Test second-step sorting for each availability (second-step sorting is a tiebreaker)
  let isThenOrderedByDescendingPrice = true
  availabilities.forEach((available) => {
    let previousAssetWithSameAvailability

    isThenOrderedByDescendingPrice = isThenOrderedByDescendingPrice &&
      searchResults.reduce((memo, asset) => {
        const assetAvailable = asset.available
        // skip other assets with other availabilities
        if (assetAvailable !== available) return memo

        const hasLowerPrice = asset.price <= (previousAssetWithSameAvailability || asset).price
        previousAssetWithSameAvailability = asset

        return memo && hasLowerPrice
      }, true)
  })

  t.is(isOrderedByAscendingAvailability, true)
  t.is(isThenOrderedByDescendingPrice, true)

  const { body: { results: searchResults2 } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: [
        { _available: 'desc' },
        { _price: 'asc' }
      ],
      availabilityFilter: {
        enabled: false
      },
      startDate: computeDate(initNow, '11 days'),
      endDate: computeDate(initNow, '14 days'),
      quantity: 3
    })
    .expect(200)

  availabilities = []
  const isOrderedByDescendingAvailability = searchResults2.reduce((memo, asset, index) => {
    const assetAvailable = asset.available
    const previousAssetAvailable = searchResults2[Math.max(0, index - 1)].available

    availabilities.push(assetAvailable)

    return memo && assetAvailable <= previousAssetAvailable
  }, true)

  // Test second-step sorting for each availability (second-step sorting is a tiebreaker)
  let isThenOrderedByAscendingPrice = true
  availabilities.forEach((available) => {
    let previousAssetWithSameAvailability

    isThenOrderedByAscendingPrice = isThenOrderedByAscendingPrice &&
      searchResults2.reduce((memo, asset) => {
        const assetAvailable = asset.available

        // skip other assets with other availabilities
        if (assetAvailable !== available) return memo

        const hasHigherPrice = asset.price >= (previousAssetWithSameAvailability || asset).price
        previousAssetWithSameAvailability = asset

        return memo && hasHigherPrice
      }, true)
  })

  t.is(isOrderedByDescendingAvailability, true)
  t.is(isThenOrderedByAscendingPrice, true)
})

test('sorts assets by price and custom attributes of type number', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: { results: searchResults } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: [
        { seatingCapacity: 'asc' },
        { _price: 'desc' }
      ]
    })
    .expect(200)

  let seatingCapacities = []
  const isOrderedByAscendingSeatingCapacity = searchResults.reduce((memo, asset, index) => {
    // Missing/null values are sorted "_last" in ElasticSearch (~ highestNumberValue)
    const assetSeatingCapacity = nullOrUndefinedFallback(
      asset.customAttributes.seatingCapacity,
      highestNumberValue
    )
    const previousSeatingCapacity = nullOrUndefinedFallback(
      searchResults[Math.max(0, index - 1)].customAttributes.seatingCapacity,
      highestNumberValue
    )

    seatingCapacities.push(assetSeatingCapacity)

    return memo && assetSeatingCapacity >= previousSeatingCapacity
  }, true)

  // Test second-step sorting for each capacity (second-step sorting is a tiebreaker)
  let isThenOrderedByDescendingPrice = true
  seatingCapacities.forEach((capacity) => {
    let previousAssetWithSameCapacity

    isThenOrderedByDescendingPrice = isThenOrderedByDescendingPrice &&
      searchResults.reduce((memo, asset) => {
        const assetSeatingCapacity = nullOrUndefinedFallback(
          asset.customAttributes.seatingCapacity,
          highestNumberValue
        )
        // skip other assets with other capacities
        if (assetSeatingCapacity !== capacity) return memo

        const hasLowerPrice = asset.price <= (previousAssetWithSameCapacity || asset).price
        previousAssetWithSameCapacity = asset

        return memo && hasLowerPrice
      }, true)
  })

  t.is(isOrderedByAscendingSeatingCapacity, true)
  t.is(isThenOrderedByDescendingPrice, true)

  const { body: { results: searchResults2 } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: [
        { seatingCapacity: 'desc' },
        { _price: 'asc' }
      ]
    })
    .expect(200)

  seatingCapacities = []
  const isOrderedByDescendingSeatingCapacity = searchResults2.reduce((memo, asset, index) => {
    // Missing/null values are sorted "_last" in ElasticSearch (~ lowestNumberValue)
    const assetSeatingCapacity = nullOrUndefinedFallback(
      asset.customAttributes.seatingCapacity,
      lowestNumberValue
    )
    const previousSeatingCapacity = nullOrUndefinedFallback(
      searchResults2[Math.max(0, index - 1)].customAttributes.seatingCapacity,
      lowestNumberValue
    )

    seatingCapacities.push(assetSeatingCapacity)

    return memo && assetSeatingCapacity <= previousSeatingCapacity
  }, true)

  // Test second-step sorting for each capacity (second-step sorting is a tiebreaker)
  let isThenOrderedByAscendingPrice = true
  seatingCapacities.forEach((capacity) => {
    let previousAssetWithSameCapacity

    isThenOrderedByAscendingPrice = isThenOrderedByAscendingPrice &&
      searchResults2.reduce((memo, asset) => {
        const assetSeatingCapacity = nullOrUndefinedFallback(
          asset.customAttributes.seatingCapacity,
          lowestNumberValue
        )

        // skip other assets with other capacities
        if (assetSeatingCapacity !== capacity) return memo

        const hasHigherPrice = asset.price >= (previousAssetWithSameCapacity || asset).price
        previousAssetWithSameCapacity = asset

        return memo && hasHigherPrice
      }, true)
  })

  t.is(isOrderedByDescendingSeatingCapacity, true)
  t.is(isThenOrderedByAscendingPrice, true)
})

test('sorts assets by several custom attributes of type number, including null values', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: { results: searchResults } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: [
        { seatingCapacity: 'desc' },
        { customScore: 'asc' }
      ]
    })
    .expect(200)

  const seatingCapacities = []
  const isOrderedByDescendingSeatingCapacity = searchResults.reduce((memo, asset, index) => {
    const previousIndex = Math.max(0, index - 1)
    // Missing/null values are sorted "_last" in ElasticSearch (~ lowestNumberValue)
    const assetSeatingCapacity = nullOrUndefinedFallback(
      asset.customAttributes.seatingCapacity,
      lowestNumberValue
    )
    const previousSeatingCapacity = nullOrUndefinedFallback(
      searchResults[previousIndex].customAttributes.seatingCapacity,
      lowestNumberValue
    )

    seatingCapacities.push(assetSeatingCapacity)

    return memo && assetSeatingCapacity <= previousSeatingCapacity
  }, true)

  let isThenOrderedByAscendingScore = true
  seatingCapacities.forEach((capacity) => {
    let previousAssetWithSameCapacity

    isThenOrderedByAscendingScore = isThenOrderedByAscendingScore &&
      searchResults.reduce((memo, asset) => {
        // Consider only one capacity at a time (second step sorting is a tiebreaker)
        const assetSeatingCapacity = nullOrUndefinedFallback(
          asset.customAttributes.seatingCapacity,
          lowestNumberValue
        )

        // skip other assets with other capacities
        if (assetSeatingCapacity !== capacity) return memo

        // Missing/null values are sorted "_last" in ElasticSearch (~ highestNumberValue)
        const assetCustomScore = nullOrUndefinedFallback(
          asset.customAttributes.customScore,
          highestNumberValue
        )
        const previousCustomScore = nullOrUndefinedFallback(
          (previousAssetWithSameCapacity || asset).customAttributes.customScore,
          highestNumberValue
        )

        previousAssetWithSameCapacity = asset

        return memo && assetCustomScore >= previousCustomScore
      }, true)
  })

  t.is(isOrderedByDescendingSeatingCapacity, true)
  t.is(isThenOrderedByAscendingScore, true)
})

test('sorts assets by custom attribute of type text, with missing values last', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: { results: searchResults } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: [{
        licensePlate: 'asc'
      }]
    })
    .expect(200)

  let lastAsset = searchResults[searchResults.length - 1]
  const isSortedByAscendingText = searchResults.reduce((memo, asset, index) => {
    const lastPlate = searchResults[Math.max(0, index - 1)].customAttributes.licensePlate
    // Missing/null values are sorted "_last" in ElasticSearch (~ highestTextValue)
    const lastPlateWithFallback = nullOrUndefinedFallback(lastPlate, highestTextValue)
    const currentPlateWithFallback = nullOrUndefinedFallback(
      asset.customAttributes.licensePlate,
      highestTextValue
    )

    return memo && currentPlateWithFallback >= lastPlateWithFallback
  }, true)

  t.is(isSortedByAscendingText, true)
  t.is(lastAsset.customAttributes.licensePlate, undefined)

  const { body: { results: searchResults2 } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: [
        { licensePlate: 'desc' },
        { _price: 'asc' } // should have no effect
      ]
    })
    .expect(200)

  lastAsset = searchResults2[searchResults2.length - 1]
  const isSortedByDescendingText = searchResults2.reduce((memo, asset, index) => {
    const lastPlate = searchResults2[Math.max(0, index - 1)].customAttributes.licensePlate
    // Missing/null values are sorted "_last" in ElasticSearch (~ lowestTextValue)
    const lastPlateWithFallback = nullOrUndefinedFallback(lastPlate, lowestTextValue)
    const currentPlateWithFallback = nullOrUndefinedFallback(
      asset.customAttributes.licensePlate,
      lowestTextValue
    )

    return memo && currentPlateWithFallback <= lastPlateWithFallback
  }, true)

  t.is(isSortedByDescendingText, true)
  t.is(lastAsset.customAttributes.licensePlate, undefined)
})

test('sorts assets by custom attribute of type boolean, with missing values last', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: { results: searchResults } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: [{
        automaticTransmission: 'asc'
      }]
    })
    .expect(200)

  const lastAsset = searchResults[searchResults.length - 1]
  const isSortedByAscendingBoolean = searchResults.reduce((memo, asset, index) => {
    const lastBoolean = searchResults[Math.max(0, index - 1)].customAttributes.automaticTransmission
    // Missing/null values are sorted "_last" in ElasticSearch (~ true boolean)
    const lastBooleanWithFallback = nullOrUndefinedFallback(lastBoolean, true)
    const currentBooleanWithFallback = nullOrUndefinedFallback(
      asset.customAttributes.automaticTransmission,
      true
    )

    return memo && currentBooleanWithFallback >= lastBooleanWithFallback
  }, true)

  t.is(isSortedByAscendingBoolean, true)
  t.is(lastAsset.customAttributes.automaticTransmission, undefined)

  // const { body: { results: searchResults2 } } = await request(t.context.serverUrl)
  //   .post('/search')
  //   .set(authorizationHeaders)
  //   .send({
  //     sort: [{
  //       automaticTransmission: 'desc'
  //     }]
  //   })
  //   .expect(200)

  // lastAsset = searchResults2[searchResults2.length - 1]
  // const isSortedByDescendingBoolean = searchResults2.reduce((memo, asset, index) => {
  //   const lastBoolean = searchResults2[Math.max(0, index - 1)].customAttributes.automaticTransmission
  //   // Missing/null values are sorted "_last" in ElasticSearch  (~ false boolean)
  //   const lastBooleanWithFallback = nullOrUndefinedFallback(lastBoolean, false)
  //   const currentBooleanWithFallback = nullOrUndefinedFallback(
  //     asset.customAttributes.automaticTransmission,
  //     false
  //   )

  //   return memo && currentBooleanWithFallback <= lastBooleanWithFallback
  // }, true)

  // t.is(isSortedByDescendingBoolean, true)
  // t.is(lastAsset.customAttributes.automaticTransmission, undefined)
})

test('sorts assets by created date', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: { results: searchResults } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: [
        { _createdDate: 'desc' }
      ]
    })
    .expect(200)

  const isOrderedByDescendingCreatedDate = searchResults.reduce((memo, asset, index) => {
    const previousIndex = Math.max(0, index - 1)
    const assetCreatedDate = asset.createdDate
    const previousCreatedDate = searchResults[previousIndex].createdDate

    return memo && assetCreatedDate <= previousCreatedDate
  }, true)

  t.is(isOrderedByDescendingCreatedDate, true)
})

test('sorts assets by name', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: { results: searchResults } } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: [
        { _name: 'asc' }
      ]
    })
    .expect(200)

  const isOrderedByDescendingName = searchResults.reduce((memo, asset, index) => {
    const previousIndex = Math.max(0, index - 1)
    const assetName = asset.name
    const previousName = searchResults[previousIndex].name

    return memo && assetName >= previousName
  }, true)

  t.is(isOrderedByDescendingName, true)
})

test('rejects invalid sort parameter with appropriate error codes', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: { _price: 'iasc' }
    })
    .expect(400)

  await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: { _price: 'asc', seatingCapacity: 'desc' }
    })
    .expect(400)

  await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: { 'Unknown custom attribute': 'asc' }
    })
    .expect(422)

  t.pass()
})

test('should retrieve available results even if they are beyond the first page of Elasticsearch', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'asset:create:all',
      'search:list:all'
    ]
  })

  const { body: searchResults } = await request(t.context.serverUrl)
    .post('/search?_size=1') // add size 1 to force Elasticsearch to do pagination
    .set(authorizationHeaders)
    .send({
      customAttributes: {
        customDescription: 'elasticsearch pagination'
      },
      page: 1,
      nbResultsPerPage: 100
    })
    .expect(200)

  t.is(searchResults.results.length, 5)
})

test('should work with all languages', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: searchResult1 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      query: 'liebhaber' // 'lover' in German (match a partial word)
    })
    .expect(200)

  t.true(searchResult1.results.length > 0)
  t.truthy(searchResult1.results.find(asset => assetsIds.asset11 === asset.id))

  const { body: searchResult2 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      query: 'grosse' // 'big' in German (replacing the character ß by ss)
    })
    .expect(200)

  t.true(searchResult2.results.length > 0)
  t.truthy(searchResult2.results.find(asset => assetsIds.asset11 === asset.id))

  const { body: searchResult3 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      query: '愛好者' // 'lover' in Chinese (match an expression)
    })
    .expect(200)

  t.true(searchResult3.results.length > 0)
  t.truthy(searchResult3.results.find(asset => [assetsIds.asset13, assetsIds.asset14].includes(asset.id)))

  const { body: searchResult4 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      query: '大' // 'big' in Chinese
    })
    .expect(200)

  t.true(searchResult4.results.length > 0)
  t.truthy(searchResult4.results.find(asset => assetsIds.asset13 === asset.id))
})

test('should match asset name edge unigrams/bigrams when query is shorter than 3 chars', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['search:list:all'] })

  const { body: search } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      query: 'ca' // expecting search-as-you-type ability with 'car'
    })
    .expect(200)

  t.is(search.results.length, 2)
  t.truthy(search.results.find(asset => assetsIds.asset7 === asset.id))
  t.truthy(search.results.find(asset => assetsIds.asset8 === asset.id))

  const { body: search2 } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      query: 'c'
    })
    .expect(200)

  t.true(search2.results.length >= 2)
  t.truthy(search.results.find(asset => assetsIds.asset7 === asset.id))
  t.truthy(search.results.find(asset => assetsIds.asset8 === asset.id))
})

// ////// //
// EVENTS //
// ////// //

// Event tests must run serially before the other tests
test.serial('generates asset__searched event', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'search:list:all',
      'event:list:all'
    ]
  })

  const { body: searchResults } = await request(t.context.serverUrl)
    .post('/search')
    .set(authorizationHeaders)
    .send({
      sort: { _price: 'desc' }
    })
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, 300))

  const { body: { results: events } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const firstResult = searchResults.results[0]
  const assetsSearchedEvent = events.find(event => {
    return event.type === 'assets__searched' && event.objectId === firstResult.id
  })
  const eventResultsIds = assetsSearchedEvent.metadata.resultsIds
  await testEventMetadata({ event: assetsSearchedEvent, object: firstResult, t })
  t.is(typeof assetsSearchedEvent.metadata.searchQuery, 'object')
  t.deepEqual(assetsSearchedEvent.metadata.searchQuery, {
    sort: [{ _price: 'desc' }], // forced into array
    save: false
  })
  t.true(Array.isArray(eventResultsIds))
  t.is(eventResultsIds.length, searchResults.results.length)
  t.is(eventResultsIds[0], firstResult.id)
  t.is(typeof eventResultsIds[eventResultsIds.length - 1], 'string')
})

// ////////// //
// VALIDATION //
// ////////// //

test('fails to search assets if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/search')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/search')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      query: true,
      filter: true,
      sort: true,
      assetTypeId: [1],
      categoryId: true,
      categoriesIds: true,
      location: true,
      maxDistance: 'invalid',
      startDate: true,
      endDate: true,
      quantity: 'invalid',
      without: true,
      similarTo: [{ invalid: true }],
      customAttributes: true,
      active: 'invalid',
      validated: 'invalid',
      page: 'invalid',
      nbResultsPerPage: 'invalid',
      availabilityFilter: true,
      save: 'invalid',

      name: true,
      userId: true,
      metadata: true,
      platformData: true,
      savedSearch: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"query" must be a string'))
  t.true(error.message.includes('"filter" must be a string'))
  t.true(error.message.includes('"sort" must be an object'))
  t.true(error.message.includes('"assetTypeId[0]" must be a string'))
  t.true(error.message.includes('"categoryId" must be a string'))
  t.true(error.message.includes('"categoriesIds" is not allowed'))
  t.true(error.message.includes('"location" must be an object'))
  t.true(error.message.includes('"maxDistance" must be a number'))
  t.true(error.message.includes('"startDate" must be a string'))
  t.true(error.message.includes('"endDate" must be a string'))
  t.true(error.message.includes('"quantity" must be a number'))
  t.true(error.message.includes('"without" must be a string'))
  t.true(error.message.includes('"similarTo[0]" must be a string'))
  t.true(error.message.includes('"customAttributes" must be an object'))
  t.true(error.message.includes('"active" must be a boolean'))
  t.true(error.message.includes('"validated" must be a boolean'))
  t.true(error.message.includes('"page" must be a number'))
  t.true(error.message.includes('"nbResultsPerPage" must be a number'))
  t.true(error.message.includes('"availabilityFilter" must be an object'))
  t.true(error.message.includes('"save" must be a boolean'))

  t.true(error.message.includes('"name" is not allowed'))
  t.true(error.message.includes('"userId" is not allowed'))
  t.true(error.message.includes('"metadata" is not allowed'))
  t.true(error.message.includes('"platformData" is not allowed'))
  t.true(error.message.includes('"savedSearch" is not allowed'))

  // parameters with wrong type when save is true
  result = await request(t.context.serverUrl)
    .post('/search')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      query: true,
      filter: true,
      sort: true,
      assetTypeId: [1],
      categoryId: true,
      categoriesIds: true,
      location: true,
      maxDistance: 'invalid',
      startDate: true,
      endDate: true,
      quantity: 'invalid',
      without: true,
      similarTo: [{ invalid: true }],
      customAttributes: true,
      active: 'invalid',
      validated: 'invalid',
      page: 'invalid',
      nbResultsPerPage: 'invalid',
      availabilityFilter: true,
      save: true,

      name: true,
      userId: true,
      metadata: true,
      platformData: true,
      savedSearch: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"query" must be a string'))
  t.true(error.message.includes('"filter" must be a string'))
  t.true(error.message.includes('"sort" must be an object'))
  t.true(error.message.includes('"assetTypeId[0]" must be a string'))
  t.true(error.message.includes('"categoryId" must be a string'))
  t.true(error.message.includes('"categoriesIds" is not allowed'))
  t.true(error.message.includes('"location" must be an object'))
  t.true(error.message.includes('"maxDistance" must be a number'))
  t.true(error.message.includes('"startDate" must be a string'))
  t.true(error.message.includes('"endDate" must be a string'))
  t.true(error.message.includes('"quantity" must be a number'))
  t.true(error.message.includes('"without" must be a string'))
  t.true(error.message.includes('"similarTo[0]" must be a string'))
  t.true(error.message.includes('"customAttributes" must be an object'))
  t.true(error.message.includes('"active" must be a boolean'))
  t.true(error.message.includes('"validated" must be a boolean'))
  t.true(error.message.includes('"page" must be a number'))
  t.true(error.message.includes('"nbResultsPerPage" must be a number'))
  t.true(error.message.includes('"availabilityFilter" must be an object'))

  t.true(error.message.includes('"name" must be a string'))
  t.true(error.message.includes('"userId" must be a string'))
  t.true(error.message.includes('"metadata" must be an object'))
  t.true(error.message.includes('"platformData" must be an object'))
  t.true(error.message.includes('"savedSearch" is not allowed'))

  // parameters with wrong type when save is true
  result = await request(t.context.serverUrl)
    .post('/search')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      save: false,
      savedSearch: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"savedSearch" must be an object'))

  // parameters with wrong type when save is true
  result = await request(t.context.serverUrl)
    .post('/search')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      savedSearch: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"savedSearch" must be an object'))
})

// //////// //
// VERSIONS //
// //////// //
