const Base = require('./Base')

const _ = require('lodash')

class User extends Base {
  static get tableName () {
    return 'user'
  }

  static get idPrefix () {
    return 'usr'
  }

  static get organizationIdPrefix () {
    return 'org'
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
        username: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        displayName: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        firstname: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        lastname: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        email: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        description: {
          type: ['string', 'null'],
          maxLength: 3000,
          default: null
        },
        roles: {
          type: 'array',
          default: []
        },
        organizations: {
          type: 'object',
          default: {}
        },
        orgOwnerId: {
          type: ['string', 'null'],
          default: null
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
        'username',
        'displayName',
        'firstname',
        'lastname',
        'email',
        'description',
        'roles',
        'organizations',
        'orgOwnerId',
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }

  static isSelf (user, userId) {
    return user.id === userId
  }

  static exposeTransform (element, field, { namespaces } = {}) {
    const hasPrivate = !!_.intersection(namespaces, ['*', 'private']).length

    switch (field) {
      case 'username':
        if (!hasPrivate) delete element.username
        break

      case 'firstname':
        if (!hasPrivate) delete element.firstname
        break

      case 'lastname':
        if (!hasPrivate) delete element.lastname
        break

      case 'email':
        if (!hasPrivate) delete element.email
        break

      case 'orgOwnerId': {
        const id = element.id
        if (!id || !id.startsWith(this.organizationIdPrefix)) delete element.orgOwnerId
      }
    }
  }

  static get defaultRoles () {
    return ['user', 'provider']
  }
}

module.exports = User
