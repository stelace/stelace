const Base = require('./Base')

class AuthToken extends Base {
  static get tableName () {
    return 'authToken'
  }

  static get idPrefix () {
    return 'atk'
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
        type: {
          type: 'string',
          maxLength: 255
        },
        value: {
          type: 'string',
          maxLength: 255
        },
        userId: {
          type: ['string', 'null'],
          maxLength: 255
        },
        reference: {
          type: 'object',
          default: {}
        },
        expirationDate: {
          type: ['string', 'null'],
          maxLength: 24,
          default: null
        }
      }
    }
  }

  static getAccessFields (access) {
    const accessFields = {}

    return accessFields[access]
  }
}

module.exports = AuthToken
