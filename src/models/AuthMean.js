const Base = require('./Base')

const bluebird = require('bluebird')
const bcrypt = require('bcrypt')

bluebird.promisifyAll(bcrypt)

class AuthMean extends Base {
  static get tableName () {
    return 'authMean'
  }

  static get idPrefix () {
    return 'amn'
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
        password: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        provider: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        identifier: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        tokens: {
          type: 'object',
          default: {}
        },
        userId: {
          type: 'string',
          maxLength: 255
        }
      }
    }
  }

  static getAccessFields (access) {
    const accessFields = {}

    return accessFields[access]
  }

  async $beforeInsert (opt, queryContext) {
    super.$beforeInsert(opt, queryContext)

    if (this.password) {
      this.password = await bcrypt.hashAsync(this.password, 10)
    }
  }

  async $beforeUpdate (opt, queryContext) {
    super.$beforeUpdate(opt, queryContext)

    if (this.password) {
      this.password = await bcrypt.hashAsync(this.password, 10)
    }
  }

  static async validatePassword (password, hashedPassword) {
    const matched = await bcrypt.compareAsync(password, hashedPassword)
    return matched
  }
}

module.exports = AuthMean
