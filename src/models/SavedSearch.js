const Base = require('./Base')

class SavedSearch extends Base {
  static get tableName () {
    return 'document'
  }

  static get idPrefix () {
    return 'sch'
  }

  static getAccessFields (access) {
    const accessFields = {
      api: [
        'id',
        'createdDate',
        'updatedDate',
        'name',
        'userId',
        'search',
        'active',
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }

  static isSelf (savedSearch, userId) {
    return savedSearch.userId === userId
  }

  static convertSavedSearchToDoc (savedSearch, { withModelMeta = false } = {}) {
    const doc = {
      authorId: savedSearch.userId,
      targetId: null,
      type: 'savedSearch',
      label: null,
      data: {
        name: savedSearch.name,
        search: savedSearch.search,
        active: savedSearch.active
      },
      metadata: savedSearch.metadata,
      platformData: savedSearch.platformData
    }

    if (withModelMeta) {
      doc.id = savedSearch.id
      doc.createdDate = savedSearch.createdDate
      doc.updatedDate = savedSearch.updatedDate
    }

    return doc
  }

  static convertDocToSavedSearch (doc) {
    return {
      id: doc.id,
      createdDate: doc.createdDate,
      updatedDate: doc.updatedDate,
      name: doc.data.name,
      userId: setNullIfUndefined(doc.authorId),
      search: doc.data.search,
      active: doc.data.active,
      metadata: doc.metadata,
      platformData: doc.platformData
    }
  }
}

function setNullIfUndefined (value) {
  return typeof value === 'undefined' ? null : value
}

module.exports = SavedSearch
