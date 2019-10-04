const Base = require('./Base')

class Asset extends Base {
  static get tableName () {
    return 'asset'
  }

  static get idPrefix () {
    return 'ast'
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
        ownerId: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        description: {
          type: ['string', 'null'],
          maxLength: 3000,
          default: null
        },
        categoryId: {
          type: ['string', 'null'],
          default: null
        },
        validated: {
          type: 'boolean',
          default: false
        },
        locations: {
          type: 'array',
          items: { type: 'object' },
          default: []
        },
        active: {
          type: 'boolean',
          default: true
        },
        assetTypeId: {
          type: 'string'
        },
        quantity: {
          type: 'integer',
          default: 1
        },
        currency: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        price: {
          type: 'number',
          default: 0
        },
        customAttributes: {
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
        'name',
        'description',
        'ownerId',
        'categoryId',
        'validated',
        'locations',
        'active',
        'assetTypeId',
        'quantity',
        'currency',
        'price',
        'customAttributes',
        'metadata',
        'platformData',

        'available', // attribute that is added in search when availability filters are disabled
        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }

  static isSelf (asset, userId) {
    return asset.ownerId === userId
  }
}

module.exports = Asset
