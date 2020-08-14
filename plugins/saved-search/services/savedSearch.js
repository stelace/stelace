const _ = require('lodash')

const documentType = 'savedSearch'

module.exports = function createService (deps) {
  const {
    documentRequester,

    models: {
      SavedSearch
    },

    getCurrentUserId,
    createError,
    handleRemoteNotFoundError
  } = deps

  return {
    list,
    read,
    update,
    remove
  }

  async function list (req) {
    const {
      id,
      orderBy,
      order,
      nbResultsPerPage,

      // offset pagination
      page,

      // cursor pagination
      startingAfter,
      endingBefore,

      userId
    } = req

    const documentParams = {
      type: 'list',
      documentType,
      id,
      orderBy,
      order,
      nbResultsPerPage,

      // offset pagination
      page,

      // cursor pagination
      startingAfter,
      endingBefore,

      authorId: userId,

      _useOffsetPagination: req._useOffsetPagination,
    }

    const paginationResult = await documentRequester.communicate(req)(documentParams)

    const currentUserId = getCurrentUserId(req)

    paginationResult.results = paginationResult.results.map(doc => {
      const savedSearch = SavedSearch.convertDocToSavedSearch(doc)

      if (!req._matchedPermissions['savedSearch:list:all']) {
        const isSelf = SavedSearch.isSelf(savedSearch, currentUserId)
        if (!isSelf) throw createError(403)
      }

      return SavedSearch.expose(savedSearch, { req })
    })

    return paginationResult
  }

  async function read (req) {
    const savedSearchId = req.savedSearchId

    const doc = await documentRequester.communicate(req)({
      type: 'read',
      documentId: savedSearchId
    }).catch(handleRemoteNotFoundError)
    if (!doc || doc.type !== documentType) throw createError(404)

    const savedSearch = SavedSearch.convertDocToSavedSearch(doc)

    const currentUserId = getCurrentUserId(req)

    const isSelf = SavedSearch.isSelf(savedSearch, currentUserId)
    if (!req._matchedPermissions['savedSearch:read:all'] && !isSelf) {
      throw createError(403)
    }

    return SavedSearch.expose(savedSearch, { req })
  }

  async function update (req) {
    const savedSearchId = req.savedSearchId

    // update on `search` object is not allowed for now
    // due to default merging strategy via `rawJsonMerge`
    // In the future, we may allow more precise updates using JSON Patch query.
    // https://erosb.github.io/post/json-patch-vs-merge-patch/
    const fields = [
      'name',
      'active',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const doc = await documentRequester.communicate(req)({
      type: 'read',
      documentId: savedSearchId
    }).catch(handleRemoteNotFoundError)
    if (!doc || doc.type !== documentType) {
      throw createError(404)
    }

    const savedSearch = SavedSearch.convertDocToSavedSearch(doc)

    const currentUserId = getCurrentUserId(req)

    const isSelf = savedSearch.userId && savedSearch.userId !== currentUserId
    if (!req._matchedPermissions['savedSearch:edit:all'] && !isSelf) {
      throw createError(403)
    }

    const updateAttrs = payload

    const docUpdateAttrs = SavedSearch.convertSavedSearchToDoc(updateAttrs)

    const docUpdateParams = Object.assign({}, docUpdateAttrs, {
      type: 'update',
      documentId: savedSearchId
    })

    const document = await documentRequester.communicate(req)(docUpdateParams)
    const newSavedSearch = SavedSearch.convertDocToSavedSearch(document)

    return SavedSearch.expose(newSavedSearch, { req })
  }

  async function remove (req) {
    const savedSearchId = req.savedSearchId

    const doc = await documentRequester.communicate(req)({
      type: 'read',
      documentId: savedSearchId
    }).catch(handleRemoteNotFoundError)
    if (!doc || doc.type !== documentType) {
      return { id: savedSearchId }
    }

    const savedSearch = SavedSearch.convertDocToSavedSearch(doc)

    const currentUserId = getCurrentUserId(req)

    const isSelf = currentUserId === savedSearch.userId

    if (!req._matchedPermissions['savedSearch:remove:all'] && !isSelf) {
      throw createError(403)
    }

    await documentRequester.communicate(req)({
      type: 'remove',
      documentId: savedSearchId
    })

    return { id: savedSearchId }
  }
}
