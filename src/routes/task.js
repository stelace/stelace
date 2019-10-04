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
    name: 'task.list',
    path: '/tasks'
  }, checkPermissions([
    'task:list:all'
  ]), wrapAction(async (req, res) => {
    const fields = [
      'orderBy',
      'order',
      'page',
      'nbResultsPerPage',

      'id',
      'eventType',
      'eventObjectId',
      'active'
    ]

    const payload = _.pick(req.query, fields)

    let params = populateRequesterParams(req)({
      type: 'list'
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.get({
    name: 'task.read',
    path: '/tasks/:id'
  }, checkPermissions([
    'task:read:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'read',
      taskId: id
    })

    const result = await requester.send(params)
    return result
  }))

  server.post({
    name: 'task.create',
    path: '/tasks'
  }, checkPermissions([
    'task:create:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const fields = [
      'executionDate',
      'recurringPattern',
      'recurringTimezone',
      'eventType',
      'eventMetadata',
      'eventObjectId',
      'active',
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
    name: 'task.update',
    path: '/tasks/:id'
  }, checkPermissions([
    'task:edit:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const { id } = req.params

    const fields = [
      'executionDate',
      'recurringPattern',
      'recurringTimezone',
      'eventType',
      'eventMetadata',
      'eventObjectId',
      'active',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'update',
      taskId: id
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.del({
    name: 'task.remove',
    path: '/tasks/:id'
  }, checkPermissions([
    'task:remove:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'remove',
      taskId: id
    })

    const result = await requester.send(params)
    return result
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Tasks route > Task Requester',
    key: 'task'
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
