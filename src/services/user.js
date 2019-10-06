const createError = require('http-errors')
const _ = require('lodash')
const bluebird = require('bluebird')
const { raw, transaction } = require('objection')
const { UniqueViolationError } = require('objection-db-errors')

const { logError } = require('../../logger')
const { getModels } = require('../models')
const { getObjectId } = require('stelace-util-keys')

const { checkPermissions } = require('../../auth')

const { performListQuery } = require('../util/listQueryBuilder')

const {
  getCurrentUserId,
  getRealCurrentUserId
} = require('../util/user')

let responder
let subscriber
let publisher
let configRequester
let roleRequester
let namespaceRequester

const organizationRole = 'organization'

function start ({ communication }) {
  const {
    getResponder,
    getSubscriber,
    getRequester,
    getPublisher,
    COMMUNICATION_ID
  } = communication

  responder = getResponder({
    name: 'User Responder',
    key: 'user'
  })

  subscriber = getSubscriber({
    name: 'User subscriber',
    key: 'user',
    namespace: COMMUNICATION_ID,
    subscribesTo: [
      'userCreated',
      'userUpdated',
      'userDeleted',
      'userOrganizationJoined',
      'userOrganizationLeft',
      'userOrganizationRightsChanged'
    ]
  })

  publisher = getPublisher({
    name: 'User publisher',
    key: 'user',
    namespace: COMMUNICATION_ID
  })

  configRequester = getRequester({
    name: 'User service > Config Requester',
    key: 'config'
  })

  roleRequester = getRequester({
    name: 'User service > Role Requester',
    key: 'role'
  })

  namespaceRequester = getRequester({
    name: 'User service > Namespace Requester',
    key: 'namespace'
  })

  responder.on('checkAvailability', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { User } = await getModels({ platformId, env })

    const {
      username
    } = req

    const user = await User.query().findOne({ username })

    return {
      available: !user
    }
  })

  responder.on('list', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { User } = await getModels({ platformId, env })

    const {
      orderBy,
      order,

      page,
      nbResultsPerPage,

      id,
      createdDate,
      updatedDate,
      query,
      userType: type,
      userOrganizationId,
    } = req

    const queryBuilder = User.query()

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
        query: {
          value: query,
          query: (queryBuilder, query) => {
            queryBuilder.where(builder => {
              const lowerQuery = query.toLowerCase()

              return builder
                .whereRaw('LOWER("displayName") LIKE ?', `%${lowerQuery}%`)
                .orWhereRaw('LOWER("firstname") LIKE ?', `%${lowerQuery}%`)
                .orWhereRaw('LOWER("lastname") LIKE ?', `%${lowerQuery}%`)
                .orWhereRaw('LOWER("username") LIKE ?', `%${lowerQuery}%`)
                .orWhereRaw('LOWER("email") LIKE ?', `%${lowerQuery}%`)
            })
          }
        },
        type: {
          value: type || null, // defaults to `null` because if `undefined`, the filter is inactive
          query: (queryBuilder, type) => {
            // defaults to 'user' if type isn't provided unless ID filter is provided
            if (!type && !id) {
              type = 'user'
            }

            if (type === 'all') return

            if (type === 'organization') {
              queryBuilder.whereJsonSupersetOf('roles', [organizationRole])
            } else if (type === 'user') {
              queryBuilder.whereJsonNotSupersetOf('roles', [organizationRole])
            }
          }
        },
        userOrganizationId: {
          value: userOrganizationId,
          transformValue: 'array',
          query: (queryBuilder, id) => {
            if (id) queryBuilder.whereJsonHasAll('organizations', id)
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

    const currentUserId = getCurrentUserId(req)

    const indexedDynamicNamespaces = await namespaceRequester.send({
      type: 'getDynamicNamespaces',
      platformId,
      env,
      readNamespaces: req._readNamespaces,
      listObjects: paginationMeta.results,
      currentUserId,
      editActive: false
    })

    paginationMeta.results = paginationMeta.results.map(user => {
      const dynamicResult = indexedDynamicNamespaces[user.id]
      return User.expose(user, { req, namespaces: dynamicResult.dynamicReadNamespaces })
    })

    return paginationMeta
  })

  responder.on('read', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { User } = await getModels({ platformId, env })

    const userId = req.userId

    const user = await User.query().findById(userId)
    if (!user) {
      throw createError(404)
    }

    const currentUserId = getCurrentUserId(req)

    const isSelf = User.isSelf(user, currentUserId)
    if (!req._matchedPermissions['user:read:all'] && !isSelf) {
      throw createError(403)
    }

    const { dynamicReadNamespaces } = await namespaceRequester.send({
      type: 'getDynamicNamespaces',
      platformId,
      env,
      readNamespaces: req._readNamespaces,
      object: user,
      currentUserId,
      editActive: false
    })

    return User.expose(user, { req, namespaces: dynamicReadNamespaces })
  })

  responder.on('create', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { AuthMean, User } = await getModels({ platformId, env })

    const {
      password,
      orgOwnerId,
      userType: type
    } = req

    const fields = [
      'username',
      'displayName',
      'firstname',
      'lastname',
      'email',
      'description',
      'roles',
      'organizations',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const {
      roles,
      organizations
    } = payload

    const targetingOrganization = type === 'organization'
    const idPrefix = targetingOrganization ? User.organizationIdPrefix : User.idPrefix

    const createAttrs = Object.assign({
      id: await getObjectId({ prefix: idPrefix, platformId, env })
    }, payload)

    const currentUserId = getCurrentUserId(req)
    const canCreateAnyOrg = req._matchedPermissions['organization:create:all']

    if (targetingOrganization) {
      if (
        (!canCreateAnyOrg && !req._matchedPermissions['organization:create']) ||
        (!canCreateAnyOrg && !currentUserId) ||
        (!canCreateAnyOrg && orgOwnerId && orgOwnerId !== currentUserId)
      ) {
        throw createError(403)
      }
    } else {
      // if there is no "all" permissions, a user cannot be authenticated
      if (!req._matchedPermissions['user:create:all'] && currentUserId) {
        throw createError(403)
      }
    }

    const {
      dynamicReadNamespaces,
      isValidEditNamespaces
    } = await namespaceRequester.send({
      type: 'getDynamicNamespaces',
      platformId,
      env,
      readNamespaces: req._readNamespaces,
      editNamespaces: req._editNamespaces,
      object: createAttrs,
      currentUserId: createAttrs.id
    })

    if (!isValidEditNamespaces) throw createError(403, 'Invalid namespaces')

    const config = await configRequester.send({
      type: '_getConfig',
      platformId,
      env,
      access: 'default'
    })

    const checkedRoles = await checkRolesBeforeCreate({
      platformId,
      env,
      req,
      roles,
      targetingOrganization,
      config,
      defaultRoles: User.defaultRoles
    })
    createAttrs.roles = checkedRoles

    await checkOrganizationsBeforeCreate({
      platformId,
      env,
      req,
      organizations,
      targetingOrganization,
      orgOwnerId
    })

    let user
    let organizationOwnerId
    let orgOwner
    let updatedOrgOwnerUser
    let orgOwnerUpdateAttrs

    if (targetingOrganization) {
      organizationOwnerId = orgOwnerId || getRealCurrentUserId(req)
      orgOwner = await User.query().findById(organizationOwnerId)
      if (!orgOwner) throw createError(422, 'The user to promote as org owner is not found.')
      createAttrs.orgOwnerId = orgOwner.id
    }

    const knex = User.knex()

    try {
      user = await transaction(knex, async (trx) => {
        const createdUser = await User.query(trx).insert(createAttrs)

        // do not create an auth mean because user cannot directly authenticate as an organization
        if (!targetingOrganization) {
          await AuthMean.query(trx).insert({
            id: await getObjectId({ prefix: AuthMean.idPrefix, platformId, env }),
            provider: '_local_',
            password,
            userId: createdUser.id
          })
        } else {
          const newOrganizations = {
            [createdUser.id]: {
              roles: ['dev'] // owner is automatically an org admin
            }
          }

          orgOwnerUpdateAttrs = {}
          orgOwnerUpdateAttrs.organizations = User.rawJsonbMerge('organizations', newOrganizations)

          updatedOrgOwnerUser = await User.query(trx).patchAndFetchById(organizationOwnerId, orgOwnerUpdateAttrs)
        }

        return createdUser
      })
    } catch (err) {
      if (err instanceof UniqueViolationError) {
        throw createError(422, 'Unavailable username')
      } else {
        throw err
      }
    }

    publisher.publish('userCreated', {
      user,
      eventDate: user.createdDate,
      platformId,
      env
    })

    if (updatedOrgOwnerUser) {
      publisher.publish('userOrganizationJoined', {
        user: updatedOrgOwnerUser,
        organizationId: user.id,
        eventDate: updatedOrgOwnerUser.updatedDate,
        platformId,
        env
      })
    }

    return User.expose(user, { req, namespaces: dynamicReadNamespaces })
  })

  responder.on('update', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { User } = await getModels({ platformId, env })

    const { userId, orgOwnerId } = req

    const fields = [
      'username',
      'displayName',
      'firstname',
      'lastname',
      'email',
      'description',
      'roles',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const {
      username,
      roles,
      metadata,
      platformData
    } = payload

    const user = await User.query().findById(userId)
    if (!user) {
      throw createError(404)
    }

    const targetingOrganization = user.roles.includes(organizationRole)
    const currentUserId = getCurrentUserId(req)

    if (targetingOrganization && username) {
      throw createError(400, 'An organization cannot have a username')
    }

    const isSelf = User.isSelf(user, currentUserId)
    if (!req._matchedPermissions['user:edit:all'] && !isSelf) {
      throw createError(403)
    }

    // Must be authenticated as the owner of the organization to transfer ownership
    // or have 'user:edit:all' permission
    if (targetingOrganization && orgOwnerId) {
      const realCurrentUserId = getRealCurrentUserId(req)
      const isOrgOwner = realCurrentUserId ? user.orgOwnerId === realCurrentUserId : false
      const canChangeOrgOwner = isOrgOwner || req._matchedPermissions['user:edit:all']
      if (!canChangeOrgOwner) {
        throw createError(403, 'Must be owner of the organization to transfer ownership, ' +
          'or have "user:edit:all" permission', {
          public: { userId: realCurrentUserId, organizationId: userId }
        })
      }
    }

    await checkRolesBeforeUpdate({
      platformId,
      env,
      req,
      roles,
      targetingOrganization,
      user
    })

    const updateAttrs = _.omit(payload, ['metadata', 'platformData'])
    const updateAttrsBeforeFullDataMerge = Object.assign({}, payload)

    if (metadata) {
      updateAttrs.metadata = User.rawJsonbMerge('metadata', metadata)
    }
    if (platformData) {
      updateAttrs.platformData = User.rawJsonbMerge('platformData', platformData)
    }

    const {
      dynamicReadNamespaces,
      isValidEditNamespaces
    } = await namespaceRequester.send({
      type: 'getDynamicNamespaces',
      platformId,
      env,
      readNamespaces: req._readNamespaces,
      editNamespaces: req._editNamespaces,
      object: Object.assign({}, user, { metadata, platformData }),
      deltaObject: { metadata, platformData },
      currentUserId
    })

    if (!isValidEditNamespaces) {
      throw createError(403, 'Invalid namespace')
    }

    let newUser

    if (targetingOrganization && orgOwnerId) {
      const orgOwner = await User.query().findById(orgOwnerId)
      if (!orgOwner) throw createError(422, 'The user to promote as org owner is not found.')
      updateAttrs.orgOwnerId = orgOwner.id
    }

    try {
      newUser = await User.query().patchAndFetchById(userId, updateAttrs)
    } catch (err) {
      if (err instanceof UniqueViolationError) {
        throw createError(422, 'Unavailable username')
      } else {
        throw err
      }
    }

    let newOrgOwnerUser
    let isNewOrgOwnerJoining
    let newRoles
    if (orgOwnerId) {
      try {
        const { isOrgMember, roles } = await isOrganizationMember({
          platformId,
          env,
          userId: orgOwnerId,
          organizationId: userId
        })
        if (!isOrgMember || !roles.includes('dev')) {
          isNewOrgOwnerJoining = !isOrgMember
          newRoles = roles.concat(['dev'])
          const newOrganization = {
            [userId]: {
              roles: newRoles // owner is automatically an org admin
              // Note that previous owner keeps 'dev' role by default
            }
          }
          newOrgOwnerUser = await User.query().patchAndFetchById(orgOwnerId, {
            organizations: User.rawJsonbMerge('organizations', newOrganization)
          })
        }
      } catch (err) {
        logError(err, {
          platformId,
          env,
          custom: { organizationId: userId, userId: orgOwnerId },
          message: 'Fail to make new owner join organization.'
        })
      }
    }

    publisher.publish('userUpdated', {
      newUser,
      updateAttrs: updateAttrsBeforeFullDataMerge,
      eventDate: newUser.updatedDate,
      platformId,
      env
    })

    if (newOrgOwnerUser) {
      const eventPayload = {
        user: newOrgOwnerUser,
        organizationId: userId,
        eventDate: newOrgOwnerUser.updatedDate,
        platformId,
        env
      }
      if (isNewOrgOwnerJoining) {
        publisher.publish('userOrganizationJoined', eventPayload)
      } else {
        publisher.publish('userOrganizationRightsChanged', Object.assign({}, eventPayload, {
          changesRequested: { roles: newRoles }
        }))
      }
    }

    return User.expose(newUser, { req, namespaces: dynamicReadNamespaces })
  })

  responder.on('remove', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { AuthMean, Asset, User } = await getModels({ platformId, env })

    const { userId } = req

    const user = await User.query().findById(userId)
    if (!user) return { id: userId }

    const isOrganization = user.roles.includes(organizationRole)

    // Must be authenticated as the owner of the organization
    // to remove without user:remove:all permission
    const realCurrentUserId = getRealCurrentUserId(req)
    const isSelf = User.isSelf(user, realCurrentUserId)
    const canRemoveUser = isSelf || req._matchedPermissions['user:remove:all']

    if (!canRemoveUser && isOrganization && realCurrentUserId) {
      if (realCurrentUserId !== user.orgOwnerId) {
        throw createError(403, 'Must be owner of the organization to delete, ' +
          'or have "user:remove:all" permission', {
          public: { userId: realCurrentUserId, organizationId: userId }
        })
      }
    } else if (!canRemoveUser) throw createError(403, 'Can’t delete this user.')

    // fetch assets for this user
    const [{ count: nbAssets }] = await Asset.query().count().where({ ownerId: user.id })
    if (nbAssets) {
      throw createError(422, `${nbAssets} Asset${
        nbAssets > 1 ? 's' : ''
      } still belong to ${user.id}. Please delete all User Assets before deleting this User.`)
    }

    let orgMembers = []
    let updatedOrgMembers = []

    if (isOrganization) {
      // cannot remove the organization if it's a parent organization
      const childrenOrganizations = await getOrganizationsDependencies({ platformId, env, type: 'organization', organizationId: user.id })
      if (childrenOrganizations.length) {
        throw createError(422, `${childrenOrganizations.length} children organizations still reference this organization`)
      }

      // User members will automatically leave the organization
      orgMembers = await getOrganizationsDependencies({ platformId, env, type: 'user', organizationId: user.id })
    } else {
      // cannot remove a user who is owner of some organization
      const ownedOrganizations = await User.query().column('id').where({ orgOwnerId: user.id })
      if (ownedOrganizations.length) {
        throw createError(422, 'This user owns organizations. Please delete these first or transfer ownership.', {
          public: { ownedOrganizationIds: ownedOrganizations.map(o => o.id) }
        })
      }
    }

    const knex = User.knex()

    await transaction(knex, async (trx) => {
      if (!isOrganization) {
        await AuthMean.query(trx).delete().where({ userId })
      } else if (orgMembers.length) {
        // remove the ID of the organization from every member
        updatedOrgMembers = await User.query(trx)
          .findByIds(orgMembers.map(m => m.id))
          .patch({
            organizations: raw(`"organizations" - '${userId}'`)
          })
          .returning('*')
      }

      await User.query(trx).deleteById(userId)
    })

    const emitDeletedEvent = () => {
      publisher.publish('userDeleted', {
        userId,
        user,
        eventDate: new Date().toISOString(),
        platformId,
        env,
        req
      })
    }

    if (!updatedOrgMembers.length) {
      emitDeletedEvent()
    } else {
      // Not awaiting this non-critical step for potentially *much* faster response
      // OK as long as required DELETE logic was executed (just above).
      bluebird.map(updatedOrgMembers, async (m) => {
        try {
          // throttle concurrent events to let local instance handle these
          // since we can’t await a publisher
          await new Promise(resolve => setTimeout(resolve, 10))

          publisher.publish('userOrganizationLeft', {
            user: m,
            organizationId: userId,
            eventDate: m.updatedDate,
            metadata: { stelaceComment: 'Organization deleted' },
            platformId,
            env
          })
        } catch (err) {
          logError(err, {
            platformId,
            env,
            custom: { organizationId: userId, userId: m.id },
            message: 'Fail to create user__organization_left events after deleting an organization.'
          })
        }
      }, {
        // all events are generated on same current instance so let’s be gentle
        concurrency: 2
      }).finally(emitDeletedEvent)
    }

    return { id: userId }
  })

  responder.on('joinOrganizationOrUpdateRights', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { User } = await getModels({ platformId, env })

    const {
      userId,
      organizationId,
      roles,
      req: origReq
    } = req

    const user = await User.query().findById(userId)
    if (!user) {
      throw createError(404)
    }
    const organizations = await getOrganizations({ platformId, env, organizationsIds: [organizationId] })
    if (!organizations.length) {
      throw createError(422, `Unknown organization "${organizationId}"`)
    }

    const targetingOrganization = user.roles.includes(organizationRole)
    if (targetingOrganization && Object.keys(user.organizations).length) {
      throw createError(403, 'Cannot update the "organizations" config of a child organization', {
        public: { parentOrganizationId: Object.keys(user.organizations)[0] }
      })
    }

    await canChangeUserOrganizationConfig({
      platformId,
      env,
      req,
      origReq,
      organizationId
    })

    const { valid, invalidRoles } = await roleRequester.send({
      type: '_isValidRoles',
      platformId,
      env,
      roles
    })
    if (!valid) {
      throw createError(422, `Invalid roles: ${invalidRoles.join(', ')}`)
    }

    const newOrganizations = User.rawJsonbMerge('organizations', {
      [organizationId]: { roles }
    })

    const currentUserId = getRealCurrentUserId(req)

    const {
      dynamicReadNamespaces
    } = await namespaceRequester.send({
      type: 'getDynamicNamespaces',
      platformId,
      env,
      readNamespaces: req._readNamespaces,
      editNamespaces: req._editNamespaces,
      object: user,
      currentUserId
    })

    const updateAttrs = {
      organizations: newOrganizations
    }

    const newUser = await User.query().patchAndFetchById(userId, updateAttrs)

    publisher.publish('userOrganizationRightsChanged', {
      user: newUser,
      organizationId,
      changesRequested: { roles },
      eventDate: newUser.updatedDate,
      platformId,
      env
    })

    return User.expose(newUser, { req, namespaces: dynamicReadNamespaces })
  })

  responder.on('removeFromOrganization', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { User } = await getModels({ platformId, env })

    const {
      userId,
      organizationId,
      req: origReq
    } = req

    const user = await User.query().findById(userId)
    if (!user) throw createError(404)

    const targetingOrganization = user.roles.includes(organizationRole)
    if (targetingOrganization) {
      throw createError(403, 'Cannot update the "organizations" config of a child organization')
    }

    await canChangeUserOrganizationConfig({
      platformId,
      env,
      req,
      origReq,
      organizationId
    })

    const currentUserId = getRealCurrentUserId(req)

    const {
      dynamicReadNamespaces
    } = await namespaceRequester.send({
      type: 'getDynamicNamespaces',
      platformId,
      env,
      readNamespaces: req._readNamespaces,
      editNamespaces: req._editNamespaces,
      object: user,
      currentUserId
    })

    const newUser = await User.query().patchAndFetchById(userId, {
      organizations: raw(`"organizations" - '${organizationId}'`)
    })

    publisher.publish('userOrganizationLeft', {
      user: newUser,
      organizationId,
      eventDate: newUser.updatedDate,
      platformId,
      env
    })

    return User.expose(newUser, { req, namespaces: dynamicReadNamespaces })
  })

  // INTERNAL

  responder.on('_getOrganizations', async (req) => {
    const { platformId, env, organizationsIds } = req

    const organizations = await getOrganizations({ platformId, env, organizationsIds })
    return organizations
  })

  responder.on('_isOrganizationMember', async (req) => {
    const {
      platformId,
      env,
      userId,
      organizationId
    } = req

    const result = await isOrganizationMember({
      platformId,
      env,
      userId,
      organizationId
    })
    return result
  })

  // EVENTS

  subscriber.on('userCreated', async ({ user, eventDate, platformId, env } = {}) => {
    try {
      const { Event, User } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'user__created',
        objectId: user.id,
        object: User.expose(user, { namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { userId: user.id },
        message: 'Fail to create event user__created'
      })
    }
  })

  subscriber.on('userUpdated', async ({
    newUser,
    updateAttrs,
    eventDate,
    platformId,
    env
  } = {}) => {
    try {
      const { Event, User } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'user__updated',
        objectId: newUser.id,
        object: User.expose(newUser, { namespaces: ['*'] }),
        changesRequested: User.expose(updateAttrs, { namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { userId: newUser.id },
        message: 'Fail to create event user__updated'
      })
    }
  })

  subscriber.on('userDeleted', async ({
    userId,
    user,
    eventDate,
    platformId,
    env,
    req
  } = {}) => {
    try {
      const { Event, User } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'user__deleted',
        objectId: userId,
        object: User.expose(user, { req, namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { userId },
        message: 'Fail to create event user__deleted'
      })
    }
  })

  subscriber.on('userOrganizationJoined', createOrgEventFn('user__organization_joined'))
  subscriber.on('userOrganizationLeft', createOrgEventFn('user__organization_left'))
  subscriber.on('userOrganizationRightsChanged', createOrgEventFn('user__organization_rights_changed'))

  function createOrgEventFn (type) {
    return async ({
      user,
      organizationId,
      changesRequested,
      metadata,
      eventDate,
      platformId,
      env
    } = {}) => {
      try {
        const { Event, User } = await getModels({ platformId, env })

        await Event.createEvent({
          createdDate: eventDate,
          type,
          objectId: user.id,
          object: User.expose(user, { namespaces: ['*'] }),
          changesRequested,
          metadata,
          // populate relatedObjectsIds
          _tmpObject: { organizationId }
        }, { platformId, env })
      } catch (err) {
        logError(err, {
          platformId,
          env,
          custom: { userId: user.id },
          message: `Fail to create event ${type}`
        })
      }
    }
  }
}

