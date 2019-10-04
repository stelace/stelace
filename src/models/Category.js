const Base = require('./Base')

class Category extends Base {
  static get tableName () {
    return 'category'
  }

  static get idPrefix () {
    return 'ctgy'
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
        parentId: {
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
        'name',
        'parentId',
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }
}

module.exports = Category
