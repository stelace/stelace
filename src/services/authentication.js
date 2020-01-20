const createError = require('http-errors')
const { Issuer, generators } = require('openid-client')
const _ = require('lodash')
const { transaction } = require('objection')

const { logError } = require('../../server/logger')
const { getModels } = require('../models')

const { getPlatformEnvData, setPlatformEnvData } = require('../redis')
const {
  createAccessToken,
  canRefreshToken,
  decodeJwtToken,
  isBuiltInSSOProvider,
  oAuth2BuiltInConnections
} = require('../util/authentication')

const { getApiBaseUrl } = require('../communication')

const {
  getCurrentUserId
} = require('../util/user')

const {
  computeDate
} = require('../util/time')

const { setSearchParams } = require('../util/url')

const {
  parseAuthorizationHeader,
  checkAuthToken
} = require('../auth')

const {
  getRandomString,
  getObjectId,
  extractDataFromObjectId,
  parsePublicPlatformId,
  parseKey
} = require('stelace-util-keys')

const tokenPrefix = 'tok_'

let responder
let configRequester
let authorizationRequester
let userPublisher

function start ({ communication, serverPort, isSystem }) {
  const {
    getResponder,
    getRequester,
    getPublisher,
    COMMUNICATION_ID
  } = communication

  responder = getResponder({
    name: 'Authentication Responder',
    key: 'authentication'
  })

  configRequester = getRequester({
    name: 'Authentication service > Config Requester',
    key: 'config'
  })

  authorizationRequester = getRequester({
    name: 'Authentication service > Authorization Requester',
    key: 'authorization'
  })

  userPublisher = getPublisher({
    name: 'Authentication service to User publisher',
    key: 'user',
    namespace: COMMUNICATION_ID
  })

  responder.on('login', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { AuthMean, User } = await getModels({ platformId, env })

    const {
      username,
      password
    } = req

    const user = await User.query().findOne({ username })
    if (!user) {
      throw createError(403)
    }

    const authMean = await AuthMean.query().findOne({
      provider: '_local_',
      userId: user.id
    })
    if (!authMean) {
      throw createError(403)
    }

    const isValid = await AuthMean.validatePassword(password, authMean.password)
    if (!isValid) {
      throw createError(403)
    }

    const result = await createLoginTokens({
      platformId,
      env,
      user,
      userAgent: req._userAgent
    })

    return result
  })

  responder.on('logout', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { AuthToken } = await getModels({ platformId, env })

    const {
      refreshToken: rawRefreshToken,
      logoutFromExternalProvider
    } = req

    const refreshToken = await AuthToken.query().findOne({
      type: 'refresh',
      value: rawRefreshToken
    })

    if (!logoutFromExternalProvider) {
      if (!refreshToken) return { success: true }

      await AuthToken.query().deleteById(refreshToken.id)
      return { success: true }
    } else {
      if (!refreshToken) throw createError('Invalid refresh token')

      const provider = refreshToken.reference.provider
      const idToken = refreshToken.reference.idToken

      if (!provider || !idToken) throw createError('This refresh token cannot be used to logout from external authentication provider')

      const publicPlatformId = getPublicPlatformId({ platformId, env })

      let ssoConnection = await getSSOConnection({ publicPlatformId, provider })
      if (isBuiltInSSOProvider({ provider, ssoConnection })) {
        ssoConnection = addBuiltInSSOValues(ssoConnection, provider)
      }

      const client = await getOAuthClient({
        publicPlatformId,
        provider,
        ssoConnection,
        serverPort,
        protocol: 'openid'
      })

      const data = { refreshTokenId: refreshToken.id }
      const state = await storeAuthenticationValue({ platformId, env, provider, type: 'oAuthLogoutState', data })

      const logoutUrl = client.endSessionUrl({
        id_token_hint: idToken,
        post_logout_redirect_uri: getSSOLogoutCallbackUrl({ publicPlatformId, provider, serverPort }),
        state
      })

      return { _redirectUrl: logoutUrl }
    }
  })

  responder.on('createToken', async (req) => {
    const platformId = req.platformId
    const env = req.env

    const {
      grantType,
      code,
      refreshToken: requestRefreshToken,
      userId,
      sourceUserId,
      roles,
      permissions,
      orgRoles,
      orgPermissions
    } = req

    const userAgent = req._userAgent

    if (grantType === 'refreshToken') {
      const result = await refreshToken({
        requestRefreshToken,
        userAgent,
        platformId,
        env
      })
      return result
    } else if (grantType === 'impersonateToken') {
      const result = await impersonateToken({
        req,
        platformId,
        env,
        userAgent,
        requestRefreshToken,
        userId,
        sourceUserId,
        roles,
        permissions,
        orgRoles,
        orgPermissions
      })
      return result
    } else if (grantType === 'authorizationCode') {
      const result = await createLoginTokensFromCode({
        platformId,
        env,
        code,
        userAgent
      })
      return result
    } else {
      throw createError(422, 'Unknown grant type')
    }
  })

  responder.on('checkToken', async (req) => {
    const platformId = req.platformId
    const env = req.env

    if (!isSystem(req._systemHash)) {
      throw createError(403)
    }

    const { AuthToken } = await getModels({ platformId, env })

    const {
      tokenType,
      token,
      userAgent
    } = req

    const result = {
      userId: null,
      valid: false
    }

    if (tokenType === 'refreshToken') {
      if (!userAgent) {
        throw createError(400, 'Missing user agent')
      }

      const refreshToken = await AuthToken.query().findOne({
        type: 'refresh',
        value: token
      })
      if (!refreshToken) {
        return result
      }

      result.userId = refreshToken.userId

      try {
        await canRefreshToken(refreshToken, { userAgent }) // throws an error if cannot refresh
        result.valid = true
      } catch (err) {
        result.valid = false
      }

      return result
    } else if (tokenType === 'accessToken') {
      const secret = await getAuthSecret({ platformId, env })

      try {
        const decodedToken = await decodeJwtToken(token, { secret })
        result.userId = decodedToken.sub
        result.valid = true

        return result
      } catch (err) {
        return result
      }
    } else {
      throw createError(400, 'Unknown token type')
    }
  })

  // Stelace API accepts the object jwks as configuration value.
  // That's to cover cases where API consumers have public certificate to provide
  // but hasn't implemented the endpoint jwks_uri on their side.

  // There is a parameter jwks in the library openid-client.
  // However it is only used for private keys and not public keys (generated from public certificate).
  // So we need to use jwks_uri with this library.

  // jwks_uri is basically an endpoint that exposes a jwks of public keys.
  // So to have a jwks_uri while we have the jwks object,
  // we build an endpoint ourself and expose the jwks object to make openid-client work.

  // https://github.com/panva/node-openid-client/blob/master/docs/README.md#new-clientmetadata-jwks
  responder.on('getJwks', async (req) => {
    const {
      publicPlatformId,
      provider
    } = req

    const { hasValidFormat } = parsePublicPlatformId(publicPlatformId)
    if (!hasValidFormat) throw createError(422)

    const ssoConnection = await getSSOConnection({ publicPlatformId, provider })
    const { jwks } = ssoConnection
    return jwks || {}
  })

  responder.on('ssoLogin', async (req) => {
    const {
      publicPlatformId,
      provider
    } = req

    const { hasValidFormat, platformId, env } = parsePublicPlatformId(publicPlatformId)
    if (!hasValidFormat) throw createError(422)

    let ssoConnection = await getSSOConnection({ publicPlatformId, provider })
    const { protocol } = ssoConnection

    if (protocol === 'oauth2') {
      if (!isValidOAuth2Connection(ssoConnection, provider)) {
        throw createError(422, `Invalid config for provider "${provider}"`)
      }

      if (isBuiltInSSOProvider({ provider, ssoConnection })) {
        ssoConnection = addBuiltInSSOValues(ssoConnection, provider)
      }

      const client = await getOAuthClient({ ssoConnection })

      // prevents CSRF attack by verifying the returned state matches this value
      const state = await storeAuthenticationValue({ platformId, env, provider, type: 'oAuthLoginState' })

      const authorizationParams = {
        redirect_uri: getSSOLoginCallbackUrl({ publicPlatformId, provider, serverPort }),
        response_type: 'code',
        scope: ssoConnection.scope,
        state
      }

      const ssoLoginUrl = getSSOLoginUrlClient({ client, authorizationParams, ssoConnection })

      // `_redirectUrl` is a special property to handle redirection,
      // please see server.js at the root of the project to have detailed explanations
      return { _redirectUrl: ssoLoginUrl }
    } else if (protocol === 'openid') {
      if (!isValidOpenIdConnection(ssoConnection, provider)) {
        throw createError(422, `Invalid config for provider "${provider}"`)
      }

      if (isBuiltInSSOProvider({ provider, ssoConnection })) {
        ssoConnection = addBuiltInSSOValues(ssoConnection, provider)
      }

      const client = await getOAuthClient({
        publicPlatformId,
        provider,
        ssoConnection,
        serverPort,
        protocol: 'openid'
      })

      let codeVerifier
      let codeChallenge

      if (ssoConnection.pkceEnabled) {
        codeVerifier = generators.codeVerifier()
        codeChallenge = generators.codeChallenge(codeVerifier)
      }

      // prevents CSRF attack by verifying the returned state matches this value
      const state = await storeAuthenticationValue({
        platformId,
        env,
        provider,
        type: 'oAuthLoginState',
        data: { codeVerifier }
      })

      const authorizationParams = {
        redirect_uri: getSSOLoginCallbackUrl({ publicPlatformId, provider, serverPort }),
        response_type: 'code',
        scope: ssoConnection.scope,
        state
      }

      if (ssoConnection.pkceEnabled) {
        authorizationParams.code_challenge = codeChallenge
        authorizationParams.code_challenge_method = 'S256'
      }

      const ssoLoginUrl = getSSOLoginUrlClient({ client, authorizationParams, ssoConnection })

      // `_redirectUrl` is a special property to handle redirection,
      // please see server.js at the root of the project to have detailed explanations
      return { _redirectUrl: ssoLoginUrl }
    } else {
      throw createError(422, 'Unknown protocol')
    }
  })

  responder.on('ssoLoginCallback', async (req) => {
    const {
      publicPlatformId,
      provider,
      originalUrl,
      state
    } = req

    const { platformId, env, hasValidFormat } = parsePublicPlatformId(publicPlatformId)
    if (!hasValidFormat) {
      throw createError(422)
    }

    let ssoConnection = await getSSOConnection({ publicPlatformId, provider })
    if (isBuiltInSSOProvider({ provider, ssoConnection })) {
      ssoConnection = addBuiltInSSOValues(ssoConnection, provider)
    }

    const {
      protocol,
      afterAuthenticationUrl,
      userInfoMapping,
      userMapProperties
    } = ssoConnection

    try {
      if (['oauth2', 'openid'].includes(protocol)) {
        let tokensToStore
        let userInfo
        let idToken

        if (!state) throw createError(422, 'Missing state')

        const { data: stateData } = await getAuthenticationValue({
          platformId,
          env,
          provider,
          type: 'oAuthLoginState',
          value: state
        })

        if (protocol === 'oauth2') {
          if (!isValidOAuth2Connection(ssoConnection, provider)) {
            throw createError(422, `Invalid config for provider "${provider}"`)
          }

          const client = await getOAuthClient({ ssoConnection })

          const parsed = client.callbackParams(originalUrl)

          const callbackURL = getSSOLoginCallbackUrl({ publicPlatformId, provider, serverPort })
          const tokenSet = await client.oauthCallback(
            callbackURL,
            parsed,
            { state },
            {
              exchangeBody: ssoConnection.tokenBodyParams || {}
            }
          )

          userInfo = await client.userinfo(tokenSet)
          tokensToStore = tokenSet
        } else if (protocol === 'openid') {
          if (!isValidOpenIdConnection(ssoConnection, provider)) {
            throw createError(422, `Invalid config for provider "${provider}"`)
          }

          const client = await getOAuthClient({
            publicPlatformId,
            provider,
            ssoConnection,
            serverPort,
            protocol: 'openid'
          })

          const { codeVerifier } = stateData

          const parsed = client.callbackParams(originalUrl)

          const callbackURL = getSSOLoginCallbackUrl({ publicPlatformId, provider, serverPort })
          const tokenSet = await client.callback(
            callbackURL,
            parsed,
            {
              code_verifier: codeVerifier,
              state
            },
            {
              exchangeBody: ssoConnection.tokenBodyParams || {}
            }
          )

          userInfo = await decodeJwtToken(tokenSet.id_token, { onlyDecode: true })

          if (ssoConnection.userInfoUrl) {
            const updatedUserInfo = await client.userinfo(tokenSet)
            userInfo = Object.assign({}, userInfo, updatedUserInfo)
          }

          idToken = tokenSet.id_token
          tokensToStore = tokenSet
        }

        // DEPRECATED: drop fallback on `userMapProperties` after migration
        const userMapping = Object.assign({}, userMapProperties || {}, userInfoMapping || {})

        const userAttrs = applySSOUserInfoMapping(userInfo, userMapping)

        const { AuthMean, AuthToken, User } = await getModels({ platformId, env })

        let authMean = await AuthMean.query().findOne({
          provider,
          identifier: userAttrs.id
        })

        const knex = AuthMean.knex()
        let user
        let updateAttrsBeforeFullDataMerge

        const shouldCreateUser = !authMean
        if (shouldCreateUser) {
          const config = await configRequester.send({
            type: '_getConfig',
            platformId,
            env,
            access: 'default'
          })

          await transaction(knex, async (trx) => {
            const createAttrs = Object.assign(
              {
                id: await getObjectId({ prefix: User.idPrefix, platformId, env }),
                roles: _.get(config, 'stelace.roles.default') || User.defaultRoles
              },
              _.omit(userAttrs, ['id', 'role'])
            )
            _.set(createAttrs, 'platformData.ssoProviders', [provider])

            user = await User.query(trx).insert(createAttrs)

            authMean = await AuthMean.query(trx).insert({
              id: await getObjectId({ prefix: AuthMean.idPrefix, platformId, env }),
              provider,
              identifier: _.toString(userAttrs.id), // external provider user ID
              userId: user.id,
              tokens: tokensToStore
            })
          })

          userPublisher.publish('userCreated', {
            user,
            eventDate: user.createdDate,
            platformId,
            env
          })
        } else {
          await transaction(knex, async (trx) => {
            user = await User.query(trx).findById(authMean.userId)
            if (!user) throw createError('User not found while referenced by an auth mean')

            let platformData

            // Update default properties and root values
            const updateAttrs = _.transform(userAttrs, (attrs, v, k) => {
              if (!_.isEmpty(_.get(user, k))) return true
              _.set(attrs, k, userAttrs[k])
            }, {})
            // Handle deep values
            _.forEach(userMapping, (v, k) => {
              if (!_.isEmpty(_.get(user, k))) return true
              _.set(updateAttrs, k, _.get(userAttrs, k))
            })

            updateAttrsBeforeFullDataMerge = Object.assign({}, updateAttrs)

            const ssoProviders = _.get(user, 'platformData.ssoProviders', [])
            if (!Array.isArray(ssoProviders)) { // can happen if API consumers set this property to an arbitrary value
              const rawPlatformData = {
                ssoProviders: [provider]
              }
              platformData = User.rawJsonbMerge('platformData', rawPlatformData)
              updateAttrsBeforeFullDataMerge.platformData = rawPlatformData
            } else if (!ssoProviders.includes(provider)) {
              const rawPlatformData = {
                ssoProviders: [provider].concat(ssoProviders)
              }
              platformData = User.rawJsonbMerge('platformData', rawPlatformData)
              updateAttrsBeforeFullDataMerge.platformData = rawPlatformData
            }

            if (updateAttrs.metadata) {
              updateAttrs.metadata = User.rawJsonbMerge('metadata', updateAttrs.metadata)
            }
            if (platformData) {
              _.merge(updateAttrs, { platformData })
            }

            user = await User.query(trx).patchAndFetchById(authMean.userId, updateAttrs)

            authMean = await AuthMean.query(trx).patchAndFetchById(authMean.id, {
              tokens: tokensToStore
            })
          })

          userPublisher.publish('userUpdated', {
            newUser: user,
            updateAttrs: updateAttrsBeforeFullDataMerge,
            eventDate: user.updatedDate,
            platformId,
            env
          })
        }

        // this request is triggered after a successful authentication
        // and should redirect the end user to a HTML page

        // so there is no way to safely retrieve authentication tokens
        // exposing tokens in query params isn't an option

        // we need to create a special code and add it to the redirect URL
        // this code (usable once) gives an access to retrieve Stelace authentication tokens
        // via the endpoint '/auth/token' with grantType === 'authorizationCode'
        const authToken = await AuthToken.query().insert({
          id: await getObjectId({ prefix: AuthToken.idPrefix, platformId, env }),
          type: 'ssoLogin',
          value: await getRandomString(40),
          reference: {
            idToken,
            provider
          },
          userId: user.id,
          expirationDate: computeDate(new Date().toISOString(), '1h')
        })

        return {
          _redirectUrl: setSearchParams(afterAuthenticationUrl, {
            status: 'success',
            code: authToken.value
          })
        }
      } else {
        throw createError(422, 'Unknown protocol')
      }
    } catch (err) {
      logError(err)
      if (afterAuthenticationUrl) {
        const params = {
          status: _.get(err, 'statusCode', 0) >= 500 ? 'serverError' : 'configError'
        }
        if (env === 'test' && params.status === 'configError') {
          params.details = err.message || ''
        }
        // `_redirectUrl` is a special property to handle redirection,
        // please see server.js at the root of the project to have detailed explanations
        return {
          _redirectUrl: setSearchParams(afterAuthenticationUrl, params)
        }
      }
    }
  })

  responder.on('ssoLogoutCallback', async (req) => {
    const {
      publicPlatformId,
      provider,
      state
    } = req

    const { hasValidFormat, platformId, env } = parsePublicPlatformId(publicPlatformId)
    if (!hasValidFormat) throw createError(422)

    let ssoConnection = await getSSOConnection({ publicPlatformId, provider })
    if (isBuiltInSSOProvider({ provider, ssoConnection })) {
      ssoConnection = addBuiltInSSOValues(ssoConnection, provider)
    }

    const {
      protocol,
      afterAuthenticationUrl,
      afterLogoutUrl
    } = ssoConnection

    const redirectUrl = afterLogoutUrl || afterAuthenticationUrl

    try {
      if (protocol !== 'openid') throw createError('Logout is only allowed if the protocol is openid')

      const { data } = await getAuthenticationValue({
        platformId,
        env,
        provider,
        type: 'oAuthLogoutState',
        value: state
      })

      const refreshTokenId = data.refreshTokenId

      const { AuthToken } = await getModels({ platformId, env })

      const refreshToken = await AuthToken.query().findById(refreshTokenId)
      if (refreshToken) {
        await AuthToken.query().deleteById(refreshToken.id)
      }

      return {
        _redirectUrl: setSearchParams(redirectUrl, {
          status: 'success'
        })
      }
    } catch (err) {
      logError(err)
      const params = {
        status: _.get(err, 'statusCode', 0) >= 500 ? 'serverError' : 'configError'
      }
      if (env === 'test' && params.status === 'configError') {
        params.details = err.message || ''
      }
      // `_redirectUrl` is a special property to handle redirection,
      // please see server.js at the root of the project to have detailed explanations
      return {
        _redirectUrl: setSearchParams(afterAuthenticationUrl, params)
      }
    }
  })

  responder.on('changePassword', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { AuthMean, Event, User } = await getModels({ platformId, env })

    const {
      currentPassword,
      newPassword
    } = req

    const currentUserId = getCurrentUserId(req)
    if (!currentUserId) {
      throw createError(401)
    }

    const user = await User.query().findById(currentUserId)
    if (!user) {
      throw createError(403)
    }

    let authMean = await AuthMean.query().findOne({
      provider: '_local_',
      userId: currentUserId
    })
    if (!authMean) {
      throw createError(403)
    }

    const isValid = await AuthMean.validatePassword(currentPassword, authMean.password)
    if (!isValid) {
      throw createError(422, 'Incorrect current password')
    }

    authMean = await AuthMean.query().patchAndFetchById(authMean.id, { password: newPassword })

    await Event.createEvent({
      createdDate: authMean.updatedDate,
      type: 'password__changed',
      objectType: 'user',
      objectId: user.id,
      object: User.expose(user, { namespaces: ['*'] })
    }, { platformId, env }).catch(() => null)

    return { success: true }
  })

  responder.on('requestPasswordReset', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { AuthMean, AuthToken, Event, User } = await getModels({ platformId, env })

    const {
      username
    } = req

    const user = await User.query().findOne({ username })
    if (!user && env === 'test') throw createError(422, { public: '[TEST]: User does not exist.' })
    else if (!user) return { success: true } // prevent sniffing in live environment

    const localAuthToken = await AuthMean.query().findOne({
      provider: '_local_',
      userId: user.id
    })
    // unavailable for SSO users that don't have a password
    // currently, there is no way for SSO users to create a password
    // but the logic allows password reset if they have one in the future
    if (!localAuthToken) throw createError(403)

    // TODO: get string length from config
    const tokenValue = await getRandomString(16)
    const expirationDate = computeDate(new Date().toISOString(), '10m')

    const authToken = await AuthToken.query().insert({
      id: await getObjectId({ prefix: AuthToken.idPrefix, platformId, env }),
      type: 'resetPassword',
      value: tokenValue,
      userId: user.id,
      expirationDate
    })

    await Event.createEvent({
      createdDate: authToken.createdDate,
      type: 'password__reset_requested',
      objectType: 'user',
      objectId: user.id,
      object: User.expose(user, { namespaces: ['*'] }),
      metadata: {
        resetToken: tokenValue,
        expirationDate
      }
    }, { platformId, env })

    return { success: true }
  })

  responder.on('confirmPasswordReset', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { AuthMean, AuthToken, Event, User } = await getModels({ platformId, env })

    const {
      resetToken,
      newPassword
    } = req

    const now = new Date().toISOString()

    const authToken = await AuthToken.query().findOne({ value: resetToken })
    if (!authToken || authToken.type !== 'resetPassword' || authToken.value !== resetToken) {
      throw createError(403)
    }
    if (authToken.expirationDate < now) {
      throw createError(403, 'Reset token expired')
    }

    const user = await User.query().findById(authToken.userId)
    if (!user) {
      throw createError(500, 'User associated with the reset token not found', { expose: false })
    }

    let authMean = await AuthMean.query().findOne({
      provider: '_local_',
      userId: user.id
    })

    if (authMean) {
      authMean = await AuthMean.query().patchAndFetchById(authMean.id, { password: newPassword })
    } else {
      // create an authentication by password if it doesn't exist
      authMean = await AuthMean.query().insert({
        id: await getObjectId({ prefix: AuthMean.idPrefix, platformId, env }),
        provider: '_local_',
        password: newPassword,
        userId: user.id
      })
    }

    await AuthToken.query().deleteById(authToken.id)

    await Event.createEvent({
      createdDate: authMean.updatedDate,
      type: 'password__reset_confirmed',
      objectType: 'user',
      objectId: user.id,
      object: User.expose(user, { namespaces: ['*'] })
    }, { platformId, env }).catch(() => null)

    return { success: true }
  })

  responder.on('tokenRequestCheck', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { AuthToken, Event, User } = await getModels({ platformId, env })

    let {
      userId
    } = req
    const {
      tokenType: type,
      expirationDate,
      redirectUrl,
      data
    } = req

    const currentUserId = getCurrentUserId(req)

    if (!currentUserId && !userId) {
      throw createError(400, 'Missing userId')
    }
    if (currentUserId && userId && currentUserId !== userId) {
      throw createError(403, 'Cannot check token for another user')
    }

    if (currentUserId && !userId) {
      userId = currentUserId
    }

    const user = await User.query().findById(userId)
    if (!user) {
      throw createError(422, 'User not found')
    }

    let tokenValue = await getObjectId({ prefix: tokenPrefix, separator: '', platformId, env })
    tokenValue = tokenValue.slice(tokenPrefix.length)

    const authToken = await AuthToken.query().insert({
      id: await getObjectId({ prefix: AuthToken.idPrefix, platformId, env }),
      type: 'check',
      value: tokenValue,
      userId: user.id,
      expirationDate,
      reference: {
        status: 'valid',
        type,
        data,
        redirectUrl
      }
    })

    await Event.createEvent({
      createdDate: authToken.createdDate,
      type: 'token__check_requested',
      objectId: user.id,
      objectType: 'user',
      object: User.expose(user, { namespaces: ['*'] }),
      metadata: {
        token: tokenValue,
        type,
        expirationDate: expirationDate || null,
        data: data || {}
      }
    }, { platformId, env })

    return { success: true }
  })

  responder.on('tokenConfirmCheck', async (req) => {
    const {
      token,
      redirect
    } = req

    const tokenId = 'tok_' + token
    let platformId
    let env

    try {
      const encodedData = extractDataFromObjectId(tokenId)
      platformId = encodedData.platformId
      env = encodedData.isLive ? 'live' : 'test'
    } catch (err) {
      return getTokenCheckResponse({ status: 'invalid', redirect })
    }

    const { AuthToken, Event, User } = await getModels({ platformId, env })

    const now = new Date().toISOString()

    const config = await configRequester.send({
      type: '_getConfig',
      platformId,
      env,
      access: 'default'
    })

    const fallbackRedirectUrl = config.stelace.tokenCheckRedirectUrl

    const authToken = await AuthToken.query().findOne({ value: token })
    if (!authToken || authToken.type !== 'check') {
      return getTokenCheckResponse({ status: 'invalid', redirect, fallbackRedirectUrl, token })
    }

    if (redirect && !authToken.reference.redirectUrl && !fallbackRedirectUrl) {
      return getTokenCheckResponse({ status: 'invalid', redirect, fallbackRedirectUrl, token })
    }

    if (authToken.expirationDate < now) {
      return getTokenCheckResponse({
        authToken,
        redirect,
        fallbackRedirectUrl,
        status: 'expired'
      })
    }

    const user = await User.query().findById(authToken.userId)
    if (!user) {
      return getTokenCheckResponse({
        authToken,
        redirect,
        fallbackRedirectUrl,
        status: 'invalid'
      })
    }

    const tokenAlreadyChecked = !!authToken.reference.checked

    const newReference = Object.assign({}, authToken.reference)
    if (!tokenAlreadyChecked) {
      newReference.checked = true
    }

    const updatedAuthToken = await AuthToken.query().patchAndFetchById(authToken.id, {
      reference: newReference
    })

    if (!tokenAlreadyChecked) {
      await Event.createEvent({
        createdDate: updatedAuthToken.updatedDate,
        type: 'token__check_confirmed',
        objectId: user.id,
        objectType: 'user',
        object: User.expose(user, { namespaces: ['*'] }),
        metadata: {
          token,
          type: authToken.reference.type,
          expirationDate: authToken.expirationDate || null,
          data: authToken.reference.data || {}
        }
      }, { platformId, env })
    }

    return getTokenCheckResponse({
      authToken,
      redirect,
      fallbackRedirectUrl,
      status: !tokenAlreadyChecked ? 'valid' : 'alreadyChecked'
    })
  })

  responder.on('authCheck', async (req) => {
    const {
      apiKey,
      authorization
    } = req

    if (apiKey) {
      return parseAuthInformation({ apiKey })
    } else if (authorization) {
      const tmpReq = { headers: { authorization } }

      // `auth.parseAuthorizationHeader` function will decompose the `authorization` header into
      // `apiKey` and/or `token` whatever the scheme is (Basic or Stelace-V1)
      // e.g. Stelace-V1 apiKey=secretApiKey, token=secretToken
      // will be parsed into { authorization: { apiKey: 'secretApiKey', token: 'secretToken' } }
      parseAuthorizationHeader(tmpReq, { noThrowIfError: true })
      return parseAuthInformation(tmpReq.authorization || {})
    } else {
      throw createError(400, 'Please pass the parameters `apiKey` or `authorization`')
    }
  })

  // INTERNAL

  responder.on('_getAuthSecret', async (req) => {
    const { platformId, env } = req

    const secret = await getAuthSecret({ platformId, env })
    return secret
  })

  async function refreshToken ({
    requestRefreshToken,
    userAgent,
    platformId,
    env
  }) {
    const { AuthToken, User } = await getModels({ platformId, env })

    if (!requestRefreshToken) throw createError(400, 'Missing refresh token')

    const refreshToken = await AuthToken.query().findOne({
      type: 'refresh',
      value: requestRefreshToken
    })
    if (!refreshToken) throw createError(403)

    await canRefreshToken(refreshToken, { userAgent })

    const user = await User.query().findById(refreshToken.userId)
    if (!user) throw createError(403, 'User no longer exist')

    const secret = await getAuthSecret({ platformId, env })

    const accessToken = await createAccessToken({
      user,
      data: {
        loggedAt: Math.round(new Date(refreshToken.createdDate).getTime() / 1000)
      },
      secret
    })

    return {
      tokenType: 'Bearer',
      accessToken
    }
  }

  async function impersonateToken ({
    req,
    platformId,
    env,
    userAgent,
    requestRefreshToken,
    userId: targetUserId,
    sourceUserId,
    roles,
    permissions,
    orgRoles: requestOrgRoles,
    orgPermissions: requestOrgPermissions
  }) {
    const { AuthToken, User } = await getModels({ platformId, env })

    if (!targetUserId) {
      throw createError(400, 'Missing userId')
    }

    const secret = await getAuthSecret({ platformId, env })

    if (isSystem(req._systemHash)) {
      const accessToken = await createAccessToken({
        user: {
          id: targetUserId
        },
        secret,
        data: {
          loggedAt: null,
          sourceUserId,
          roles,
          permissions,
          orgRoles: requestOrgRoles,
          orgPermissions: requestOrgPermissions
        }
      })

      return {
        tokenType: 'Bearer',
        accessToken
      }
    } else {
      if (roles || permissions || requestOrgRoles || requestOrgPermissions) {
        throw createError(403)
      }
      if (!requestRefreshToken) {
        throw createError(400, 'Missing refresh token')
      }

      const refreshToken = await AuthToken.query().findOne({
        type: 'refresh',
        value: requestRefreshToken
      })
      if (!refreshToken) {
        throw createError(403)
      }

      await canRefreshToken(refreshToken, { userAgent })

      const sourceUser = await User.query().findById(refreshToken.userId)
      if (!sourceUser) {
        throw createError(403)
      }

      const targetUser = await User.query().findById(targetUserId)
      if (!targetUser) {
        throw createError(422, 'User not found')
      }

      const organizationRole = 'organization'
      const hasImpersonatePermissions = !!req._matchedPermissions['auth:impersonate']
      const isTargetUserOrganization = targetUser.roles.includes(organizationRole)
      const orgObject = sourceUser.organizations[targetUserId]
      const orgRoles = orgObject && orgObject.roles
      const isOrganizationMember = !!orgObject

      const canImpersonate = hasImpersonatePermissions ||
        (isTargetUserOrganization && isOrganizationMember)

      if (!canImpersonate) {
        throw createError(403)
      }

      const accessToken = await createAccessToken({
        user: {
          id: targetUserId
        },
        secret,
        data: {
          loggedAt: Math.round(new Date(refreshToken.createdDate).getTime() / 1000),
          sourceUserId: sourceUser.id,
          roles: isTargetUserOrganization ? orgRoles : targetUser.roles,
          orgRoles: isTargetUserOrganization ? targetUser.roles : null
        }
      })

      return {
        tokenType: 'Bearer',
        accessToken
      }
    }
  }

  async function createLoginTokensFromCode ({ platformId, env, code, userAgent }) {
    const { AuthToken, User } = await getModels({ platformId, env })

    const now = new Date().toISOString()

    const authToken = await AuthToken.query().findOne({ type: 'ssoLogin', value: code })
    if (!authToken) throw createError(422, 'Invalid code')
    if (authToken.expirationDate < now) throw createError(403, 'Code expired')
    if (authToken.reference.checked) throw createError(422, 'Code already used')

    const user = await User.query().findById(authToken.userId)
    if (!user) throw createError(422, 'User does not exist')

    const idToken = authToken.reference.idToken
    const provider = authToken.reference.provider

    const result = createLoginTokens({ platformId, env, user, userAgent, provider, idToken })

    await AuthToken.query().patchAndFetchById(authToken.id, { reference: { checked: true } })

    return result
  }

  async function parseAuthInformation ({ apiKey, token }) {
    const result = {
      valid: false,
      apiKey: null,
      user: null,
      tokenExpired: null
    }

    if (!apiKey) return result

    const parsedApiKey = parseKey(apiKey)
    result.valid = parsedApiKey.hasValidFormat

    if (!result.valid) return result

    result.apiKey = parsedApiKey
    const platformId = parsedApiKey.platformId
    const env = parsedApiKey.env

    if (token) {
      const { decodedToken, isTokenExpired } = await checkAuthToken({
        authToken: token,
        platformId,
        env,
      })

      result.valid = !!decodedToken

      if (decodedToken && result.valid) {
        result.user = decodedToken
        result.tokenExpired = isTokenExpired
      }
    }

    return result
  }
}

