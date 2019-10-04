const Base = require('./Base')

class Webhook extends Base {
  static get tableName () {
    return 'webhook'
  }

  static get idPrefix () {
    return 'whk'
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
        targetUrl: {
          type: 'string'
        },
        event: {
          type: 'string'
        },
        apiVersion: {
          type: 'string'
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
        'name',
        'targetUrl',
        'event',
        'apiVersion',
        'active',
        'logs', // not in model, populated on the fly from WebhookLog Model
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }
}

module.exports = Webhook
