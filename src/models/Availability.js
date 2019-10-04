const Base = require('./Base')

class Availability extends Base {
  static get tableName () {
    return 'availability'
  }

  static get idPrefix () {
    return 'avl'
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
        assetId: {
          type: 'string'
        },
        startDate: {
          type: 'string',
          maxLength: 24
        },
        endDate: {
          type: 'string',
          maxLength: 24
        },
        quantity: {
          type: 'string',
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
        recurringDuration: {
          type: ['object', 'null'],
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
        'assetId',
        'startDate',
        'endDate',
        'quantity',
        'recurringPattern',
        'recurringTimezone',
        'recurringDuration',
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }

  static exposeTransform (element, field) {
    switch (field) {
      case 'quantity':
        const sign = element.quantity.charAt(0)
        const isSign = ['+', '-'].includes(sign)

        if (!isSign) {
          element.quantity = parseInt(element.quantity, 10)
        }
        break
    }
  }
}

module.exports = Availability
