const _ = require('lodash')
const bluebird = require('bluebird')

const {
  getObjectId
} = require('stelace-util-keys')

let deps
let enabled = false
let middleware = async (req, res, next) => { next() }

const createOrTriggerSavedSearchMiddleware = async (...args) => {
  const next = _.last(args)
  if (enabled) await middleware(...args)
  else if (typeof next === 'function') next()
}

const savedSearchDocumentType = 'savedSearch'
const defaultPage = 1
const defaultNbResultsPerPage = 20

let documentRequester

module.exports = {
  createOrTriggerSavedSearchMiddleware,

  beforeRoutes,
  start,
  stop
}

function createMiddleware () {
  const {
    createError,
    getCurrentUserId,
    middlewares: { checkPermissions },
    routes: { getRouteRequestContext, wrapAction },
    communication: { stelaceApiRequest },
    models: {
      Asset,
      SavedSearch
    }
  } = deps

  return (req, res, next) => {
    const { name } = req.getRoute() || {}
    if (name !== 'search.list') return next()

    const { save, savedSearch } = req.body
    const savedSearchLogic = save || savedSearch
    if (!savedSearchLogic) return next()

    // retrieve search permissions in the middleware (usually, they are retrieved in the route)
    checkPermissions([
      // depending on the payload, trigger a search or a saved search creation
      'search:list:all',

      'savedSearch:create',
      'savedSearch:create:all'
    ], {
      optionalPermissions: [ // if present, can use saved search queries
        'savedSearch:list',
        'savedSearch:list:all'
      ]
    })(req, res, async (err) => {
      if (err) return next(err)

      // apply all request transformation variables
      // to retrieve permissions or make `getCurrentUserId` work
      const populatedReq = getRouteRequestContext(req)

      const noop = () => {}

      // use wrapAction to apply common operation on response
      // like applying versioning or setting API headers
      wrapAction(async (req, res) => {
        if (save) {
          if (!populatedReq._matchedPermissions['savedSearch:create'] && !populatedReq._matchedPermissions['savedSearch:create:all']) {
            throw createError(403)
          }

          return createSavedSearch({ req: populatedReq, searchQuery: req.body })
        } else if (savedSearch) {
          return triggerSearchWithSavedSearch({ req: populatedReq, searchQuery: req.body })
        }
      })(req, res, (err2) => {
        // pass the next callback from the upstream middleware
        // to the third argument of wrapAction returned middleware to forward any error
        if (err2) next(err2)
        else noop() // skip downstream logic
      })
    })
  }

  async function createSavedSearch ({ req, searchQuery }) {
    const { platformId, env } = req

    const fields = [
      'name',
      'userId',
      'metadata',
      'platformData'
    ]
    const searchFields = [
      'query',
      'categoryId',
      'assetTypeId',
      'location',
      'maxDistance',
      'startDate',
      'endDate',
      'quantity',
      'without',
      'similarTo',
      'page',
      'nbResultsPerPage',
      'customAttributes',
      'filter',
      'validated',
      'active',
      'sort',
      'availabilityFilter',
      'createdBefore',
      'createdAfter'
    ]

    const savedSearchPayload = _.pick(searchQuery, fields)
    const search = _.pick(searchQuery, searchFields)

    const createAttrs = Object.assign({}, savedSearchPayload, {
      search,
      active: true // saved search active by default
    })

    const currentUserId = getCurrentUserId(req)

    // cannot create as another user
    if (!req._matchedPermissions['savedSearch:create:all'] && createAttrs.userId && createAttrs.userId !== currentUserId) {
      throw createError(403)
    }

    // automatically set the current user as author if there is no specified author
    if (!createAttrs.userId && currentUserId) {
      createAttrs.userId = currentUserId
    }

    const isSelf = currentUserId && currentUserId === createAttrs.userId
    if (!req._matchedPermissions['savedSearch:create:all'] && !isSelf) {
      throw createError(403)
    }

    // check the validity of the search query
    await stelaceApiRequest('/search?_validateOnly=true', {
      platformId,
      env,
      method: 'POST',
      payload: search
    })

    let docCreateAttrs = SavedSearch.convertSavedSearchToDoc(createAttrs)

    docCreateAttrs.documentId = await getObjectId({ prefix: SavedSearch.idPrefix, platformId, env })
    docCreateAttrs.documentType = savedSearchDocumentType

    const docCreateParams = Object.assign({}, docCreateAttrs, {
      type: 'create'
    })

    const document = await documentRequester.communicate(req)(docCreateParams)
    const savedSearch = SavedSearch.convertDocToSavedSearch(document)

    return SavedSearch.expose(savedSearch, { req })
  }

  async function triggerSearchWithSavedSearch ({ req, searchQuery }) {
    if (!req._matchedPermissions['search:list:all']) throw createError(403)

    // if the object `savedSearch` isn't an empty object, then we consider the request to use
    // previously saved search queries
    const useSavedSearchQuery = _.isPlainObject(searchQuery.savedSearch) &&
      (searchQuery.savedSearch.userId || searchQuery.savedSearch.ids)

    const { platformId, env } = req
    const {
      page = defaultPage,
      nbResultsPerPage = defaultNbResultsPerPage
    } = searchQuery

    if (useSavedSearchQuery) {
      const { results: savedSearches } = await stelaceApiRequest('/search', {
        platformId,
        env,
        method: 'GET',
        payload: {
          userId: searchQuery.savedSearch.userId,
          id: searchQuery.savedSearch.ids
        }
      })

      if (!savedSearches.length) {
        return {
          page,
          nbResultsPerPage,
          nbResults: 0,
          nbPages: 1,
          exhaustiveNbResults: true,
          results: []
        }
      }

      // to be able to use saved search, a user must at least the permission 'savedSearch:list' on
      // her saved searches
      const currentUserId = getCurrentUserId(req)
      const savedSearchesFromCurrentUser = savedSearches.filter(s => s.userId === currentUserId)
      const savedSearchesFromOtherUsers = savedSearches.filter(s => s.userId !== currentUserId)
      const forbiddenUseOfSavedSearch = (
        savedSearchesFromCurrentUser.length &&
        !req._matchedPermissions['savedSearch:list'] &&
        !req._matchedPermissions['savedSearch:list:all']
      ) ||
        (
          savedSearchesFromOtherUsers.length &&
          !req._matchedPermissions['savedSearch:list:all']
        )
      if (forbiddenUseOfSavedSearch) throw createError(403)

      const matchedSavedSearchIds = {}

      // range filter on createdDate from the root query overrides saved search query
      // that is to allow searching for assets newly created for some period of time with
      // saved searches queries
      const overrideCreatedRangeFilter = searchQuery.createdBefore || searchQuery.createdAfter
      const createdRangeFilter = {
        createdBefore: searchQuery.createdBefore || null,
        createdAfter: searchQuery.createdAfter || null
      }

      const savedSearchResults = await bluebird.map(savedSearches, async (savedSearch) => {
        const savedSearchQuery = Object.assign(
          {},
          savedSearch.search,
          overrideCreatedRangeFilter ? createdRangeFilter : {}
        )

        const { results } = await stelaceApiRequest('/search', {
          platformId,
          env,
          method: 'POST',
          payload: savedSearchQuery
        })

        // save matched saved searches for each asset
        results.forEach(result => {
          matchedSavedSearchIds[result.id] = matchedSavedSearchIds[result.id] || []
          matchedSavedSearchIds[result.id].push(savedSearch.id)
        })

        return results
      }, { concurrency: 4 })

      let mergedSavedSearchResults = savedSearchResults.reduce((merged, results) => merged.concat(results), [])
      mergedSavedSearchResults = _.uniqBy(mergedSavedSearchResults, result => result.id)

      let exposedResults = getResultsByPagination(mergedSavedSearchResults, page, nbResultsPerPage)
      exposedResults = Asset.exposeAll(exposedResults, { req })

      // add the property `savedSearchIds` after the above `exposeAll` method
      exposedResults = exposedResults.map(result => {
        return Object.assign({}, result, { savedSearchIds: matchedSavedSearchIds[result.id] || [] })
      })

      const nbResults = mergedSavedSearchResults.length

      return {
        page,
        nbResultsPerPage,
        nbResults,
        nbPages: Math.ceil(nbResults / nbResultsPerPage),
        exhaustiveNbResults: nbResults <= page * nbResultsPerPage,
        results: exposedResults
      }
    }
  }
}

// copied from search service
function getResultsByPagination (results, page, limit) {
  return results.slice((page - 1) * limit, page * limit)
}

function beforeRoutes (server, startParams) {
  server.use(createOrTriggerSavedSearchMiddleware)
}

function start (startParams) {
  deps = Object.assign({}, startParams)

  const {
    communication: { getRequester }
  } = deps

  middleware = createMiddleware()
  enabled = true

  documentRequester = getRequester({
    name: 'Create saved search middleware > Document Requester',
    key: 'document'
  })
}

function stop () {
  documentRequester.close()
  documentRequester = null
}
