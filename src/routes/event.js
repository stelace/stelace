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

  server.get({
    name: 'event.getStats',
    path: '/events/stats'
  }, checkPermissions([
    'event:stats:all'
  ]), wrapAction(async (req, res) => {
    const fields = [
      'orderBy',
      'order',
      'page',
      'nbResultsPerPage',

      'field',
      'groupBy',
      'avgPrecision',

      'id',
      // 'type' // parsing manually below to avoid conflict with côte requester 'type'
      'createdDate',
      'objectType',
      'objectId',
      'emitter',
      'emitterId',
      'object',
      'metadata',
    ]

    const payload = _.pick(req.query, fields)

    let params = populateRequesterParams(req)({
      type: 'getStats'
    })

    params = Object.assign({}, params, payload)

    if (req.query) params.eventType = req.query.type

    return requester.send(params)
  }))

  server.get({
    name: 'event.list',
    path: '/events'
  }, checkPermissions([
    'event:list:all'
  ]), wrapAction(async (req, res) => {
    const fields = [
      'orderBy',
      'order',
      'page',
      'nbResultsPerPage',

      'id',
      // 'type' // parsing manually below to avoid conflict with côte requester 'type'
      'createdDate',
      'objectType',
      'objectId',
      'emitter',
      'emitterId',
      'object',
      'metadata',
    ]

    const payload = _.pick(req.query, fields)

    let params = populateRequesterParams(req)({
      type: 'list'
    })

    params = Object.assign({}, params, payload)

    if (req.query) params.eventType = req.query.type

    return requester.send(params)
  }))

  server.get({
    name: 'event.read',
    path: '/events/:id'
  }, checkPermissions([
    'event:read:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'read',
      eventId: id
    })

    const result = await requester.send(params)
    return result
  }))

  server.post({
    name: 'event.create',
    path: '/events'
  }, checkPermissions([
    'event:create:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const fields = [
      'objectId',
      'emitterId',
      'metadata'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'create'
    })

    params = Object.assign({}, params, payload)

    params.eventType = req.body.type

    const result = await requester.send(params)
    return result
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Event route > Event Requester',
    key: 'event'
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
