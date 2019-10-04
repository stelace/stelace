const isoCurrencies = require('mobitel-iso-4217-currencies')

function isValidCurrency (currency) {
  return isoCurrencies.validate(currency)
}

function getISOAmount (amount, currency) {
  const obj = isoCurrencies.get(currency)
  if (!obj) {
    throw new Error('Invalid currency')
  }

  return Math.floor(amount * Math.pow(10, obj.minor))
}

function getStandardAmount (amount, currency) {
  const obj = isoCurrencies.get(currency)
  if (!obj) {
    throw new Error('Invalid currency')
  }

  return amount / Math.pow(10, obj.minor)
}

function getCurrencyDecimal (currency) {
  const obj = isoCurrencies.get(currency)
  if (!obj) {
    throw new Error('Invalid currency')
  }

  return obj.minor
}

module.exports = {

  isValidCurrency,
  getISOAmount,
  getStandardAmount,
  getCurrencyDecimal

}
