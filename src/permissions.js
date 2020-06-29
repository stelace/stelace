const _ = require('lodash')

const coreListObjectPermissions = [
  {
    object: 'apiKey',
    actions: [
      'list:all',
      'read',
      'read:all',
      'create:all',
      'edit',
      'edit:all',
      'remove',
      'remove:all'
    ]
  },
  {
    object: 'assessment',
    actions: [
      'list',
      'list:all',
      'read',
      'read:all',
      'create',
      'create:all',
      'edit',
      'edit:all',
      'sign',
      'sign:all',
      'config',
      'config:all',
      'remove',
      'remove:all'
    ]
  },
  {
    object: 'asset',
    actions: [
      'list',
      'list:all',
      'read',
      'read:all',
      'create',
      'create:all',
      'edit',
      'edit:all',
      'remove',
      'remove:all'
    ]
  },
  {
    object: 'assetType',
    actions: [
      'list:all',
      'read:all',
      'create:all',
      'edit:all',
      'remove:all'
    ]
  },
  {
    object: 'auth',
    actions: [
      'login',
      'impersonate'
    ]
  },
  {
    object: 'availability',
    actions: [
      'list',
      'list:all',
      'read',
      'read:all',
      'create',
      'create:all',
      'edit',
      'edit:all',
      'remove',
      'remove:all'
    ]
  },
  {
    object: 'config',
    actions: [
      'read',
      'edit',
      'read:all',
      'edit:all'
    ]
  },
  {
    object: 'customAttribute',
    actions: [
      'list:all',
      'read:all',
      'create:all',
      'edit:all',
      'remove:all'
    ]
  },
  {
    object: 'document',
    actions: [
      'stats:all',
      'list:all',
      'read:all',
      'create:all',
      'edit:all',
      'remove:all'
    ]
  },
  {
    object: 'entry',
    actions: [
      'list:all',
      'read:all',
      'create:all',
      'edit:all',
      'remove:all'
    ]
  },
  {
    object: 'event',
    actions: [
      'stats:all',
      'list:all',
      'read:all',
      'create:all'
    ]
  },
  {
    object: 'category',
    actions: [
      'list:all',
      'read:all',
      'create:all',
      'edit:all',
      'remove:all'
    ]
  },
  {
    object: 'platformData',
    actions: [
      'edit:all'
    ]
  },
  {
    object: 'message',
    actions: [
      'list',
      'list:all',
      'read',
      'read:all',
      'create',
      'create:all',
      'edit',
      'edit:all',
      'remove',
      'remove:all'
    ]
  },
  {
    object: 'order',
    actions: [
      'preview',
      'preview:all',
      'list',
      'list:all',
      'read',
      'read:all',
      'create',
      'create:all',
      'edit',
      'edit:all'
    ]
  },
  {
    object: 'orderLine',
    actions: [
      'read',
      'read:all',
      'create',
      'create:all',
      'edit',
      'edit:all'
    ]
  },
  {
    object: 'orderMove',
    actions: [
      'read',
      'read:all',
      'create',
      'create:all',
      'edit',
      'edit:all'
    ]
  },
  {
    object: 'organization',
    actions: [
      'create',
      'create:all'
    ]
  },
  {
    object: 'password',
    actions: [
      'reset'
    ]
  },
  {
    object: 'role',
    actions: [
      'list:all',
      'read:all',
      'create:all',
      'edit:all',
      'remove:all'
    ]
  },
  {
    object: 'search',
    actions: [
      'list:all'
    ]
  },
  {
    object: 'task',
    actions: [
      'list:all',
      'read:all',
      'create:all',
      'edit:all',
      'remove:all'
    ]
  },
  {
    object: 'token',
    actions: [
      'check'
    ]
  },
  {
    object: 'transaction',
    actions: [
      'list',
      'list:all',
      'read',
      'read:all',
      'preview:all',
      'create',
      'create:all',
      'edit',
      'edit:all',
      'config:all',
      'transition',
      'transition:all'
    ]
  },
  {
    object: 'signal',
    actions: [
      'create:all'
    ]
  },
  {
    object: 'user',
    actions: [
      'list',
      'list:all',
      'read',
      'read:all',
      'create',
      'create:all',
      'edit',
      'edit:all',
      'edit:organization',
      'remove',
      'remove:all',
      'config:all',
      'configOrganization',
      'configOrganization:all'
    ]
  },
  {
    object: 'webhook',
    actions: [
      'list:all',
      'read:all',
      'create:all',
      'edit:all',
      'remove:all'
    ]
  },
  {
    object: 'workflow',
    actions: [
      'list:all',
      'read:all',
      'create:all',
      'edit:all',
      'remove:all'
    ]
  }
]

const permissionsDefObjects = _.cloneDeep(coreListObjectPermissions)

let permissionsArray

function getPermissionsDefObjects () {
  return permissionsDefObjects
}

function getListPermissions () {
  if (permissionsArray) return permissionsArray

  const permissionsDefObjects = getPermissionsDefObjects()

  const keys = permissionsDefObjects.reduce((p, def) => {
    return [...p, ...def.actions.map(a => getPermissionKey(def.object, a))]
  }, [])

  permissionsArray = keys
  return permissionsArray
}

function registerPermission (permission) {
  if (typeof permission !== 'string') {
    throw new Error('Invalid permission: string expected')
  }

  const parsedPermission = parsePermission(permission)
  if (!parsedPermission || !parsedPermission.object || !parsedPermission.action) {
    throw new Error('Invalid permission: wrong format')
  }

  const objectPermission = permissionsDefObjects.find(objPermission => {
    return objPermission.object === parsedPermission.object
  })

  if (!objectPermission) {
    permissionsDefObjects.push({
      object: parsedPermission.object,
      actions: [parsedPermission.action]
    })
  } else if (!objectPermission.actions.includes(parsedPermission.action)) {
    objectPermission.actions.push(parsedPermission.action)
  }

  permissionsArray = null // reset the cache
}

function parsePermission (permission, { readScope = false } = {}) {
  const parts = permission.split(':')
  if (parts.length < 2 || parts.length > 3) return

  const separatorIndex = permission.indexOf(':')
  const object = parts[0]
  let action
  let scope

  if (readScope) {
    action = parts[1]
    scope = parts[2]
  } else {
    action = permission.substring(separatorIndex + 1)
    scope = null
  }

  return {
    object,
    action,
    scope
  }
}

function getPermissionKey (object, action) {
  return `${object}:${action}`
}

module.exports = {
  getPermissionsDefObjects,
  getListPermissions,

  registerPermission,

  parsePermission,
  getPermissionKey
}
