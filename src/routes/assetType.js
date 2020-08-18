const _ = require('lodash')

let requester

function init (server, { middlewares, helpers } = {}) {
  const {
    cache,
    checkPermissions
  } = middlewares
  const {
    wrapAction,
    populateRequesterParams
  } = helpers

  server.get({
    name: 'assetType.list',
    path: '/asset-types'
  }, cache(), checkPermissions([
    'assetType:list:all'
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
      'isDefault',
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
    name: 'assetType.read',
    path: '/asset-types/:id'
  }, checkPermissions([
    'assetType:read:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'read',
      assetTypeId: id
    })

    const result = await requester.send(params)
    return result
  }))

  server.post({
    name: 'assetType.create',
    path: '/asset-types'
  }, checkPermissions([
    'assetType:create:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const fields = [
      'name',
      'timeBased',
      'infiniteStock',
      'pricing',
      'timing',
      'unavailableWhen',
      'transactionProcess',
      'namespaces',
      'isDefault',
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
    name: 'assetType.update',
    path: '/asset-types/:id'
  }, checkPermissions([
    'assetType:edit:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const assetTypeId = req.params.id
    const fields = [
      'name',
      'timeBased',
      'infiniteStock',
      'pricing',
      'timing',
      'unavailableWhen',
      'transactionProcess',
      'namespaces',
      'isDefault',
      'active',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'update',
      assetTypeId
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.del({
    name: 'assetType.remove',
    path: '/asset-types/:id'
  }, checkPermissions([
    'assetType:remove:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'remove',
      assetTypeId: id
    })

    const result = await requester.send(params)
    return result
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Asset type route > Asset type Requester',
    key: 'asset-type'
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