async function createRefreshToken ({
  user,
  userAgent,
  idToken,
  provider,
  refreshTokenExpiration,
  platformId,
  env
} = {}) {
  const { AuthToken } = await getModels({ platformId, env })

  const refreshTokenLength = 60

  const refreshToken = await AuthToken.query().insert({
    id: await getObjectId({ prefix: AuthToken.idPrefix, platformId, env }),
    type: 'refresh',
    value: await getRandomString(refreshTokenLength),
    userId: user.id,
    reference: {
      userAgent,
      provider,
      idToken
    },
    expirationDate: computeDate(new Date().toISOString(), refreshTokenExpiration || '14d')
  })

  return refreshToken
}

async function getAuthSecret ({ platformId, env }) {
  const key = 'auth'

  const authData = await getPlatformEnvData(platformId, env, key)

  let secret = authData && authData.secret

  // if there is no auth secret, create one
  if (!secret) {
    secret = await getRandomString(40)
    await setPlatformEnvData(platformId, env, key, { secret })
  }

  return secret
}

function getTokenCheckResponse ({
  authToken,
  token,
  redirect,
  status,
  fallbackRedirectUrl
}) {
  const responseObject = {
    status: 'valid',
    type: null,
    userId: null,
    expirationDate: null,
    data: {}
  }

  if (!authToken) {
    if (redirect) {
      if (fallbackRedirectUrl) {
        return getRedirectObject({
          redirectUrl: fallbackRedirectUrl,
          token,
          status: 'invalid'
        })
      } else {
        return {
          _rawResponse: {
            statusCode: 422,
            content: 'This validation address is invalid, we invite you to contact staff.',
            headers: {
              'content-type': 'text/plain'
            }
          }
        }
      }
    } else {
      responseObject.status = 'invalid'
      return responseObject
    }
  }

  if (redirect) {
    return getRedirectObjectFromAuthToken(authToken, status, fallbackRedirectUrl)
  } else {
    responseObject.status = status
    responseObject.type = authToken.reference.type
    responseObject.userId = authToken.userId
    responseObject.expirationDate = authToken.expirationDate || null
    responseObject.data = authToken.reference.data || {}

    return responseObject
  }
}

