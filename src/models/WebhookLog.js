const Base = require('./Base')

class WebhookLog extends Base {
  static get tableName () {
    return 'webhookLog'
  }

  static get idPrefix () {
    return 'whl'
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
        createdTimestamp: { // time column for hypertable
          type: 'string',
        },
        webhookId: {
          type: 'string'
        },
        eventId: {
          type: 'string'
        },
        status: {
          type: 'string'
        },
        metadata: {
          type: 'object',
          default: {}
        }
      }
    }
  }

  $beforeInsert () {
    const now = new Date().toISOString()

    this.createdDate = now
    this.createdTimestamp = now
    // no updatedDate
  }

  $beforeUpdate () { // no updatedDate
  }

  static getAccessFields (access) {
    const accessFields = {
      api: [
        'id',
        'createdDate',
        'webhookId',
        'eventId',
        'status',
        'metadata',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }
}

module.exports = WebhookLog
