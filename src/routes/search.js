let requester

function init (server, { middlewares, helpers } = {}) {
  const {
    checkPermissions
  } = middlewares
  const {
    wrapAction,
    populateRequesterParams
  } = helpers

  server.post({
    name: 'search.list',
    path: '/search'
  }, checkPermissions([
    // depending on the payload, trigger a search or a saved search creation
    'search:list:all',

    'savedSearch:create',
    'savedSearch:create:all'
  ], {
    optionalPermissions: [ // if present, can use saved search queries
      'savedSearch:list',
      'savedSearch:list:all'
    ]
  }), wrapAction(async (req, res) => {
    const params = populateRequesterParams(req)({
      type: 'search',
      searchQuery: req.body,
      parsedFilter: req._stlParsedSearchFilter, // can be added by Stelace filter DSL parser plugin
      _size: req.query && req.query._size,
      _validateOnly: req.query && req.query._validateOnly
    })

    const result = await requester.send(params)
    return result
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Search route > Search Requester',
    key: 'search'
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
