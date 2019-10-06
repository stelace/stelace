const createError = require('http-errors')
const _ = require('lodash')

const { logError } = require('../../logger')
const { getModels } = require('../models')

const {
  generateKey,
  getObjectId
} = require('stelace-util-keys')

const { performListQuery } = require('../util/listQueryBuilder')

const { getListPermissions } = require('../permissions')

let responder
let subscriber
let publisher
let roleRequester

function start ({ communication, isSystem }) {
  const {
    getResponder,
    getRequester,
    getSubscriber,
    getPublisher,
    COMMUNICATION_ID
  } = communication

  responder = getResponder({
    name: 'Api key Responder',
    key: 'api-key'
  })

  subscriber = getSubscriber({
    name: 'Api key subscriber',
    key: 'api-key',
    namespace: COMMUNICATION_ID,
    subscribesTo: [
      'apiKeyCreated',
      'apiKeyUpdated',
      'apiKeyDeleted'
    ]
  })

  publisher = getPublisher({
    name: 'Api key publisher',
    key: 'api-key',
    namespace: COMMUNICATION_ID
  })

  roleRequester = getRequester({
    name: 'Api key service > Role Requester',
    key: 'role'
  })

  responder.on('list', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { ApiKey } = await getModels({ platformId, env })

    const {
      orderBy,
      order,

      page,
      nbResultsPerPage,

      id,
      createdDate,
      updatedDate,
      apiKeyType,
      reveal
    } = req

    if (reveal && !canRevealApiKey(req)) {
      throw createError(403)
    }

    const type = apiKeyType

    const queryBuilder = ApiKey.query()

    const paginationMeta = await performListQuery({
      queryBuilder,
      filters: {
        ids: {
          dbField: 'id',
          value: id,
          transformValue: 'array',
          query: 'inList'
        },
        createdDate: {
          dbField: 'createdDate',
          value: createdDate,
          query: 'range'
        },
        updatedDate: {
          dbField: 'updatedDate',
          value: updatedDate,
          query: 'range'
        },
        type: {
          value: type,
          query: (queryBuilder, type) => {
            queryBuilder.where('key', 'like', `${type}_%`)
          }
        }
      },
      paginationActive: true,
      paginationConfig: {
        page,
        nbResultsPerPage
      },
      orderConfig: {
        orderBy,
        order
      }
    })

    const options = {}
    if (reveal && canRevealApiKey(req)) {
      options.reveal = true
    }

    paginationMeta.results = ApiKey.exposeAll(paginationMeta.results, { req, options })

    return paginationMeta
  })

  responder.on('read', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { ApiKey } = await getModels({ platformId, env })

    const apiKeyId = req.apiKeyId

    const { reveal } = req

    if (reveal && !canRevealApiKey(req)) {
      throw createError(403)
    }

    const apiKey = await ApiKey.query().findById(apiKeyId)
    if (!apiKey) {
      throw createError(404)
    }

    const isSelf = ApiKey.isSelf(apiKey, req._apiKeyId)
    if (!req._matchedPermissions['apiKey:read:all'] && !isSelf) {
      throw createError(403)
    }

    const options = {}
    if (reveal && canRevealApiKey(req)) {
      options.reveal = true
    }

    return ApiKey.expose(apiKey, { req, options })
  })

  responder.on('create', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { ApiKey } = await getModels({ platformId, env })

    const {
      name,
      apiKeyType = 'pubk',
      roles,
      permissions,
      readNamespaces,
      editNamespaces,
      metadata,
      platformData
    } = req

    if (roles) {
      const { valid, invalidRoles } = await roleRequester.send({
        type: '_isValidRoles',
        platformId,
        env,
        roles
      })

      if (!valid) {
        throw createError(422, `Invalid roles: ${invalidRoles.join(', ')}`)
      }
    }
    if (permissions) {
      const allowedPermissions = getListPermissions()
      const indexedPermissions = _.keyBy(allowedPermissions)

      const valid = permissions.reduce((memo, permission) => {
        return memo && indexedPermissions[permission]
      }, true)

      if (!valid) {
        throw createError(422, 'Invalid permissions')
      }
    }

    const createAttrs = {
      id: await getObjectId({ prefix: ApiKey.idPrefix, platformId, env }),
      name,
      key: await generateKey({ type: apiKeyType, env, platformId }),
      roles,
      permissions,
      readNamespaces,
      editNamespaces,
      metadata,
      platformData
    }

    const [{ count: nbApiKeys }] = await ApiKey.query().count()
      .where('key', 'like', 'seck_%')
    const creatingFirstMasterKey = apiKeyType === 'seck' && !req._matchedPermissions['apiKey:create:all']
    // cannot create a master key if there are other secret key: must be authorized
    if (creatingFirstMasterKey && nbApiKeys) throw createError(403)

    if (apiKeyType === 'seck') {
      // Force maximal rights
      // User must create a key with custom type for custom rights
      createAttrs.roles = ['dev']
      createAttrs.permissions = []
      createAttrs.readNamespaces = createAttrs.editNamespaces = ['*']
    } else if (apiKeyType === 'pubk') {
      // Force minimal rights
      createAttrs.roles = ['public']
      createAttrs.permissions = []
      createAttrs.readNamespaces = createAttrs.editNamespaces = []
    } else if (apiKeyType === 'cntk') {
      createAttrs.permissions = [
        'entry:list:all',
        'entry:read:all'
      ]
    }

    const apiKey = await ApiKey.query().insert(createAttrs)

    publisher.publish('apiKeyCreated', {
      apiKey,
      eventDate: apiKey.createdDate,
      platformId,
      env
    })

    const exposedApiKey = ApiKey.expose(apiKey, { req })
    exposedApiKey.key = createAttrs.key // show only once

    return exposedApiKey
  })

  responder.on('update', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { ApiKey } = await getModels({ platformId, env })

    const apiKeyId = req.apiKeyId

    const fields = [
      'name',
      'roles',
      'permissions',
      'readNamespaces',
      'editNamespaces',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const {
      roles,
      permissions,
      metadata,
      platformData
    } = payload

    const apiKey = await ApiKey.query().findById(apiKeyId)
    if (!apiKey) {
      throw createError(404)
    }

    const isSelf = ApiKey.isSelf(apiKey, req._apiKeyId)
    if (!req._matchedPermissions['apiKey:edit:all'] && !isSelf) {
      throw createError(403)
    }

    if (roles) {
      const { valid, invalidRoles } = await roleRequester.send({
        type: '_isValidRoles',
        platformId,
        env,
        roles
      })

      if (!valid) {
        throw createError(422, `Invalid roles: ${invalidRoles.join(', ')}`)
      }
    }
    if (permissions) {
      const allowedPermissions = getListPermissions()
      const indexedPermissions = _.keyBy(allowedPermissions)

      const valid = permissions.reduce((memo, permission) => {
        return memo && indexedPermissions[permission]
      }, true)

      if (!valid) {
        throw createError(422, 'Invalid permissions')
      }
    }

    const updateAttrs = _.omit(payload, ['metadata', 'platformData'])
    const updateAttrsBeforeFullDataMerge = Object.assign({}, payload)

    if (metadata) {
      updateAttrs.metadata = ApiKey.rawJsonbMerge('metadata', metadata)
    }
    if (platformData) {
      updateAttrs.platformData = ApiKey.rawJsonbMerge('platformData', platformData)
    }

    const newApiKey = await ApiKey.query().patchAndFetchById(apiKeyId, updateAttrs)

    publisher.publish('apiKeyUpdated', {
      apiKey,
      newApiKey,
      updateAttrs: updateAttrsBeforeFullDataMerge,
      eventDate: newApiKey.updatedDate,
      platformId,
      env
    })

    return ApiKey.expose(newApiKey, { req })
  })

  responder.on('remove', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { ApiKey } = await getModels({ platformId, env })

    const {
      apiKeyId
    } = req

    const apiKey = await ApiKey.query().findById(apiKeyId)
    if (!apiKey) {
      return { id: apiKeyId }
    }

    const isSelf = ApiKey.isSelf(apiKey, req._apiKeyId)
    if (!req._matchedPermissions['apiKey:remove:all'] && !isSelf) {
      throw createError(403)
    }

    await ApiKey.query().deleteById(apiKeyId)

    publisher.publish('apiKeyDeleted', {
      apiKeyId, // needed since…
      apiKey, // … this can be undefined
      eventDate: new Date().toISOString(),
      platformId,
      env
    })

    return { id: apiKeyId }
  })

  // EVENTS

  subscriber.on('apiKeyCreated', async ({ apiKey, eventDate, platformId, env } = {}) => {
    try {
      const { ApiKey, Event } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'api_key__created',
        objectId: apiKey.id,
        object: ApiKey.expose(apiKey, { namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { apiKeyId: apiKey.id },
        message: 'Fail to create event api_key__created'
      })
    }
  })

  subscriber.on('apiKeyUpdated', async ({
    // apiKey,
    newApiKey,
    updateAttrs,
    eventDate,
    platformId,
    env
  } = {}) => {
    try {
      const { ApiKey, Event } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'api_key__updated',

        objectId: newApiKey.id,
        object: ApiKey.expose(newApiKey, { namespaces: ['*'] }),
        changesRequested: ApiKey.expose(updateAttrs, { namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { apiKeyId: newApiKey.id },
        message: 'Fail to create event api_key__updated'
      })
    }
  })

  subscriber.on('apiKeyDeleted', async ({
    apiKeyId,
    apiKey,
    eventDate,
    platformId,
    env
  } = {}) => {
    try {
      const { ApiKey, Event } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'api_key__deleted',
        objectId: apiKeyId,
        object: ApiKey.expose(apiKey, { namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { apiKeyId },
        message: 'Fail to create event api_key__deleted'
      })
    }
  })

  // INTERNAL

  responder.on('_getApiKey', async (req) => {
    const { key, platformId, env } = req

    const { ApiKey } = await getModels({ platformId, env })

    const apiKey = await ApiKey.query().findOne({ key })
    return apiKey
  })

  function canRevealApiKey (req) {
    return isSystem(req._systemHash) ||
      (req._stelaceAuthToken &&
        (req._matchedPermissions['apiKey:create:all'] || req._matchedPermissions['apiKey:edit:all'])
      )
  }
}

function stop () {
  responder.close()
  responder = null

  subscriber.close()
  subscriber = null

  publisher.close()
  publisher = null
}

module.exports = {
  start,
  stop
}
