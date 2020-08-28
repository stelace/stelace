const _ = require('lodash')
const createRatingService = require('../services/rating')
const createRating = require('../models/Rating')

let rating
let deps = {}

function init (server, { middlewares, helpers } = {}) {
  const {
    checkPermissions,
    testMiddleware, // middleware created by this plugin
  } = middlewares
  const {
    wrapAction,
    getRequestContext
  } = helpers

  const statsFields = [
    'orderBy',
    'order',
    'nbResultsPerPage',

    // offset pagination
    'page',

    // cursor pagination
    'startingAfter',
    'endingBefore',

    'groupBy',
    'computeRanking',

    'authorId',
    'targetId',
    'topicId',
    'assetId',
    'transactionId',
    'label'
  ]

  server.get({
    name: 'rating.getStats',
    path: '/ratings/stats'
  }, checkPermissions([
    'rating:stats:all'
  ]), wrapAction(async (req, res) => {
    let ctx = getRequestContext(req)

    const payload = _.pick(req.query, statsFields)

    ctx = Object.assign({}, ctx, payload)
    return rating.getStats(ctx)
  }))

  if (process.env.NODE_ENV === 'test') {
    server.get({
      name: 'rating.getStats',
      path: '/ratings/test'
    }, checkPermissions([
      'rating:stats:all'
    ]), testMiddleware, wrapAction(async (req, res) => {
      let ctx = getRequestContext(req)

      const payload = _.pick(req.query, statsFields)

      ctx = Object.assign({}, ctx, payload)
      const stats = await rating.getStats(ctx)

      const { workingTestMiddleware } = req
      return Object.assign(stats, { workingTestMiddleware })
    }))
  }

  server.get({
    name: 'rating.list',
    path: '/ratings'
  }, checkPermissions([
    'rating:list',
    'rating:list:all'
  ]), wrapAction(async (req, res) => {
    let ctx = getRequestContext(req)

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
      'authorId',
      'targetId',
      'topicId',
      'assetId',
      'transactionId',
      'label'
    ]

    const payload = _.pick(req.query, fields)

    ctx = Object.assign({}, ctx, payload)
    return rating.list(ctx)
  }))

  server.get({
    name: 'rating.read',
    path: '/ratings/:id'
  }, checkPermissions([
    'rating:read',
    'rating:read:all'
  ]), wrapAction(async (req, res) => {
    let ctx = getRequestContext(req)

    const { id } = req.params

    ctx = Object.assign({}, ctx, {
      ratingId: id
    })

    return rating.read(ctx)
  }))

  server.post({
    name: 'rating.create',
    path: '/ratings'
  }, checkPermissions([
    'rating:create',
    'rating:create:all'
  ]), wrapAction(async (req, res) => {
    let ctx = getRequestContext(req)

    const fields = [
      'score',
      'comment',
      'authorId',
      'targetId',
      'topicId',
      'assetId',
      'transactionId',
      'label',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    ctx = Object.assign({}, ctx, payload)

    return rating.create(ctx)
  }))

  server.patch({
    name: 'rating.update',
    path: '/ratings/:id'
  }, checkPermissions([
    'rating:edit',
    'rating:edit:all'
  ]), wrapAction(async (req, res) => {
    let ctx = getRequestContext(req)

    const { id } = req.params

    const fields = [
      'score',
      'comment',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    ctx = Object.assign({}, ctx, payload, {
      ratingId: id
    })

    return rating.update(ctx)
  }))

  server.del({
    name: 'rating.remove',
    path: '/ratings/:id'
  }, checkPermissions([
    'rating:remove',
    'rating:remove:all'
  ]), wrapAction(async (req, res) => {
    let ctx = getRequestContext(req)

    const { id } = req.params

    ctx = Object.assign({}, ctx, {
      ratingId: id
    })

    return rating.remove(ctx)
  }))
}

function start (startParams) {
  deps = Object.assign({}, startParams)

  const {
    communication: { getRequester },
    BaseModel
  } = deps

  const documentRequester = getRequester({
    name: 'Rating service > Document Requester',
    key: 'document'
  })

  const assetRequester = getRequester({
    name: 'Rating service > Asset Requester',
    key: 'asset'
  })

  const transactionRequester = getRequester({
    name: 'Rating service > Transaction Requester',
    key: 'transaction'
  })

  const Rating = createRating(BaseModel)

  Object.assign(deps, {
    documentRequester,
    assetRequester,
    transactionRequester,

    Rating
  })

  rating = createRatingService(deps)
}

function stop () {
  const {
    documentRequester,
    assetRequester,
    transactionRequester
  } = deps

  documentRequester.close()
  assetRequester.close()
  transactionRequester.close()

  deps = null
}

module.exports = {
  init,
  start,
  stop
}
