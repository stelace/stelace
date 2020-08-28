const Base = require('./Base')

class Document extends Base {
  static get tableName () {
    return 'document'
  }

  static get idPrefix () {
    return 'doc'
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
        authorId: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        targetId: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        topicId: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        type: {
          type: 'string',
          maxLength: 255
        },
        label: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        data: {
          type: 'object',
          default: {}
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
        'authorId',
        'targetId',
        'topicId',
        'type',
        'label',
        'data',
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }
}

module.exports = Document
