const Base = require('./Base')

class Entry extends Base {
  static get tableName () {
    return 'entry'
  }

  static get idPrefix () {
    return 'ent'
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
        collection: {
          type: 'string',
          maxLength: 255
        },
        locale: {
          type: 'string',
          maxLength: 255
        },
        name: {
          type: 'string',
          maxLength: 255
        },
        fields: {
          type: 'object',
          default: {}
        },
        metadata: {
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
        'collection',
        'locale',
        'name',
        'fields',
        'metadata',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }
}

module.exports = Entry
