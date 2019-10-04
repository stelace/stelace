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
    name: 'entry.list',
    path: '/entries'
  }, checkPermissions([
    'entry:list:all'
  ]), cache(), wrapAction(async (req, res) => {
    const fields = [
      'orderBy',
      'order',
      'page',
      'nbResultsPerPage',

      'id',
      'collection',
      'locale',
      'name'
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
    name: 'entry.read',
    path: '/entries/:id'
  }, checkPermissions([
    'entry:read:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'read',
      entryId: id
    })

    const result = await requester.send(params)
    return result
  }))

  server.post({
    name: 'entry.create',
    path: '/entries'
  }, checkPermissions([
    'entry:create:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const fields = [
      'collection',
      'locale',
      'name',
      'fields',
      'metadata'
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
    name: 'entry.update',
    path: '/entries/:id'
  }, checkPermissions([
    'entry:edit:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const { id } = req.params
    const fields = [
      'collection',
      'locale',
      'name',
      'fields',
      'metadata'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'update',
      entryId: id
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.del({
    name: 'entry.remove',
    path: '/entries/:id'
  }, checkPermissions([
    'entry:remove:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'remove',
      entryId: id
    })

    const result = await requester.send(params)
    return result
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Entry route > Entry Requester',
    key: 'entry'
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
