const _ = require('lodash')

const {
  computeRecurringPeriods
} = require('./time')

/**
* Get the graph that shows availability by period
* @param {Object[]} transactions
* @param {String} transactions[i].startDate
* @param {String} transactions[i].endDate (can be null, means no end date)
* @param {Number} transactions[i].quantity
* @param {Number} defaultQuantity - base quantity that is used for periods when there is no availability, no transaction or only relative availability quantity (basically it's asset quantity)
* @param {Number} maxQuantity - available quantity cannot exceed this value (useful for availability UNIQUE)
* @param  {Object[]} [availabilities]
* @param  {String} availabilities[i].updatedDate
* @param  {String} availabilities[i].startDate
* @param  {String} availabilities[i].endDate
* @param  {String} availabilities[i].quantity
* @param  {String} availabilities[i].recurringPattern
* @param  {String} availabilities[i].recurringTimezone
* @param  {Object} availabilities[i].recurringDuration
* @return {Object} graph
* @return {Number} graph.defaultQuantity - same as input defaultQuantity
* @return {Number} graph.totalUsedQuantity - sum of all transaction quantities
* @return {Object[]} graph.graphDates
* @return {String} graph.graphDates[i].date
* @return {Number} graph.graphDates[i].usedQuantity       - quantity used by transactions
* @return {Number} graph.graphDates[i].availableQuantity  - quantity defined by availabilities
*/
function getAvailabilityPeriodGraph ({ transactions = [], availabilities = [], defaultQuantity, maxQuantity } = {}) {
  const indexedTransactionsByStartDate = _.groupBy(transactions, 'startDate')
  const indexedTransactionsByEndDate = _.groupBy(transactions, 'endDate')

  const useMaxQuantity = typeof maxQuantity === 'number'
  let totalUsedQuantity = 0

  const allAvailabilities = _getAvailabilitiesWithRecurringPattern(availabilities)

  const {
    fixedQuantityAvailabilities,
    relativeQuantityAvailabilities
  } = _partitionFixedAndRelativeQuantityAvailabilities(allAvailabilities)

  const {
    indexedFixedQuantityAvailabilities,
    fixedQuantityDates
  } = _getIndexedFixedQuantityAvailabilities(fixedQuantityAvailabilities)

  const indexedRelativeQuantityAvailabilitiesByStartDate = _.groupBy(relativeQuantityAvailabilities, 'startDate')
  const indexedRelativeQuantityAvailabilitiesByEndDate = _.groupBy(relativeQuantityAvailabilities, 'endDate')

  let dates = []
  transactions.forEach(transaction => {
    dates.push(transaction.startDate)

    if (transaction.endDate) {
      dates.push(transaction.endDate)
    }
  })

  relativeQuantityAvailabilities.forEach(availability => {
    dates.push(availability.startDate)
    dates.push(availability.endDate)
  })

  dates = dates.concat(fixedQuantityDates)
  dates = _.sortBy(_.uniq(dates))

  let fixedQuantity = defaultQuantity
  let usedQuantity = 0
  let relativeQuantity = 0

  const graphDates = []

  dates.forEach(date => {
    const addUsedQuantity = (indexedTransactionsByStartDate[date] || []).reduce((memo, transaction) => {
      memo += transaction.quantity
      return memo
    }, 0)
    const removeUsedQuantity = (indexedTransactionsByEndDate[date] || []).reduce((memo, transaction) => {
      memo += transaction.quantity
      return memo
    }, 0)

    const addAvailableQuantity = (indexedRelativeQuantityAvailabilitiesByStartDate[date] || []).reduce((memo, availability) => {
      memo += availability.quantity
      return memo
    }, 0)
    const removeAvailableQuantity = (indexedRelativeQuantityAvailabilitiesByEndDate[date] || []).reduce((memo, availability) => {
      memo += availability.quantity
      return memo
    }, 0)

    // if there is a fixed quantity at this date, use it
    // otherwise use the default quantity
    const fixedAvailability = indexedFixedQuantityAvailabilities[date]
    if (typeof fixedAvailability !== 'undefined') {
      fixedQuantity = fixedAvailability ? fixedAvailability.quantity : defaultQuantity
    }

    totalUsedQuantity += addUsedQuantity

    usedQuantity = usedQuantity + addUsedQuantity - removeUsedQuantity
    relativeQuantity = relativeQuantity + addAvailableQuantity - removeAvailableQuantity

    let availableQuantity = fixedQuantity + relativeQuantity

    if (useMaxQuantity) {
      availableQuantity = Math.min(availableQuantity, maxQuantity)
    }

    const displayedAvailableQuantity = Math.max(availableQuantity, 0)

    const graphDate = {
      date,
      usedQuantity,
      availableQuantity: displayedAvailableQuantity
    }

    graphDates.push(graphDate)
  })

  return {
    graphDates,
    defaultQuantity,
    totalUsedQuantity
  }
}

/**
 * @param {Object[]} availabilities
 * @return {Object[]} all availabilities
 */
