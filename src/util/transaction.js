const _ = require('lodash')

const {
  isDateString,
  computeDate,
  getDurationAs,
  diffDates
} = require('./time')

const {
  getPriceAfterFees,
  roundPriceWithCurrency
} = require('./pricing')

function getDefaultTransactionProcess () {
  return {
    initStatus: 'draft',
    cancelStatus: 'cancelled',
    transitions: [
      { name: 'accept', from: 'draft', to: 'accepted', actors: ['owner'] },
      { name: 'confirm', from: 'draft', to: 'confirmed', actors: ['taker'] },
      { name: 'pay', from: 'draft', to: 'pending-acceptance', actors: ['taker'] },
      { name: 'confirmAndPay', from: 'draft', to: 'pending-acceptance', actors: ['taker'] },

      { name: 'pay', from: 'confirmed', to: 'pending-acceptance', actors: ['taker'] },
      { name: 'accept', from: 'confirmed', to: 'pending-payment', actors: ['owner'] },

      { name: 'pay', from: 'accepted', to: 'validated', actors: ['taker'] },
      { name: 'confirmAndPay', from: 'accepted', to: 'validated', actors: ['taker'] },
      { name: 'confirm', from: 'accepted', to: 'pending-payment', actors: ['taker'] },

      { name: 'accept', from: 'pending-acceptance', to: 'validated', actors: ['owner'] },

      { name: 'pay', from: 'pending-payment', to: 'validated', actors: ['taker'] },

      { name: 'complete', from: 'validated', to: 'completed' },
      { name: 'cancel', from: '*', to: 'cancelled' }
    ]
  }
}

function getNewStatus (transaction, action) {
  const { transitions } = getDefaultTransactionProcess()

  const currStatus = transaction.status

  const transition = transitions.find(transition => {
    return transition.name === action && transition.from === currStatus
  })

  if (!transition) {
    throw new Error('Unknown transition')
  }

  return transition.to
}

function getFutureStatuses (status, { excludeCurrentStatus = true } = {}) {
  const { transitions } = getDefaultTransactionProcess()

  const indexedFromStatuses = _.groupBy(transitions, 'from')
  const doneStatuses = {}
  let futureStatuses = []

  // we recursively move to next statuses with defined above transitions
  _addNextStatuses(status)

  futureStatuses = _.uniq(futureStatuses)

  if (excludeCurrentStatus) {
    futureStatuses = _.without(futureStatuses, status)
  }

  return futureStatuses

  function _addNextStatuses (status) {
    // prevent infinite check on cyclic transitions
    if (doneStatuses[status]) return

    doneStatuses[status] = true
    futureStatuses.push(status)

    const statusTransitions = (indexedFromStatuses[status] || [])
      .concat(indexedFromStatuses['*'] || [])
    if (!statusTransitions || !statusTransitions.length) {
      return
    }

    const nextStatuses = statusTransitions.map(t => t.to)
    nextStatuses.forEach(_addNextStatuses)
  }
}

function getTransactionProcess (transaction) {
  const defaultTransactionProcess = getDefaultTransactionProcess()

  const assetType = transaction.assetType
  if (!assetType || !assetType.transactionProcess) return defaultTransactionProcess

  return assetType.transactionProcess
}

function getUnavailableWhen (transaction) {
  return transaction.assetType.unavailableWhen || ['validated', 'completed']
}

function isStatusBlockingAvailability (transaction, status) {
  return getUnavailableWhen(transaction).includes(status)
}

/**
 * Determines if the previous and current status blocks an availability
 * Can be useful to detect changes on blocking
 * e.g. know when to update asset quantity for non time-based and non infinite stock asset types
 * @param  {Object}  transaction
 * @return {Object}  result
 * @return {Boolean} result.previous - true for block, false otherwise
 * @return {Boolean} result.current  - true for block, false otherwise
 */
function getBlockingAvailabilityChange (transaction) {
  return {
    previous: transaction.statusHistory.length < 2
      ? false
      : isStatusBlockingAvailability(transaction, transaction.statusHistory[1].status),
    current: isStatusBlockingAvailability(transaction, transaction.status)
  }
}

