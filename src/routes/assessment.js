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
    name: 'assessment.list',
    path: '/assessments'
  }, checkPermissions([
    'assessment:list',
    'assessment:list:all'
  ]), wrapAction(async (req, res) => {
    const fields = [
      'order',
      'page',
      'nbResultsPerPage',

      'assetId'
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
    name: 'assessment.read',
    path: '/assessments/:id'
  }, checkPermissions([
    'assessment:read',
    'assessment:read:all'
  ], {
    optionalPermissions: [
      'assessment:config',
      'assessment:config:all'
    ]
  }), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'read',
      assessmentId: id
    })

    const result = await requester.send(params)
    return result
  }))

  server.post({
    name: 'assessment.create',
    path: '/assessments'
  }, checkPermissions([
    'assessment:create',
    'assessment:create:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const fields = [
      'assetId',
      'status',
      'statement',
      'transactionId',
      'ownerId',
      'takerId',
      'emitterId',
      'receiverId',
      'signers',
      'signCodes',
      'nbSigners',
      'expirationDate',
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
    name: 'assessment.update',
    path: '/assessments/:id'
  }, checkPermissions([
    'assessment:edit',
    'assessment:edit:all'
  ], {
    checkData: true,
    optionalPermissions: [
      'assessment:config',
      'assessment:config:all'
    ]
  }), wrapAction(async (req, res) => {
    const assessmentId = req.params.id
    const fields = [
      'status',
      'statement',
      'emitterId',
      'receiverId',
      'signers',
      'signCodes',
      'nbSigners',
      'expirationDate',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'update',
      assessmentId
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.post({
    name: 'assessment.sign',
    path: '/assessments/:id/signatures'
  }, checkPermissions([
    'assessment:sign',
    'assessment:sign:all'
  ]), wrapAction(async (req, res) => {
    const assessmentId = req.params.id
    const fields = [
      'signCode'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'sign',
      assessmentId
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.del({
    name: 'assessment.remove',
    path: '/assessments/:id'
  }, checkPermissions([
    'assessment:remove',
    'assessment:remove:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'remove',
      assessmentId: id
    })

    const result = await requester.send(params)
    return result
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Assessment route > Assessment Requester',
    key: 'assessment'
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
