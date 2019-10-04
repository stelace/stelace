const jwt = require('jsonwebtoken')
const useragent = require('useragent')
const bluebird = require('bluebird')
const createError = require('http-errors')

bluebird.promisifyAll(jwt)

const {
  convertToMs
} = require('../util/time')

async function createAccessToken ({
  user,
  data = {},
  issuer,
  secret,
  accessTokenExpiration
} = {}) {
  const accessTokenExpirationMilliSeconds = convertToMs(accessTokenExpiration || '1h')
  const accessTokenExpirationSeconds = Math.round(accessTokenExpirationMilliSeconds / 1000)

  const roles = user.roles || []

  const encodingToken = Object.assign({}, {
    userId: user.id,
    roles
  }, data)

  const params = {
    expiresIn: accessTokenExpirationSeconds
  }

  if (issuer) {
    params.issuer = issuer
  }

  const token = await jwt.signAsync(encodingToken, secret, params)

  return token
}

async function decodeJwtToken (token, { secret, issuer, onlyDecode = false } = {}) {
  const options = {}
  if (issuer) {
    options.issuer = issuer
  }

  if (onlyDecode) {
    return jwt.decode(token)
  } else {
    return jwt.verifyAsync(token, secret, options)
  }
}

/**
 * Throw an error if cannot refresh the token
 * @param {String} refreshToken
 * @param {Object} options
 * @param {String} options.userAgent
 */
async function canRefreshToken (refreshToken, { userAgent } = {}) {
  if (!refreshToken.reference || !refreshToken.reference.userAgent) throw createError(500)
  if (refreshToken.expirationDate < new Date().toISOString()) throw createError(403, 'Refresh token expired')

  const isValidUA = checkUserAgent(userAgent, refreshToken.reference.userAgent)
  if (!isValidUA) throw createError(403, 'Cannot refresh this token')

  return isValidUA
}

function checkUserAgent (newUA, oldUA) {
  const parsedNewUA = useragent.parse(newUA)
  const parsedOldUA = useragent.parse(oldUA)

  const newMajor = parseInt(parsedNewUA.major, 10)
  const newMinor = parseInt(parsedNewUA.minor, 10)
  const oldMajor = parseInt(parsedOldUA.major, 10)
  const oldMinor = parseInt(parsedOldUA.minor, 10)

  // if the user agent isn't recognized, check if the two user agents are equal
  if (parsedNewUA.family === 'Other' || parsedOldUA.family === 'Other') {
    return newUA === oldUA
  }

  // otherwise, check if the new useragent is an upgrade version of the old one
  return parsedNewUA.family === parsedOldUA.family &&
    (newMajor > oldMajor || (newMajor === oldMajor && newMinor >= oldMinor))
}

const builtInSSOProviders = [
  'facebook',
  'github',
  'google'
]

function isBuiltInSSOProvider ({ provider, ssoConnection = {} } = {}) {
  if (typeof provider !== 'string') throw new Error('provider string expected in options object')
  return builtInSSOProviders.includes(provider) && !ssoConnection.isCustom
}

const oAuth2BuiltInConnections = {
  facebook: {
    protocol: 'oauth2',
    authorizationUrl: 'https://www.facebook.com/v3.3/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v3.3/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/me',
    userInfoMapping: {
      email: 'email',
      displayName: 'name',
      firstname: 'first_name',
      lastname: 'last_name'
    }
  },
  github: {
    protocol: 'oauth2',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    userInfoMapping: {
      displayName: 'name',
      email: 'email'
    }
  },
  google: {
    protocol: 'oauth2',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://accounts.google.com/o/oauth2/token',
    scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json',
    userInfoMapping: {
      email: 'email',
      displayName: 'name',
      firstname: 'given_name',
      lastname: 'family_name',
      'platformData.instant.emailVerified': 'verified_email'
    }
  }
}

module.exports = {

  createAccessToken,
  decodeJwtToken,
  canRefreshToken,

  builtInSSOProviders,
  isBuiltInSSOProvider,
  oAuth2BuiltInConnections

}
