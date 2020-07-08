require('dotenv').config()

const test = require('ava')
const request = require('supertest')
const jwt = require('jsonwebtoken')
const sinon = require('sinon')
const { URL } = require('url')
const _ = require('lodash')
const puppeteer = require('puppeteer-core')

const { before, beforeEach, after } = require('../../lifecycle')
const { getAccessTokenHeaders, refreshAccessToken, getSystemKey, getAccessToken } = require('../../auth')
const { getObjectEvent, testEventMetadata } = require('../../util')
const { encodeBase64 } = require('../../../src/util/encoding')

const createOidcServer = require('../../../test/oauth/server')

const OAUTH_TEST_CONFIGS = (() => {
  try {
    /**
     * process.env.OAUTH_TEST_CONFIGS must be a JSON stringified object with the following format:
     * {
     *   "<provider>": {
     *     "credentials": {
     *       "username": ""
     *       "password": ""
     *     },
     *     "ssoConnection": {
     *       "clientId": "",
     *       "clientSecret": ""
     *     }
     *   }
     * }
     *
     * Currently, the following providers are tested: 'github' and 'facebook'
     */

    return JSON.parse(process.env.OAUTH_TEST_CONFIGS)
  } catch (err) {
    return {}
  }
})()

const shouldExecuteBuiltInSSOTest = (() => {
  return typeof !process.env.CIRCLECI ||
    (
      process.env.CIRCLECI &&
        (process.env.CIRCLE_BRANCH !== 'dev' || !process.env.CIRCLE_BRANCH.startsWith('dependabot/'))
    )
})()

function getOAuthConfiguration (provider) {
  const config = OAUTH_TEST_CONFIGS[provider]
  if (!config) return

  if (!config.credentials || !config.credentials.username || !config.credentials.password) {
    throw new Error(`Invalid credentials for provider: ${provider}`)
  }

  if (!config.ssoConnection || !config.ssoConnection.clientId || !config.ssoConnection.clientSecret) {
    throw new Error(`Invalid SSO connection for provider: ${provider}`)
  }

  return {
    credentials: OAUTH_TEST_CONFIGS[provider].credentials,
    ssoConnection: OAUTH_TEST_CONFIGS[provider].ssoConnection,
  }
}

async function checkElementVisible (page, selector, timeout = 5000) {
  try {
    // https://github.com/puppeteer/puppeteer/blob/v5.0.0/docs/api.md#pagewaitforselectorselector-options
    // waits until the element exists and is visible
    await page.waitForSelector(selector, { timeout, visible: true })
    return true
  } catch (err) {
    return false
  }
}

const adminUserId = 'usr_WHlfQps1I3a1gJYz2I3a' // username: 'admin'

let authorizationServerPort
let authorizationServerUrl
let authorizationApp

const oauthSSOData = {
  userId: '123456789',
  name: 'Github user',
  email: 'oauth2@github.com'
}
const openIdSSOData = {
  userId: '23121d3c-84df-44ac-b458-3d63a9a05497', // string ID
  name: 'OpenID user',
  email: 'openid@example.com'
}
const openIdSSOData2 = {
  userId: '23121d3c-84df-44ac-b458-3d63a9a05497',
  name: null,
  email: null,
  firstname: 'New firstname',
  lastname: 'New lastname'
}

const authorizationServerInfo = {
  issuer: 'http://issuer.com',
  clientId: 'clientId',
  clientSecret: 'clientSecret',
  scope: 'openid email name'
}

let apiServerUrl
let publicPlatformId

async function checkOAuthProcess ({ t, provider, ssoConnection, afterAuthenticationUrl, executeBrowserScenario }) {
  const systemKey = getSystemKey()

  // add SSO connection
  await request(t.context.serverUrl)
    .patch('/config/private')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-system-key': systemKey,
      'x-stelace-env': t.context.env
    })
    .send({
      stelace: {
        ssoConnections: {
          [provider]: Object.assign({}, ssoConnection, {
            protocol: 'oauth2',
            afterAuthenticationUrl,
            active: true
          })
        }
      }
    })
    .expect(200)

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    args: ['--disable-dev-shm-usage', '--no-sandbox']
  })

  const page = await browser.newPage()

  // Chrome on Linux
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36')

  await executeBrowserScenario({ browser, page })

  await new Promise(resolve => setTimeout(resolve, 1000))

  const afterLoginRedirectUrl = page.url()
  t.true(afterLoginRedirectUrl.startsWith(afterAuthenticationUrl))

  const applicationCodeUrlObj = new URL(afterLoginRedirectUrl)
  t.is(typeof applicationCodeUrlObj.searchParams.get('code'), 'string')
  t.is(applicationCodeUrlObj.searchParams.get('status'), 'success')

  const { body: obj } = await request(t.context.serverUrl)
    .post('/auth/token')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      code: applicationCodeUrlObj.searchParams.get('code'),
      grantType: 'authorizationCode'
    })
    .expect(200)

  t.is(typeof obj, 'object')
  t.is(obj.tokenType, 'Bearer')
  t.is(typeof obj.accessToken, 'string')
  t.is(typeof obj.refreshToken, 'string')
  t.truthy(obj.userId)

  const token = jwt.decode(obj.accessToken)
  t.is(typeof token, 'object')
  t.is(typeof token.loggedAt, 'number')
  t.deepEqual(token.roles, ['user', 'provider'])
  t.truthy(token.userId)

  // Tokens can only be fetched once
  const { body: getTokenError } = await request(t.context.serverUrl)
    .post('/auth/token')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      code: applicationCodeUrlObj.searchParams.get('code'),
      grantType: 'authorizationCode'
    })
    .expect(422)

  t.true(getTokenError.message.includes('already used'))

  const ssoAuthorizationHeaders = {
    'x-platform-id': t.context.platformId,
    'x-stelace-env': t.context.env,
    authorization: `${obj.tokenType} ${obj.accessToken}`
  }

  // fetch the created user
  const { body: user } = await request(t.context.serverUrl)
    .get(`/users/${token.userId}`)
    .set(ssoAuthorizationHeaders)
    .expect(200)

  t.deepEqual(user.roles, ['user', 'provider'])
  t.true(user.platformData.ssoProviders.includes(provider))

  await browser.close()
}

test.before(async t => {
  // set fixed values to be able to test OAuth authentication with external providers
  // with stable URLs
  // App URL: http://localhost:9461
  // Authorization callback URL: http://localhost:7645/auth/sso/e8_test/${provider}/callback
  // Current tested providers: 'github', 'facebook'
  process.env.SERVER_PORT = 7645
  const oauthServerPort = 9461

  await before({
    name: 'authentication',
    platformId: 8,
    useFreePort: false
  })(t)
  await beforeEach()(t)

  publicPlatformId = `e${t.context.platformId}_${t.context.env}`
  apiServerUrl = `http://localhost:${t.context.serverPort}`

  // use the previous free port to start the authorization server
  await new Promise((resolve, reject) => {
    const authorizationServer = createOidcServer({
      loginRedirectUrl: [
        `${apiServerUrl}/auth/sso/${publicPlatformId}/my_github/callback`,
        `${apiServerUrl}/auth/sso/${publicPlatformId}/custom_openid/callback`
      ],
      logoutRedirectUrl: `${apiServerUrl}/auth/sso/${publicPlatformId}/custom_openid/logout/callback`,
      clientId: authorizationServerInfo.clientId,
      clientSecret: authorizationServerInfo.clientSecret,
      issuer: authorizationServerInfo.issuer
    })

    // add new routes to be used after login or logout redirection
    authorizationServer.get('/', (req, res, next) => {
      res.send('<p>login</p>')
      next()
    })

    authorizationServer.get('/logout', (req, res, next) => {
      res.send('<p>logout</p>')
      next()
    })

    authorizationApp = authorizationServer.listen(oauthServerPort, (err) => {
      if (err) return reject(err)

      // dynamically get a free port
      authorizationServerPort = authorizationApp.address().port
      authorizationServerUrl = `http://localhost:${authorizationServerPort}`

      resolve()
    })
  })
})
// test.beforeEach(beforeEach()) // Concurrent tests are much faster
test.after(async (t) => {
  await after()(t)
  await authorizationApp.close()
})