function _getAvailabilitiesWithRecurringPattern (availabilities) {
  const allAvailabilities = []

  availabilities.forEach(availability => {
    const isRecurring = availability.recurringPattern && availability.recurringTimezone && availability.recurringDuration

    if (isRecurring) {
      const recurringPeriods = computeRecurringPeriods(availability.recurringPattern, {
        startDate: availability.startDate,
        endDate: availability.endDate,
        timezone: availability.recurringTimezone,
        duration: availability.recurringDuration
      })

      recurringPeriods.forEach(period => {
        const obj = Object.assign({}, availability, {
          startDate: period.startDate,
          endDate: period.endDate
        })

        allAvailabilities.push(obj)
      })
    } else {
      allAvailabilities.push(availability)
    }
  })

  return allAvailabilities
}

/**
 * @param {Object[]} availabilities
 * @return {Object} result
 * @return {Object} result.fixedQuantityAvailabilities
 * @return {Object} result.relativeQuantityAvailabilities
 */
function _partitionFixedAndRelativeQuantityAvailabilities (availabilities) {
  const fixedQuantityAvailabilities = []
  const relativeQuantityAvailabilities = []

  availabilities.forEach(availability => {
    const sign = availability.quantity.charAt(0)
    const isSign = ['+', '-'].includes(sign)

    const tmpAvailability = Object.assign({}, availability, {
      quantity: parseInt(availability.quantity, 10)
    })

    if (isSign) {
      relativeQuantityAvailabilities.push(tmpAvailability)
    } else {
      fixedQuantityAvailabilities.push(tmpAvailability)
    }
  })

  return {
    fixedQuantityAvailabilities,
    relativeQuantityAvailabilities
  }
}

/**
 * @param {Object[]} fixedQuantityAvailabilities
 * @return {Object} result
 * @return {Object} result.indexedFixedQuantityAvailabilities
 * @return {Object} result.indexedFixedQuantityAvailabilities[date] - availability that applies at this date
 * @return {String[]} result.fixedQuantityDates
 */
function _getIndexedFixedQuantityAvailabilities (fixedQuantityAvailabilities) {
  const indexedFixedQuantityAvailabilities = {}
  const indexedAddFixedQuantityAvailabilities = {}
  const indexedRemoveFixedQuantityAvailabilities = {}

  let fixedQuantityDates = []

  // group fixed quantity availabilities by date
  fixedQuantityAvailabilities.forEach(availability => {
    if (!indexedAddFixedQuantityAvailabilities[availability.startDate]) {
      indexedAddFixedQuantityAvailabilities[availability.startDate] = [availability]
    } else {
      indexedAddFixedQuantityAvailabilities[availability.startDate].push(availability)
    }
    if (!indexedRemoveFixedQuantityAvailabilities[availability.endDate]) {
      indexedRemoveFixedQuantityAvailabilities[availability.endDate] = [availability]
    } else {
      indexedRemoveFixedQuantityAvailabilities[availability.endDate].push(availability)
    }

    fixedQuantityDates.push(availability.startDate)
    fixedQuantityDates.push(availability.endDate)
  })

  fixedQuantityDates = _.sortBy(_.uniq(fixedQuantityDates))

  let poolFixedQuantityAvailabilities = []

  // for a fixed quantity date, associate it with the right availability (most recent updatedDate)
  fixedQuantityDates.forEach(date => {
    const addAv = indexedAddFixedQuantityAvailabilities[date] || []
    const removeAv = indexedRemoveFixedQuantityAvailabilities[date] || []

    poolFixedQuantityAvailabilities = _.differenceBy(poolFixedQuantityAvailabilities, removeAv, av => av.endDate)
    poolFixedQuantityAvailabilities = poolFixedQuantityAvailabilities.concat(addAv)

    // Reminder: sort method mutates the array
    poolFixedQuantityAvailabilities.sort((a, b) => {
      if (a.updatedDate > b.updatedDate) {
        return -1
      } else if (a.updatedDate < b.updatedDate) {
        return 1
      } else {
        return 0
      }
    })

    indexedFixedQuantityAvailabilities[date] = poolFixedQuantityAvailabilities[0] || null
  })

  return {
    indexedFixedQuantityAvailabilities,
    fixedQuantityDates
  }
}

/**
* @param {Object} availabilityGraph
* @param {Object} newTransaction
* @param {String} newTransaction.startDate
* @param {String} newTransaction.endDate
* @param {Number} newTransaction.quantity
* @return {Object} info
* @return {Boolean} info.isAvailable
* @return {Number} info.remainingQuantity
*/
function getAvailabilityPeriodInfo (availabilityGraph, newTransaction) {
  const { defaultQuantity, graphDates } = availabilityGraph

  let remainingQuantity

  const beforeStartGraphDate = _.last(graphDates.filter(graphDate => graphDate.date <= newTransaction.startDate))

  const overlapGraphDates = graphDates.filter(graphDate => {
    const startDate = beforeStartGraphDate ? beforeStartGraphDate.date : newTransaction.startDate

    let overlapping = startDate <= graphDate.date
    if (newTransaction.endDate) {
      overlapping = overlapping && graphDate.date < newTransaction.endDate
    }
    return overlapping
  })

  if (!overlapGraphDates.length) {
    remainingQuantity = defaultQuantity
  } else {
    remainingQuantity = Math.abs(overlapGraphDates[0].availableQuantity - overlapGraphDates[0].usedQuantity)

    overlapGraphDates.forEach(graphDate => {
      remainingQuantity = Math.min(remainingQuantity, Math.abs(graphDate.availableQuantity - graphDate.usedQuantity))
    })
  }

  return {
    isAvailable: newTransaction.quantity <= remainingQuantity && remainingQuantity > 0,
    remainingQuantity
  }
}

