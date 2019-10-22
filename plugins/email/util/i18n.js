if (!global.Intl) {
  require('intl')
}

const IntlMessageFormat = require('intl-messageformat')
const momentTimezone = require('moment-timezone')
const memoizeIntlConstructor = require('intl-format-cache').default

const { isDateString } = require('../../../src/util/time')
const { getCurrencyDecimal } = require('../../../src/util/currency')

function formatMessages (messages, values, { locale, currency, timezone }) {
  const transformedValues = transformValues(values)

  let currentKey
  let currentValue

  try {
    return Object.keys(messages).reduce((memo, key) => {
      const message = messages[key]

      currentKey = key
      currentValue = message

      memo[key] = formatMessage(message, transformedValues, { locale, currency, timezone, noTransformValues: true })
      return memo
    }, {})
  } catch (err) {
    err.errorType = 'ICU_FORMAT_ERROR'
    err.invalidKey = currentKey
    err.invalidValue = currentValue
    throw err
  }
}

function formatMessage (message, values, {
  locale,
  currency,
  timezone,
  noTransformValues = false,
  messageTypeChecking = true
} = {}) {
  if (messageTypeChecking) {
    if (typeof message !== 'string') return message
  }

  const formatter = getFormatMessage(message, locale, { currency, timezone })

  let passedValues = values
  if (!noTransformValues) {
    passedValues = transformValues(values)
  }
  return formatter.format(passedValues)
}

function getFormatMessage (message, locale, { currency, timezone }) {
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

  let additionalOptions

  if (timezone) {
    // https://github.com/formatjs/formatjs/tree/master/packages/intl-messageformat#formatters
    // customize formatters to be able to render dates to a specific timezone
    additionalOptions = {
      formatters: {
        getNumberFormat: memoizeIntlConstructor(Intl.NumberFormat),
        getPluralRules: memoizeIntlConstructor(Intl.PluralRules),

        getDateTimeFormat (locales, intlOptions) {
          return {
            format (date) {
              if (!(date instanceof Date)) throw new Error('Invalid valid date passed to format')

              const zone = momentTimezone.tz.zone(timezone)
              if (!zone) throw new Error('Invalid timezone')

              const clonedDate = new Date(date.getTime())
              const fromOffset = clonedDate.getTimezoneOffset()
              const toOffset = zone.parse(clonedDate)

              const newDate = new Date(clonedDate.getTime() - (toOffset - fromOffset) * 60 * 1000)
              return new Intl.DateTimeFormat(locales, intlOptions).format(newDate)
            }
          }
        }
      }
    }
  }

  return new IntlMessageFormat(message, locale, customFormats, additionalOptions)
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
