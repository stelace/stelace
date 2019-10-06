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
    name: 'user.checkAvailability',
    path: '/users/check-availability'
  }, checkPermissions([
    'user:list:all'
  ]), wrapAction(async (req, res) => {
    const fields = [
      'username'
    ]

    const payload = _.pick(req.query, fields)

    let params = populateRequesterParams(req)({
      type: 'checkAvailability'
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.get({
    name: 'user.list',
    path: '/users'
  }, checkPermissions([
    'user:list:all'
  ]), wrapAction(async (req, res) => {
    const fields = [
      'orderBy',
      'order',
      'page',
      'nbResultsPerPage',

      'id',
      'createdDate',
      'updatedDate',
      'query',
      'userOrganizationId'
    ]

    const payload = _.pick(req.query, fields)

    let params = populateRequesterParams(req)({
      type: 'list'
    })

    params = Object.assign({}, params, payload)

    params.userType = req.query.type

    const result = await requester.send(params)
    return result
  }))

  server.get({
    name: 'user.read',
    path: '/users/:id'
  }, checkPermissions([
    'user:read',
    'user:read:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'read',
      userId: id
    })

    const result = await requester.send(params)
    return result
  }))

  server.post({
    name: 'user.create',
    path: '/users'
  }, checkPermissions([
    'user:create',
    'user:create:all',
    'organization:create',
    'organization:create:all'
  ], {
    optionalCheck: true,
    checkData: true,
    editProtectedNamespaces: true,
    optionalPermissions: ['user:config:all']
  }), wrapAction(async (req, res) => {
    const fields = [
      'username',
      'password',
      'displayName',
      'firstname',
      'lastname',
      'email',
      'description',
      'roles',
      'organizations',
      'orgOwnerId',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'create'
    })

    params = Object.assign({}, params, payload)

    // cannot set the type because it used by cote
    if (req.body.type) {
      params.userType = req.body.type
    }

    const result = await requester.send(params)
    return result
  }))

  server.patch({
    name: 'user.update',
    path: '/users/:id'
  }, checkPermissions([
    'user:edit',
    'user:edit:all'
  ], {
    checkData: true,
    editProtectedNamespaces: true,
    optionalPermissions: ['user:config:all']
  }), wrapAction(async (req, res) => {
    const userId = req.params.id
    const fields = [
      'username',
      'displayName',
      'firstname',
      'lastname',
      'email',
      'description',
      'roles',
      'orgOwnerId',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'update',
      userId
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.del({
    name: 'user.remove',
    path: '/users/:id'
  }, checkPermissions([
    'user:remove',
    'user:remove:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'remove',
      userId: id
    })

    const result = await requester.send(params)
    return result
  }))

  // DEPRECATED:START prefer put verb since here we update rights or add an org to user organizations
  server.patch({
    name: 'user.updateOrganization',
    path: '/users/:id/organizations/:organizationId'
  }, wrapAction(async (req, res) => {
    const userId = req.params.id
    const organizationId = req.params.organizationId
    const fields = [
      'roles'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'joinOrganizationOrUpdateRights',
      userId,
      organizationId,
      req: serializeObjectReq(req) // exceptionally pass `req` as parameters because we need it in service
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))
  // DEPRECATED:END
  server.put({
    name: 'user.joinOrganizationOrUpdateRights',
    path: '/users/:id/organizations/:organizationId'
  }, wrapAction(async (req, res) => {
    const userId = req.params.id
    const organizationId = req.params.organizationId
    const fields = ['roles']

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'joinOrganizationOrUpdateRights',
      userId,
      organizationId,
      req: serializeObjectReq(req) // exceptionally pass `req` as parameters because we need it in service
    })

    params = Object.assign({}, params, payload)
    return requester.send(params)
  }))

  server.del({
    name: 'user.removeFromOrganization',
    path: '/users/:id/organizations/:organizationId'
  }, wrapAction(async (req, res) => {
    const userId = req.params.id
    const organizationId = req.params.organizationId

    const params = populateRequesterParams(req)({
      type: 'removeFromOrganization',
      userId,
      organizationId,
      req: serializeObjectReq(req) // exceptionally pass `req` as parameters because we need it in service
    })

    const result = await requester.send(params)
    return result
  }))
}

function serializeObjectReq (req) {
  return _.pick(req, [
    'authorization',
    'headers',
    'auth',
    'platformId',
    'env',
    'body',

    '_plan',
    '_systemHash'
  ])
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'User route > User Requester',
    key: 'user'
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