/**
* Check if transaction dates are valid when calendar needed based on asset type config
* @param  {String}  startDate
* @param  {Object}  duration
* @param  {String}  refDate
* @param  {String}  previousTransactionRefDate
* @param  {String}  lastTransactionRefDate
* @param  {Object}  config
* @param  {Object}  config.startDateMinDelta
* @param  {Object}  config.startDateMaxDelta
* @param  {Number}  config.minDuration
* @param  {Number}  config.maxDuration
* @param  {Boolean} [checkDateDeltas = false] - if true, `startDateMinDelta` and `startDateMaxDelta` will be used
* @return {Boolean}
*/
function isValidDates ({
  startDate,
  duration,
  refDate,
  previousTransactionRefDate,
  lastTransactionRefDate,
  config,
  checkDateDeltas = false
}) {
  const errors = []

  if (!isDateString(startDate)) {
    errors.push({
      message: 'Start date has an invalid format (expected format: YYYY-MM-DDTHH:MM:SS.sssZ)',
      value: startDate
    })
  }
  if (!isDateString(refDate)) {
    errors.push({
      message: 'Reference date has an invalid format (expected format: YYYY-MM-DDTHH:MM:SS.sssZ)',
      value: refDate
    })
  }
  if (errors.length) {
    return exposeDatesResult(errors)
  }

  let startDateMinLimit
  let startDateMaxLimit

  if (checkDateDeltas) {
    if (_.isObjectLike(config.startDateMinDelta)) {
      const date = previousTransactionRefDate
        ? pickHighestDate(previousTransactionRefDate, refDate)
        : refDate

      startDateMinLimit = computeDate(date, config.startDateMinDelta)
    }
    if (_.isObjectLike(config.startDateMaxDelta)) {
      const date = lastTransactionRefDate
        ? pickHighestDate(lastTransactionRefDate, refDate)
        : refDate

      startDateMaxLimit = computeDate(date, config.startDateMaxDelta)
    }
  }

  const refTimeUnit = 'd' // choose a default time unit as reference

  const nbTimeUnits = getDurationAs(duration, refTimeUnit)

  if (nbTimeUnits <= 0) {
    errors.push({
      message: 'Duration must be a strictly positive number',
      value: duration
    })
  } else {
    if (config.minDuration) {
      if (!_.isObjectLike(config.minDuration)) {
        errors.push({
          message: 'Object duration format is expected for min duration',
          value: config.minDuration
        })
      } else {
        const minNbTimeUnits = getDurationAs(config.minDuration, refTimeUnit)

        if (nbTimeUnits < minNbTimeUnits) {
          errors.push({
            message: `Duration must be equal to or greater than ${config.minDuration}`,
            value: duration,
            limit: config.minDuration
          })
        }
      }
    }
    if (config.maxDuration) {
      if (!_.isObjectLike(config.maxDuration)) {
        errors.push({
          message: 'Object duration format is expected for max duration',
          value: config.maxDuration
        })
      } else {
        const maxNbTimeUnits = getDurationAs(config.maxDuration, refTimeUnit)

        if (maxNbTimeUnits < nbTimeUnits) {
          errors.push({
            message: `Duration must be equal to or less than ${config.maxDuration}`,
            value: duration,
            limit: config.maxDuration
          })
        }
      }
    }
  }

  if (startDateMinLimit && startDate < startDateMinLimit) {
    errors.push({
      message: `Start date must be equal to or after the date ${startDateMinLimit}`,
      value: startDate,
      limit: startDateMinLimit
    })
  }
  if (startDateMaxLimit && startDateMaxLimit < startDate) {
    errors.push({
      message: `Start date must be equal to or prior the date ${startDateMaxLimit}`,
      value: startDate,
      limit: startDateMaxLimit
    })
  }

  return exposeDatesResult(errors)
}

function exposeDatesResult (errors) {
  return {
    result: !errors.length,
    errors
  }
}

function pickHighestDate (date1, date2) {
  return date1 < date2 ? date2 : date1
}