test('login', async (t) => {
  const { body: obj1 } = await request(t.context.serverUrl)
    .post('/auth/login')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      username: 'user',
      password: 'user'
    })
    .expect(200)

  t.is(typeof obj1, 'object')
  t.is(obj1.tokenType, 'Bearer')
  t.is(typeof obj1.accessToken, 'string')
  t.is(typeof obj1.refreshToken, 'string')
  t.is(obj1.userId, 'usr_Y0tfQps1I3a1gJYz2I3a')

  const token = jwt.decode(obj1.accessToken)
  t.is(typeof token, 'object')
  t.is(typeof token.loggedAt, 'number')
  t.true(Array.isArray(token.roles))
  t.is(token.userId, 'usr_Y0tfQps1I3a1gJYz2I3a')

  // check that the public role permissions are added to authenticated user
  // otherwise authenticated users can have less permissions than unauthenticated ones
  // if they have no roles
  // 'auth:login' is only available in public role
  const { body: obj2 } = await request(t.context.serverUrl)
    .post('/auth/login')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env,
      authorization: `${obj1.tokenType} ${obj1.accessToken}`
    })
    .send({
      username: 'user',
      password: 'user'
    })
    .expect(200)

  t.is(typeof obj2, 'object')
  t.is(obj2.tokenType, 'Bearer')
  t.is(typeof obj2.accessToken, 'string')
  t.is(typeof obj2.refreshToken, 'string')
  t.is(obj2.userId, 'usr_Y0tfQps1I3a1gJYz2I3a')

  const token2 = jwt.decode(obj2.accessToken)
  t.is(typeof token2, 'object')
  t.is(typeof token2.loggedAt, 'number')
  t.true(Array.isArray(token2.roles))
  t.is(token2.userId, 'usr_Y0tfQps1I3a1gJYz2I3a')
})

test('logout', async (t) => {
  await refreshAccessToken('refreshToken1', { status: 200, t, requester: request(t.context.serverUrl) })

  await request(t.context.serverUrl)
    .post('/auth/logout')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      refreshToken: 'refreshToken1'
    })
    .expect(200)

  // cannot refresh token anymore
  await refreshAccessToken('refreshToken1', { status: 403, t, requester: request(t.context.serverUrl) })

  t.pass()
})

test('refreshes access token', async (t) => {
  const result = await refreshAccessToken('refreshToken1', { t, requester: request(t.context.serverUrl) })

  t.is(typeof result, 'object')
  t.is(result.tokenType, 'Bearer')
  t.is(typeof result.accessToken, 'string')

  const token = jwt.decode(result.accessToken)
  t.is(typeof token, 'object')
  t.is(typeof token.loggedAt, 'number')
  t.true(Array.isArray(token.roles))
  t.is(token.userId, 'usr_WHlfQps1I3a1gJYz2I3a')
})

test('fails to refresh token if the refresh token is forged', async (t) => {
  await refreshAccessToken('fakeRefreshToken', { status: 403, t, requester: request(t.context.serverUrl) })

  t.pass()
})

// Must be serial because the test bends time and changes the config
test.serial('fails to refresh token if the refresh token is expired', async (t) => {
  const systemKey = getSystemKey()

  // Must specify which functions Sinon should fake
  // By default, it fakes all timer functions, that can lead the server to not respond anymore.
  // https://github.com/sinonjs/sinon/issues/960
  const clock = sinon.useFakeTimers({
    now: new Date(),
    toFake: ['Date'] // we're only interested in faking dates
  })

  const defaultExpirationDuration = 14 * 24 * 3600 * 1000 // 14 days

  const { body: { refreshToken } } = await request(t.context.serverUrl)
    .post('/auth/login')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      username: 'admin',
      password: 'admin'
    })
    .expect(200)

  await refreshAccessToken(refreshToken, { status: 200, t, requester: request(t.context.serverUrl) })
  clock.tick(defaultExpirationDuration)
  await refreshAccessToken(refreshToken, { status: 200, t, requester: request(t.context.serverUrl) })

  clock.tick(1000)
  await refreshAccessToken(refreshToken, { status: 403, t, requester: request(t.context.serverUrl) })

  // set the refresh token expiration duration at 1 day
  await request(t.context.serverUrl)
    .patch('/config/private')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env,
      'x-stelace-system-key': systemKey
    })
    .send({
      stelace: {
        stelaceAuthRefreshTokenExpiration: { d: 1 }
      }
    })
    .expect(200)

  const { body: { refreshToken: refreshToken2 } } = await request(t.context.serverUrl)
    .post('/auth/login')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      username: 'admin',
      password: 'admin'
    })
    .expect(200)

  const oneDayInMs = 24 * 3600 * 1000

  await refreshAccessToken(refreshToken2, { status: 200, t, requester: request(t.context.serverUrl) })
  clock.tick(oneDayInMs)
  await refreshAccessToken(refreshToken2, { status: 200, t, requester: request(t.context.serverUrl) })

  clock.tick(1000)
  await refreshAccessToken(refreshToken2, { status: 403, t, requester: request(t.context.serverUrl) })

  // reset the refresh token expiration duration
  await request(t.context.serverUrl)
    .patch('/config/private')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env,
      'x-stelace-system-key': systemKey
    })
    .send({
      stelace: {
        stelaceAuthRefreshTokenExpiration: null
      }
    })
    .expect(200)

  t.pass()

  clock.restore()
})

// Must run serially because config and plan are updated
test.serial('configures built-in SSO providers', async (t) => {
  const systemKey = getSystemKey()

  // can be any URL, localhost URL is used to prevent failing tests due to external conditions
  // like bad network or remote server disruption
  const afterAuthenticationUrl = authorizationServerUrl

  const githubConnection = {
    protocol: 'oauth2',
    authorizationUrl: `${authorizationServerUrl}/login/oauth/authorize`,
    authorizationQueryParams: { allow_signup: true },
    tokenUrl: `${authorizationServerUrl}/login/oauth/access_token`,
    tokenBodyParams: { someValue: 'random' },
    clientId: authorizationServerInfo.clientId,
    clientSecret: authorizationServerInfo.clientSecret,
    scope: authorizationServerInfo.scope,
    userInfoUrl: `${authorizationServerUrl}/user`,
    userInfoMapping: {
      displayName: 'name',
      email: 'email'
    },
    afterAuthenticationUrl,
    active: true
  }

  const { body: error } = await request(t.context.serverUrl)
    .patch('/config/private')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env,
      'x-stelace-system-key': systemKey
    })
    .send({
      stelace: {
        ssoConnections: {
          github: githubConnection
        }
      }
    })
    .expect(400)

  t.true(error.message.includes('github'))

  await request(t.context.serverUrl)
    .patch('/config/private')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env,
      'x-stelace-system-key': systemKey
    })
    .send({
      stelace: {
        ssoConnections: {
          github: _.omit(githubConnection, [
            'protocol', // protocol is optional for built-in connections
            'authorizationUrl',
            'tokenUrl',
            'userInfoUrl'
          ])
        }
      }
    })
    .expect(200)
})

