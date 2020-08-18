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
    name: 'category.list',
    path: '/categories'
  }, checkPermissions([
    'category:list:all'
  ]), cache(), wrapAction(async (req, res) => {
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
      'parentId',
    ]

    const payload = _.pick(req.query, fields)

    let params = populateRequesterParams(req)({
      type: 'list'
    })

    params = Object.assign({}, params, payload)

    return requester.send(params)
  }))

  server.get({
    name: 'category.read',
    path: '/categories/:id'
  }, checkPermissions([
    'category:read:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'read',
      categoryId: id
    })

    const result = await requester.send(params)
    return result
  }))

  server.post({
    name: 'category.create',
    path: '/categories'
  }, checkPermissions([
    'category:create:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const {
      name,
      parentId,
      metadata,
      platformData
    } = req.body

    const params = populateRequesterParams(req)({
      type: 'create',
      name,
      parentId,
      metadata,
      platformData
    })

    const result = await requester.send(params)
    return result
  }))

  server.patch({
    name: 'category.update',
    path: '/categories/:id'
  }, checkPermissions([
    'category:edit:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const { id } = req.params
    const {
      name,
      parentId,
      metadata,
      platformData
    } = req.body

    const params = populateRequesterParams(req)({
      type: 'update',
      categoryId: id,
      name,
      parentId,
      metadata,
      platformData
    })

    const result = await requester.send(params)
    return result
  }))

  server.del({
    name: 'category.remove',
    path: '/categories/:id'
  }, checkPermissions([
    'category:remove:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'remove',
      categoryId: id
    })

    const result = await requester.send(params)
    return result
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Category route > Category Requester',
    key: 'category'
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
