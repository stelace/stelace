const _ = require('lodash')

const Base = require('./Base')

const { allowedTimeUnits } = require('../util/time')

class AssetType extends Base {
  static get tableName () {
    return 'assetType'
  }

  static get idPrefix () {
    return 'typ'
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
        timeBased: {
          type: 'boolean',
          default: false
        },
        infiniteStock: {
          type: 'boolean',
          default: false
        },
        pricing: {
          type: 'object',
          properties: {
            ownerFeesPercent: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              default: 0
            },
            takerFeesPercent: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              default: 0
            }
          },
          default: {}
        },
        timing: {
          type: 'object',
          properties: {
            timeUnit: {
              type: 'string',
              enum: allowedTimeUnits,
              default: 'd'
            },
            minDuration: {
              type: ['object', 'null'],
              default: null
            },
            maxDuration: {
              type: ['object', 'null'],
              default: null
            }
          },
          default: {}
        },
        unavailableWhen: {
          type: ['array', 'null'],
          items: { type: 'string' },
          default: null
        },
        transactionProcess: {
          type: ['object', 'null'],
          properties: {
            initStatus: {
              type: 'string'
            },
            cancelStatus: {
              type: 'string'
            },
            transitions: {
              type: 'array',
              items: { type: 'object' },
              default: []
            }
          },
          default: null
        },
        namespaces: {
          type: 'object',
          properties: {
            visibility: {
              type: 'object',
              default: {}
            }
          },
          default: {}
        },
        isDefault: {
          type: 'boolean',
          default: false
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
        'timeBased',
        'infiniteStock',
        'pricing',
        'timing',
        'unavailableWhen',
        'transactionProcess',
        'namespaces',
        'isDefault',
        'active',
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }

  static exposeTransform (element, field, { planPermissions } = {}) {
    switch (field) {
      case 'pricing':
      case 'timing':
      case 'unavailableWhen':
      case 'transactionProcess': {
        if (planPermissions === null) return // no plan permission to check
        const granted = _.pickBy(planPermissions)
        const transactionsEnabled = Object.keys(granted).some(p => p.startsWith('transaction:'))
        if (!transactionsEnabled) delete element[field]
        break
      }
    }
  }
}

module.exports = AssetType