async function getOrganizations ({ platformId, env, organizationsIds } = {}) {
  const { User } = await getModels({ platformId, env })

  if (organizationsIds && !organizationsIds.length) return []

  const queryBuilder = User.query().whereJsonSupersetOf('roles', [organizationRole])

  if (organizationsIds) {
    queryBuilder.whereIn('id', organizationsIds)
  }

  const organizations = await queryBuilder
  return organizations
}

async function getOrganizationsDependencies ({ platformId, env, organizationId, type }) {
  const { User } = await getModels({ platformId, env })

  const queryBuilder = User.query().whereJsonSupersetOf(`organizations:${organizationId}`, {})

  if (type === 'user') {
    queryBuilder.whereJsonNotSupersetOf('roles', [organizationRole])
  } else if (type === 'organization') {
    queryBuilder.whereJsonSupersetOf('roles', [organizationRole])
  } else {
    throw createError('Unknown type for organizations dependencies')
  }

  const deps = await queryBuilder
  return deps
}

async function isOrganizationMember ({
  platformId,
  env,
  userId,
  organizationId
}) {
  const { User } = await getModels({ platformId, env })

  const ancestorOrganizations = []
  const errors = {}
  let user = null
  let roles = []
  let isOrgMember = false
  let organization = null
  let realOrganization = null
  let tmpOrganization

  const displayResult = () => {
    return {
      user,
      roles,
      organization,
      ancestorOrganizations,
      realOrganization,
      isOrgMember,
      errors
    }
  }

  user = await User.query().findById(userId)
  if (!user) {
    errors.userNotFound = true
    return displayResult()
  }

  const organizations = await getOrganizations({ platformId, env })

  const indexedOrganizations = _.keyBy(organizations, 'id')

  organization = indexedOrganizations[organizationId]
  if (!organization) {
    errors.organizationNotFound = true
    return displayResult()
  }

  const doesUserBelongToOrg = !!user.organizations[organizationId]

  if (doesUserBelongToOrg) {
    realOrganization = organization
    roles = user.organizations[realOrganization.id].roles
    isOrgMember = true
  // search if the user belongs to one of the ancestor organizations
  } else {
    const maxLvlOrg = 10
    let lvl = maxLvlOrg // avoid infinite loop

    tmpOrganization = organization

    while (lvl && !realOrganization) {
      const parentOrganizationId = Object.keys(tmpOrganization.organizations)[0]
      if (!parentOrganizationId) {
        break
      }

      const parentOrganization = indexedOrganizations[parentOrganizationId]
      if (!parentOrganization) {
        throw createError(`There is no parent organization with ID "${parentOrganizationId}"`)
      }

      ancestorOrganizations.push(parentOrganization)

      if (user.organizations[parentOrganizationId]) {
        realOrganization = parentOrganization
        roles = user.organizations[realOrganization.id].roles
        isOrgMember = true
      }

      tmpOrganization = parentOrganization
      lvl -= 1
    }
  }

  return displayResult()
}

