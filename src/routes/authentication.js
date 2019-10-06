const _ = require('lodash')

let requester

function init (server, { middlewares, helpers } = {}) {
  const {
    checkPermissions
  } = middlewares
  const {
    wrapAction,
    populateRequesterParams
  } = helpers

  server.post({
    name: 'auth.login',
    path: '/auth/login'
  }, checkPermissions(['auth:login']), wrapAction(async (req, res) => {
    const fields = [
      'username',
      'password'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'login'
    })

    params = Object.assign({}, params, payload)

    return requester.send(params)
  }))

  server.post({
    name: 'auth.logout',
    path: '/auth/logout'
  }, wrapAction(async (req, res) => {
    const {
      refreshToken,
      logoutFromExternalProvider
    } = req.body

    const params = populateRequesterParams(req)({
      type: 'logout',
      refreshToken,
      logoutFromExternalProvider
    })

    return requester.send(params)
  }))

  server.post({
    name: 'auth.createToken',
    path: '/auth/token'
  }, checkPermissions([], { optionalPermissions: ['auth:impersonate'] }), wrapAction(async (req, res) => {
    const fields = [
      'grantType',
      'refreshToken',
      'code',
      'userId',
      'sourceUserId',
      'roles',
      'permissions'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'createToken'
    })

    params = Object.assign({}, params, payload)

    return requester.send(params)
  }))

  server.post({
    name: 'auth.checkToken',
    path: '/auth/token/check'
  }, wrapAction(async (req, res) => {
    const fields = [
      'tokenType',
      'token',
      'userAgent'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'checkToken'
    })

    params = Object.assign({}, params, payload)

    return requester.send(params)
  }))

  server.get({
    name: 'auth.getJwks',
    path: '/auth/sso/:platformId/:provider/jwks'
  }, wrapAction(async (req, res) => {
    const {
      platformId,
      provider
    } = req.params

    const params = populateRequesterParams(req)({
      type: 'getJwks',
      publicPlatformId: platformId,
      provider
    })

    return requester.send(params)
  }))

  server.get({
    name: 'auth.ssoLogin',
    path: '/auth/sso/:platformId/:provider'
  }, wrapAction(async (req, res) => {
    const {
      platformId,
      provider
    } = req.params

    const params = populateRequesterParams(req)({
      type: 'ssoLogin',
      publicPlatformId: platformId,
      provider
    })

    return requester.send(params)
  }))

  server.get({
    name: 'auth.ssoLoginCallback',
    path: '/auth/sso/:platformId/:provider/callback'
  }, wrapAction(async (req, res) => {
    const {
      platformId,
      provider
    } = req.params
    const {
      state
    } = req.query || {}

    const params = populateRequesterParams(req)({
      type: 'ssoLoginCallback',
      publicPlatformId: platformId,
      provider,
      originalUrl: req.url,
      state
    })

    return requester.send(params)
  }))

  server.get({
    name: 'auth.ssoLogoutCallback',
    path: '/auth/sso/:platformId/:provider/logout/callback'
  }, wrapAction(async (req, res) => {
    const {
      platformId,
      provider
    } = req.params
    const {
      state
    } = req.query

    const params = populateRequesterParams(req)({
      type: 'ssoLogoutCallback',
      publicPlatformId: platformId,
      provider,
      state
    })

    return requester.send(params)
  }))

  server.post({
    name: 'password.changePassword',
    path: '/password/change'
  }, wrapAction(async (req, res) => {
    const fields = [
      'currentPassword',
      'newPassword'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'changePassword'
    })

    params = Object.assign({}, params, payload)

    return requester.send(params)
  }))

  server.post({
    name: 'password.requestPasswordReset',
    path: '/password/reset/request'
  }, checkPermissions(['password:reset']), wrapAction(async (req, res) => {
    const {
      username
    } = req.body

    const params = populateRequesterParams(req)({
      type: 'requestPasswordReset',
      username
    })

    return requester.send(params)
  }))

  server.post({
    name: 'password.confirmPasswordReset',
    path: '/password/reset/confirm'
  }, wrapAction(async (req, res) => {
    const {
      resetToken,
      newPassword
    } = req.body

    const params = populateRequesterParams(req)({
      type: 'confirmPasswordReset',
      resetToken,
      newPassword
    })

    return requester.send(params)
  }))

  server.post({
    name: 'token.requestCheck',
    path: '/token/check/request'
  }, checkPermissions(['token:check']), wrapAction(async (req, res) => {
    const fields = [
      'userId',
      'expirationDate',
      'redirectUrl',
      'data'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'tokenRequestCheck'
    })

    params = Object.assign({}, params, payload)

    params.tokenType = req.body.type

    return requester.send(params)
  }))

  server.get({
    name: 'token.confirmCheck',
    path: '/token/check/:token'
  }, wrapAction(async (req, res) => {
    const token = req.params.token
    const {
      redirect
    } = req.query

    const params = populateRequesterParams(req)({
      type: 'tokenConfirmCheck',
      token,
      redirect
    })

    return requester.send(params)
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Authentication route > Authentication Requester',
    key: 'authentication'
  })
}

function stop () {
  requester.close()
  requester = null
}

module.exports = {
  init,
  start,
  stop
}
