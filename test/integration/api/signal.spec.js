require('dotenv').config()

const test = require('ava')
const request = require('supertest')
const io = require('socket.io-client')
const _ = require('lodash')

const { before, beforeEach, after } = require('../../lifecycle')
const { getAccessTokenHeaders, getApiKey, getAccessToken } = require('../../auth')

const sockets = {
  authenticated: null,
  validApiKey: null,
  invalidApiKey: null,
  authenticatedOrg: null,
  notSomeOrgMember: null,
  missingAuthTokenForOrg: null,
  missingAuthTokenForUserIdChannel: null,
  severalUserIds: null,
  live: null,
  timeout: null
}
const socketsData = _.mapValues(sockets, () => [])

const userId = 'usr_WHlfQps1I3a1gJYz2I3a'
const user2Id = 'usr_Y0tfQps1I3a1gJYz2I3a'
const userOrganizationId = 'org_xC3ZlGs1Jo71gb2G0Jo7'
const notUserOrganizationId = 'org_toMLWis1EpB1gwNcfEpB'

const defaultTestDelay = 2000

const message1 = 'plain string'
const message2 = { content: 'can use an object with any property too' }
const eventName = 'test_event-name'
const apiKeyChannel = 'apiKeyChannel'

test.before(async (t) => {
  await before({ name: 'signal' })(t)
  await beforeEach()(t)

  const apiKey = await getApiKey({ t, type: 'pubk' })
  const apiKeyLive = await getApiKey({ t, env: 'live', type: 'pubk' })

  const userAccessToken = await getAccessToken({ userId })
  const user2AccessToken = await getAccessToken({ user2Id })

  const createSocket = (name, cbData, waitMs = 0) => {
    sockets[name] = io.connect(`http://localhost:${t.context.serverPort}/signal`, { path: '/signal' })

    return new Promise(resolve => {
      sockets[name].on('authentication', async function (socketId, subscribeCb) {
        sockets[name].on('signal', data => socketsData[name].push(data))
        sockets[name].on(eventName, data => socketsData[name].push(data))
        sockets[name].on('warning', w => socketsData[name].push(`warning: ${w}`))
        sockets[name].on('willDisconnect', r => socketsData[name].push(`willDisconnect: ${r.error}`))
        // native event
        sockets[name].on('disconnect', reason => socketsData[name].push(`disconnect: ${reason}`))

        if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs))
        subscribeCb(cbData)
        resolve()
      })
    })
  }

  await createSocket('authenticated', {
    channels: `${userId}_friends_channel`,
    authToken: userAccessToken, // automatically joining userId channel
    publishableKey: apiKey.key
  })

  await createSocket('validApiKey', {
    channels: apiKeyChannel,
    publishableKey: apiKey.key
  })

  await createSocket('invalidApiKey', {
    channels: apiKeyChannel,
    publishableKey: 'invalid'
  })

  await createSocket('authenticatedOrg', {
    channels: [userId, userOrganizationId], // single userId channel can be explicitly included too
    authToken: userAccessToken, // required to join user and org channels
    publishableKey: apiKey.key
  })

  await createSocket('notSomeOrgMember', {
    // user doesn't belong to one of two orgs, but will still join other channels
    channels: [`${userId}_friends_channel`, userOrganizationId, notUserOrganizationId],
    authToken: userAccessToken, // automatically joining userId channel
    publishableKey: apiKey.key
  })

  await createSocket('missingAuthTokenForOrg', {
    channels: [`${userId}_friends_channel`, notUserOrganizationId], // no auth token provided
    publishableKey: apiKey.key
  })

  await createSocket('missingAuthTokenForUserIdChannel', {
    channels: userId,
    // authToken: userAccessToken, // required to join userId channel
    publishableKey: apiKey.key
  })

  await createSocket('severalUserIds', {
    channels: [userId, user2Id], // can only subscribe to own user channel so this will fail
    authToken: userAccessToken, // matching userId but not user2Id
    publishableKey: apiKey.key
  })

  await createSocket('live', {
    channels: user2Id,
    authToken: user2AccessToken, // required to join userId channel
    publishableKey: apiKeyLive.key
  })

  await createSocket('timeout', {
    channels: user2Id,
    publishableKey: apiKey.key
  }, 3000)
})
// test.beforeEach(beforeEach()) // no need to reset database before each test
test.after(async (t) => {
  _.forEach(sockets, socket => socket.close())
  after()(t)
})

test('emits signal to single client', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: [] })

  const { body: result } = await request(t.context.serverUrl)
    .post('/signal')
    .set(authorizationHeaders)
    .send({
      message: message1,
      destination: userId
    })
    .expect(200)

  t.is(result.destination, userId)
  t.is(result.message, message1)

  await new Promise(resolve => setTimeout(resolve, defaultTestDelay))

  t.true(socketsData.authenticated.some(d => d.message === message1))
  t.true(socketsData.authenticatedOrg.some(d => d.message === message1))
  t.true(socketsData.notSomeOrgMember.some(d => d.message === message1))

  // Different channel / environment
  t.false(socketsData.validApiKey.some(d => d.message === message1))
  t.false(socketsData.live.some(d => d.message === message1))
  // failed authentication
  t.false(socketsData.invalidApiKey.some(d => d.message === message1))
  t.false(socketsData.missingAuthTokenForOrg.some(d => d.message === message1))
  t.false(socketsData.missingAuthTokenForUserIdChannel.some(d => d.message === message1))
  t.false(socketsData.severalUserIds.some(d => d.message === message1))
  t.false(socketsData.timeout.some(d => d.message === message1))
})

