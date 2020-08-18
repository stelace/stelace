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
    name: 'role.list',
    path: '/roles'
  }, checkPermissions([
    'role:list:all'
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
    ]

    const payload = _.pick(req.query, fields)

    let params = populateRequesterParams(req)({
      type: 'list'
    })

    params = Object.assign({}, params, payload)

    return requester.send(params)
  }))

  server.get({
    name: 'role.read',
    path: '/roles/:id'
  }, checkPermissions([
    'role:read:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'read',
      roleId: id
    })

    const result = await requester.send(params)
    return result
  }))

  server.post({
    name: 'role.create',
    path: '/roles'
  }, checkPermissions([
    'role:create:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const fields = [
      'name',
      'value',
      'parentId',
      'permissions',
      'readNamespaces',
      'editNamespaces',
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
    name: 'role.update',
    path: '/roles/:id'
  }, checkPermissions([
    'role:edit:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const { id } = req.params

    const fields = [
      'name',
      'parentId',
      'permissions',
      'readNamespaces',
      'editNamespaces',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'update',
      roleId: id
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.del({
    name: 'role.remove',
    path: '/roles/:id'
  }, checkPermissions([
    'role:remove:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'remove',
      roleId: id
    })

    const result = await requester.send(params)
    return result
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Roles route > Role Requester',
    key: 'role'
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
