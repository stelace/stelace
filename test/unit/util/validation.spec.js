const test = require('ava')

const Uuid = require('uuid')

const {
  isUUIDV4,
  isValidObjectId
} = require('../../../src/util/validation')

const {
  getRandomString,
  getObjectId,
  getRandomPlatformId,
  objectIdLength
} = require('stelace-util-keys')

test('checks UUID is valid', (t) => {
  for (let i = 0; i < 1000; i++) {
    t.true(isUUIDV4(Uuid.v4()))
  }

  t.false(isUUIDV4(true))
  t.false(isUUIDV4('true'))

  t.true(isUUIDV4('4b00611c-b790-4b22-83e3-a6d24b8a82fc'))
  t.false(isUUIDV4('4b00611c-b790-4b22-83e3-a6d24b8a82fcd')) // UUID format + 1 character
  t.false(isUUIDV4('4b00611c-b790-4b22-83e3-a6d24b8a82f')) // UUID format - 1 character
})

test('checks objectId is valid', async (t) => {
  const prefix = 'usr'

  for (let i = 0; i < 1000; i++) {
    const platformId = getRandomPlatformId()
    t.true(isValidObjectId({
      id: await getObjectId({
        prefix,
        platformId
      }),
      prefix,
      platformId,
      unitTest: true // testing real platformIds despite NODE_ENV being test
    }))
    t.false(isValidObjectId(Uuid.v4()))
  }

  t.false(isValidObjectId({
    // randomString faking objectId without encoded platformId required
    id: await getRandomString(objectIdLength, { prefix, separator: '_' }),
    prefix
  }))

  t.false(isValidObjectId({
    id: await getObjectId({
      prefix,
      platformId: getRandomPlatformId()
    }) + 'A', // expected length + 1
    prefix
  }))

  t.false(isValidObjectId({
    id: (await getObjectId({
      prefix,
      platformId: getRandomPlatformId()
    })).slice(1), // expected length - 1
    prefix
  }))

  t.false(isValidObjectId({
    id: 'ast' + (await getObjectId({
      prefix,
      platformId: getRandomPlatformId()
    })).slice(3), // change prefix
    prefix
  }))

  t.false(isValidObjectId(true))
  t.false(isValidObjectId('true'))

  t.false(isValidObjectId('4b00611c-b790-4b22-83e3-a6d24b8a82fcd')) // UUID format + 1 character
  t.false(isValidObjectId('4b00611c-b790-4b22-83e3-a6d24b8a82f')) // UUID format - 1 character
})
