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
    name: 'apiKey.list',
    path: '/api-keys'
  }, checkPermissions([
    'apiKey:list:all'
  ], {
    optionalPermissions: [ // needed for reveal
      'apiKey:create:all',
      'apiKey:edit:all'
    ]
  }), wrapAction(async (req, res) => {
    const fields = [
      'orderBy',
      'order',
      'page',
      'nbResultsPerPage',

      'id',
      'createdDate',
      'updatedDate',
      'reveal'
    ]

    const payload = _.pick(req.query, fields)

    let params = populateRequesterParams(req)({
      type: 'list'
    })

    params = Object.assign({}, params, payload)

    // cannot set the type because it used by cote
    if (req.query.type) {
      params.apiKeyType = req.query.type
    }

    const result = await requester.send(params)
    return result
  }))

  server.get({
    name: 'apiKey.read',
    path: '/api-keys/:id'
  }, checkPermissions([
    'apiKey:read',
    'apiKey:read:all'
  ], {
    optionalPermissions: [ // needed for reveal
      'apiKey:create:all',
      'apiKey:edit:all'
    ]
  }), wrapAction(async (req, res) => {
    const { id } = req.params

    let reveal
    if (req.query) {
      reveal = req.query.reveal
    }

    const params = populateRequesterParams(req)({
      type: 'read',
      apiKeyId: id,
      reveal
    })

    const result = await requester.send(params)
    return result
  }))

  server.post({
    name: 'apiKey.create',
    path: '/api-keys'
  }, checkPermissions([
    'apiKey:create:all'
  ], { optionalCheck: true, checkData: true }), wrapAction(async (req, res) => {
    const fields = [
      'name',
      'roles',
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

    // cannot set the type because it used by cote
    if (req.body.type) {
      params.apiKeyType = req.body.type
    }

    const result = await requester.send(params)
    return result
  }))

  server.patch({
    name: 'apiKey.update',
    path: '/api-keys/:id'
  }, checkPermissions([
    'apiKey:edit',
    'apiKey:edit:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const { id } = req.params

    const fields = [
      'name',
      'roles',
      'permissions',
      'readNamespaces',
      'editNamespaces',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'update',
      apiKeyId: id
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.del({
    name: 'apiKey.remove',
    path: '/api-keys/:id'
  }, checkPermissions([
    'apiKey:remove',
    'apiKey:remove:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'remove',
      apiKeyId: id
    })

    const result = await requester.send(params)
    return result
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Api key route > Api Key Requester',
    key: 'api-key'
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
