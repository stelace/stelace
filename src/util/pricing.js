module.exports = {

  roundPrice,
  roundPriceWithCurrency,

  getDurationPrice,
  getPriceAfterFees,
  getDutyFreePrice,

  isValidCustomDurationConfig

}

const _ = require('lodash')

const {
  roundDecimal
} = require('./math')

const {
  getCurrencyDecimal,
  isValidCurrency
} = require('./currency')

function roundPrice (price) {
  if (typeof price === 'string') {
    price = parseFloat(price)
  }

  if (price < 3) {
    return roundDecimal(price, 1)
  } else {
    return Math.floor(price)
  }
}

function roundPriceWithCurrency (price, currency, nbRoundingDecimals = 0) {
  let nbCurrencyDecimals = 2
  if (currency && isValidCurrency(currency)) {
    nbCurrencyDecimals = getCurrencyDecimal(currency)
  }

  return roundDecimal(price, Math.min(nbCurrencyDecimals, nbRoundingDecimals))
}

/**
* Get price depending on duration
* @param {Number} nbTimeUnits
* @param {Number} timeUnitPrice
* @param {Object} customConfig
* @param {Boolean} [array = false] - if true, get array of prices
* @return {Number|Number[]} price or array of prices
*/
function getDurationPrice ({ nbTimeUnits, timeUnitPrice, customConfig, array = false }) {
  if (typeof nbTimeUnits !== 'number' || typeof timeUnitPrice !== 'number') {
    throw new Error('Missing parameters')
  }

  let iterator

  if (customConfig && customConfig.duration) {
    iterator = _getCustomDurationPriceIterator({ customConfig })
  } else {
    iterator = _getDefaultDurationPriceIterator({ timeUnitPrice })
  }

  const prices = []

  _.times(nbTimeUnits, () => {
    let price = iterator.next().value
    price = roundPrice(price)
    price = (price >= 0 ? price : 0)
    prices.push(price)
  })

  if (array) {
    return prices
  } else {
    return _.last(prices)
  }
}

function _getDefaultDurationPriceIterator ({ timeUnitPrice }) {
  const iterator = {
    _nbUnits: 1,
    _timeUnitPrice: timeUnitPrice
  }

  iterator.next = () => {
    const value = iterator._nbUnits * iterator._timeUnitPrice
    iterator._nbUnits += 1

    return {
      value,
      done: false
    }
  }

  return iterator
}

function _getCustomDurationPriceIterator ({ customConfig }) {
  if (!customConfig || !customConfig.duration) {
    throw new Error('Missing duration config')
  }

  const config = customConfig.duration

  if (!isValidCustomDurationConfig(config)) {
    throw new Error('Invalid custom duration config')
  }

  const PriceIterator = function (breakpoints) {
    let index = 0
    let currentNbUnits = 1
    let price = 0
    let currentBreakpoint
    let nextBreakpoint

    const setBreakpointState = () => {
      currentBreakpoint = breakpoints[index]
      nextBreakpoint = breakpoints[index + 1]
    }

    setBreakpointState()

    const next = function () {
      if (nextBreakpoint && nextBreakpoint.nbUnits === currentNbUnits) {
        index += 1
        setBreakpointState()
      }

      price += currentBreakpoint.price
      currentNbUnits += 1

      return {
        value: price,
        done: false
      }
    }

    return { next }
  }

  return new PriceIterator(config.breakpoints)
}