// Must run serially because config is updated
test.serial('performs a OAuth2 authentication', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:list:all'
    ]
  })

  const systemKey = getSystemKey()

  // can be any URL, localhost URL is used to prevent failing tests due to external conditions
  // like bad network or remote server disruption
  const afterAuthenticationUrl = authorizationServerUrl

  // add SSO connection
  await request(t.context.serverUrl)
    .patch('/config/private')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-system-key': systemKey,
      'x-stelace-env': t.context.env
    })
    .send({
      stelace: {
        ssoConnections: {
          my_github: {
            protocol: 'oauth2',

            // authorization server routes: https://github.com/panva/node-oidc-provider/blob/master/docs/README.md#routes
            authorizationUrl: `${authorizationServerUrl}/auth`,
            authorizationQueryParams: { allow_signup: true },
            tokenUrl: `${authorizationServerUrl}/token`,
            tokenBodyParams: { someValue: 'random' },
            clientId: authorizationServerInfo.clientId,
            clientSecret: authorizationServerInfo.clientSecret,
            scope: authorizationServerInfo.scope,
            userInfoUrl: `${authorizationServerUrl}/me`,
            issuer: authorizationServerInfo.issuer,
            userInfoMapping: {
              // displayName: 'name', // default
              // email: 'email', // default
              'metadata.name': 'name',
              'metadata.email': 'email'
            },
            afterAuthenticationUrl,
            active: true,
          }
        }
      }
    })
    .expect(200)

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    args: ['--disable-dev-shm-usage', '--no-sandbox']
  })

  const page = await browser.newPage()

  // trigger the SSO authentication (user clicks on the SSO button)
  await page.goto(`${apiServerUrl}/auth/sso/${publicPlatformId}/my_github`)

  await page.waitForSelector('input[name="email"]')

  // fill login form
  await page.type('input[name="email"]', 'oauth2@github.com') // account from test/openid/account.js
  await page.type('input[name="password"]', 'secret')
  await page.click('button[type="submit"]')

  // authorize OAuth2 application
  await page.waitForSelector('button[type="submit"]')

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation()
  ])

  const afterLoginRedirectUrl = page.url() // redirect to afterAuthorizationUrl (like SPA homepage)
  t.true(afterLoginRedirectUrl.startsWith(afterAuthenticationUrl))

  const stelaceCodeUrlObj = new URL(afterLoginRedirectUrl)
  t.is(typeof stelaceCodeUrlObj.searchParams.get('code'), 'string')
  t.is(stelaceCodeUrlObj.searchParams.get('status'), 'success')

  const { body: obj } = await request(t.context.serverUrl)
    .post('/auth/token')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      code: stelaceCodeUrlObj.searchParams.get('code'),
      grantType: 'authorizationCode'
    })
    .expect(200)

  t.is(typeof obj, 'object')
  t.is(obj.tokenType, 'Bearer')
  t.is(typeof obj.accessToken, 'string')
  t.is(typeof obj.refreshToken, 'string')
  t.truthy(obj.userId)

  const token = jwt.decode(obj.accessToken)
  t.is(typeof token, 'object')
  t.is(typeof token.loggedAt, 'number')
  t.deepEqual(token.roles, ['user', 'provider'])
  t.truthy(token.userId)

  // Tokens can only be fetched once
  const { body: getTokenError } = await request(t.context.serverUrl)
    .post('/auth/token')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      code: stelaceCodeUrlObj.searchParams.get('code'),
      grantType: 'authorizationCode'
    })
    .expect(422)

  t.true(getTokenError.message.includes('already used'))

  const ssoAuthorizationHeaders = {
    'x-platform-id': t.context.platformId,
    'x-stelace-env': t.context.env,
    authorization: `${obj.tokenType} ${obj.accessToken}`
  }

  // fetch the created user
  const { body: user } = await request(t.context.serverUrl)
    .get(`/users/${token.userId}`)
    .set(ssoAuthorizationHeaders)
    .expect(200)

  t.is(user.displayName, oauthSSOData.name)
  t.is(user.email, oauthSSOData.email)
  t.is(user.metadata.name, oauthSSOData.name)
  t.is(user.metadata.email, oauthSSOData.email)
  t.deepEqual(user.roles, ['user', 'provider'])
  t.true(user.platformData.ssoProviders.includes('my_github'))

  const username = 'ssoUser'

  const { body: updatedUser } = await request(t.context.serverUrl)
    .patch(`/users/${token.userId}`)
    .set(ssoAuthorizationHeaders)
    .send({ username })
    .expect(200)

  t.is(updatedUser.username, username)

  await request(t.context.serverUrl)
    .post('/password/reset/request')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      username
    })
    .expect(403) // forbidden for SSO users

  await new Promise(resolve => setTimeout(resolve, 300))

  const { body: { results: eventsAfterSSOLogin } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const userCreatedEvent = getObjectEvent({
    events: eventsAfterSSOLogin,
    eventType: 'user__created',
    objectId: user.id
  })
  await testEventMetadata({ event: userCreatedEvent, object: user, t })
  t.is(userCreatedEvent.object.displayName, oauthSSOData.name)
  t.is(userCreatedEvent.object.email, oauthSSOData.email)

  await browser.close()
})

