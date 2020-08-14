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
    name: 'customAttribute.list',
    path: '/custom-attributes'
  }, checkPermissions([
    'customAttribute:list:all'
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

      'id'
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
    name: 'customAttribute.read',
    path: '/custom-attributes/:id'
  }, checkPermissions([
    'customAttribute:read:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'read',
      customAttributeId: id
    })

    const result = await requester.send(params)
    return result
  }))

  server.post({
    name: 'customAttribute.create',
    path: '/custom-attributes'
  }, checkPermissions([
    'customAttribute:create:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const {
      name,
      type,
      listValues,
      metadata,
      platformData
    } = req.body

    const params = populateRequesterParams(req)({
      type: 'create',
      name,
      customAttributeType: type,
      listValues,
      metadata,
      platformData
    })

    const result = await requester.send(params)
    return result
  }))

  server.patch({
    name: 'customAttribute.update',
    path: '/custom-attributes/:id'
  }, checkPermissions([
    'customAttribute:edit:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const { id } = req.params
    const { listValues, metadata, platformData } = req.body

    const params = populateRequesterParams(req)({
      type: 'update',
      customAttributeId: id,
      listValues,
      metadata,
      platformData
    })

    const result = await requester.send(params)
    return result
  }))

  server.del({
    name: 'customAttribute.remove',
    path: '/custom-attributes/:id'
  }, checkPermissions([
    'customAttribute:remove:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'remove',
      customAttributeId: id
    })

    const result = await requester.send(params)
    return result
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Custom attribute route > Custom attribute Requester',
    key: 'custom-attribute'
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
