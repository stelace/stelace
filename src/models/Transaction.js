const Base = require('./Base')

class Transaction extends Base {
  static get tableName () {
    return 'transaction'
  }

  static get idPrefix () {
    return 'trn'
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
          type: ['string', 'null'],
          default: null
        },
        assetSnapshot: {
          type: 'object',
          default: {}
        },
        assetTypeId: {
          type: ['string', 'null'],
          default: null
        },
        assetType: {
          type: 'object',
          default: {}
        },
        status: {
          type: 'string',
          maxLength: 255,
          default: 'draft'
        },
        statusHistory: {
          type: 'array',
          default: ['draft']
        },
        ownerId: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        takerId: {
          type: 'string',
          maxLength: 255,
          default: null
        },
        quantity: {
          type: 'integer',
          default: 1
        },
        startDate: {
          type: ['string', 'null'],
          maxLength: 24,
          default: null
        },
        endDate: {
          type: ['string', 'null'],
          maxLength: 24,
          default: null
        },
        duration: {
          type: ['object', 'null'],
          default: null
        },
        timeUnit: {
          type: ['string', 'null'],
          default: null
        },
        unitPrice: {
          type: ['number', 'null'],
          default: null
        },
        value: {
          type: ['number', 'null'],
          default: null
        },
        ownerAmount: {
          type: ['number', 'null'],
          default: null
        },
        takerAmount: {
          type: ['number', 'null'],
          default: null
        },
        platformAmount: {
          type: ['number', 'null'],
          default: null
        },
        ownerFees: {
          type: ['number', 'null'],
          default: null
        },
        takerFees: {
          type: ['number', 'null'],
          default: null
        },
        currency: {
          type: ['string', 'null'],
          default: null
        },
        completedDate: {
          type: ['string', 'null'],
          maxLength: 24,
          default: null
        },
        cancelledDate: {
          type: ['string', 'null'],
          maxLength: 24,
          default: null
        },
        cancellationReason: {
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
        'assetId',
        'assetSnapshot',
        'assetTypeId',
        'assetType',
        'status',
        'statusHistory',
        'ownerId',
        'takerId',
        'quantity',
        'startDate',
        'endDate',
        'duration',
        'timeUnit',
        'unitPrice',
        'value',
        'ownerAmount',
        'takerAmount',
        'platformAmount',
        'currency',
        'completedDate',
        'cancelledDate',
        'cancellationReason',
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ],
      public: [
        'id',
        'createdDate',
        'assetId',
        'assetTypeId',
        'assetType',
        'status',
        'quantity',
        'startDate',
        'endDate',
        'duration',
        'timeUnit',
        'unitPrice',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }

  static isSelf (transaction, userId) {
    return [
      transaction.ownerId,
      transaction.takerId
    ].includes(userId)
  }
}

module.exports = Transaction
