const _ = require('lodash')

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
    name: 'batch.create',
    path: '/batch'
  }, checkPermissions([]), wrapAction(async (req, res) => {
    const fields = [
      'objectType',
      'method',
      'objects'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'create'
    })

    params = Object.assign({}, params, payload)

    // We need to pass request headers to every single request
    params.rawHeaders = req.headers

    const result = await requester.send(params)
    return result
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Batch route | Batch Requester',
    key: 'batch'
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
