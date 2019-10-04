/* eslint-disable */

const serializeError = require('serialize-error')

const PROD = process.env.NODE_ENV === 'production'

function initErrors () {
  if (!('toJSON' in Error.prototype)) {
    Object.defineProperty(Error.prototype, 'toJSON', {
      value: function () {
        const alt = serializeError(this)

        alt.name = alt.name || 'Internal Server Error'
        alt.expose = this.expose
        alt.statusCode = this.statusCode

        return alt
      },
      configurable: true,
      writable: true
    })
  }
}

module.exports = {
  initErrors
}