function getRedirectObjectFromAuthToken (authToken, status, fallbackRedirectUrl) {
  return getRedirectObject({
    redirectUrl: authToken.reference.redirectUrl || fallbackRedirectUrl,
    token: authToken.value,
    status
  })
}

function getRedirectObject ({ redirectUrl, token, status }) {
  // `_redirectUrl` is a special property to handle redirection,
  // please see server.js at the root of the project to have detailed explanations
  return { _redirectUrl: setSearchParams(redirectUrl, { token, status }) }
}

async function getSSOConnection ({ publicPlatformId, provider }) {
  const { platformId, env, hasValidFormat } = parsePublicPlatformId(publicPlatformId)
  if (!hasValidFormat) {
    throw createError(422)
  }

  const privateConfig = await configRequester.send({
    type: '_getConfig',
    platformId,
    env,
    access: 'private'
  })

  const connectionConfig = _.get(privateConfig, `stelace.ssoConnections.${provider}`)
  if (!connectionConfig || !_.isPlainObject(connectionConfig)) {
    throw createError(422, 'Missing connection configuration')
  }

  return connectionConfig
}

function isValidOAuth2Connection (ssoConnection, provider) {
  const {
    protocol,
    authorizationUrl,
    tokenUrl,
    clientId,
    clientSecret,
    afterAuthenticationUrl,
    userInfoUrl
  } = ssoConnection

  const validOAuthConnection = !!(
    protocol === 'oauth2' &&
    clientId &&
    clientSecret &&
    afterAuthenticationUrl
  )

  const validCustomOAuthConnection = !!(
    validOAuthConnection &&
    authorizationUrl &&
    tokenUrl &&
    userInfoUrl
  )

  if (isBuiltInSSOProvider({ provider, ssoConnection })) return validOAuthConnection
  else return validCustomOAuthConnection
}

