const _ = require('lodash')

const {
  getTransactionPricing
} = require('./transaction')

function getLinesFromTransactions (transactions) {
  const lines = []

  transactions.forEach(transaction => {
    const transactionPricing = getTransactionPricing(transaction)

    lines.push({
      transactionId: transaction.id,
      reversal: false,
      senderId: transaction.takerId,
      senderAmount: transactionPricing.takerAmount,
      receiverId: null,
      receiverAmount: 0,
      platformAmount: transactionPricing.takerFees || 0,
      currency: transaction.currency,
      metadata: {
        duration: transaction.duration,
        timeUnit: transaction.timeUnit,
        unitPrice: transaction.unitPrice
      },
      platformData: {}
    })

    lines.push({
      transactionId: transaction.id,
      reversal: false,
      senderId: null,
      senderAmount: 0,
      receiverId: transaction.ownerId,
      receiverAmount: transactionPricing.ownerAmount,
      platformAmount: transactionPricing.ownerFees || 0,
      currency: transaction.currency,
      metadata: {},
      platformData: {}
    })
  })

  return lines
}

function getInformationFromLines (lines) {
  const result = {
    senderId: null,
    receiverIds: [],
    transactionIds: [],
    currency: null,
    totalSenderAmount: 0,
    totalReceiverAmount: 0,
    totalPlatformAmount: 0,
    totalReversedSenderAmount: 0,
    totalReversedReceiverAmount: 0,
    totalReversedPlatformAmount: 0
  }

  lines.forEach(line => {
    if (!result.senderId) {
      result.senderId = line.senderId
    }
    if (!result.currency) {
      result.currency = line.currency
    }
    if (line.receiverId) {
      result.receiverIds.push(line.receiverId)
    }
    if (line.transactionId) {
      result.transactionIds.push(line.transactionId)
    }
    if (typeof line.senderAmount === 'number') {
      if (line.reversal) {
        result.totalReversedSenderAmount += line.senderAmount
      } else {
        result.totalSenderAmount += line.senderAmount
      }
    }
    if (typeof line.receiverAmount === 'number') {
      if (line.reversal) {
        result.totalReversedReceiverAmount += line.receiverAmount
      } else {
        result.totalReceiverAmount += line.receiverAmount
      }
    }
    if (typeof line.platformAmount === 'number') {
      if (line.reversal) {
        result.totalReversedPlatformAmount += line.platformAmount
      } else {
        result.totalPlatformAmount += line.platformAmount
      }
    }
  })

  result.receiverIds = _.uniq(result.receiverIds)
  result.transactionIds = _.uniq(result.transactionIds)

  return result
}

function getInformationFromMoves (moves) {
  const result = {
    senderId: null,
    receiverIds: [],
    transactionIds: [],
    currency: null,
    totalSenderAmount: 0,
    totalReceiverAmount: 0,
    totalPlatformAmount: 0,
    totalReversedSenderAmount: 0,
    totalReversedReceiverAmount: 0,
    totalReversedPlatformAmount: 0
  }

  moves.forEach(move => {
    if (!result.senderId) {
      result.senderId = move.senderId
    }
    if (!result.currency) {
      result.currency = move.currency
    }
    if (move.receiverId) {
      result.receiverIds.push(move.receiverId)
    }
    if (move.transactionId) {
      result.transactionIds.push(move.transactionId)
    }
    if (typeof move.senderAmount === 'number') {
      if (move.reversal) {
        result.totalReversedSenderAmount += move.senderAmount
      } else {
        result.totalSenderAmount += move.senderAmount
      }
    }
    if (typeof move.receiverAmount === 'number') {
      if (move.reversal) {
        result.totalReversedReceiverAmount += move.receiverAmount
      } else {
        result.totalReceiverAmount += move.receiverAmount
      }
    }
    if (typeof move.platformAmount === 'number') {
      if (move.reversal) {
        result.totalReversedPlatformAmount += move.platformAmount
      } else {
        result.totalPlatformAmount += move.platformAmount
      }
    }
  })

  result.receiverIds = _.uniq(result.receiverIds)
  result.transactionIds = _.uniq(result.transactionIds)

  return result
}

function getOrderMeta (order, { moves, linesInformation, movesInformation }) {
  const meta = {}

  const amountDue = linesInformation.totalSenderAmount
  const amountPaid = movesInformation.totalSenderAmount
  const amountRemaining = amountDue - amountPaid
  const currency = linesInformation.currency
  const senderId = linesInformation.senderId
  const paymentAttempted = !!moves.length

  if (order.amountDue !== amountDue) {
    meta.amountDue = amountDue
  }
  if (order.amountPaid !== amountPaid) {
    meta.amountPaid = amountPaid
  }
  if (order.amountRemaining !== amountRemaining) {
    meta.amountRemaining = amountRemaining
  }
  if (order.currency !== currency) {
    meta.currency = currency
  }
  if (order.senderId !== senderId) {
    meta.senderId = senderId
  }
  if (order.paymentAttempted !== paymentAttempted) {
    meta.paymentAttempted = paymentAttempted
  }

  return meta
}

module.exports = {
  getLinesFromTransactions,
  getInformationFromLines,
  getInformationFromMoves,
  getOrderMeta
}
