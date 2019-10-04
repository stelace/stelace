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
    name: 'document.getStats',
    path: '/documents/stats'
  }, checkPermissions([
    'document:stats:all'
  ]), wrapAction(async (req, res) => {
    const fields = [
      'orderBy',
      'order',
      'page',
      'nbResultsPerPage',

      'field',
      'groupBy',

      'label',
      'authorId',
      'targetId',
      'data',
      'computeRanking',
      'avgPrecision'
    ]

    const payload = _.pick(req.query, fields)

    let params = populateRequesterParams(req)({
      type: 'getStats'
    })

    params = Object.assign({}, params, payload)

    params.documentType = req.query.type

    const result = await requester.send(params)
    return result
  }))

  server.get({
    name: 'document.list',
    path: '/documents'
  }, checkPermissions([
    'document:list:all'
  ]), wrapAction(async (req, res) => {
    const fields = [
      'orderBy',
      'order',
      'page',
      'nbResultsPerPage',

      'id',
      'label',
      'authorId',
      'targetId',
      'data'
    ]

    const payload = _.pick(req.query, fields)

    let params = populateRequesterParams(req)({
      type: 'list'
    })

    params = Object.assign({}, params, payload)

    params.documentType = req.query.type

    const result = await requester.send(params)
    return result
  }))

  server.get({
    name: 'document.read',
    path: '/documents/:id'
  }, checkPermissions([
    'document:read:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'read',
      documentId: id
    })

    const result = await requester.send(params)
    return result
  }))

  server.post({
    name: 'document.create',
    path: '/documents'
  }, checkPermissions([
    'document:create:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const {
      authorId,
      targetId,
      type,
      label,
      data,
      metadata,
      platformData
    } = req.body

    const params = populateRequesterParams(req)({
      type: 'create',
      label,
      authorId,
      targetId,
      documentType: type,
      data,
      metadata,
      platformData
    })

    const result = await requester.send(params)
    return result
  }))

  server.patch({
    name: 'document.update',
    path: '/documents/:id'
  }, checkPermissions([
    'document:edit:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const { id } = req.params
    const {
      label,
      data,
      metadata,
      platformData,

      replaceDataProperties
    } = req.body

    const params = populateRequesterParams(req)({
      type: 'update',
      documentId: id,
      label,
      data,
      metadata,
      platformData,

      replaceDataProperties
    })

    const result = await requester.send(params)
    return result
  }))

  server.del({
    name: 'document.remove',
    path: '/documents/:id'
  }, checkPermissions([
    'document:remove:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'remove',
      documentId: id
    })

    const result = await requester.send(params)
    return result
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Document route > Document Requester',
    key: 'document'
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
