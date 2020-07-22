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
    name: 'message.list',
    path: '/messages'
  }, checkPermissions([
    'message:list',
    'message:list:all'
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
      'userId',
      'senderId',
      'receiverId',
      'topicId',
      'conversationId'
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
    name: 'message.read',
    path: '/messages/:id'
  }, checkPermissions([
    'message:read',
    'message:read:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'read',
      messageId: id
    })

    const result = await requester.send(params)
    return result
  }))

  server.post({
    name: 'message.create',
    path: '/messages'
  }, checkPermissions([
    'message:create',
    'message:create:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const fields = [
      'topicId',
      'conversationId',
      'content',
      'attachments',
      'read',
      'senderId',
      'receiverId',
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
    name: 'message.update',
    path: '/messages/:id'
  }, checkPermissions([
    'message:edit',
    'message:edit:all'
  ], { checkData: true }), wrapAction(async (req, res) => {
    const { id } = req.params

    const fields = [
      'read',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    let params = populateRequesterParams(req)({
      type: 'update',
      messageId: id
    })

    params = Object.assign({}, params, payload)

    const result = await requester.send(params)
    return result
  }))

  server.del({
    name: 'message.remove',
    path: '/messages/:id'
  }, checkPermissions([
    'message:remove',
    'message:remove:all'
  ]), wrapAction(async (req, res) => {
    const { id } = req.params

    const params = populateRequesterParams(req)({
      type: 'remove',
      messageId: id
    })

    const result = await requester.send(params)
    return result
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Message route > Message Requester',
    key: 'message'
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
