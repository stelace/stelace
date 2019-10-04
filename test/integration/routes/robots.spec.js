require('dotenv').config()

const test = require('ava')
const request = require('supertest')

const { before, beforeEach, after } = require('../../lifecycle')

test.before(before({ name: 'routes/robots' }))
test.beforeEach(beforeEach())
test.after(after())

test('disallows bots with robots.txt', async (t) => {
  const { text: response } = await request(t.context.serverUrl)
    .get('/robots.txt')
    .expect(200)

  t.true(response.includes('Disallow:'))
})
