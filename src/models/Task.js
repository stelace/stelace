const Base = require('./Base')

class Task extends Base {
  static get tableName () {
    return 'task'
  }

  static get idPrefix () {
    return 'task'
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
        executionDate: {
          type: ['string', 'null'],
          maxLength: 24,
          default: null
        },
        recurringPattern: {
          type: ['string', 'null'],
          default: null
        },
        recurringTimezone: {
          type: ['string', 'null'],
          default: null
        },
        eventType: {
          type: 'string',
          maxLength: 255
        },
        eventMetadata: {
          type: 'object',
          default: {}
        },
        eventObjectId: {
          type: ['string', 'null'],
          default: null
        },
        active: {
          type: 'boolean',
          default: true
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
        'executionDate',
        'recurringPattern',
        'recurringTimezone',
        'eventType',
        'eventMetadata',
        'eventObjectId',
        'active',
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }
}

module.exports = Task
