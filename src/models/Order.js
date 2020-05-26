const Base = require('./Base')

class Order extends Base {
  static get tableName () {
    return 'order'
  }

  static get idPrefix () {
    return 'ord'
  }

  static get lineIdPrefix () {
    return 'ordl'
  }

  static get moveIdPrefix () {
    return 'ordm'
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
        lines: {
          type: 'array',
          default: []
        },
        moves: {
          type: 'array',
          default: []
        },
        amountDue: {
          type: ['number', 'null'],
          default: null
        },
        amountPaid: {
          type: ['number', 'null'],
          default: null
        },
        amountRemaining: {
          type: ['number', 'null'],
          default: null
        },
        currency: {
          type: 'string',
          maxLength: 255
        },
        payerId: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        paymentAttempted: {
          type: 'boolean',
          default: false
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

  // define the $beforeInsert function to have the same created date for order, lines and moves
  $beforeInsert () {
    super.$beforeInsert()

    const now = this.createdDate

    if (this.lines && this.lines.length) {
      this.lines.forEach(line => {
        if (!line.createdDate) {
          line.createdDate = now
        }
        if (!line.updatedDate) {
          line.updatedDate = now
        }
      })
    }
    if (this.moves && this.moves.length) {
      this.moves.forEach(move => {
        if (!move.createdDate) {
          move.createdDate = now
        }
        if (!move.updatedDate) {
          move.updatedDate = now
        }
      })
    }
  }

  static getAccessFields (access) {
    const accessFields = {
      api: [
        'id',
        'createdDate',
        'updatedDate',
        'lines',
        'moves',
        'amountDue',
        'amountPaid',
        'amountRemaining',
        'currency',
        'payerId',
        'isExternal',
        'paymentAttempted',
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }

  static getAccessFieldsForLine (access) {
    const accessFields = {
      api: [
        'id',
        'createdDate',
        'updatedDate',
        'orderId',
        'transactionId',
        'reversal',
        'payerId',
        'payerAmount',
        'receiverId',
        'receiverAmount',
        'platformAmount',
        'currency',
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }

  static getAccessFieldsForMove (access) {
    const accessFields = {
      api: [
        'id',
        'createdDate',
        'updatedDate',
        'eventDate',
        'orderId',
        'transactionId',
        'reversal',
        'payerId',
        'payerAmount',
        'receiverId',
        'receiverAmount',
        'platformAmount',
        'currency',
        'real',
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }

  static isSelf (order, userId) {
    const isPayer = order.payerId === userId
    const isReceiverFromLines = order.lines.reduce((memo, line) => {
      return memo || line.receiverId === userId
    }, false)
    const isReceiverFromMoves = order.moves.reduce((memo, move) => {
      return memo || move.receiverId === userId
    }, false)

    return isPayer || isReceiverFromLines || isReceiverFromMoves
  }

  static isSelfForLine (line, userId) {
    return userId && [line.payerId, line.receiverId].includes(userId)
  }

  static isSelfForMove (move, userId) {
    return userId && [move.payerId, move.receiverId].includes(userId)
  }

  static expose (element, options = {}) {
    const exposedElement = super.expose(element, Object.assign({}, options, {
      getAccessFieldsFn: this.getAccessFields
    }))

    if (exposedElement.lines) {
      exposedElement.lines = element.lines.map(line => this.exposeLine(line, options))
    }
    if (exposedElement.moves) {
      exposedElement.moves = element.moves.map(move => this.exposeMove(move, options))
    }

    return exposedElement
  }

  static exposeLine (line, options = {}) {
    const accessFields = this.getAccessFieldsForLine(options.access || 'api')

    return this.expose(line, Object.assign({}, options, {
      accessFields
    }))
  }

  static exposeMove (move, options = {}) {
    const accessFields = this.getAccessFieldsForMove(options.access || 'api')

    return this.expose(move, Object.assign({}, options, {
      accessFields
    }))
  }
}

module.exports = Order
