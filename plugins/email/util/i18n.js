if (!global.Intl) {
  require('intl')
}

const IntlMessageFormat = require('intl-messageformat')

const { isDateString } = require('../../../src/util/time')
const { getCurrencyDecimal } = require('../../../src/util/currency')

function formatMessages (messages, values, { locale, currency }) {
  const transformedValues = transformValues(values)

  let currentKey
  let currentValue

  try {
    return Object.keys(messages).reduce((memo, key) => {
      const message = messages[key]

      currentKey = key
      currentValue = message

      memo[key] = formatMessage(message, transformedValues, { locale, currency, noTransformValues: true })
      return memo
    }, {})
  } catch (err) {
    err.errorType = 'ICU_FORMAT_ERROR'
    err.invalidKey = currentKey
    err.invalidValue = currentValue
    throw err
  }
}

function formatMessage (message, values, { locale, currency, noTransformValues = false, messageTypeChecking = true } = {}) {
  if (messageTypeChecking) {
    if (typeof message !== 'string') return message
  }

  const formatter = getFormatMessage(message, locale, { currency })

  let passedValues = values
  if (!noTransformValues) {
    passedValues = transformValues(values)
  }
  return formatter.format(passedValues)
}

function getFormatMessage (message, locale, { currency }) {
  let numberFormat

  if (currency) {
    const nbDecimals = getCurrencyDecimal(currency)

    numberFormat = {
      currency: {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: nbDecimals
      }
    }
  }

  const customFormats = {}
  if (numberFormat) {
    customFormats.number = numberFormat
  }

  return new IntlMessageFormat(message, locale, customFormats)
}

function transformValue (value) {
  if (typeof value === 'string') {
    const isDate = isDateString(value, { onlyDate: false }) || isDateString(value, { onlyDate: true })
    if (isDate) {
      return new Date(value)
    } else {
      return value
    }
  } else {
    return value
  }
}

function transformValues (values = {}) {
  return Object.keys(values).reduce((memo, key) => {
    const value = values[key]
    memo[key] = transformValue(value)
    return memo
  }, {})
}

module.exports = {
  formatMessages,
  formatMessage,
  getFormatMessage,
  transformValues
}
