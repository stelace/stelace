const Cote = require('cote')
const apm = require('elastic-apm-node')
const { isActive: isApmActive } = require('../../apm')
const { logError } = require('../../logger')
const { getListPermissions } = require('../permissions')

class CustomRequester extends Cote.Requester {
  // Inherit send method to log the processing duration
  async send (...args) {
    const sendParams = args[0] || {}

    const name = `Requester send: ${this.advertisement.name} | type: ${sendParams.type}`
    const apmSpan = apm.startSpan(name)

    // used to link to the source APM transaction across network (see custom responder)
    if (apm.currentTransaction) {
      sendParams._apmTraceparent = apm.currentTransaction.traceparent
    }

    try {
      const result = await super.send(...args)
      return result
    } finally {
      if (isApmActive && !apmSpan) {
        if (!apm.currentTransaction) {
          logError(new Error(`No APM transaction available in requester "${name}"`))
        } else {
          logError(new Error(`Empty apm span in requester "${name}"`))
        }
      }

      // check the existence of apm span just in case (should always be defined)
      apmSpan && apmSpan.end()
    }
  }

  communicate (req = {}) {
    const requestContext = getRequestContext(req)

    return (requestParams) => {
      return this.send(Object.assign({}, requestContext, requestParams))
    }
  }
}

function getRequestContext (req) {
  return {
    _readNamespaces: ['*'],
    _editNamespaces: ['*'],
    _requestId: req._requestId,
    platformId: req.platformId,
    env: req.env,
    _systemHash: req._systemHash,

    // Granting all existing permissions to ease maintenance

    // Stelace services can communicate with each other thanks to `customRequester.communicate()`.
    // However, even if the request is considered as a system request,
    // some permissions may protect service logic.
    // By automatically granting all permissions, should the permissions needed by a service change,
    // there will be no need to update permissions at every location calling this service.
    _matchedPermissions: getListPermissions().reduce((o, p) => {
      o[p] = true
      return o
    }, {})
  }
}

module.exports = CustomRequester
