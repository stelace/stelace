const Base = require('./Base')

const _ = require('lodash')

class Role extends Base {
  static get tableName () {
    return 'role'
  }

  static get idPrefix () {
    return 'role'
  }

  static get jsonSchema () {
    return {
      type: 'object',
      properties: {
        id: {
          type: 'string'
        },
        createdDate: {
          type: 'string',
          maxLength: 24
        },
        updatedDate: {
          type: 'string',
          maxLength: 24
        },
        name: {
          type: 'string',
          maxLength: 255
        },
        value: {
          type: 'string',
          maxLength: 255
        },
        customRole: {
          type: 'boolean',
          default: true
        },
        parentId: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        permissions: {
          type: 'array',
          default: []
        },
        readNamespaces: {
          type: 'array',
          default: []
        },
        editNamespaces: {
          type: 'array',
          default: []
        },
        metadata: {
          type: 'object',
          default: {}
        },
        platformData: {
          type: 'object',
          default: {}
        }
      }
    }
  }

  static getAccessFields (access) {
    const accessFields = {
      api: [
        'id',
        'createdDate',
        'updatedDate',
        'name',
        'value',
        'customRole',
        'parentId',
        'permissions',
        'readNamespaces',
        'editNamespaces',
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }

  // get namespaces based on role inheritance
  static getNamespaces (roles, values) {
    const indexedRoles = _.keyBy(roles, 'id')
    const indexedRolesByValue = _.keyBy(roles, 'value')

    let readNamespaces = []
    let editNamespaces = []

    const addNamespaces = (role) => {
      if (role.readNamespaces) {
        readNamespaces = readNamespaces.concat(role.readNamespaces)
      }
      if (role.editNamespaces) {
        editNamespaces = editNamespaces.concat(role.editNamespaces)
      }

      if (role.parentId) {
        const parentRole = indexedRoles[role.parentId]
        if (parentRole) {
          addNamespaces(parentRole)
        }
      }
    }

    values.forEach(value => {
      const role = indexedRolesByValue[value]
      if (!role) return

      addNamespaces(role)
    })

    return {
      readNamespaces: _.uniq(readNamespaces),
      editNamespaces: _.uniq(editNamespaces)
    }
  }
}

module.exports = Role
