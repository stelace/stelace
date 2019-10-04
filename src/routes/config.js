const _ = require('lodash')

let requester

function init (server, { middlewares, helpers } = {}) {
  const {
    allowSystem,
    cache,
    checkPermissions
  } = middlewares
  const {
    wrapAction,
    populateRequesterParams
  } = helpers

  server.get({
    name: 'config.read',
    path: '/config'
  }, checkPermissions([
    'config:read', 'config:read:all'
  ]), cache(), wrapAction(async (req, res) => {
    const params = populateRequesterParams(req)({
      type: 'read',
      access: 'default'
    })

    return requester.send(params)
  }))

  server.patch({
    name: 'config.update',
    path: '/config'
  }, checkPermissions([
    'config:edit', 'config:edit:all'
  ]), wrapAction(async (req, res) => {
    const fields = [
      'stelace',
      'custom',
      'theme'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'update',
      access: 'default'
    })

    params = Object.assign({}, params, payload)

    return requester.send(params)
  }))

  server.get({
    name: 'config.readPrivate',
    path: '/config/private'
  }, checkPermissions([
    'config:read:all'
  ]), wrapAction(async (req, res) => {
    const params = populateRequesterParams(req)({
      type: 'readPrivate'
    })

    return requester.send(params)
  }))

  server.patch({
    name: 'config.updatePrivate',
    path: '/config/private'
  }, checkPermissions([
    'config:edit:all'
  ]), wrapAction(async (req, res) => {
    const fields = [
      'stelace',
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'updatePrivate'
    })

    params = Object.assign({}, params, payload)

    return requester.send(params)
  }))

  server.get({
    name: 'config.readSystem',
    path: '/config/system'
  }, allowSystem, wrapAction(async (req, res) => {
    const params = populateRequesterParams(req)({
      type: 'read',
      access: 'system'
    })

    return requester.send(params)
  }))

  server.patch({
    name: 'config.updateSystem',
    path: '/config/system'
  }, allowSystem, wrapAction(async (req, res) => {
    const fields = [
      'stelace',
      'custom'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'update',
      access: 'system'
    })

    params = Object.assign({}, params, payload)

    return requester.send(params)
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Config route > Config Requester',
    key: 'config'
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