function isValidOpenIdConnection (ssoConnection, provider) {
  const {
    protocol,
    authorizationUrl,
    tokenUrl,
    clientId,
    afterAuthenticationUrl,
    jwksUrl,
    jwks,
    clientSecret,
    issuer,
  } = ssoConnection

  const validConnection = !!(
    protocol === 'openid' &&
    clientId &&
    afterAuthenticationUrl &&
    issuer &&
    (jwksUrl || jwks || clientSecret)
  )

  const validCustomConnection = !!(
    validConnection &&
    authorizationUrl &&
    tokenUrl
  )

  if (isBuiltInSSOProvider({ provider, ssoConnection })) return validConnection
  else return validCustomConnection
}

function getPublicPlatformId ({ platformId, env }) {
  return `e${platformId}_${env}`
}

/**
 * Add pre-configured values for built-in providers
 * @param {Object} ssoConnection
 * @param {String} provider
 */
function addBuiltInSSOValues (ssoConnection, provider) {
  let newSsoConnection = Object.assign({}, ssoConnection)
  if (['oauth2', 'openid'].includes(ssoConnection.protocol)) {
    newSsoConnection = Object.assign(newSsoConnection, oAuth2BuiltInConnections[provider])
  }

  return newSsoConnection
}

function getJwksUrl ({ publicPlatformId, provider, serverPort }) {
  const apiUrl = getApiBaseUrl({ publicPlatformId, provider, serverPort })
  return `${apiUrl}/auth/sso/${publicPlatformId}/${provider}/jwks`
}