function getTransactionDurationData ({ startDate, endDate, duration, timeUnit = 'd' }) {
  if ((endDate && duration) || (!endDate && !duration)) {
    throw new Error('endDate OR duration expected')
  }

  let newDuration = duration
  let nbTimeUnits
  let newEndDate = endDate

  if (endDate) {
    nbTimeUnits = diffDates(endDate, startDate, timeUnit)
    newDuration = { [timeUnit]: nbTimeUnits }
  } else if (duration) {
    newEndDate = computeDate(startDate, duration)
  }

  return {
    startDate,
    endDate: newEndDate,
    duration: newDuration
  }
}

function shouldAffectAvailability (transaction, { checkStatus = true } = {}) {
  // do not consider transaction with unlimited availability because it doesn't decrease quantity
  const { timeBased, infiniteStock } = transaction.assetType
  if (infiniteStock) return false

  // timeless transactions won't affect availability
  if (!timeBased) return false

  // do not consider timebased transaction that don't have a start date
  if (!transaction.startDate) return false

  if (checkStatus) {
    return isStatusBlockingAvailability(transaction, transaction.status)
  } else {
    return true
  }
}

function canComputePricing (transaction) {
  return !!(
    (transaction.assetId && transaction.assetSnapshot) &&
    transaction.assetType &&
    (!transaction.assetType.timeBased ||
      (transaction.assetType.timeBased && typeof transaction.startDate === 'string')) &&
    typeof transaction.quantity === 'number'
  )
}

/**
 * Compute the transaction pricing
 * Some pricing value can be provided, they will override the default computed pricing values
 * @param {Object} transaction
 * @param {Object} [overrideParams]
 * @param {Number} [overrideParams.value] - computed based on transaction quantity and duration
 * @param {Number} [overrideParams.ownerAmount] - computed based on `assetType.pricing.ownerFeesPercent`
 * @param {Number} [overrideParams.takerAmount] - computed based on `assetType.pricing.takerFeesPercent`
 *
 * @return {Object} priceResult.value
 * @return {Number} priceResult.ownerAmount
 * @return {Number} priceResult.takerAmount
 * @return {Number} priceResult.platformAmount
 * @return {Number} priceResult.ownerFees
 * @return {Number} priceResult.takerFees
 */
function getTransactionPricing (transaction, { value, ownerAmount, takerAmount } = {}) {
  const {
    ownerFeesPercent,
    takerFeesPercent
  } = transaction.assetType.pricing

  let nbTimeUnits = 1
  if (transaction.startDate && transaction.duration) {
    nbTimeUnits = getDurationAs(transaction.duration, transaction.timeUnit)
  }

  const defaultValue = transaction.unitPrice * nbTimeUnits * (transaction.quantity || 1)
  const finalValue = _.isFinite(value) ? value : defaultValue

  const defaultPriceResult = getPriceAfterFees({
    ownerPrice: finalValue,
    currency: transaction.currency,
    ownerFeesPercent,
    takerFeesPercent
  })

  const priceResult = {
    value: finalValue,
    ownerAmount: _.isFinite(ownerAmount) ? ownerAmount : defaultPriceResult.ownerNetIncome,
    takerAmount: _.isFinite(takerAmount) ? takerAmount : defaultPriceResult.takerPrice,
  }

  priceResult.takerFees = roundPrice(priceResult.takerAmount - priceResult.value)
  priceResult.ownerFees = roundPrice(priceResult.value - priceResult.ownerAmount)
  priceResult.platformAmount = roundPrice(priceResult.ownerFees + priceResult.takerFees)

  return priceResult

  function roundPrice (amount) {
    return roundPriceWithCurrency(amount, transaction.currency, 1)
  }
}

module.exports = {
  getDefaultTransactionProcess,
  getNewStatus,
  getFutureStatuses,
  getTransactionProcess,
  getUnavailableWhen,
  isStatusBlockingAvailability,
  getBlockingAvailabilityChange,
  isValidDates,
  getTransactionDurationData,
  shouldAffectAvailability,

  canComputePricing,
  getTransactionPricing
}
