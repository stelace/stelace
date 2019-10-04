require('dotenv').config()

const test = require('ava')
const request = require('supertest')

const { before, beforeEach, after } = require('../test/lifecycle')
const { getAccessTokenHeaders } = require('../test/auth')

const seedData = process.env.INSTANT_DATA === 'true'

// only trigger lifecycle methods if INSTANT_DATA is true
if (seedData) {
  test.before(before({
    name: 'instantData',
    platformId: 1, // same as platformId encoded in API keys generated
    env: 'test'
  }))
  test.beforeEach(beforeEach())
  test.after(after())
}

test('initializing data', async (t) => {
  if (!seedData) {
    t.pass()
    return
  }

  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'apiKey:list:all',
      'apiKey:create:all' // needed to "reveal" the secret key
    ]
  })

  const { body: { results: apiKeys } } = await request(t.context.serverUrl)
    .get('/api-keys?reveal=1')
    .set(authorizationHeaders)
    .expect(200)

  const secretApiKey = apiKeys.find(apiKey => apiKey.key.startsWith('seck'))
  const publishableApiKey = apiKeys.find(apiKey => apiKey.key.startsWith('pubk'))

  console.log(`
    --------
    API Keys

    Test environment:
    Secret API key: ${secretApiKey.key}
    Publishable API key: ${publishableApiKey.key}

    Live environment:
    Secret API key: ${secretApiKey.key.replace('_test_', '_live_')}
    Publishable API key: ${publishableApiKey.key.replace('_test_', '_live_')}
  `)
  t.pass()
})
