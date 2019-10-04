const Base = require('./Base')

const {
  parseKey,
  getBaseKey
} = require('stelace-util-keys')

class ApiKey extends Base {
  static get tableName () {
    return 'apiKey'
  }

  static get idPrefix () {
    return 'apik'
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
        key: {
          type: 'string',
          maxLength: 255
        },
        roles: {
          type: 'array',
          default: []
        },
        permissions: {
          type: 'array',
          default: []
        },
        readNamespaces: {
          type: 'array',
          default: []
        },
        editNamespaces: {
          type: 'array',
          default: []
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
        'key',
        'roles',
        'permissions',
        'readNamespaces',
        'editNamespaces',
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }

  static isSelf (apiKey, apiKeyId) {
    return apiKey.id === apiKeyId
  }

  static exposeTransform (element, field, { options }) {
    switch (field) {
      case 'key':
        let key = element.key

        if (key && typeof key === 'string') {
          const parsedKey = parseKey(key)

          // do not obfuscate if the key is a publishable or content key
          // or if there is a reveal option
          const revealKey = options && options.reveal
          const shouldObfuscateKey = !['pubk', 'cntk'].includes(parsedKey.type) && !revealKey

          if (shouldObfuscateKey) {
            const nbKeyCharsToShow = 4
            const baseKey = getBaseKey(key)

            element.key = key.slice(0, baseKey.length + nbKeyCharsToShow) +
              key.slice(baseKey.length + nbKeyCharsToShow, -nbKeyCharsToShow).replace(/\w/gi, 'x') +
              key.substr(-nbKeyCharsToShow)
          }
        }
        break
    }
  }
}

module.exports = ApiKey
