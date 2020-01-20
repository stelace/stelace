const Cote = require('cote')
const apm = require('elastic-apm-node')

const {
  addRequestContext,
  getUserContextFromRequest,
  getCustomContextFromRequest,
  getLabelsFromRequest
} = require('../../server/apm')

const { logError } = require('../../server/logger')

class CustomResponder extends Cote.Responder {
  // Inherit on method to log the processing duration
  on (type, handler) {
    const name = `Responder: ${this.advertisement.name} | type: ${type}`

    const newHandler = async function (...args) {
      const receivedParams = args[0] || {}

      const { platformId, env } = receivedParams

      // used to link to the source APM transaction across network (see custom requester)
      const traceparent = receivedParams._apmTraceparent

      apm.startTransaction(name, 'custom', {
        childOf: traceparent
      })

      addRequestContext(apm, receivedParams)

      try {
        const result = await handler(...args)
        return result
      } catch (err) {
        // APM captures the error stack if the error object is instance of Error
        // The Error stack is lost after Côte.js networking
        logError(err, {
          platformId,
          env,
          user: getUserContextFromRequest(receivedParams),
          custom: getCustomContextFromRequest(receivedParams),
          labels: getLabelsFromRequest(receivedParams),
          enableRoarr: false, // no need to log via Roarr because it's only a capture error problem for APM
          message: err.message
        })
        throw err
      } finally {
        apm.endTransaction()
      }
    }

    return super.on(type, newHandler)
  }
}

module.exports = CustomResponder