// Must run serially because config is updated
test.serial('performs an OpenID authentication', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:list:all'
    ]
  })

  const systemKey = getSystemKey()

  // can be any URL, localhost URL is used to prevent failing tests due to external conditions
  // like bad network or remote server disruption
  const afterAuthenticationUrl = authorizationServerUrl
  const afterLogoutUrl = `${authorizationServerUrl}/logout`

  // add SSO connection
  await request(t.context.serverUrl)
    .patch('/config/private')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env,
      'x-stelace-system-key': systemKey
    })
    .send({
      stelace: {
        ssoConnections: {
          custom_openid: {
            // authorization server routes: https://github.com/panva/node-oidc-provider/blob/master/docs/README.md#routes
            protocol: 'openid',
            authorizationUrl: `${authorizationServerUrl}/auth`,
            authorizationQueryParams: { allow_signup: true },
            tokenUrl: `${authorizationServerUrl}/token`,
            tokenBodyParams: { someValue: 'random' },
            clientId: authorizationServerInfo.clientId,
            clientSecret: authorizationServerInfo.clientSecret,
            scope: authorizationServerInfo.scope,
            endSessionUrl: `${authorizationServerUrl}/session/end`,
            userInfoUrl: `${authorizationServerUrl}/me`,
            afterAuthenticationUrl,
            afterLogoutUrl,
            jwksUrl: `${authorizationServerUrl}/jwks`,
            issuer: authorizationServerInfo.issuer,
            userInfoMapping: {
              // displayName: 'name', // default
              // email: 'email', // default
              firstname: 'first_name',
              lastname: 'last_name',
              'metadata.name': 'name',
              'metadata.deep.name': 'name',
              'metadata.deep.email': 'email',
              'metadata.firstname': 'first_name',
              'metadata.lastname': 'last_name'
            },
            active: true,
            pkceEnabled: true
          }
        }
      }
    })
    .expect(200)

  let browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    args: ['--disable-dev-shm-usage', '--no-sandbox']
  })

  let page = await browser.newPage()

  // trigger the SSO authentication (user clicks on the SSO button)
  await page.goto(`${apiServerUrl}/auth/sso/${publicPlatformId}/custom_openid`)

  // fill login form
  await page.waitForSelector('input[name="email"]')
  await page.type('input[name="email"]', 'openid@example.com') // account from test/openid/account.js
  await page.type('input[name="password"]', 'secret')
  await page.click('button[type="submit"]')

  // authorize OpenID application
  await page.waitForSelector('button[type="submit"]')

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation()
  ])

  const afterLoginRedirectUrl = page.url() // redirect to afterAuthorizationUrl (like SPA homepage)
  t.true(afterLoginRedirectUrl.startsWith(afterAuthenticationUrl))

  const stelaceCodeUrlObj = new URL(afterLoginRedirectUrl)

  t.is(typeof stelaceCodeUrlObj.searchParams.get('code'), 'string')
  t.is(stelaceCodeUrlObj.searchParams.get('status'), 'success')

  const { body: obj } = await request(t.context.serverUrl)
    .post('/auth/token')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      code: stelaceCodeUrlObj.searchParams.get('code'),
      grantType: 'authorizationCode'
    })
    .expect(200)

  t.is(typeof obj, 'object')
  t.is(obj.tokenType, 'Bearer')
  t.is(typeof obj.accessToken, 'string')
  t.is(typeof obj.refreshToken, 'string')
  t.truthy(obj.userId)

  const token = jwt.decode(obj.accessToken)
  t.is(typeof token, 'object')
  t.is(typeof token.loggedAt, 'number')
  t.deepEqual(token.roles, ['user', 'provider'])
  t.truthy(token.userId)

  // Tokens can only be fetched once
  const { body: getTokenError } = await request(t.context.serverUrl)
    .post('/auth/token')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      code: stelaceCodeUrlObj.searchParams.get('code'),
      grantType: 'authorizationCode'
    })
    .expect(422)

  t.true(getTokenError.message.includes('already used'))

  const ssoAuthorizationHeaders = {
    'x-platform-id': t.context.platformId,
    'x-stelace-env': t.context.env,
    authorization: `${obj.tokenType} ${obj.accessToken}`
  }

  // fetch the created user
  const { body: user } = await request(t.context.serverUrl)
    .get(`/users/${token.userId}`)
    .set(ssoAuthorizationHeaders)
    .expect(200)

  t.deepEqual(user.roles, ['user', 'provider'])
  t.true(user.platformData.ssoProviders.includes('custom_openid'))
  t.is(user.email, openIdSSOData.email)
  t.is(user.displayName, openIdSSOData.name)
  t.is(user.metadata.name, openIdSSOData.name)
  t.is(user.metadata.deep.name, openIdSSOData.name)
  t.is(user.metadata.deep.email, openIdSSOData.email)

  const username = 'ssoOpenIdUser'

  const { body: updatedUser } = await request(t.context.serverUrl)
    .patch(`/users/${token.userId}`)
    .set(ssoAuthorizationHeaders)
    .send({
      username,
      metadata: {
        name: null,
        deep: {
          name: null,
          something: 'updated'
        }
      }
    })
    .expect(200)

  t.is(updatedUser.username, username)
  t.is(updatedUser.metadata.name, null)

  await request(t.context.serverUrl)
    .post('/password/reset/request')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      username
    })
    .expect(403) // forbidden for SSO users

  // trigger the SSO logout (user clicks on the SSO logout button)
  const logoutResponse = await request(t.context.serverUrl)
    .post('/auth/logout')
    .set(ssoAuthorizationHeaders)
    .send({
      refreshToken: obj.refreshToken,
      logoutFromExternalProvider: true // destroys the external authentication session as well
    })
    .expect(301)

  // go to the logout UI
  await page.goto(logoutResponse.headers.location)

  // click on sign out button
  await page.waitForSelector('button[name="logout"][type="submit"]')

  await Promise.all([
    page.click('button[name="logout"][type="submit"]'),
    page.waitForNavigation()
  ])

  const afterLogoutRedirectUrl = page.url()
  t.true(afterLogoutRedirectUrl.startsWith(afterLogoutUrl))

  const afterLogoutUrlObj = new URL(afterLogoutRedirectUrl)
  t.is(afterLogoutUrlObj.searchParams.get('status'), 'success')

  // rejected after logout, cannot refresh token anymore
  await request(t.context.serverUrl)
    .post('/auth/token')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env,
    })
    .send({
      refreshToken: obj.refreshToken,
      grantType: 'refreshToken'
    })
    .expect(403)

  await new Promise(resolve => setTimeout(resolve, 300))

  const { body: { results: eventsAfterSSOLogin } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const userCreatedEvent = getObjectEvent({
    events: eventsAfterSSOLogin,
    eventType: 'user__created',
    objectId: user.id
  })
  await testEventMetadata({ event: userCreatedEvent, object: user, t })
  t.is(userCreatedEvent.object.displayName, openIdSSOData.name)
  t.is(userCreatedEvent.object.email, openIdSSOData.email)

  await browser.close()

  // Login again to fetch new info

  // Recreate a browser navigation, because API login endpoint isn't hit the second time
  // for some unknown reason
  // Maybe that's because of the login redirection that is cached by puppeteer
  browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    args: ['--disable-dev-shm-usage', '--no-sandbox']
  })

  page = await browser.newPage()

  // trigger the SSO authentication (user clicks on the SSO button)
  await page.goto(`${apiServerUrl}/auth/sso/${publicPlatformId}/custom_openid`)

  // fill login form
  await page.waitForSelector('input[name="email"]')
  await page.type('input[name="email"]', 'openid@example.com') // account from test/openid/account.js
  await page.type('input[name="password"]', 'secret')
  await page.click('button[type="submit"]')

  // authorize OpenID application
  await page.waitForSelector('button[type="submit"]')

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation()
  ])

  const afterLoginRedirectUrl2 = page.url() // redirect to afterAuthorizationUrl (like SPA homepage)
  t.true(afterLoginRedirectUrl2.startsWith(afterAuthenticationUrl))

  const stelaceCodeUrlObj2 = new URL(afterLoginRedirectUrl2)

  t.is(typeof stelaceCodeUrlObj2.searchParams.get('code'), 'string')
  t.is(stelaceCodeUrlObj2.searchParams.get('status'), 'success')

  const { body: obj2 } = await request(t.context.serverUrl)
    .post('/auth/token')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      code: stelaceCodeUrlObj2.searchParams.get('code'),
      grantType: 'authorizationCode'
    })
    .expect(200)

  t.is(typeof obj2, 'object')
  t.is(obj2.tokenType, 'Bearer')
  t.is(typeof obj2.accessToken, 'string')
  t.is(typeof obj2.refreshToken, 'string')
  t.truthy(obj2.userId)

  const token2 = jwt.decode(obj2.accessToken)
  t.is(typeof token2, 'object')
  t.is(typeof token2.loggedAt, 'number')
  t.deepEqual(token2.roles, ['user', 'provider'])
  t.truthy(token2.userId)

  const ssoAuthorizationHeaders2 = {
    'x-platform-id': t.context.platformId,
    'x-stelace-env': t.context.env,
    authorization: `${obj2.tokenType} ${obj2.accessToken}`
  }

  // fetch the user that logs a second time
  const { body: userAfterNewLogin } = await request(t.context.serverUrl)
    .get(`/users/${token2.userId}`)
    .set(ssoAuthorizationHeaders2)
    .expect(200)

  t.deepEqual(userAfterNewLogin.roles, ['user', 'provider'])
  t.true(userAfterNewLogin.platformData.ssoProviders.includes('custom_openid'))
  t.is(userAfterNewLogin.displayName, openIdSSOData.name) // truthy values are preserved
  t.not(userAfterNewLogin.displayName, openIdSSOData2.name)
  t.is(userAfterNewLogin.firstname, openIdSSOData2.firstname)
  t.is(userAfterNewLogin.lastname, openIdSSOData2.lastname)
  t.is(userAfterNewLogin.email, openIdSSOData.email)
  t.not(userAfterNewLogin.email, openIdSSOData2.email)
  t.deepEqual(userAfterNewLogin.metadata, {
    name: openIdSSOData2.name, // null values are updated
    firstname: openIdSSOData2.firstname,
    lastname: openIdSSOData2.lastname,
    deep: {
      email: openIdSSOData.email,
      name: openIdSSOData2.name,
      something: 'updated' // all existing attributes are preserved
    }
  })

  await new Promise(resolve => setTimeout(resolve, 300))

  const { body: { results: eventsAfterSecondSSOLogin } } = await request(t.context.serverUrl)
    .get(`/events?createdDate[gt]=${encodeURIComponent(userCreatedEvent.createdDate)}`)
    .set(authorizationHeaders)
    .expect(200)

  const userUpdatedEvent = getObjectEvent({
    events: eventsAfterSecondSSOLogin,
    eventType: 'user__updated',
    objectId: user.id
  })
  await testEventMetadata({
    event: userUpdatedEvent,
    object: userAfterNewLogin,
    t,
    patchPayload: {
      firstname: openIdSSOData2.firstname,
      lastname: openIdSSOData2.lastname,
      metadata: {
        deep: {
          name: openIdSSOData2.name
        },
        firstname: openIdSSOData2.firstname,
        lastname: openIdSSOData2.lastname,
        name: openIdSSOData2.name
      }
    }
  })
  t.is(userUpdatedEvent.object.displayName, openIdSSOData.name)
  t.is(userUpdatedEvent.object.email, openIdSSOData.email)

  await browser.close()
})

