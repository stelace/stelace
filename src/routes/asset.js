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
    name: 'asset.list',
    path: '/assets'
  }, checkPermissions([
    'asset:list',
    'asset:list:all'
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
      'ownerId',
      'categoryId',
      'assetTypeId',
      'validated',
      'active',
      'quantity',
      'price'
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
    name: 'asset.read',
    path: '/assets/:id'
  }, checkPermissions([
    'asset:read',
    'asset:read:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'read',
      assetId: id
    })

    const result = await requester.send(params)
    return result
  }))

  server.post({
    name: 'asset.create',
    path: '/assets'
  }, checkPermissions([
    'asset:create',
    'asset:create:all'
  ], { checkData: true, editProtectedNamespaces: true }), wrapAction(async (req, res) => {
    const fields = [
      'name',
      'ownerId',
      'description',
      'categoryId',
      'validated',
      'active',
      'locations',
      'assetTypeId',
      'quantity',
      'price',
      'currency',
      'customAttributes',
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
    name: 'asset.update',
    path: '/assets/:id'
  }, checkPermissions([
    'asset:edit',
    'asset:edit:all'
  ], { checkData: true, editProtectedNamespaces: true }), wrapAction(async (req, res) => {
    const assetId = req.params.id
    const fields = [
      'name',
      'description',
      'categoryId',
      'validated',
      'active',
      'locations',
      'assetTypeId',
      'quantity',
      'price',
      'currency',
      'customAttributes',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'update',
      assetId
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.del({
    name: 'asset.remove',
    path: '/assets/:id'
  }, checkPermissions([
    'asset:remove',
    'asset:remove:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'remove',
      assetId: id
    })

    const result = await requester.send(params)
    return result
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Asset route > Asset Requester',
    key: 'asset'
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
