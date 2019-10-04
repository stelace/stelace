const bluebird = require('bluebird')
const { Acl } = require('virgen-acl')
const _ = require('lodash')

const { getModels } = require('../models')

const {
  getPermissionsDefObjects,
  parsePermission,
  getPermissionKey
} = require('../permissions')

let responder
let configRequester

function start ({ communication }) {
  const {
    getResponder,
    getRequester
  } = communication

  responder = getResponder({
    name: 'Authorization Responder',
    key: 'authorization'
  })

  configRequester = getRequester({
    name: 'Authorization service > Config Requester',
    key: 'config'
  })

  responder.on('_getGrantedPermissions', async (req) => {
    const platformId = req.platformId
    const env = req.env

    const {
      roles,
      permissionsToCheck,
      plan
    } = req

    const permissionsDefObjects = getPermissionsDefObjects()

    const acl = await getAcl({ platformId, env })
    const planPermissions = _.get(plan, 'allPermissions', null)

    const grantedPermissions = {}
    let missingPlanPermissions = []

    const isAllowed = async (roles, permission) => {
      const [
        allowedByRole,
        allowedByPlan
      ] = await Promise.all([
        isAllowedByRole(roles, permission, { acl }),
        isAllowedByPlan(permission, { planPermissions })
      ])
      if (allowedByRole && !allowedByPlan) missingPlanPermissions.push(permission)

      return allowedByRole && allowedByPlan
    }

    if (permissionsToCheck) {
      await bluebird.map(permissionsToCheck, async (permission) => {
        const allowed = await isAllowed(roles, permission)
        grantedPermissions[permission] = allowed
      })
    } else {
      await bluebird.each(permissionsDefObjects, async (permission) => {
        await bluebird.map(permission.actions, async (action) => {
          const key = getPermissionKey(permission.object, action)
          const allowed = await isAllowed(roles, key)
          grantedPermissions[key] = allowed
        })
      })
    }

    // missing `object:action` plan permission has no impact if `object:action:all` is active
    // so that we remove these
    const allScopePermissionRegex = /:all$/
    missingPlanPermissions = missingPlanPermissions.filter(p => {
      const allScopeP = allScopePermissionRegex.test(p) || p.split(':').length === 3
        ? p
        : `${p}:all`
      return !planPermissions[allScopeP]
    })

    return {
      grantedPermissions,
      missingPlanPermissions
    }
  })

  responder.on('_filterPermissionsByPlan', async (req) => {
    const {
      permissions,
      plan
    } = req

    const planPermissions = _.get(plan, 'allPermissions', null)
    const validPermissions = []

    await bluebird.each(permissions, async (permission) => {
      const allowed = await isAllowedByPlan(permission, { planPermissions })
      if (allowed) {
        validPermissions.push(permission)
      }
    })

    return validPermissions
  })
}

async function isAllowedByRole (roles, permission, { acl }) {
  const parsedPermission = parsePermission(permission)
  if (!parsedPermission) return false

  const { object, action } = parsedPermission

  const allowed = await acl.queryAsync(roles, object, action)
  return allowed
}

// if no plugin has set req._plan and/or req._plan.allPermissions is null
// consider all permissions can be granted (still depending on own user permissions)
async function isAllowedByPlan (permission, { planPermissions }) {
  if (planPermissions === null) return true
  return planPermissions[permission]
}

async function getAcl ({ platformId, env }) {
  // PERF:TODO: get roles from redis in platform info middleware
  // rather than loading them from DB here
  const { Role } = await getModels({ platformId, env })
  const roles = await Role.query()

  const acl = _getAcl(roles)
  return acl
}

function _getAcl (roles) {
  const acl = new Acl()

  bluebird.promisifyAll(acl)

  const indexedRoles = _.keyBy(roles, 'id')

  roles.forEach(role => {
    const parentRole = role.parentId ? indexedRoles[role.parentId] : null

    if (parentRole) {
      acl.addRole(role.value, parentRole.value)
    } else {
      acl.addRole(role.value)
    }
  })

  acl.deny()

  roles.forEach(role => {
    if (role.permissions.includes('*')) {
      acl.allow(role.value)
    } else {
      role.permissions.forEach(permission => {
        const parsedPermission = parsePermission(permission)
        if (!parsedPermission) return

        const { object, action } = parsedPermission
        acl.allow(role.value, object, action)
      })
    }

    acl.allow(role)
  })

  return acl
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
