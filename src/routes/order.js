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
    name: 'order.preview',
    path: '/orders/preview'
  }, checkPermissions([
    'order:preview',
    'order:preview:all'
  ]), wrapAction(async (req, res) => {
    const fields = [
      'transactionIds',
      'lines',
      'moves'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'preview'
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.get({
    name: 'order.list',
    path: '/orders'
  }, checkPermissions([
    'order:list',
    'order:list:all'
  ]), wrapAction(async (req, res) => {
    const fields = [
      'orderBy',
      'order',
      'page',
      'nbResultsPerPage',

      'id',
      'payerId',
      'receiverId',
      'transactionId'
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
    name: 'order.read',
    path: '/orders/:id'
  }, checkPermissions([
    'order:read',
    'order:read:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'read',
      orderId: id
    })

    const result = await requester.send(params)
    return result
  }))

  server.get({
    name: 'orderLine.read',
    path: '/order-lines/:id'
  }, checkPermissions([
    'orderLine:read',
    'orderLine:read:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'readLine',
      orderLineId: id
    })

    const result = await requester.send(params)
    return result
  }))

  server.get({
    name: 'orderMove.read',
    path: '/order-moves/:id'
  }, checkPermissions([
    'orderMove:read',
    'orderMove:read:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'readMove',
      orderMoveId: id
    })

    const result = await requester.send(params)
    return result
  }))

  server.post({
    name: 'order.create',
    path: '/orders'
  }, checkPermissions([
    'order:create',
    'order:create:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const fields = [
      'transactionIds',
      'lines',
      'moves',
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

  server.post({
    name: 'orderLine.create',
    path: '/order-lines'
  }, checkPermissions([
    'orderLine:create',
    'orderLine:create:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const fields = [
      'orderId',
      'transactionId',
      'reversal',
      'payerId',
      'payerAmount',
      'receiverId',
      'receiverAmount',
      'platformAmount',
      'currency',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'createLine'
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.post({
    name: 'orderMove.create',
    path: '/order-moves'
  }, checkPermissions([
    'orderMove:create',
    'orderMove:create:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const fields = [
      'orderId',
      'transactionId',
      'reversal',
      'payerId',
      'payerAmount',
      'receiverId',
      'receiverAmount',
      'platformAmount',
      'currency',
      'real',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'createMove'
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.patch({
    name: 'order.update',
    path: '/orders/:id'
  }, checkPermissions([
    'order:edit',
    'order:edit:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const orderId = req.params.id
    const fields = [
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'update',
      orderId
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.patch({
    name: 'orderLine.update',
    path: '/order-lines/:id'
  }, checkPermissions([
    'orderLine:edit',
    'orderLine:edit:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const orderLineId = req.params.id
    const fields = [
      'payerId',
      'payerAmount',
      'receiverId',
      'receiverAmount',
      'platformAmount',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'updateLine',
      orderLineId
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.patch({
    name: 'orderMove.update',
    path: '/order-moves/:id'
  }, checkPermissions([
    'orderMove:edit',
    'orderMove:edit:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const orderMoveId = req.params.id
    const fields = [
      'real',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'updateMove',
      orderMoveId
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Order route > Order Requester',
    key: 'order'
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
