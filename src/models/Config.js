const Base = require('./Base')

class Config extends Base {
  static get tableName () {
    return 'config'
  }

  static get idPrefix () {
    return 'conf'
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
        access: {
          type: 'string',
          maxLength: 255
        },
        stelace: {
          type: 'object',
          default: {}
        },
        custom: {
          type: 'object',
          default: {}
        },
        theme: {
          type: 'object',
          default: {}
        }
      }
    }
  }

  static getAccessFields (access) {
    const accessFields = {
      api: [
        'stelace',
        'custom',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }
}

module.exports = Config
