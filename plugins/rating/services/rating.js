const _ = require('lodash')
const { getObjectId } = require('stelace-util-keys')

module.exports = function createService (deps) {
  const {
    assetRequester,
    documentRequester,
    transactionRequester,

    Rating,

    getCurrentUserId,
    createError,
    handleRemoteNotFoundError
  } = deps

  return {
    getStats,
    list,
    read,
    create,
    update,
    remove
  }

  async function getStats (req) {
    const {
      orderBy,
      order,
      nbResultsPerPage,

      // offset pagination
      page,

      // cursor pagination
      startingAfter,
      endingBefore,

      groupBy,
      computeRanking,

      authorId,
      targetId,
      topicId,
      assetId,
      transactionId,
      label
    } = req

    let documentGroupBy = groupBy
    if (groupBy === 'assetId') {
      documentGroupBy = 'data.assetId'
    } else if (groupBy === 'transactionId') {
      documentGroupBy = 'data.transactionId'
    }

    const documentParams = {
      type: 'getStats',
      documentType: 'rating',
      field: 'data.score',
      groupBy: documentGroupBy,
      orderBy,
      order,
      nbResultsPerPage,

      // offset pagination
      page,

      // cursor pagination
      startingAfter,
      endingBefore,

      label,
      authorId,
      targetId,
      topicId,
      avgPrecision: 0,
      computeRanking,

      _useOffsetPagination: req._useOffsetPagination,
    }

    const data = {}

    if (assetId) {
      data.assetId = assetId
    }
    if (transactionId) {
      data.transactionId = transactionId
    }

    if (!_.isEmpty(data)) {
      documentParams.data = data
    }

    const paginationResult = await documentRequester.communicate(req)(documentParams)

    const transformRatingStat = stat => {
      const mapToRatingField = {
        authorId: 'authorId',
        targetId: 'targetId',
        topicId: 'topicId',
        'data.assetId': 'assetId',
        'data.transactionId': 'transactionId'
      }

      const cloneStat = _.cloneDeep(stat)

      cloneStat[mapToRatingField[cloneStat.groupBy]] = cloneStat.groupByValue
      delete cloneStat.groupBy
      delete cloneStat.groupByValue
      return cloneStat
    }

    paginationResult.results = paginationResult.results.map(result => {
      const isMultiLabelsResult = !!result.groupBy

      if (isMultiLabelsResult) {
        return transformRatingStat(result)
      } else {
        const labelsStats = {}

        Object.keys(result).forEach(key => {
          labelsStats[key] = transformRatingStat(result[key])
        })

        return labelsStats
      }
    })

    return paginationResult
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

      authorId,
      targetId,
      topicId,
      assetId,
      transactionId,

      label
    } = req

    const documentParams = {
      type: 'list',
      documentType: 'rating',
      id,
      orderBy,
      order,
      nbResultsPerPage,

      // offset pagination

      // cursor pagination
      startingAfter,
      endingBefore,

      page,
      authorId,
      targetId,
      topicId,
      label,

      _useOffsetPagination: req._useOffsetPagination,
    }

    const data = {}

    if (assetId) {
      data.assetId = assetId
    }
    if (transactionId) {
      data.transactionId = transactionId
    }

    if (!_.isEmpty(data)) {
      documentParams.data = data
    }

    const paginationResult = await documentRequester.communicate(req)(documentParams)

    const currentUserId = getCurrentUserId(req)

    paginationResult.results = paginationResult.results.map(doc => {
      const rating = Rating.convertDocToRating(doc)

      if (!req._matchedPermissions['rating:list:all']) {
        const isSelf = Rating.isSelf(rating, currentUserId)
        if (!isSelf) {
          throw createError(403)
        }
      }

      return Rating.expose(rating, { req })
    })

    return paginationResult
  }

  async function read (req) {
    const ratingId = req.ratingId

    const doc = await documentRequester.communicate(req)({
      type: 'read',
      documentId: ratingId
    }).catch(handleRemoteNotFoundError)
    if (!doc || doc.type !== 'rating') {
      throw createError(404)
    }

    const rating = Rating.convertDocToRating(doc)

    const currentUserId = getCurrentUserId(req)

    const isSelf = Rating.isSelf(rating, currentUserId)
    if (!req._matchedPermissions['rating:read:all'] && !isSelf) {
      throw createError(403)
    }

    return Rating.expose(rating, { req })
  }

  async function create (req) {
    const platformId = req.platformId
    const env = req.env

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

    const payload = _.pick(req, fields)

    const createAttrs = Object.assign({}, payload)

    const currentUserId = getCurrentUserId(req)

    // cannot create as another user
    if (!req._matchedPermissions['rating:create:all'] && createAttrs.authorId && createAttrs.authorId !== currentUserId) {
      throw createError(403)
    }

    // automatically set the current user as author if there is no specified author
    if (!createAttrs.authorId && currentUserId) {
      createAttrs.authorId = currentUserId
    }

    const isSelf = currentUserId && currentUserId === createAttrs.authorId
    if (!req._matchedPermissions['rating:create:all'] && !isSelf) {
      throw createError(403)
    }

    const getAsset = async () => {
      if (!createAttrs.assetId) return

      const asset = await assetRequester.communicate(req)({
        type: 'read',
        assetId: createAttrs.assetId,
        _matchedPermissions: {
          'asset:read:all': true
        }
      }).catch(handleRemoteNotFoundError)

      if (!asset) {
        throw createError(422, `Asset ID ${createAttrs.assetId} doesn't exist`)
      }

      return asset
    }

    const getTransaction = async () => {
      if (!createAttrs.transactionId) return

      const transaction = await transactionRequester.communicate(req)({
        type: 'read',
        transactionId: createAttrs.transactionId,
        _matchedPermissions: {
          'transaction:read:all': true
        }
      }).catch(handleRemoteNotFoundError)

      if (!transaction) {
        throw createError(422, `Transaction ID ${createAttrs.transactionId} doesn't exist`)
      }

      return transaction
    }

    const [
      asset,
      transaction
    ] = await Promise.all([
      getAsset(),
      getTransaction()
    ])

    // automatically set the assetId if the information is available in transaction
    if (!createAttrs.assetId && transaction.assetId) {
      createAttrs.assetId = transaction.assetId
    }

    if (asset && transaction && asset.id !== transaction.assetId) {
      throw createError(422, `The transaction ${transaction.id} isn't associated with the asset ${asset.id}`)
    }

    const docCreateAttrs = Rating.convertRatingToDoc(createAttrs)

    docCreateAttrs.documentId = await getObjectId({ prefix: Rating.idPrefix, platformId, env })
    docCreateAttrs.documentType = 'rating'

    const docCreateParams = Object.assign({}, docCreateAttrs, {
      type: 'create'
    })

    const document = await documentRequester.communicate(req)(docCreateParams)
    const rating = Rating.convertDocToRating(document)

    return Rating.expose(rating, { req })
  }

  async function update (req) {
    const ratingId = req.ratingId

    const fields = [
      'score',
      'comment',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const doc = await documentRequester.communicate(req)({
      type: 'read',
      documentId: ratingId
    }).catch(handleRemoteNotFoundError)
    if (!doc || doc.type !== 'rating') {
      throw createError(404)
    }

    const rating = Rating.convertDocToRating(doc)

    const currentUserId = getCurrentUserId(req)

    const isSelf = rating.authorId && rating.authorId !== currentUserId
    if (!req._matchedPermissions['rating:edit:all'] && !isSelf) {
      throw createError(403)
    }

    const updateAttrs = payload

    const docUpdateAttrs = Rating.convertRatingToDoc(updateAttrs)

    const docUpdateParams = Object.assign({}, docUpdateAttrs, {
      type: 'update',
      documentId: ratingId
    })

    const document = await documentRequester.communicate(req)(docUpdateParams)
    const newRating = Rating.convertDocToRating(document)

    return Rating.expose(newRating, { req })
  }

  async function remove (req) {
    const ratingId = req.ratingId

    const doc = await documentRequester.communicate(req)({
      type: 'read',
      documentId: ratingId
    }).catch(handleRemoteNotFoundError)
    if (!doc || doc.type !== 'rating') {
      return { id: ratingId }
    }

    const rating = Rating.convertDocToRating(doc)

    const currentUserId = getCurrentUserId(req)

    const isSelf = currentUserId === rating.authorId

    if (!req._matchedPermissions['rating:remove:all'] && !isSelf) {
      throw createError(403)
    }

    await documentRequester.communicate(req)({
      type: 'remove',
      documentId: ratingId
    })

    return { id: ratingId }
  }
}