/**
* All amounts are rounded to nearest 1/10 unit
* if the currency supports 1/10 unit or if there is no currency
*
* @param  {object} args
* @param  {number} args.ownerPrice
* @param  {string} args.currency
* @param  {number} [args.ownerFeesPercent = 0]      do not mix fees and fees percent (use one of them)
* @param  {number} [args.takerFeesPercent = 0]      owner and takerFeesPercent must be used together
* @param  {number} [args.ownerFees = 0]
* @param  {number} [args.takerFees = 0]             owner and takerFees must be used together
*
* @return {object} obj
* @return {number} obj.ownerNetIncome
* @return {number} obj.takerPrice
* @return {number} obj.ownerFees
* @return {number} obj.ownerFeesPercent
* @return {number} obj.takerFees
* @return {number} obj.takerFeesPercent
*/
function getPriceAfterFees (args) {
  let useFeesPercent = typeof args.ownerFeesPercent !== 'undefined' &&
    typeof args.takerFeesPercent !== 'undefined'

  const useFees = typeof args.ownerFees !== 'undefined' &&
    typeof args.takerFees !== 'undefined'

  if (useFeesPercent && useFees) {
    throw new Error('No fees mix expected')
  }

  if (!useFeesPercent && !useFees) {
    useFeesPercent = true
  }

  const ownerPrice = args.ownerPrice
  const currency = args.currency

  let takerPrice
  let ownerFeesPercent
  let takerFeesPercent
  let ownerFees
  let takerFees

  // wrap all arithmetic operations because of floating precision
  if (useFees) {
    ownerFees = args.ownerFees || 0
    takerFees = args.takerFees || 0

    ownerFeesPercent = getFeesPercent(ownerFees, ownerPrice)
    takerPrice = _roundPrice(ownerPrice + takerFees)
    takerFeesPercent = getFeesPercent(takerFees, takerPrice)
  } else { // useFeesPercent
    ownerFeesPercent = args.ownerFeesPercent || 0
    takerFeesPercent = args.takerFeesPercent || 0

    const ownerFeesRate = ownerFeesPercent / 100
    const takerFeesRate = takerFeesPercent / 100

    ownerFees = _roundPrice(ownerFeesRate * ownerPrice)
    takerFees = _roundPrice(takerFeesRate * ownerPrice)
    takerPrice = _roundPrice(ownerPrice + takerFees)
  }

  const ownerNetIncome = _roundPrice(ownerPrice - ownerFees)

  return {
    ownerNetIncome,
    takerPrice,
    ownerFeesPercent,
    takerFeesPercent,
    ownerFees,
    takerFees
  }

  function getFeesPercent (fees, price) {
    if (price === 0) return 0
    return Math.round(fees * 100 / price)
  }

  function _roundPrice (amount) {
    return roundPriceWithCurrency(amount, currency, 1)
  }
}

function getDutyFreePrice (taxedPrice, taxPercent) {
  var dutyFreePrice = roundDecimal(taxedPrice / (1 + taxPercent / 100), 2)
  var taxValue = roundDecimal(taxedPrice - dutyFreePrice, 2)

  return {
    dutyFreePrice: dutyFreePrice,
    taxValue: taxValue
  }
}

/**
* Check valid custom duration config
* @param  {Object}   config
* @param  {Object[]} config.breakpoints
* @param  {Number}   config.breakpoints.nbUnits
* @param  {Number}   config.breakpoints.price
* @return {Boolean}
*/
function isValidCustomDurationConfig (config) {
  if (typeof config !== 'object' || !config ||
    !_.isArray(config.breakpoints) || config.breakpoints.length < 2
  ) {
    return false
  }

  return _.reduce(config.breakpoints, (memo, breakpoint, index) => {
    if (!memo) {
      return memo
    }

    if (!isCustomConfigBreakpoint(breakpoint)) {
      return false
    }

    // the first breakpoint must be unit one
    if (index === 0 && breakpoint.nbUnits !== 1) {
      return false
    } else if (breakpoint.price < 0) {
      return false
    }

    return memo
  }, true)
}

function isCustomConfigBreakpoint (breakpoint) {
  return typeof breakpoint === 'object' &&
    typeof breakpoint.nbUnits === 'number' &&
    typeof breakpoint.price === 'number' &&
    breakpoint &&
    breakpoint.nbUnits > 0 &&
    breakpoint.price >= 0
}