function getSSOLoginCallbackUrl ({ publicPlatformId, provider, serverPort }) {
  const apiUrl = getApiBaseUrl({ publicPlatformId, provider, serverPort })
  return `${apiUrl}/auth/sso/${publicPlatformId}/${provider}/callback`
}

function getSSOLogoutCallbackUrl ({ publicPlatformId, provider, serverPort }) {
  const apiUrl = getApiBaseUrl({ publicPlatformId, provider, serverPort })
  return `${apiUrl}/auth/sso/${publicPlatformId}/${provider}/logout/callback`
}

async function getOAuthClient ({ publicPlatformId, provider, ssoConnection, serverPort, protocol = 'oauth2' }) {
  const {
    issuer: customIssuer,
    authorizationUrl,
    tokenUrl,
    userInfoUrl,
    clientId,
    clientSecret,
    active,

    // specific OpenID parameters
    endSessionUrl,
    jwks,
    jwksUrl,
    idTokenSignedResponseAlg,
    tokenEndpointAuthSigningAlg
  } = ssoConnection

  if (!active) {
    throw createError(422, 'SSO connection inactive')
  }

  const issuerParams = {
    issuer: customIssuer,
    authorization_endpoint: authorizationUrl,
    token_endpoint: tokenUrl,
    token_endpoint_auth_method: 'client_secret_basic',
    userinfo_endpoint: userInfoUrl
  }

  if (protocol === 'openid') {
    if (endSessionUrl) {
      issuerParams.end_session_endpoint = endSessionUrl
    }
    if (jwks || jwksUrl) {
      issuerParams.jwks_uri = jwksUrl || getJwksUrl({ publicPlatformId, provider, serverPort })
    }
    if (idTokenSignedResponseAlg) { // node-openid-client default: 'RS256'
      issuerParams.id_token_signed_response_alg = idTokenSignedResponseAlg
    }
    if (tokenEndpointAuthSigningAlg) {
      issuerParams.token_endpoint_auth_signing_alg = tokenEndpointAuthSigningAlg
    }
  }

  const issuer = new Issuer(issuerParams)

  const client = new issuer.Client({
    client_id: clientId,
    client_secret: clientSecret || null,
    response_types: ['code']
  })

  return client
}

