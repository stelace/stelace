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
    name: 'webhook.list',
    path: '/webhooks'
  }, checkPermissions([
    'webhook:list:all'
  ]), wrapAction(async (req, res) => {
    const fields = [
      'orderBy',
      'order',
      'nbResultsPerPage',

      // cursor pagination
      'startingAfter',
      'endingBefore',

      'id',
      'createdDate',
      'updatedDate',
      'event',
      'active',
    ]

    const payload = _.pick(req.query, fields)

    let params = populateRequesterParams(req)({
      type: 'list'
    })

    params = Object.assign({}, params, payload)

    return requester.send(params)
  }))

  server.get({
    name: 'webhook.read',
    path: '/webhooks/:id'
  }, checkPermissions([
    'webhook:read:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params
    const fields = [
      'logs'
    ]
    const payload = _.pick(req.query, fields)

    let params = populateRequesterParams(req)({
      type: 'read',
      webhookId: id
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.post({
    name: 'webhook.create',
    path: '/webhooks'
  }, checkPermissions([
    'webhook:create:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const fields = [
      'name',
      'targetUrl',
      'event',
      'apiVersion',
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
    name: 'webhook.update',
    path: '/webhooks/:id'
  }, checkPermissions([
    'webhook:edit:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const webhookId = req.params.id
    const fields = [
      'name',
      'targetUrl',
      'event',
      'active',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'update',
      webhookId
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.del({
    name: 'webhook.remove',
    path: '/webhooks/:id'
  }, checkPermissions([
    'webhook:remove:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'remove',
      webhookId: id
    })

    const result = await requester.send(params)
    return result
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Webhook route > Webhook Requester',
    key: 'webhook'
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
