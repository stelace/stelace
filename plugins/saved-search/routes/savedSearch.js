const _ = require('lodash')
const createSavedSearchService = require('../services/savedSearch')

let savedSearch
let deps = {}

function init (server, { middlewares, helpers } = {}) {
  const {
    checkPermissions
  } = middlewares
  const {
    wrapAction,
    getRequestContext
  } = helpers

  server.get({
    name: 'savedSearch.list',
    path: '/search'
  }, checkPermissions([
    'savedSearch:list',
    'savedSearch:list:all'
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
      'userId'
    ]

    const payload = _.pick(req.query, fields)

    ctx = Object.assign({}, ctx, payload)
    return savedSearch.list(ctx)
  }))

  server.get({
    name: 'savedSearch.read',
    path: '/search/:id'
  }, checkPermissions([
    'savedSearch:read',
    'savedSearch:read:all'
  ]), wrapAction(async (req, res) => {
    let ctx = getRequestContext(req)

    const { id } = req.params

    ctx = Object.assign({}, ctx, {
      savedSearchId: id
    })

    return savedSearch.read(ctx)
  }))

  // creation of saved search is managed by a middleware
  // on route POST /search

  server.patch({
    name: 'savedSearch.update',
    path: '/search/:id'
  }, checkPermissions([
    'savedSearch:edit',
    'savedSearch:edit:all'
  ]), wrapAction(async (req, res) => {
    let ctx = getRequestContext(req)

    const { id } = req.params

    const fields = [
      'name',
      'active',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req.body, fields)

    ctx = Object.assign({}, ctx, payload, {
      savedSearchId: id
    })

    return savedSearch.update(ctx)
  }))

  server.del({
    name: 'savedSearch.remove',
    path: '/search/:id'
  }, checkPermissions([
    'savedSearch:remove',
    'savedSearch:remove:all'
  ]), wrapAction(async (req, res) => {
    let ctx = getRequestContext(req)

    const { id } = req.params

    ctx = Object.assign({}, ctx, {
      savedSearchId: id
    })

    return savedSearch.remove(ctx)
  }))
}

function start (startParams) {
  deps = Object.assign({}, startParams)

  const {
    communication: { getRequester }
  } = deps

  const documentRequester = getRequester({
    name: 'SavedSearch service > Document Requester',
    key: 'document'
  })

  Object.assign(deps, {
    documentRequester
  })

  savedSearch = createSavedSearchService(deps)
}

function stop () {
  const {
    documentRequester
  } = deps

  documentRequester.close()

  deps = null
}

module.exports = {
  init,
  start,
  stop
}