async function checkRolesBeforeCreate ({
  platformId,
  env,
  req,
  roles,
  targetingOrganization,
  config,
  defaultRoles
}) {
  let newRoles

  if (roles) {
    if (!req._matchedPermissions['user:config:all']) {
      const whitelistRoles = _.get(config, 'stelace.roles.whitelist') || defaultRoles
      if (roles.includes('dev')) {
        throw createError(403, 'Cannot provide the role "dev"')
      }

      const nonWhitelistRoles = _.difference(roles, whitelistRoles)
      if (nonWhitelistRoles.length) {
        throw createError(422, 'The following roles are not whitelisted: ' + nonWhitelistRoles.join(', '))
      }
    }

    newRoles = roles.slice(0)

    const { valid, invalidRoles } = await roleRequester.send({
      type: '_isValidRoles',
      platformId,
      env,
      roles
    })
    if (!valid) {
      throw createError(422, `Invalid roles: ${invalidRoles.join(', ')}`)
    }
  } else {
    const configDefaultRoles = _.get(config, 'stelace.roles.default')

    newRoles = configDefaultRoles || defaultRoles
  }

  if (targetingOrganization && !newRoles.includes(organizationRole)) {
    newRoles.push(organizationRole)
  }

  return newRoles
}

async function checkRolesBeforeUpdate ({
  platformId,
  env,
  req,
  roles,
  targetingOrganization,
  user
}) {
  const newRoles = user.roles.slice(0)

  // no change on roles, skip the check
  if (!roles) {
    return newRoles
  }

  const hasOrganizationRoles = roles.includes(organizationRole)

  if (targetingOrganization && !hasOrganizationRoles) {
    throw createError(422, 'Cannot transform an organization into a normal user')
  } else if (!targetingOrganization && hasOrganizationRoles) {
    throw createError(422, 'Cannot transform a normal user into an organization')
  }

  if (!req._matchedPermissions['user:config:all']) {
    throw createError(403, 'Roles cannot be updated without "user:config:all" permission.')
  }

  const { valid, invalidRoles } = await roleRequester.send({
    type: '_isValidRoles',
    platformId,
    env,
    roles
  })
  if (!valid) {
    throw createError(422, `Invalid roles: ${invalidRoles.join(', ')}`)
  }

  return newRoles
}