// store authentication value because in multi-instance environment,
// the server sending the authentication request
// and the server receiving the response in callback request can be different
// e.g. useful to store the state used in authorization code flow
async function storeAuthenticationValue ({ platformId, env, provider, type, data }) {
  const { AuthToken } = await getModels({ platformId, env })

  const authToken = await AuthToken.query().insert({
    id: await getObjectId({ prefix: AuthToken.idPrefix, platformId, env }),
    type,
    value: await getRandomString(40),
    reference: { provider, data },
    expirationDate: computeDate(new Date().toISOString(), '1h')
  })

  return authToken.value
}

async function getAuthenticationValue ({ platformId, env, provider, type, value }) {
  const { AuthToken } = await getModels({ platformId, env })

  const result = {
    data: {}
  }

  const now = new Date().toISOString()

  const authToken = await AuthToken.query().findOne({
    value,
    type
  })

  if (!authToken) {
    result.error = 'No authToken'
    return result
  } else if (authToken.reference.provider !== provider) {
    result.error = 'Providers don’t match.'
  }

  await AuthToken.query().deleteById(authToken.id)

  if (authToken.expirationDate < now) {
    result.error = 'authToken expired'
  }

  if (result.error) {
    throw createError(422, `Invalid state${result.error ? ': ' + result.error : ''}`, {
      public: { custom: { platformId, env, provider } }
    })
  }

  result.data = authToken.reference.data || {}

  return result
}

