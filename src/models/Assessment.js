const Base = require('./Base')

const { getRandomString } = require('stelace-util-keys')

class Assessment extends Base {
  static get tableName () {
    return 'assessment'
  }

  static get idPrefix () {
    return 'assm'
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
        statement: {
          type: ['string', 'null'],
          default: null
        },
        status: {
          type: ['string', 'null'],
          default: null
        },
        assetId: {
          type: 'string'
        },
        transactionId: {
          type: ['string', 'null'],
          default: null
        },
        ownerId: {
          type: 'string',
          maxLength: 255
        },
        takerId: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        emitterId: {
          type: 'string',
          maxLength: 255
        },
        receiverId: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        signers: {
          type: 'object',
          default: {}
        },
        signCodes: {
          type: 'object',
          default: {}
        },
        nbSigners: {
          type: 'integer',
          default: 1
        },
        expirationDate: {
          type: ['string', 'null'],
          maxLength: 24,
          default: null
        },
        signedDate: {
          type: ['string', 'null'],
          maxLength: 24,
          default: null
        },
        assessmentDate: {
          type: ['string', 'null'],
          maxLength: 24,
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
        'statement',
        'status',
        'assetId',
        'transactionId',
        'ownerId',
        'takerId',
        'emitterId',
        'receiverId',
        'signers',
        'signCodes',
        'nbSigners',
        'expirationDate',
        'signedDate',
        'assessmentDate',
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }

  static isSelf (assessment, userId) {
    const signersIds = this.getSignersIds(assessment)
    return signersIds.includes(userId)
  }

  static isValidStatement (statement) {
    return ['pass', 'challenge'].includes(statement)
  }

  static isValidStatus (status) {
    return ['draft', 'accept', 'reject'].includes(status)
  }

  static async generateSignCode (nbChars = 10) {
    const code = await getRandomString(nbChars)
    return code.toUpperCase()
  }

  static async generateSignCodes (nbCodes, nbChars = 10) {
    const codes = []

    for (let i = 0; i < nbCodes; i++) {
      const code = await this.generateSignCode(nbChars)
      codes.push(code)
    }

    return codes
  }

  static getSignersIds (assessment) {
    return Object.keys(assessment.signers)
  }
}

module.exports = Assessment
