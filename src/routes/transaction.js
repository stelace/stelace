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
    name: 'transaction.list',
    path: '/transactions'
  }, checkPermissions([
    'transaction:list',
    'transaction:list:all'
  ]), wrapAction(async (req, res) => {
    const fields = [
      'orderBy',
      'order',
      'nbResultsPerPage',

      // offset pagination
      'page',

      // cursor pagination
      'startingAfter',
      'endingBefore',

      'id',
      'createdDate',
      'updatedDate',
      'assetId',
      'assetTypeId',
      'ownerId',
      'takerId',
      'value',
      'ownerAmount',
      'takerAmount',
      'platformAmount'
    ]

    const payload = _.pick(req.query, fields)

    let params = populateRequesterParams(req)({
      type: 'list'
    })

    params = Object.assign({}, params, payload)

    return requester.send(params)
  }))

  server.get({
    name: 'transaction.read',
    path: '/transactions/:id'
  }, checkPermissions([
    'transaction:read',
    'transaction:read:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'read',
      transactionId: id
    })

    return requester.send(params)
  }))

  server.post({
    name: 'transaction.preview',
    path: '/transactions/preview'
  }, checkPermissions([
    'transaction:preview:all'
  ], {
    checkData: true,
    optionalPermissions: [
      'transaction:config:all'
    ]
  }), wrapAction(async (req, res) => {
    const fields = [
      'assetId',
      'startDate',
      'endDate',
      'duration',
      'quantity',
      'value',
      'ownerAmount',
      'takerAmount',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'preview'
    })

    params = Object.assign({}, params, payload)

    return requester.send(params)
  }))

  server.post({
    name: 'transaction.create',
    path: '/transactions'
  }, checkPermissions([
    'transaction:create',
    'transaction:create:all'
  ], {
    checkData: true,
    optionalPermissions: [
      'transaction:config:all'
    ]
  }), wrapAction(async (req, res) => {
    const fields = [
      'assetId',
      'startDate',
      'endDate',
      'duration',
      'quantity',
      'value',
      'ownerAmount',
      'takerAmount',
      'takerId',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'create'
    })

    params = Object.assign({}, params, payload)

    return requester.send(params)
  }))

  server.patch({
    name: 'transaction.update',
    path: '/transactions/:id'
  }, checkPermissions([
    'transaction:edit',
    'transaction:edit:all'
  ], {
    checkData: true,
    optionalPermissions: [
      'transaction:config:all'
    ]
  }), wrapAction(async (req, res) => {
    const transactionId = req.params.id
    const fields = [
      'assetId',
      'startDate',
      'endDate',
      'duration',
      'quantity',
      'value',
      'ownerAmount',
      'takerAmount',
      'status',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'update',
      transactionId
    })

    params = Object.assign({}, params, payload)

    return requester.send(params)
  }))

  server.post({
    name: 'transaction.createTransition',
    path: '/transactions/:id/transitions'
  }, checkPermissions([
    'transaction:transition',
    'transaction:transition:all'
  ]), wrapAction(async (req, res) => {
    const transactionId = req.params.id

    const fields = [
      'name',
      'data'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'createTransition',
      transactionId
    })

    params = Object.assign({}, params, payload)

    return requester.send(params)
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Transaction route > Transaction Requester',
    key: 'transaction'
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