async function checkOrganizationsBeforeCreate ({
  platformId,
  env,
  req,
  organizations: organizationsConfig,
  targetingOrganization,
  orgOwnerId
}) {
  const organizationsIds = organizationsConfig && Object.keys(organizationsConfig)

  // no config to check
  if (!organizationsIds || !organizationsIds.length) return

  if (!targetingOrganization) {
    throw createError(422, 'Cannot specify the "organizations" object when creating a user')
  }

  if (organizationsIds.length > 1) {
    throw createError(422, 'An organization cannot belong to multiple parent organizations')
  }

  const organizationId = organizationsIds[0]

  const organizationOwnerId = orgOwnerId || getRealCurrentUserId(req)
  if (!organizationOwnerId) {
    throw createError(403, `Missing organization owner for the organization with ID "${organizationId}"`)
  }

  const {
    isOrgMember
  } = await isOrganizationMember({
    platformId,
    env,
    userId: organizationOwnerId,
    organizationId
  })

  if (!isOrgMember) {
    throw createError(403, `The current user does not belong to the parent organization with ID "${organizationId}"`)
  }
}

async function canChangeUserOrganizationConfig ({
  platformId,
  env,
  req,
  origReq,
  organizationId
}) {
  const permissionsToCheck = [
    'user:configOrganization',
    'user:configOrganization:all'
  ]

  const realCurrentUserId = getRealCurrentUserId(req)

  // like API keys
  if (!realCurrentUserId) {
    await checkPermissionsPromise(permissionsToCheck, origReq)

    if (!origReq.matchedPermissions['user:configOrganization:all']) {
      throw createError(403)
    }
  } else {
    const {
      isOrgMember
    } = await isOrganizationMember({
      platformId,
      env,
      userId: realCurrentUserId,
      organizationId
    })

    if (isOrgMember) {
      await checkPermissionsPromise(permissionsToCheck, origReq, {
        getOrganizationIdFn: () => organizationId
      })

      if (!origReq.matchedPermissions['user:configOrganization:all'] &&
        !origReq.matchedPermissions['user:configOrganization']
      ) {
        throw createError(403)
      }
    } else {
      await checkPermissionsPromise(permissionsToCheck, origReq, {
        getOrganizationIdFn: () => null
      })

      if (!origReq.matchedPermissions['user:configOrganization:all']) {
        throw createError(403)
      }
    }
  }
}

function checkPermissionsPromise (permissions, req, options) {
  const middleware = checkPermissions(permissions, options)
  return new Promise((resolve, reject) => {
    middleware(req, null, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function stop () {
  responder.close()
  responder = null

  subscriber.close()
  subscriber = null

  publisher.close()
  publisher = null

  configRequester.close()
  configRequester = null

  roleRequester.close()
  roleRequester = null

  namespaceRequester.close()
  namespaceRequester = null
}

module.exports = {
  start,
  stop
}