/**
 * Break the availability periods and transactions into chunks to speed up query on availability from database
 * @param {Object} availabilityGraph
 * @param {Object[]} transactions
 * @return {Object} res
 * @return {Object[]} res.chunkAvailabilities
 * @return {Object[]} res.chunkTransactions
 */
function getInternalAvailabilityPeriods (availabilityGraph, transactions = []) {
  const { graphDates } = availabilityGraph

  let allDates = []
  allDates = allDates.concat(graphDates.map(graphDate => graphDate.date))

  transactions.forEach(transaction => {
    if (transaction.startDate) { // we need transaction dates
      allDates.push(transaction.startDate)

      if (transaction.endDate) {
        allDates.push(transaction.endDate)
      }
    }
  })

  allDates = _.sortBy(_.uniq(allDates))

  const availabilityPeriods = getAvailabilityPeriods(availabilityGraph)

  let chunkAvailabilities = []
  let chunkTransactions = []

  availabilityPeriods.forEach(availabilityPeriod => {
    const chunks = _breakIntoDateChunks(availabilityPeriod, allDates)
    chunkAvailabilities = chunkAvailabilities.concat(chunks)
  })

  transactions.forEach(transaction => {
    const chunks = _breakIntoDateChunks(transaction, allDates)
    chunkTransactions = chunkTransactions.concat(chunks)
  })

  return {
    chunkAvailabilities,
    chunkTransactions
  }
}

/**
 * Break date element into smallest period including the provided dates
 * e.g. dateElement = { startDate: '2018-01-01', endDate: '2019-01-01' }
 * dates = ['2018-02-01', '2018-03-01']
 * => result = [
 *   { startDate: '2018-01-01', endDate: '2018-02-01' },
 *   { startDate: '2018-02-01', endDate: '2019-03-01' },
 *   { startDate: '2018-03-01', endDate: '2019-01-01' }
 * ]
 * @param {Object} dateElement - object with `startDate` and `endDate` (which can be `null`)
 * @param {String[]} dates - array of dates
 * @return {Object[]} chunks - will preserve `dateElement` properties (only `startDate` and `endDate` changing)
 */
function _breakIntoDateChunks (dateElement, dates) {
  // use these dates to easily compare dates
  const minDate = '0000-00-00T00:00:00.000Z'
  const maxDate = '9999-12-31T23:59:59.999Z'

  // availability period dates can be null (means -Infinity or Infinity)
  const startDate = dateElement.startDate || minDate
  const endDate = dateElement.endDate || maxDate

  const chunks = []

  // filter dates within the availability period dates
  // TODO: rework this if performance issue encountered
  const innerDates = dates.filter(date => {
    return startDate < date && date < endDate
  })

  if (!innerDates.length) return [dateElement]

  let prevDate = dateElement.startDate

  // for each inner date, break the period to include it
  innerDates.forEach(innerDate => {
    const obj = Object.assign({}, dateElement, {
      startDate: prevDate,
      endDate: innerDate
    })

    prevDate = innerDate

    chunks.push(obj)
  })

  const obj = Object.assign({}, dateElement, {
    startDate: prevDate,
    endDate: dateElement.endDate
  })

  chunks.push(obj)

  return chunks
}

/**
 * Based on the availability graph, compute the availability periods with start and end dates
 * @param {Object} availabilityGraph
 * @return {Object[]} periods
 * @return {String} periods[i].startDate - can be null to express -Infinity
 * @return {String} periods[i].endDate   - can be null to express +Infinity
 * @return {Number} periods[i].quantity
 */
function getAvailabilityPeriods (availabilityGraph) {
  const { defaultQuantity, graphDates } = availabilityGraph

  // use null for period dates
  // -Infinity if startDate and +Infinity if endDate
  const periods = []

  if (!graphDates.length) {
    periods.push({
      startDate: null,
      endDate: null,
      quantity: defaultQuantity
    })
  } else {
    let prevDate = null
    let prevQuantity = defaultQuantity

    graphDates.forEach((graphDate, index) => {
      const {
        date,
        availableQuantity
      } = graphDate

      periods.push({
        startDate: prevDate,
        endDate: date,
        quantity: prevQuantity
      })

      prevDate = date
      prevQuantity = availableQuantity

      // push the last period (from last date to +Infinity)
      if (index === graphDates.length - 1) {
        periods.push({
          startDate: date,
          endDate: null,
          quantity: defaultQuantity
        })
      }
    })
  }

  return periods
}

module.exports = {
  getAvailabilityPeriodGraph,
  getAvailabilityPeriodInfo,

  getInternalAvailabilityPeriods,
  getAvailabilityPeriods
}
