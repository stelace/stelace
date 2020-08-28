module.exports = (Base) => class Rating extends Base {
  static get idPrefix () {
    return 'rtg'
  }

  static getAccessFields (access) {
    const accessFields = {
      api: [
        'id',
        'createdDate',
        'updatedDate',
        'score',
        'comment',
        'authorId',
        'targetId',
        'topicId',
        'assetId',
        'transactionId',
        'label',
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }

  static isSelf (rating, userId) {
    const selfUsersIds = []

    if (rating.authorId) {
      selfUsersIds.push(rating.authorId)
    }
    if (rating.targetId) {
      selfUsersIds.push(rating.targetId)
    }

    return selfUsersIds.includes(userId)
  }

  static convertRatingToDoc (rating, { withModelMeta = false } = {}) {
    const doc = {
      authorId: rating.authorId,
      targetId: rating.targetId,
      topicId: rating.topicId,
      type: 'rating',
      label: rating.label,
      data: {
        score: rating.score,
        comment: rating.comment,
        assetId: rating.assetId,
        transactionId: rating.transactionId
      },
      metadata: rating.metadata,
      platformData: rating.platformData
    }

    if (withModelMeta) {
      doc.id = rating.id
      doc.createdDate = rating.createdDate
      doc.updatedDate = rating.updatedDate
    }

    return doc
  }

  static convertDocToRating (doc) {
    return {
      id: doc.id,
      createdDate: doc.createdDate,
      updatedDate: doc.updatedDate,
      authorId: setNullIfUndefined(doc.authorId),
      targetId: setNullIfUndefined(doc.targetId),
      topicId: setNullIfUndefined(doc.topicId),
      label: setNullIfUndefined(doc.label),
      score: doc.data.score,
      comment: setNullIfUndefined(doc.data.comment),
      assetId: setNullIfUndefined(doc.data.assetId),
      transactionId: setNullIfUndefined(doc.data.transactionId),
      metadata: doc.metadata,
      platformData: doc.platformData
    }
  }
}

function setNullIfUndefined (value) {
  return typeof value === 'undefined' ? null : value
}
