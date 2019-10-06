const createError = require('http-errors')
const _ = require('lodash')

const { getModels } = require('../models')

const { isValidHierarchy } = require('../util/hierarchy')

const { getObjectId } = require('stelace-util-keys')

const { performListQuery } = require('../util/listQueryBuilder')

let responder
let configRequester

function start ({ communication, isSystem }) {
  const {
    getResponder,
    getRequester
  } = communication

  responder = getResponder({
    name: 'Role Responder',
    key: 'role'
  })

  configRequester = getRequester({
    name: 'Role service > Config Requester',
    key: 'config'
  })

  responder.on('list', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Role } = await getModels({ platformId, env })

    const queryBuilder = Role.query()

    const roles = await performListQuery({
      queryBuilder,
      paginationActive: false,
      orderConfig: {
        orderBy: 'createdDate',
        order: 'asc'
      }
    })

    return Role.exposeAll(roles, { req })
  })

  responder.on('read', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Role } = await getModels({ platformId, env })

    const roleId = req.roleId

    const role = await Role.query().findById(roleId)
    if (!role) {
      throw createError(404)
    }

    return Role.expose(role, { req })
  })

  responder.on('create', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Role } = await getModels({ platformId, env })

    const {
      id, // can come from system
      name,
      value,
      parentId,
      permissions,
      readNamespaces,
      editNamespaces,
      metadata,
      platformData
    } = req

    if (parentId) {
      const parentRole = await Role.query().findById(parentId)
      if (!parentRole) {
        throw createError(422, 'Parent role not found')
      }
    }

    const existingRole = await Role.query().findOne({ value })
    if (existingRole) {
      throw createError(422, 'Existing role with this value')
    }

    const role = await Role.query().insert({
      id: id || await getObjectId({ prefix: Role.idPrefix, platformId, env }),
      name,
      value,
      customRole: !isSystem(req._systemHash),
      parentId,
      permissions,
      readNamespaces,
      editNamespaces,
      metadata,
      platformData
    })

    return Role.expose(role, { req })
  })

  responder.on('update', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Role } = await getModels({ platformId, env })

    const {
      roleId,
      name,
      parentId,
      permissions,
      readNamespaces,
      editNamespaces,
      metadata,
      platformData
    } = req

    const roles = await Role.query()

    const indexedRoles = _.keyBy(roles, 'id')

    let role = indexedRoles[roleId]
    if (!role) {
      throw createError(404)
    }

    if (parentId && !indexedRoles[parentId]) {
      throw createError(422, 'Parent role not found')
    }
    if (roleId === parentId) {
      throw createError(422, 'A role cannot be its own parent')
    }
    if (!isSystem(req._systemHash) && !role.customRole) {
      throw createError(403, 'Only custom roles can be modified')
    }

    // check for a circular hierarchy
    if (typeof parentId !== 'undefined') {
      const workingRoles = roles.concat([])
      const workingRole = workingRoles.find(r => r.id === role.id)
      workingRole.parentId = parentId

      const validHierarchy = isValidHierarchy(workingRoles)

      if (!validHierarchy) {
        throw createError(422, 'The change of parentId introduces a circular hierarchy')
      }
    }

    const updateAttrs = {
      name,
      parentId,
      permissions,
      readNamespaces,
      editNamespaces
    }

    if (metadata) {
      updateAttrs.metadata = Role.rawJsonbMerge('metadata', metadata)
    }
    if (platformData) {
      updateAttrs.platformData = Role.rawJsonbMerge('platformData', platformData)
    }

    role = await Role.query().patchAndFetchById(roleId, updateAttrs)

    return Role.expose(role, { req })
  })

  responder.on('remove', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { ApiKey, Role, User } = await getModels({ platformId, env })

    const {
      roleId
    } = req

    const role = await Role.query().findById(roleId)
    if (!role) {
      return { id: roleId }
    }

    // only system requests can remove non custom role
    if (!role.customRole && !isSystem(req._systemHash)) {
      throw createError(403, 'Only custom roles can be removed')
    }

    const [
      [{ count: nbApiKeys }],
      [{ count: nbUsers }],
      [{ count: nbRoles }],
      config
    ] = await Promise.all([
      ApiKey.query().count().whereJsonSupersetOf('roles', [role.value]),
      User.query().count().whereJsonSupersetOf('roles', [role.value]),
      Role.query().count().where({ parentId: role.id }),
      configRequester.send({
        type: '_getConfig',
        platformId,
        env,
        access: 'default'
      })
    ])

    const whitelistRoles = _.get(config, 'config.stelace.roles.whitelist')
    const defaultRoles = _.get(config, 'config.stelace.roles.default')

    if (nbApiKeys) {
      throw createError(422, `This role is still referenced in ${nbApiKeys} api keys`)
    }
    if (nbUsers) {
      throw createError(422, `This role is still referenced in ${nbUsers} users`)
    }
    if (nbRoles) {
      throw createError(422, `This role is still referenced in ${nbRoles} roles`)
    }
    if (whitelistRoles && whitelistRoles.includes(role.value)) {
      throw createError(422, 'This role is still referenced in the config roles whitelist')
    }
    if (defaultRoles && defaultRoles.includes(role.value)) {
      throw createError(422, 'This role is still referenced in the config default roles')
    }

    await Role.query().deleteById(roleId)

    return { id: roleId }
  })

  // INTERNAL

  responder.on('_getNamespaces', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Role } = await getModels({ platformId, env })

    const {
      values
    } = req

    const roles = await Role.query()

    return Role.getNamespaces(roles, values)
  })

  responder.on('_isValidRoles', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Role } = await getModels({ platformId, env })

    const {
      roles: values
    } = req

    const roles = await Role.query().whereIn('value', values)

    const validRoles = []
    const invalidRoles = []

    const indexedRoles = _.keyBy(roles, 'value')

    values.forEach(value => {
      if (indexedRoles[value]) {
        validRoles.push(value)
      } else {
        invalidRoles.push(value)
      }
    })

    return {
      valid: !invalidRoles.length,
      validRoles,
      invalidRoles
    }
  })
}

function stop () {
  responder.close()
  responder = null

  configRequester.close()
  configRequester = null
}

module.exports = {
  start,
  stop
}
