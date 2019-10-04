let requester

function init (server, { middlewares, helpers } = {}) {
  const {
    checkPermissions
  } = middlewares
  const {
    wrapAction,
    populateRequesterParams
  } = helpers

  server.post({
    name: 'signal.create',
    path: '/signal'
  }, checkPermissions([/* For now, no permission is required for single channel signal */], {
    optionalPermissions: [
      'signal:create',
      'signal:create:all'
      // system level permission required to broadcast (no destination)
    ]
  }), wrapAction(async (req, res) => {
    const {
      destination,
      message,
      event
    } = req.body || {}

    const params = populateRequesterParams(req)({
      type: 'stelaceSignal',
      destination,
      message,
      event
    })

    const result = await requester.send(params)
    return result
  }))
}

function start ({ communication }) {
  const { getRequester, COMMUNICATION_ID } = communication

  requester = getRequester({
    name: 'Signal route > Requester',
    namespace: 'signal', // pls refer to service to see why we use namespace as usual key here
    key: `${COMMUNICATION_ID}_signal`
  })
}

function stop () {
  requester.close()
  requester = null
}

module.exports = {
  init,
  start,
  stop
}