test('broadcasts signal to all authenticated clients with appropriate permissions', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['signal:create:all'] })

  const { body: result } = await request(t.context.serverUrl)
    .post('/signal')
    .set(authorizationHeaders)
    .send({
      message: message2
      // destination: 'broadcast'
    })
    .expect(200)

  t.falsy(result.destination)
  t.deepEqual(result.message, message2)

  await new Promise(resolve => setTimeout(resolve, defaultTestDelay))

  t.true(socketsData.authenticated.some(d => _.isEqual(d.message, message2)))
  t.true(socketsData.validApiKey.some(d => _.isEqual(d.message, message2)))
  t.true(socketsData.authenticatedOrg.some(d => _.isEqual(d.message, message2)))
  t.true(socketsData.notSomeOrgMember.some(d => _.isEqual(d.message, message2)))

  // Unauthenticated socket
  t.false(socketsData.invalidApiKey.some(d => _.isEqual(d.message, message2)))
  t.false(socketsData.missingAuthTokenForOrg.some(d => _.isEqual(d.message, message2)))
  t.false(socketsData.missingAuthTokenForUserIdChannel.some(d => _.isEqual(d.message, message2)))
  t.false(socketsData.severalUserIds.some(d => d.message === message2))
  t.false(socketsData.timeout.some(d => _.isEqual(d.message, message2)))

  // Different environment
  t.false(socketsData.live.some(d => _.isEqual(d.message, message2)))
})

test('broadcasts named signal event to all authenticated clients', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['signal:create:all'] })

  const { body: result } = await request(t.context.serverUrl)
    .post('/signal')
    .set(authorizationHeaders)
    .send({
      message: message2,
      event: `  ${eventName} ` // automatically trimmed
      // destination: 'broadcast'
    })
    .expect(200)

  t.falsy(result.destination)
  t.deepEqual(result.message, message2)

  await new Promise(resolve => setTimeout(resolve, defaultTestDelay))

  t.true(socketsData.authenticated.some(d => _.isEqual(d.event, eventName)))
  t.true(socketsData.validApiKey.some(d => _.isEqual(d.event, eventName)))
  t.true(socketsData.authenticatedOrg.some(d => _.isEqual(d.event, eventName)))
  t.true(socketsData.notSomeOrgMember.some(d => _.isEqual(d.event, eventName)))

  // Unauthenticated socket
  t.false(socketsData.invalidApiKey.some(d => _.isEqual(d.event, eventName)))
  t.false(socketsData.missingAuthTokenForOrg.some(d => _.isEqual(d.event, eventName)))
  t.false(socketsData.severalUserIds.some(d => _.isEqual(d.event, eventName)))
  t.false(socketsData.timeout.some(d => _.isEqual(d.event, eventName)))
  t.false(socketsData.missingAuthTokenForUserIdChannel.some(d => _.isEqual(d.event, eventName)))

  // Different environment
  t.false(socketsData.live.some(d => _.isEqual(d.event, eventName)))
})

test('emits warning when trying to join channel of an organization user is not a member of', async (t) => {
  t.true(socketsData.notSomeOrgMember.some(
    d => typeof d === 'string' && d.startsWith('warning:') && d.includes('not granted'))
  )
})

test('disconnects unauthenticated or invalid clients', async (t) => {
  // Let authentication happen
  await new Promise(resolve => setTimeout(resolve, 1.5 * defaultTestDelay))

  const validSockets = [
    socketsData.authenticated,
    socketsData.validApiKey,
    socketsData.authenticatedOrg,
    socketsData.notSomeOrgMember,
    socketsData.live
  ]
  t.false(validSockets.some(sock => {
    const disconnect = sock.some(d => typeof d === 'string' && d.startsWith('disconnect:'))
    const willDisconnect = sock.some(d => typeof d === 'string' && d.startsWith('willDisconnect:'))
    return sock.disconnected || disconnect || willDisconnect
  }))

  const invalidSockets = [
    socketsData.invalidApiKey,
    socketsData.missingAuthTokenForOrg,
    socketsData.missingAuthTokenForUserIdChannel,
    socketsData.severalUserIds,
    socketsData.timeout
  ]
  invalidSockets.forEach((sock, index) => {
    t.true(sock.some(d => typeof d === 'string' && d.startsWith('willDisconnect:')))
    t.true(sock.some(d => typeof d === 'string' && d.startsWith('disconnect:') && d.includes('server')))
  })
  t.true(socketsData.invalidApiKey.some(d => typeof d === 'string' && d.includes('key')))
  t.true(socketsData.missingAuthTokenForOrg.some(d => typeof d === 'string' && d.includes('token')))
  t.true(socketsData.missingAuthTokenForUserIdChannel.some(d => typeof d === 'string' && d.includes('token')))
  t.true(socketsData.severalUserIds.some(d => typeof d === 'string' && d.includes('own')))
  t.true(socketsData.timeout.some(d => typeof d === 'string' && d.includes('timeout')))
})

test('can’t emit signal to all clients without appropriate permissions', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: [] })

  await request(t.context.serverUrl)
    .post('/signal')
    .set(authorizationHeaders)
    .send({
      message: { content: 'this will fail' }
      // destination: 'broadcast'
    })
    .expect(403)

  t.pass()
})

// ////////// //
// VALIDATION //
// ////////// //

test('fails to create a signal if missing or invalid parameters', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: ['signal:create:all'] })
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/signal')
    .set(authorizationHeaders)
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/signal')
    .set(authorizationHeaders)
    .send({
      message: undefined, // can be anything
      destination: {},
      event: 'invalid::char'
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"destination" must be a string'))
  t.true(error.message.includes('event'))
  t.regex(error.message, /event.*pattern/i)
})