if (shouldExecuteBuiltInSSOTest) {
  if (getOAuthConfiguration('github')) {
    // Must run serially because config is updated
    test.serial('Github OAuth authentication works', async (t) => {
      const provider = 'github'

      const config = getOAuthConfiguration(provider)
      if (!config) return t.pass()

      const { credentials, ssoConnection } = config

      const { username, password } = credentials

      const executeBrowserScenario = async ({ page }) => {
        // trigger the SSO authentication (user clicks on the SSO button)
        await page.goto(`${apiServerUrl}/auth/sso/${publicPlatformId}/${provider}`)

        const usernameSelector = 'input[name="login"]'

        await page.waitForSelector(usernameSelector)

        // fill login form
        await page.type(usernameSelector, username)
        await page.type('input[type="password"]', password)
        await page.click('input[type="submit"]')

        // authorize form is displayed the first time
        const authorizeButtonSelector = 'button[name="authorize"]'
        const authorizeButtonExists = await checkElementVisible(page, authorizeButtonSelector)
        if (authorizeButtonExists) {
          // wait a little bit before clicking the button as it can be disabled at first
          await new Promise(resolve => setTimeout(resolve, 1000))

          await page.click(authorizeButtonSelector)
          await page.waitForNavigation()
        }
      }

      await checkOAuthProcess({
        t,
        provider,
        ssoConnection,
        afterAuthenticationUrl: authorizationServerUrl,
        executeBrowserScenario
      })
    })
  }

  if (getOAuthConfiguration('facebook')) {
    // Must run serially because config is updated
    test.serial('Facebook OAuth authentication works', async (t) => {
      const provider = 'facebook'

      const config = getOAuthConfiguration(provider)
      if (!config) return t.pass()

      const { credentials, ssoConnection } = config
      const { username, password } = credentials

      const executeBrowserScenario = async ({ page }) => {
        // trigger the SSO authentication (user clicks on the SSO button)
        await page.goto(`${apiServerUrl}/auth/sso/${publicPlatformId}/${provider}`)

        const usernameSelector = 'input[name="email"]'

        await page.waitForSelector(usernameSelector)

        // fill login form
        await page.type(usernameSelector, username)
        await page.type('input[type="password"]', password)
        await page.click('button[type="submit"]')

        // authorize form is displayed the first time
        const authorizeButtonSelector = 'button.layerConfirm[type="submit"]'
        const authorizeButtonExists = await checkElementVisible(page, authorizeButtonSelector)
        if (authorizeButtonExists) {
          // wait a little bit before clicking the button as it can be disabled at first
          await new Promise(resolve => setTimeout(resolve, 1000))

          await page.click(authorizeButtonSelector)
          await page.waitForNavigation()
        }
      }

      await checkOAuthProcess({
        t,
        provider,
        ssoConnection,
        afterAuthenticationUrl: authorizationServerUrl,
        executeBrowserScenario
      })
    })
  }

  // The Google OAuth test implemented below doesn't work as the authentication process is different from real user
  // (e.g. popup appearing only for puppeteer and difficult to )
  if (getOAuthConfiguration('google')) {
    // Must run serially because config is updated
    // test.serial('Google OAuth authentication works', async (t) => {
    //   const provider = 'google'

    //   const { credentials, ssoConnection } = getOAuthConfiguration(provider)
    //   const { username, password } = credentials

    //   const executeBrowserScenario = async ({ page }) => {
    //     // trigger the SSO authentication (user clicks on the SSO button)
    //     await page.goto(`${apiServerUrl}/auth/sso/${publicPlatformId}/${provider}`)

    //     const usernameSelector = 'input[name="identifier"]'

    //     await page.waitForSelector(usernameSelector)

    //     // fill identifier form
    //     await page.type(usernameSelector, username)
    //     await page.click('#identifierNext')

    //     // fill password form
    //     await page.type('input[type="password"]', password)
    //     await page.click('#passwordNext')

    //     await page.waitForNavigation()
    //   }

    //   await checkOAuthProcess({
    //     t,
    //     provider,
    //     ssoConnection,
    //     afterAuthenticationUrl: authorizationServerUrl,
    //     executeBrowserScenario
    //   })
    // })
  }
}

test('rejects if the user agent does not match the user agent that created the refresh token', async (t) => {
  const userAgent = 'Mozilla/5.0 (Windows; U; Win98; en-US; rv:0.9.2) Gecko/20010725 Netscape6/6.1'
  await refreshAccessToken('refreshToken1', { status: 403, userAgent, t, requester: request(t.context.serverUrl) })

  t.pass()
})

test('impersonates access token for a user', async (t) => {
  const accessToken = await getAccessToken({
    permissions: [
      'user:edit:all',
      'user:config:all',
      'auth:impersonate'
    ]
  })

  const { body: result } = await request(t.context.serverUrl)
    .post('/auth/token')
    .set({
      'user-agent': 'node-superagent/3.8.3',
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env,
      authorization: `Bearer ${accessToken}`
    })
    .send({
      grantType: 'impersonateToken',
      refreshToken: 'refreshToken1',
      userId: 'usr_QVQfQps1I3a1gJYz2I3a'
    })
    .expect(200)

  t.is(typeof result, 'object')
  t.is(result.tokenType, 'Bearer')
  t.is(typeof result.accessToken, 'string')

  const token = jwt.decode(result.accessToken)
  t.is(typeof token, 'object')
  t.is(typeof token.loggedAt, 'number')
  t.deepEqual(token.roles, ['user', 'provider'])
  t.is(token.userId, 'usr_QVQfQps1I3a1gJYz2I3a')
  t.is(token.sourceUserId, 'usr_WHlfQps1I3a1gJYz2I3a')
})

test('impersonates access token for a user via system', async (t) => {
  const systemKey = getSystemKey()

  const { body: result } = await request(t.context.serverUrl)
    .post('/auth/token')
    .set({
      'user-agent': 'node-superagent/3.8.3',
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env,
      'x-stelace-system-key': systemKey
    })
    .send({
      grantType: 'impersonateToken',
      refreshToken: 'refreshToken1',
      roles: ['admin'],
      userId: 'user-external-id1',
      sourceUserId: 'user-external-id2'
    })
    .expect(200)

  t.is(typeof result, 'object')
  t.is(result.tokenType, 'Bearer')
  t.is(typeof result.accessToken, 'string')

  const token = jwt.decode(result.accessToken)
  t.is(typeof token, 'object')
  t.deepEqual(token.roles, ['admin'])
  t.is(token.userId, 'user-external-id1')
  t.is(token.sourceUserId, 'user-external-id2')
})

test('checks a refresh token', async (t) => {
  const systemKey = getSystemKey()

  const { body: result1 } = await request(t.context.serverUrl)
    .post('/auth/token/check')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env,
      'x-stelace-system-key': systemKey
    })
    .send({
      tokenType: 'refreshToken',
      token: 'refreshToken1',
      userAgent: 'node-superagent/3.8.3'
    })
    .expect(200)

  t.is(result1.userId, 'usr_WHlfQps1I3a1gJYz2I3a')
  t.true(result1.valid)

  const { body: result2 } = await request(t.context.serverUrl)
    .post('/auth/token/check')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env,
      'x-stelace-system-key': systemKey
    })
    .send({
      tokenType: 'refreshToken',
      token: 'unknownRefreshToken',
      userAgent: 'node-superagent/3.8.3'
    })
    .expect(200)

  t.is(result2.userId, null)
  t.false(result2.valid)
})

test('checks an access token', async (t) => {
  const systemKey = getSystemKey()

  const accessToken = await getAccessToken({ permissions: [], userId: 'user-external-id' })

  const { body: result1 } = await request(t.context.serverUrl)
    .post('/auth/token/check')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env,
      'x-stelace-system-key': systemKey
    })
    .send({
      tokenType: 'accessToken',
      token: accessToken
    })
    .expect(200)

  t.is(result1.userId, 'user-external-id')
  t.true(result1.valid)

  const { body: result2 } = await request(t.context.serverUrl)
    .post('/auth/token/check')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env,
      'x-stelace-system-key': systemKey
    })
    .send({
      tokenType: 'accessToken',
      token: 'unknownAccessToken'
    })
    .expect(200)

  t.is(result2.userId, null)
  t.false(result2.valid)
})

