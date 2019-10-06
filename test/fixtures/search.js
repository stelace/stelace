require('dotenv').config()

const request = require('supertest')

const { getAccessTokenHeaders } = require('../auth')
const { computeDate } = require('../util')

const fixturesParams = {
  ownerId: 'c12ca46b-995c-487c-a940-d9e41e0ff178',
  assetsIds: {},
  transactionIds: {},
  basePrice: 24,
  lowSeatingCapacity: 4,
  uniqueSeatingCapacity: 5,
  // useful for string ordering tests
  lowestTextValue: ' '.repeat(8),
  highestTextValue: 'z'.repeat(8),
  // useful for number ordering tests
  lowestNumberValue: -Infinity,
  highestNumberValue: Infinity,
  maxDistance: 150000,
}

module.exports = {
  fixturesParams,
  initElasticsearch
}

async function initElasticsearch ({ t }) {
  const initNow = new Date().toISOString()

  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'asset:list:all',
      'asset:read:all',
      'asset:create:all',
      'asset:edit:all',
      'asset:remove:all',
      'availability:create:all',
      'transaction:create:all'
    ],
    userId: fixturesParams.ownerId
  })

  const { body: asset1 } = await request(t.context.serverUrl)
    .post('/assets')
    .set(authorizationHeaders)
    .send({
      name: 'Toyota',
      ownerId: 'd61a76e5-8e8b-4660-8e3f-8ae0834c9662',
      assetTypeId: 'typ_RFpfQps1I3a1gJYz2I3a',
      locations: [
        { latitude: 0, longitude: 0 }
      ],
      // no currency, to test if search works without it
      active: true,
      validated: true
    })
    .expect(200)

  fixturesParams.assetsIds.asset1 = asset1.id

  await request(t.context.serverUrl)
    .patch(`/assets/${asset1.id}`)
    .set(authorizationHeaders)
    .send({
      locations: [
        { latitude: 10, longitude: 10 }
      ]
    })
    .expect(200)

  const { body: asset2 } = await request(t.context.serverUrl)
    .post('/assets')
    .set(authorizationHeaders)
    .send({
      name: 'Ford',
      ownerId: 'd61a76e5-8e8b-4660-8e3f-8ae0834c9662',
      assetTypeId: 'typ_MGsfQps1I3a1gJYz2I3a',
      locations: [
        { latitude: 1, longitude: 1 }
      ],
      // no currency, to test if search works without it
      active: true,
      validated: true
    })
    .expect(200)

  fixturesParams.assetsIds.asset2 = asset2.id

  await request(t.context.serverUrl)
    .patch(`/assets/${asset2.id}`)
    .set(authorizationHeaders)
    .send({
      name: 'Custom Ford',
      locations: [
        { latitude: 2, longitude: 2 }
      ]
    })
    .expect(200)

  const { body: asset3 } = await request(t.context.serverUrl)
    .post('/assets')
    .set(authorizationHeaders)
    .send({
      name: 'Ford',
      ownerId: '3135511d-719e-41a6-8753-36f188029eb1',
      assetTypeId: 'typ_RFpfQps1I3a1gJYz2I3a',
      locations: [
        { latitude: 20, longitude: 20 }
      ],
      currency: 'EUR',
      active: true,
      validated: true
    })
    .expect(200)

  fixturesParams.assetsIds.asset3 = asset3.id

  const { body: transaction3 } = await request(t.context.serverUrl)
    .post('/transactions')
    .set(authorizationHeaders)
    .send({
      assetId: asset3.id,
      startDate: computeDate(initNow, '5 days'),
      endDate: computeDate(initNow, '7 days'),
      quantity: 1,
      metadata: { dummy: true }
    })
    .expect(200)

  fixturesParams.transactionIds.transaction3 = transaction3.id

  // Deleted asset
  const { body: asset4 } = await request(t.context.serverUrl)
    .post('/assets')
    .set(authorizationHeaders)
    .send({
      name: 'Honda',
      ownerId: 'd61a76e5-8e8b-4660-8e3f-8ae0834c9662',
      assetTypeId: 'typ_MGsfQps1I3a1gJYz2I3a',
      locations: [],
      active: true,
      validated: true
    })
    .expect(200)

  fixturesParams.assetsIds.asset4 = asset4.id

  await request(t.context.serverUrl)
    .delete(`/assets/${asset4.id}`)
    .set(authorizationHeaders)
    .expect(200)

  const { body: asset5 } = await request(t.context.serverUrl)
    .post('/assets')
    .set(authorizationHeaders)
    .send({
      name: 'Chevrolet',
      ownerId: 'd61a76e5-8e8b-4660-8e3f-8ae0834c9662',
      assetTypeId: 'typ_ZU9fQps1I3a1gJYz2I3a',
      quantity: 5,
      locations: [
        { latitude: 50, longitude: 50 }
      ],
      active: true,
      validated: true,
      price: fixturesParams.basePrice,
      description: 'I have a price',
      currency: 'USD',
      customAttributes: {
        seatingCapacity: fixturesParams.lowSeatingCapacity
      }
    })
    .expect(200)

  fixturesParams.assetsIds.asset5 = asset5.id

  await request(t.context.serverUrl)
    .post('/availabilities')
    .set(authorizationHeaders)
    .send({
      assetId: asset5.id,
      startDate: computeDate(initNow, '2 days'),
      endDate: computeDate(initNow, '5 days'),
      quantity: 0,
      metadata: { dummy: true }
    })
    .expect(200)

  await request(t.context.serverUrl)
    .post('/availabilities')
    .set(authorizationHeaders)
    .send({
      assetId: asset5.id,
      startDate: computeDate(initNow, '7 days'),
      endDate: computeDate(initNow, '9 days'),
      quantity: 2,
      metadata: { dummy: true }
    })
    .expect(200)

  const { body: transaction5 } = await request(t.context.serverUrl)
    .post('/transactions')
    .set(authorizationHeaders)
    .send({
      assetId: asset5.id,
      startDate: computeDate(initNow, '11 days'),
      duration: { d: 3 },
      quantity: 1,
      metadata: { dummy: true }
    })
    .expect(200)

  fixturesParams.transactionIds.transaction5 = transaction5.id

  const { body: asset6 } = await request(t.context.serverUrl)
    .post('/assets')
    .set(authorizationHeaders)
    .send({
      name: 'Toyota',
      ownerId: 'd61a76e5-8e8b-4660-8e3f-8ae0834c9662',
      assetTypeId: 'typ_MnkfQps1I3a1gJYz2I3a',
      categoryId: 'ctgy_ejQQps1I3a1gJYz2I3a',
      locations: [
        { latitude: 8, longitude: 8 }
      ],
      currency: 'USD',
      active: true,
      validated: true,
      price: fixturesParams.basePrice + 6,
      description: 'I have a price',
      customAttributes: {
        seatingCapacity: fixturesParams.lowSeatingCapacity,
        customScore: 1000,
        licensePlate: '123456789',
        options: ['gps', 'convertible', 'sunroof'],
        automaticTransmission: true,
        make: 'Toyota',
        customDescription: 'This is a modern car'
      }
    })
    .expect(200)

  fixturesParams.assetsIds.asset6 = asset6.id

  const { body: asset7 } = await request(t.context.serverUrl)
    .post('/assets')
    .set(authorizationHeaders)
    .send({
      name: 'Big car',
      ownerId: 'd61a76e5-8e8b-4660-8e3f-8ae0834c9662',
      assetTypeId: 'typ_MnkfQps1I3a1gJYz2I3a',
      categoryId: 'ctgy_N1FQps1I3a1gJYz2I3a',
      locations: [
        { latitude: 10, longitude: 10 }
      ],
      currency: 'USD',
      active: true,
      validated: true,
      price: fixturesParams.basePrice + 7,
      description: 'Someday, I will be booked by a car lover.',
      customAttributes: {
        seatingCapacity: 7,
        customScore: 10000,
        licensePlate: '987654321',
        automaticTransmission: false,
        make: 'Chevrolet'
      }
    })
    .expect(200)

  fixturesParams.assetsIds.asset7 = asset7.id

  const { body: asset8 } = await request(t.context.serverUrl)
    .post('/assets')
    .set(authorizationHeaders)
    .send({
      name: 'A new car model',
      ownerId: 'd61a76e5-8e8b-4660-8e3f-8ae0834c9662',
      assetTypeId: 'typ_MnkfQps1I3a1gJYz2I3a',
      locations: [
        { latitude: 1, longitude: 1 }
      ],
      currency: 'USD',
      active: true,
      validated: true,
      description: 'My description is unique. Somehow, I will be booked by a car lover.',
      customAttributes: {
        seatingCapacity: fixturesParams.uniqueSeatingCapacity,
        customScore: 1,
        licensePlate: '132465798',
        options: ['sunroof'],
        automaticTransmission: false,
        make: 'Toyota',
        customDescription: ''
      }
    })
    .expect(200)

  fixturesParams.assetsIds.asset8 = asset8.id

  const { body: asset9 } = await request(t.context.serverUrl)
    .post('/assets')
    .set(authorizationHeaders)
    .send({
      name: 'Inactive Asset',
      ownerId: 'd61a76e5-8e8b-4660-8e3f-8ae0834c9662',
      assetTypeId: 'typ_MGsfQps1I3a1gJYz2I3a',
      locations: [],
      currency: 'USD',
      active: false,
      validated: true,
      customAttributes: {
        seatingCapacity: fixturesParams.lowSeatingCapacity,
        customScore: 1200
      },
      price: fixturesParams.basePrice + 9
    })
    .expect(200)

  fixturesParams.assetsIds.asset9 = asset9.id

  const { body: asset10 } = await request(t.context.serverUrl)
    .post('/assets')
    .set(authorizationHeaders)
    .send({
      name: 'Asset with null customScore',
      ownerId: 'd61a76e5-8e8b-4660-8e3f-8ae0834c9662',
      assetTypeId: 'typ_MGsfQps1I3a1gJYz2I3a',
      locations: [{ latitude: 9, longitude: 9 }],
      currency: 'USD',
      active: true,
      validated: true,
      customAttributes: {
        seatingCapacity: fixturesParams.lowSeatingCapacity,
        customScore: null
      },
      price: fixturesParams.basePrice + 0.9
    })
    .expect(200)

  fixturesParams.assetsIds.asset10 = asset10.id

  const { body: asset11 } = await request(t.context.serverUrl)
    .post('/assets')
    .set(authorizationHeaders)
    .send({
      name: 'Großes Auto', // 'Big car' in German
      ownerId: 'd61a76e5-8e8b-4660-8e3f-8ae0834c9662',
      assetTypeId: 'typ_MnkfQps1I3a1gJYz2I3a',
      locations: [
        { latitude: 90, longitude: 90 }
      ],
      currency: 'USD',
      active: true,
      validated: true,
      price: fixturesParams.basePrice + 7,
      // 'Someday, I will be booked by a car lover.' in German
      description: 'Eines Tages werde ich von einem Autoliebhaber gebucht.'
    })
    .expect(200)

  fixturesParams.assetsIds.asset11 = asset11.id

  const { body: asset12 } = await request(t.context.serverUrl)
    .post('/assets')
    .set(authorizationHeaders)
    .send({
      name: 'Ein neues modell', // 'A new model' in German
      ownerId: 'd61a76e5-8e8b-4660-8e3f-8ae0834c9662',
      assetTypeId: 'typ_MnkfQps1I3a1gJYz2I3a',
      locations: [
        { latitude: 90, longitude: 90 }
      ],
      currency: 'USD',
      active: true,
      validated: true,
      // 'My description is unique. Somehow, I will be booked by a car lover.' in German
      description: 'Meine Beschreibung ist einzigartig. Irgendwie werde ich von einem Autoliebhaber gebucht.'
    })
    .expect(200)

  fixturesParams.assetsIds.asset12 = asset12.id

  const { body: asset13 } = await request(t.context.serverUrl)
    .post('/assets')
    .set(authorizationHeaders)
    .send({
      name: '大車', // 'Big car' in Chinese
      ownerId: 'usr_Y0tfQps1I3a1gJYz2I3a',
      assetTypeId: 'typ_MnkfQps1I3a1gJYz2I3a',
      locations: [
        { latitude: 90, longitude: 90 }
      ],
      currency: 'USD',
      active: true,
      validated: true,
      price: fixturesParams.basePrice + 7,
      // 'Someday, I will be booked by a car lover.' in Chinese
      description: '總有一天，我會被汽車愛好者預訂。'
    })
    .expect(200)

  fixturesParams.assetsIds.asset13 = asset13.id

  const { body: asset14 } = await request(t.context.serverUrl)
    .post('/assets')
    .set(authorizationHeaders)
    .send({
      name: '一個新的模型', // 'A new model' in Chinese
      ownerId: 'd61a76e5-8e8b-4660-8e3f-8ae0834c9662',
      assetTypeId: 'typ_MnkfQps1I3a1gJYz2I3a',
      locations: [
        { latitude: 90, longitude: 90 }
      ],
      currency: 'USD',
      active: true,
      validated: true,
      // 'My description is unique. Somehow, I will be booked by a car lover.' in Chinese
      description: '我的描述很獨特。 不知何故，我將被汽車愛好者預訂。'
    })
    .expect(200)

  fixturesParams.assetsIds.asset14 = asset14.id

  // For ElasticSearch internal pagination test

  const nbUnavailableAssets = 5
  const nbAvailableAssets = 5

  const createParams = {
    name: 'Asset with zero quantity',
    ownerId: 'd61a76e5-8e8b-4660-8e3f-8ae0834c9662',
    assetTypeId: 'typ_MGsfQps1I3a1gJYz2I3a',
    locations: [],
    currency: 'USD',
    active: true,
    validated: true,
    customAttributes: {
      customDescription: 'elasticsearch pagination'
    }
  }

  const unavailableCreateParams = Object.assign({}, createParams, {
    name: 'Asset with zero quantity',
    quantity: 0
  })

  for (let i = 0; i < nbUnavailableAssets; i++) {
    await request(t.context.serverUrl)
      .post('/assets')
      .set(authorizationHeaders)
      .send(unavailableCreateParams)
      .expect(200)
  }

  const availableCreateParams = Object.assign({}, createParams, {
    name: 'Asset with one quantity',
    quantity: 1
  })

  for (let i = 0; i < nbAvailableAssets; i++) {
    const { body: availableAsset } = await request(t.context.serverUrl)
      .post('/assets')
      .set(authorizationHeaders)
      .send(availableCreateParams)
      .expect(200)

    fixturesParams.assetsIds[`paginationAsset${i + 1}`] = availableAsset.id
  }

  // let Elasticsearch synchronize the assets
  await new Promise(resolve => setTimeout(resolve, 2000))

  return initNow
}