function applySSOUserInfoMapping (userInfo, userInfoMapping) {
  const defaultUserInfoMapping = {
    email: 'email',
    firstname: 'given_name',
    lastname: 'family_name',
    displayName: 'name'
  }

  if (userInfo.sub) defaultUserInfoMapping.id = 'sub'
  else defaultUserInfoMapping.id = 'id'

  const mapProperties = Object.assign({}, defaultUserInfoMapping, userInfoMapping || {})

  const userAttrs = {}

  _.forEach(mapProperties, (v, k) => {
    const value = userInfo[v]
    if (!_.isUndefined(value)) _.set(userAttrs, k, value)
  })

  return userAttrs
}

async function createLoginTokens ({ platformId, env, user, userAgent, provider, idToken }) {
  const privateConfig = await configRequester.send({
    type: '_getConfig',
    platformId,
    env,
    access: 'private'
  })

  const refreshTokenExpiration = privateConfig.stelace.stelaceAuthRefreshTokenExpiration

  const secret = await getAuthSecret({ platformId, env })

  const refreshToken = await createRefreshToken({
    user,
    userAgent,
    refreshTokenExpiration,
    provider,
    idToken,
    platformId,
    env
  })

  const accessToken = await createAccessToken({
    user,
    data: {
      loggedAt: Math.round(new Date(refreshToken.createdDate).getTime() / 1000)
    },
    secret
  })

  return {
    tokenType: 'Bearer',
    accessToken,
    refreshToken: refreshToken.value,
    userId: user.id
  }
}

function getSSOLoginUrlClient ({ client, authorizationParams, ssoConnection }) {
  let ssoLoginUrl = client.authorizationUrl(authorizationParams)

  if (ssoConnection.authorizationQueryParams && !_.isEmpty(ssoConnection.authorizationQueryParams)) {
    ssoLoginUrl = setSearchParams(ssoLoginUrl, ssoConnection.authorizationQueryParams)
  }

  return ssoLoginUrl
}

function stop () {
  responder.close()
  responder = null

  configRequester.close()
  configRequester = null

  authorizationRequester.close()
  authorizationRequester = null
}

module.exports = {
  start,
  stop
}
