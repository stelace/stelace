require('dotenv').config()

const jwt = require('jsonwebtoken')
const request = require('supertest')

const defaultUserId = 'usr_QVQfQps1I3a1gJYz2I3a'

async function getAccessTokenHeaders ({
  userId = defaultUserId,
  permissions = [],
  readNamespaces = [],
  editNamespaces = [],
  apiVersion,
  t
}) {
  const accessToken = await getAccessToken({
    userId,
    permissions,
    readNamespaces,
    editNamespaces
  })

  const headers = {
    authorization: `Bearer ${accessToken}`,
    // TODO: use an API key instead of these special headers
    'x-platform-id': t.context.platformId,
    'x-stelace-env': t.context.env
  }

  if (apiVersion) {
    headers['x-stelace-version'] = apiVersion
  }

  return headers
}

async function getAccessToken ({
  userId = defaultUserId,
  permissions = [],
  readNamespaces = [],
  editNamespaces = []
} = {}) {
  const token = jwt.sign({
    sub: userId,
    scope: permissions.join(' '),
    readNamespaces,
    editNamespaces
  }, 'secret', {
    algorithm: 'HS256',
    expiresIn: '2h'
  })

  return token
}

async function refreshAccessToken (refreshToken, { status = 200, userAgent, requester, t } = {}) {
  const res = await requester
    .post('/auth/token')
    .set('user-agent', userAgent || 'node-superagent/3.8.3')
    .set('x-platform-id', t.context.platformId)
    .set('x-stelace-env', t.context.env)
    .send({
      grantType: 'refreshToken',
      refreshToken
    })
    .expect(status)

  return res.body
}

function getSystemKey () {
  return process.env.SYSTEM_KEY
}

async function getApiKey ({
  t,
  name = 'New Api key',
  type = 'seck',
  roles,
  permissions,
  env
}) {
  const accessToken = await getAccessToken({ permissions: ['apiKey:create:all'] })

  const { body: apiKey } = await request(t.context.serverUrl)
    .post('/api-keys')
    .set({
      authorization: `Bearer ${accessToken}`,
      'x-platform-id': t.context.platformId,
      'x-stelace-env': env || t.context.env
    })
    .send({ name, type, roles, permissions })
    .expect(200)

  return apiKey
}

module.exports = {
  defaultUserId,
  getAccessTokenHeaders,

  getAccessToken,
  refreshAccessToken,
  getSystemKey,
  getApiKey
}