test('can only check tokens if system', async (t) => {
  const authorizationHeaders = await getAccessTokenHeaders({ t, permissions: [] })

  await request(t.context.serverUrl)
    .post('/auth/token/check')
    .set(authorizationHeaders)
    .send({
      tokenType: 'refreshToken',
      token: 'refreshToken1',
      userAgent: 'node-superagent/3.8.3'
    })
    .expect(403)

  await request(t.context.serverUrl)
    .post('/auth/token/check')
    .set(authorizationHeaders)
    .send({
      tokenType: 'accessToken',
      token: 'accessToken1',
      userAgent: 'node-superagent/3.8.3'
    })
    .expect(403)

  t.pass()
})

test('changes the password and emits event', async (t) => {
  const userId = 'usr_em9SToe1nI01iG4yRnHz'

  const result = await request(t.context.serverUrl)
    .post('/auth/login')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      username: 'user2',
      password: 'user2'
    })
    .expect(200)

  const { accessToken, refreshToken } = result.body

  // fails to change the password if the current password is wrong
  await request(t.context.serverUrl)
    .post('/password/change')
    .set({
      authorization: `Bearer ${accessToken}`,
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      currentPassword: 'wrongPassword',
      newPassword: 'newUser2'
    })
    .expect(422)

  await request(t.context.serverUrl)
    .post('/password/change')
    .set({
      authorization: `Bearer ${accessToken}`,
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      currentPassword: 'user2',
      newPassword: 'newUser2'
    })
    .expect(200)

  await request(t.context.serverUrl)
    .post('/auth/logout')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      refreshToken
    })
    .expect(200)

  await request(t.context.serverUrl)
    .post('/auth/login')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      username: 'user2',
      password: 'user2'
    })
    .expect(403)

  await request(t.context.serverUrl)
    .post('/auth/login')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      username: 'user2',
      password: 'newUser2'
    })
    .expect(200)

  const eventAccessTokenHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:list:all',
      'user:read:all'
    ]
  })

  const { body: user } = await request(t.context.serverUrl)
    .get(`/users/${userId}`)
    .set(Object.assign({}, eventAccessTokenHeaders, {
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    }))
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, 1000))

  const { body: { results: events } } = await request(t.context.serverUrl)
    .get('/events')
    .set(Object.assign({}, eventAccessTokenHeaders, {
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    }))
    .expect(200)

  const passwordChangedEvent = getObjectEvent({
    events,
    objectType: 'user',
    eventType: 'password__changed',
    objectId: userId
  })
  await testEventMetadata({ event: passwordChangedEvent, object: user, t })
})

test.serial('requests the password reset and emits event', async (t) => {
  const userId = 'usr_bF9Mpoe1cDG1i4xyxcDG'

  const accessTokenHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:list:all',
      'user:read:all'
    ]
  })

  const { body: user } = await request(t.context.serverUrl)
    .get(`/users/${userId}`)
    .set(Object.assign({}, accessTokenHeaders, {
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    }))
    .expect(200)

  await request(t.context.serverUrl)
    .post('/password/reset/request')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      username: 'user3'
    })
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, 1000))

  const { body: { results: events } } = await request(t.context.serverUrl)
    .get('/events')
    .set(Object.assign({}, accessTokenHeaders, {
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    }))
    .expect(200)

  const resetPasswordRequestedEvent = getObjectEvent({
    events,
    eventType: 'password__reset_requested',
    objectType: 'user',
    objectId: userId
  })
  await testEventMetadata({ event: resetPasswordRequestedEvent, object: user, t })
  const eventData = resetPasswordRequestedEvent.metadata
  t.true(typeof resetPasswordRequestedEvent.metadata.resetToken === 'string')
  t.is(eventData.resetToken.length, 16) // hard-coded in services/authentication.js
  t.is(eventData.expirationDate, new Date(eventData.expirationDate).toISOString())
})

test('confirms the password reset and emits event', async (t) => {
  // cannot login
  await request(t.context.serverUrl)
    .post('/auth/login')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      username: 'admin',
      password: 'newAdmin'
    })
    .expect(403)

  // confirms the password reset
  await request(t.context.serverUrl)
    .post('/password/reset/confirm')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      resetToken: 'resetToken1',
      newPassword: 'newAdmin'
    })
    .expect(200)

  // can login with the new password
  await request(t.context.serverUrl)
    .post('/auth/login')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      username: 'admin',
      password: 'newAdmin'
    })
    .expect(200)

  // the reset token can only be used once
  await request(t.context.serverUrl)
    .post('/password/reset/confirm')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      resetToken: 'resetToken1',
      newPassword: 'newAdmin'
    })
    .expect(403)

  const accessTokenHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'event:list:all',
      'user:read:all'
    ]
  })

  const { body: user } = await request(t.context.serverUrl)
    .get(`/users/${adminUserId}`)
    .set(Object.assign({}, accessTokenHeaders, {
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    }))
    .expect(200)

  const { body: { results: events } } = await request(t.context.serverUrl)
    .get('/events')
    .set(Object.assign({}, accessTokenHeaders, {
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    }))
    .expect(200)

  const resetPasswordConfirmedEvent = getObjectEvent({
    events,
    objectType: 'user',
    eventType: 'password__reset_confirmed',
    objectId: adminUserId
  })
  await testEventMetadata({ event: resetPasswordConfirmedEvent, object: user, t })
})

test('fails to confirm the password reset using an expired token', async (t) => {
  await request(t.context.serverUrl)
    .post('/password/reset/confirm')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      resetToken: 'expiredResetToken',
      newPassword: 'newAdmin'
    })
    .expect(403)

  t.pass()
})

test('triggers a token check process', async (t) => {
  const userId = 'usr_WHlfQps1I3a1gJYz2I3a'

  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'token:check',
      'event:list:all'
    ],
    userId
  })

  const expirationDate = new Date((new Date().getTime() + 3600 * 1000)).toISOString()

  await request(t.context.serverUrl)
    .post('/token/check/request')
    .set(authorizationHeaders)
    .send({
      type: 'email',
      expirationDate,
      data: {
        testData: true
      }
    })
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, 300))

  const { body: { results: eventsAfterRequestingToken } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const tokenRequestedEvent = getObjectEvent({
    events: eventsAfterRequestingToken,
    eventType: 'token__check_requested',
    objectId: userId
  })

  t.is(tokenRequestedEvent.object.id, userId)
  t.truthy(tokenRequestedEvent.metadata.token)
  t.is(tokenRequestedEvent.metadata.type, 'email')
  t.is(tokenRequestedEvent.metadata.expirationDate, expirationDate)
  t.deepEqual(tokenRequestedEvent.metadata.data, { testData: true })

  const tokenValue = tokenRequestedEvent.metadata.token

  const { body: tokenResult } = await request(t.context.serverUrl)
    .get(`/token/check/${tokenValue}`) // no authorization headers
    .expect(200)

  t.is(tokenResult.status, 'valid')
  t.is(tokenResult.type, 'email')
  t.is(tokenResult.userId, userId)
  t.is(tokenResult.expirationDate, expirationDate)

  await new Promise(resolve => setTimeout(resolve, 300))

  const { body: { results: eventsAfterCheckingToken } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const tokenCheckedEvent = getObjectEvent({
    events: eventsAfterCheckingToken,
    eventType: 'token__check_confirmed',
    objectId: userId
  })

  t.is(tokenCheckedEvent.object.id, userId)
  t.truthy(tokenCheckedEvent.metadata.token)
  t.is(tokenCheckedEvent.metadata.type, 'email')
  t.is(tokenCheckedEvent.metadata.expirationDate, expirationDate)
  t.deepEqual(tokenCheckedEvent.metadata.data, { testData: true })

  const { body: tokenResultSecondTime } = await request(t.context.serverUrl)
    .get(`/token/check/${tokenValue}`)
    .expect(200)

  t.is(tokenResultSecondTime.status, 'alreadyChecked')
})

