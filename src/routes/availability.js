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
    name: 'availability.getGraph',
    path: '/availabilities/graph'
  }, checkPermissions([
    'availability:list',
    'availability:list:all'
  ]), wrapAction(async (req, res) => {
    const fields = [
      'assetId'
    ]

    const payload = _.pick(req.query, fields)

    let params = populateRequesterParams(req)({
      type: 'getGraph'
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.get({
    name: 'availability.list',
    path: '/availabilities'
  }, checkPermissions([
    'availability:list',
    'availability:list:all'
  ]), wrapAction(async (req, res) => {
    const fields = [
      'orderBy',
      'order',
      'page',
      'nbResultsPerPage',

      'assetId'
    ]

    const payload = _.pick(req.query, fields)

    let params = populateRequesterParams(req)({
      type: 'list'
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.post({
    name: 'availability.create',
    path: '/availabilities'
  }, checkPermissions([
    'availability:create',
    'availability:create:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const fields = [
      'assetId',
      'startDate',
      'endDate',
      'quantity',
      'recurringPattern',
      'recurringTimezone',
      'recurringDuration',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'create'
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.patch({
    name: 'availability.update',
    path: '/availabilities/:id'
  }, checkPermissions([
    'availability:edit',
    'availability:edit:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const { id } = req.params

    const fields = [
      'startDate',
      'endDate',
      'quantity',
      'recurringPattern',
      'recurringTimezone',
      'recurringDuration',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'update',
      availabilityId: id
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.del({
    name: 'availability.remove',
    path: '/availabilities/:id'
  }, checkPermissions([
    'availability:remove',
    'availability:remove:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'remove',
      availabilityId: id
    })

    const result = await requester.send(params)
    return result
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Availability route > Availability Requester',
    key: 'availability'
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
