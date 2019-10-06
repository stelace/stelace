const createError = require('http-errors')
const _ = require('lodash')
const { getModels } = require('../models')

const { getObjectId } = require('stelace-util-keys')

const { apiVersions } = require('../versions')
const { setPlatformEnvData } = require('../redis')
const { builtInSSOProviders } = require('../util/authentication')

let responder
let roleRequester

function start ({ communication, isSystem }) {
  const {
    getResponder,
    getRequester
  } = communication

  responder = getResponder({
    name: 'Config Responder',
    key: 'config'
  })

  roleRequester = getRequester({
    name: 'Config service > Role Requester',
    key: 'role'
  })

  responder.on('read', async (req) => {
    const {
      access
    } = req

    if (!isAccessGranted({ access, req })) throw createError(403)

    return readConfig({ req, access })
  })

  responder.on('update', async (req) => {
    const {
      access
    } = req

    if (!isAccessGranted({ access, req })) throw createError(403)

    return updateConfig({ req, access })
  })

  responder.on('readPrivate', async (req) => {
    return readConfig({ req, access: 'private' })
  })

  responder.on('updatePrivate', async (req) => {
    const { stelace } = req

    if (stelace) {
      const ssoConnections = stelace.ssoConnections

      if (ssoConnections) {
        const connectionNames = Object.keys(ssoConnections)
        const customProviders = _.difference(connectionNames, builtInSSOProviders)

        connectionNames.forEach(p => {
          const isCustom = _.get(ssoConnections[p], 'isCustom')
          const customProviderOnly = ['authorizationUrl', 'tokenUrl', 'userInfoUrl']
          const forbiddenWithBuiltIn = customProviderOnly.filter(k => _.has(ssoConnections[p], k))

          if (!isCustom && builtInSSOProviders.includes(p) && forbiddenWithBuiltIn.length) {
            throw createError(400, `Bad Request: ${
              forbiddenWithBuiltIn.join(',')
            } cannot be set with ${p} built-in connection.`)
          } else if (customProviders.includes(p)) {
            _.set(ssoConnections[p], 'isCustom', true)
          }
        })
      }
    }

    return updateConfig({ req, access: 'private' })
  })

  // INTERNAL

  responder.on('_getConfig', async (req) => {
    const {
      platformId,
      env,
      access = 'default'
    } = req

    const { Config } = await getModels({ platformId, env })

    const config = await Config.query().findOne({ access })

    if (!config) {
      return {
        stelace: {},
        custom: {},
        theme: {}
      }
    }

    return config
  })

  function isAccessGranted ({ access, req }) {
    const protectedAccesses = ['private', 'system']
    const canAccessProtected = isSystem(req._systemHash)

    if (!protectedAccesses.includes(access)) return true

    return canAccessProtected
  }
}

async function readConfig ({ req, access }) {
  const platformId = req.platformId
  const env = req.env
  const { Config } = await getModels({ platformId, env })

  const config = await Config.query().findOne({ access })

  return exposeConfig({ req, config, access })
}

async function updateConfig ({ req, access }) {
  const platformId = req.platformId
  const env = req.env
  const { Config } = await getModels({ platformId, env })
  let apiVersion

  if (access === 'default') {
    if (req.stelace) {
      const whitelistRoles = _.get(req.stelace, 'roles.whitelist')
      const defaultRoles = _.get(req.stelace, 'roles.default')

      if (whitelistRoles && whitelistRoles.includes('dev')) {
        throw createError(422, 'Cannot whitelist the role "dev"')
      }
      if (defaultRoles && defaultRoles.includes('dev')) {
        throw createError(422, 'Cannot include the role "dev" into default roles')
      }

      if (whitelistRoles) {
        const { valid, invalidRoles } = await roleRequester.send({
          type: '_isValidRoles',
          platformId,
          env,
          roles: whitelistRoles
        })
        if (!valid) {
          throw createError(422, `Invalid whitelist roles: ${invalidRoles.join(', ')}`)
        }
      }
      if (defaultRoles) {
        const { valid, invalidRoles } = await roleRequester.send({
          type: '_isValidRoles',
          platformId,
          env,
          roles: defaultRoles
        })
        if (!valid) {
          throw createError(422, `Invalid default roles: ${invalidRoles.join(', ')}`)
        }
      }
    }
  } else if (access === 'system') {
    if (req.stelace) {
      if (req.stelace.stelaceVersion) {
        if (!apiVersions.includes(req.stelace.stelaceVersion)) {
          throw createError(422, 'Invalid Stelace version')
        }
        apiVersion = req.stelace.stelaceVersion
      }
    }
  }

  let config = await Config.query().findOne({ access })

  if (!config) {
    config = await Config.query().insert({
      id: await getObjectId({ prefix: Config.idPrefix, platformId, env }),
      access,
      stelace: req.stelace || {},
      custom: req.custom || {},
      theme: req.theme || {}
    })
  } else {
    const updateAttrs = {}

    if (req.stelace) {
      const TOKEN_EXP = 'stelaceAuthRefreshTokenExpiration'
      updateAttrs.stelace = Config.rawJsonbMerge('stelace', _.omit(req.stelace, TOKEN_EXP))

      if (access === 'private') {
        if (req.stelace[TOKEN_EXP]) {
          // override the whole duration object, we don't want multiple time units
          // Objection.js syntax to update JSONB columns: jsonbColumn:nested.fields
          // https://vincit.github.io/objection.js/recipes/json-queries.html#json-queries
          await Config.query().patch({
            [`stelace:${TOKEN_EXP}`]: req.stelace[TOKEN_EXP]
          }).where({ id: config.id })
        }
      }
    }
    if (req.custom) updateAttrs.custom = Config.rawJsonbMerge('custom', req.custom)
    if (req.theme) updateAttrs.theme = Config.rawJsonbMerge('theme', req.theme)

    config = await Config.query().patchAndFetchById(config.id, updateAttrs)
  }

  if (apiVersion) {
    await setPlatformEnvData(platformId, env, 'version', apiVersion)
  }

  return exposeConfig({ req, config, access })
}

function exposeConfig ({ req, config, access }) {
  const exposedConfig = {
    stelace: config ? config.stelace : {}
  }

  if (access === 'default') {
    exposedConfig.custom = config ? config.custom : {}
    exposedConfig.theme = config ? config.theme : {}
  } else if (access === 'system') {
    exposedConfig.custom = config ? config.custom : {}
  }

  return exposedConfig
}

function stop () {
  responder.close()
  responder = null

  roleRequester.close()
  roleRequester = null
}

module.exports = {
  start,
  stop
}