test('triggers a token check process with a redirection', async (t) => {
  const userId = 'usr_Y0tfQps1I3a1gJYz2I3a'

  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'token:check',
      'event:list:all'
    ],
    userId
  })

  const expirationDate = new Date((new Date().getTime() + 3600 * 1000)).toISOString()

  await request(t.context.serverUrl)
    .post('/token/check/request')
    .set(authorizationHeaders)
    .send({
      type: 'email',
      expirationDate,
      redirectUrl: 'https://example.com',
      data: {
        testData: true
      }
    })
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, 300))

  const { body: { results: eventsAfterRequestingToken } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const tokenRequestedEvent = getObjectEvent({
    events: eventsAfterRequestingToken,
    eventType: 'token__check_requested',
    objectId: userId
  })

  t.is(tokenRequestedEvent.object.id, userId)
  t.truthy(tokenRequestedEvent.metadata.token)
  t.is(tokenRequestedEvent.metadata.type, 'email')
  t.is(tokenRequestedEvent.metadata.expirationDate, expirationDate)
  t.deepEqual(tokenRequestedEvent.metadata.data, { testData: true })

  const tokenValue = tokenRequestedEvent.metadata.token

  await request(t.context.serverUrl)
    .get(`/token/check/${tokenValue}?redirect=true`) // no authorization headers
    .expect('Location', `https://example.com/?token=${tokenRequestedEvent.metadata.token}&status=valid`)
    .expect(301)

  await new Promise(resolve => setTimeout(resolve, 300))

  const { body: { results: eventsAfterCheckingToken } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const tokenCheckedEvent = getObjectEvent({
    events: eventsAfterCheckingToken,
    eventType: 'token__check_confirmed',
    objectId: userId
  })

  t.is(tokenCheckedEvent.object.id, userId)
  t.truthy(tokenCheckedEvent.metadata.token)
  t.is(tokenCheckedEvent.metadata.type, 'email')
  t.is(tokenCheckedEvent.metadata.expirationDate, expirationDate)
  t.deepEqual(tokenCheckedEvent.metadata.data, { testData: true })

  const { body: tokenResult } = await request(t.context.serverUrl)
    .get(`/token/check/${tokenValue}`) // no authorization headers
    .expect(200)

  t.is(tokenResult.status, 'alreadyChecked')
  t.is(tokenResult.type, 'email')
  t.is(tokenResult.userId, userId)
  t.is(tokenResult.expirationDate, expirationDate)
})

// use .serial() because the token check process is long and we don't want other tests to interfere with it
test.serial('triggers a token check process with the fallback redirection', async (t) => {
  const userId = 'usr_em9SToe1nI01iG4yRnHz'

  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'token:check',
      'event:list:all',
      'config:edit:all'
    ],
    userId
  })

  const expirationDate = new Date((new Date().getTime() + 3600 * 1000)).toISOString()

  await request(t.context.serverUrl)
    .patch('/config')
    .set(authorizationHeaders)
    .send({
      stelace: {
        tokenCheckRedirectUrl: 'https://example.com'
      }
    })

  await request(t.context.serverUrl)
    .post('/token/check/request')
    .set(authorizationHeaders)
    .send({
      type: 'email',
      expirationDate,
      data: {
        testData: true
      }
    })
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, 300))

  const { body: { results: eventsAfterRequestingToken } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const tokenRequestedEvent = getObjectEvent({
    events: eventsAfterRequestingToken,
    eventType: 'token__check_requested',
    objectId: userId
  })

  t.is(tokenRequestedEvent.object.id, userId)
  t.truthy(tokenRequestedEvent.metadata.token)
  t.is(tokenRequestedEvent.metadata.type, 'email')
  t.is(tokenRequestedEvent.metadata.expirationDate, expirationDate)
  t.deepEqual(tokenRequestedEvent.metadata.data, { testData: true })

  const tokenValue = tokenRequestedEvent.metadata.token

  await request(t.context.serverUrl)
    .get(`/token/check/${tokenValue}?redirect=true`) // no authorization headers
    .expect('Location', `https://example.com/?token=${tokenRequestedEvent.metadata.token}&status=valid`)
    .expect(301)

  await new Promise(resolve => setTimeout(resolve, 300))

  const { body: { results: eventsAfterCheckingToken } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const tokenCheckedEvent = getObjectEvent({
    events: eventsAfterCheckingToken,
    eventType: 'token__check_confirmed',
    objectId: userId
  })

  t.is(tokenCheckedEvent.object.id, userId)
  t.truthy(tokenCheckedEvent.metadata.token)
  t.is(tokenCheckedEvent.metadata.type, 'email')
  t.is(tokenCheckedEvent.metadata.expirationDate, expirationDate)
  t.deepEqual(tokenCheckedEvent.metadata.data, { testData: true })

  const { body: tokenResult } = await request(t.context.serverUrl)
    .get(`/token/check/${tokenValue}`) // no authorization headers
    .expect(200)

  t.is(tokenResult.status, 'alreadyChecked')
  t.is(tokenResult.type, 'email')
  t.is(tokenResult.userId, userId)
  t.is(tokenResult.expirationDate, expirationDate)

  // restore for other tests
  await request(t.context.serverUrl)
    .patch('/config')
    .set(authorizationHeaders)
    .send({
      stelace: {
        tokenCheckRedirectUrl: null
      }
    })
})

test('displays text error when triggering token check process with missing redirect url', async (t) => {
  const userId = 'usr_bF9Mpoe1cDG1i4xyxcDG'

  const authorizationHeaders = await getAccessTokenHeaders({
    t,
    permissions: [
      'token:check',
      'event:list:all'
    ],
    userId
  })

  const expirationDate = new Date((new Date().getTime() + 3600 * 1000)).toISOString()

  await request(t.context.serverUrl)
    .post('/token/check/request')
    .set(authorizationHeaders)
    .send({
      type: 'email',
      expirationDate,
      data: {
        testData: true
      }
    })
    .expect(200)

  await new Promise(resolve => setTimeout(resolve, 300))

  const { body: { results: eventsAfterRequestingToken } } = await request(t.context.serverUrl)
    .get('/events')
    .set(authorizationHeaders)
    .expect(200)

  const tokenRequestedEvent = getObjectEvent({
    events: eventsAfterRequestingToken,
    eventType: 'token__check_requested',
    objectId: userId
  })

  t.is(tokenRequestedEvent.object.id, userId)
  t.truthy(tokenRequestedEvent.metadata.token)
  t.is(tokenRequestedEvent.metadata.type, 'email')
  t.is(tokenRequestedEvent.metadata.expirationDate, expirationDate)
  t.deepEqual(tokenRequestedEvent.metadata.data, { testData: true })

  const tokenValue = tokenRequestedEvent.metadata.token

  await request(t.context.serverUrl)
    .get(`/token/check/${tokenValue}?redirect=true`) // no authorization headers
    .expect('content-type', 'text/plain')
    .expect(422)
})

// ////////// //
// VALIDATION //
// ////////// //

test('fails to login if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/auth/login')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // missing required parameters
  result = await request(t.context.serverUrl)
    .post('/auth/login')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({})
    .expect(400)

  error = result.body
  t.true(error.message.includes('"username" is required'))
  t.true(error.message.includes('"password" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/auth/login')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      username: true,
      password: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"username" must be a string'))
  t.true(error.message.includes('"password" must be a string'))
})

test('fails to logout if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/auth/logout')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // missing required parameters
  result = await request(t.context.serverUrl)
    .post('/auth/logout')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({})
    .expect(400)

  error = result.body
  t.true(error.message.includes('"refreshToken" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/auth/token')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      refreshToken: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"refreshToken" must be a string'))
})

test('fails to refresh access token if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/auth/token')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // missing required parameters
  result = await request(t.context.serverUrl)
    .post('/auth/token')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({})
    .expect(400)

  error = result.body
  t.true(error.message.includes('"grantType" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/auth/token')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      refreshToken: true,
      grantType: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"refreshToken" must be a string'))
  t.true(error.message.includes('"grantType" must be a string'))
})

test('fails to change the password if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/password/change')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // missing required parameters
  result = await request(t.context.serverUrl)
    .post('/password/change')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({})
    .expect(400)

  error = result.body
  t.true(error.message.includes('"currentPassword" is required'))
  t.true(error.message.includes('"newPassword" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/password/change')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      currentPassword: true,
      newPassword: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"currentPassword" must be a string'))
  t.true(error.message.includes('"newPassword" must be a string'))
})

test('fails to request the password reset if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/password/reset/request')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // missing required parameters
  result = await request(t.context.serverUrl)
    .post('/password/reset/request')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({})
    .expect(400)

  error = result.body
  t.true(error.message.includes('"username" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/password/reset/request')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      username: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"username" must be a string'))
})

test('fails to confirm the password reset if missing or invalid parameters', async (t) => {
  let result
  let error

  // missing body
  result = await request(t.context.serverUrl)
    .post('/password/reset/confirm')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"body" is required'))

  // missing required parameters
  result = await request(t.context.serverUrl)
    .post('/password/reset/confirm')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({})
    .expect(400)

  error = result.body
  t.true(error.message.includes('"resetToken" is required'))
  t.true(error.message.includes('"newPassword" is required'))

  // parameters with wrong type
  result = await request(t.context.serverUrl)
    .post('/password/reset/confirm')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      resetToken: true,
      newPassword: true
    })
    .expect(400)

  error = result.body
  t.true(error.message.includes('"resetToken" must be a string'))
  t.true(error.message.includes('"newPassword" must be a string'))
})

test('check authentication information', async (t) => {
  // ////////////// //
  // INITIALIZATION //
  // ////////////// //

  const { body: apiKeyObj } = await request(t.context.serverUrl)
    .post('/api-keys')
    .set({
      'x-platform-id': t.context.platformId,
      'x-stelace-env': t.context.env
    })
    .send({
      name: 'New custom api key',
      roles: ['dev'],
      type: 'custom'
    })
    .expect(200)

  const getBasicAuthHeader = key => `Basic ${encodeBase64(`${key}:`)}`

  const apiKey = apiKeyObj.key
  const apiKeyAuthorization = getBasicAuthHeader(apiKey)

  const { body: loginObj } = await request(t.context.serverUrl)
    .post('/auth/login')
    .set({
      authorization: apiKeyAuthorization
    })
    .send({
      username: 'user',
      password: 'user'
    })
    .expect(200)

  const decodedToken = jwt.decode(loginObj.accessToken)
  const userAuthorization = `Stelace-v1 apiKey=${apiKey}, token=${loginObj.accessToken}`

  const invalidApiKey = 'invalid_api_key'
  const invalidApiKeyAuthorization = getBasicAuthHeader(invalidApiKey)
  const invalidUserAuthorization1 = `Stelace-v1 apiKey=${invalidApiKey}, token=${loginObj.accessToken}`
  const invalidUserAuthorization2 = `Stelace-v1 apiKey=${apiKey}, token=a.b.c`

  function checkValidApiKey (apiKey, type = 'custom') {
    t.is(typeof apiKey, 'object')
    t.is(apiKey.type, type)
    t.is(apiKey.env, t.context.env)
    t.is(apiKey.platformId, t.context.platformId)
    t.is(apiKey.hasValidFormat, true)
  }

  function checkValidToken (token, decoded = decodedToken) {
    t.deepEqual(token, decoded)
  }

  // ///////////////// //
  // PARAMETER API KEY //
  // ///////////////// //

  const { body: apiKeyCheck1 } = await request(t.context.serverUrl)
    .post('/auth/check')
    .send({ apiKey })
    .set({
      authorization: apiKeyAuthorization
    })
    .expect(200)

  t.is(apiKeyCheck1.valid, true)
  t.is(apiKeyCheck1.user, null)
  t.is(apiKeyCheck1.tokenExpired, null)
  checkValidApiKey(apiKeyCheck1.apiKey)

  const { body: apiKeyCheck2 } = await request(t.context.serverUrl)
    .post('/auth/check')
    .send({ apiKey: 'invalid_api_key' })
    .set({
      authorization: apiKeyAuthorization
    })
    .expect(200)

  t.is(apiKeyCheck2.valid, false)
  t.is(apiKeyCheck2.apiKey, null)
  t.is(apiKeyCheck2.user, null)
  t.is(apiKeyCheck2.tokenExpired, null)

  // /////////////////////// //
  // PARAMETER AUTHORIZATION //
  // /////////////////////// //

  const { body: authorizationCheck1 } = await request(t.context.serverUrl)
    .post('/auth/check')
    .send({
      authorization: apiKeyAuthorization
    })
    .set({
      authorization: apiKeyAuthorization
    })
    .expect(200)

  t.is(authorizationCheck1.valid, true)
  t.is(authorizationCheck1.user, null)
  t.is(authorizationCheck1.tokenExpired, null)
  checkValidApiKey(authorizationCheck1.apiKey)

  const { body: authorizationCheck2 } = await request(t.context.serverUrl)
    .post('/auth/check')
    .send({
      authorization: invalidApiKeyAuthorization
    })
    .set({
      authorization: apiKeyAuthorization
    })
    .expect(200)

  t.is(authorizationCheck2.valid, false)
  t.is(authorizationCheck2.apiKey, null)
  t.is(authorizationCheck2.user, null)
  t.is(authorizationCheck2.tokenExpired, null)

  const { body: authorizationCheck3 } = await request(t.context.serverUrl)
    .post('/auth/check')
    .send({
      authorization: userAuthorization
    })
    .set({
      authorization: apiKeyAuthorization
    })
    .expect(200)

  t.is(authorizationCheck3.valid, true)
  t.is(authorizationCheck3.tokenExpired, false)
  checkValidApiKey(authorizationCheck3.apiKey)
  checkValidToken(authorizationCheck3.user)

  const { body: authorizationCheck4 } = await request(t.context.serverUrl)
    .post('/auth/check')
    .send({
      authorization: invalidUserAuthorization1
    })
    .set({
      authorization: apiKeyAuthorization
    })
    .expect(200)

  t.is(authorizationCheck4.valid, false)
  t.is(authorizationCheck4.apiKey, null)
  t.is(authorizationCheck4.user, null)
  t.is(authorizationCheck4.tokenExpired, null)

  const { body: authorizationCheck5 } = await request(t.context.serverUrl)
    .post('/auth/check')
    .send({
      authorization: invalidUserAuthorization1
    })
    .set({
      authorization: apiKeyAuthorization
    })
    .expect(200)

  t.is(authorizationCheck5.valid, false)
  t.is(authorizationCheck5.apiKey, null)
  t.is(authorizationCheck5.user, null)
  t.is(authorizationCheck5.tokenExpired, null)

  const { body: authorizationCheck6 } = await request(t.context.serverUrl)
    .post('/auth/check')
    .send({
      authorization: invalidUserAuthorization2
    })
    .set({
      authorization: apiKeyAuthorization
    })
    .expect(200)

  t.is(authorizationCheck6.valid, false)
  t.is(authorizationCheck6.apiKey, null)
  t.is(authorizationCheck6.user, null)
  t.is(authorizationCheck6.tokenExpired, null)

  // ///////////////////// //
  // AUTHORIZATION HEADER  //
  // ///////////////////// //

  await request(t.context.serverUrl)
    .post('/auth/check')
    .set({
      authorization: apiKeyAuthorization // authorization isn't used in this endpoint
    })
    .set({
      authorization: apiKeyAuthorization
    })
    .expect(400)

  // /////////////////// //
  // MULTIPLE PARAMETERS //
  // /////////////////// //

  await request(t.context.serverUrl)
    .post('/auth/check')
    .send({
      apiKey,
      authorization: userAuthorization
    })
    .set({
      authorization: apiKeyAuthorization
    })
    .expect(400)

  // ////////////////// //
  // MISSING PARAMETERS //
  // ////////////////// //

  await request(t.context.serverUrl)
    .post('/auth/check')
    .set({
      authorization: apiKeyAuthorization
    })
    .expect(400)

  // /////////////// //
  // MISSING API KEY //
  // /////////////// //

  await request(t.context.serverUrl)
    .post('/auth/check')
    .expect(401)
})
