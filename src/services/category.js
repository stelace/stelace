const createError = require('http-errors')
const _ = require('lodash')

const { logError } = require('../../logger')
const { getModels } = require('../models')

const { isValidHierarchy } = require('../util/hierarchy')

const { getObjectId } = require('stelace-util-keys')

const { performListQuery } = require('../util/listQueryBuilder')

let responder
let subscriber
let publisher

function start ({ communication }) {
  const {
    getResponder,
    getSubscriber,
    getPublisher,
    COMMUNICATION_ID
  } = communication

  responder = getResponder({
    name: 'Asset category Responder',
    key: 'category'
  })

  subscriber = getSubscriber({
    name: 'Asset category subscriber',
    key: 'category',
    namespace: COMMUNICATION_ID,
    subscribesTo: [
      'categoryCreated',
      'categoryUpdated',
      'categoryDeleted'
    ]
  })

  publisher = getPublisher({
    name: 'Asset category publisher',
    key: 'category',
    namespace: COMMUNICATION_ID
  })

  responder.on('list', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Category } = await getModels({ platformId, env })

    const queryBuilder = Category.query()

    const categories = await performListQuery({
      queryBuilder,
      paginationActive: false,
      orderConfig: {
        orderBy: 'name',
        order: 'asc'
      }
    })

    return Category.exposeAll(categories, { req })
  })

  responder.on('read', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Category } = await getModels({ platformId, env })

    const categoryId = req.categoryId

    const category = await Category.query().findById(categoryId)
    if (!category) {
      throw createError(404)
    }

    return Category.expose(category, { req })
  })

  responder.on('create', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Category } = await getModels({ platformId, env })

    const {
      name,
      parentId,
      metadata,
      platformData
    } = req

    if (parentId) {
      const parentCategory = await Category.query().findById(parentId)
      if (!parentCategory) {
        throw createError(422, 'Parent category not found')
      }
    }

    const category = await Category.query().insert({
      id: await getObjectId({ prefix: Category.idPrefix, platformId, env }),
      name,
      parentId,
      metadata,
      platformData
    })

    publisher.publish('categoryCreated', {
      category,
      eventDate: category.createdDate,
      platformId,
      env
    })

    return Category.expose(category, { req })
  })

  responder.on('update', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Category } = await getModels({ platformId, env })

    const categoryId = req.categoryId

    const fields = [
      'name',
      'parentId',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const {
      parentId,
      metadata,
      platformData
    } = payload

    const assetCategories = await Category.query()

    const indexedAssetCategories = _.keyBy(assetCategories, 'id')

    let category = indexedAssetCategories[categoryId]
    if (!category) {
      throw createError(404)
    }

    if (parentId && !indexedAssetCategories[parentId]) {
      throw createError(422, `Parent category ${parentId} not found`)
    }
    if (categoryId === parentId) {
      throw createError(422, 'A category cannot be its own parent')
    }

    // check for a circular hierarchy
    if (typeof parentId !== 'undefined') {
      const workingCategories = assetCategories.concat([])
      const workingCategory = workingCategories.find(cat => cat.id === category.id)
      workingCategory.parentId = parentId

      const validHierarchy = isValidHierarchy(workingCategories)

      if (!validHierarchy) {
        throw createError(422, 'The change of parentId introduces a circular hierarchy')
      }
    }

    const updateAttrs = _.omit(payload, ['metadata', 'platformData'])
    const updateAttrsBeforeFullDataMerge = Object.assign({}, payload)

    if (metadata) {
      updateAttrs.metadata = Category.rawJsonbMerge('metadata', metadata)
    }
    if (platformData) {
      updateAttrs.platformData = Category.rawJsonbMerge('platformData', platformData)
    }

    category = await Category.query().patchAndFetchById(categoryId, updateAttrs)

    publisher.publish('categoryUpdated', {
      category,
      updateAttrs: updateAttrsBeforeFullDataMerge,
      eventDate: category.updatedDate,
      platformId,
      env
    })

    return Category.expose(category, { req })
  })

  responder.on('remove', async (req) => {
    const platformId = req.platformId
    const env = req.env

    const {
      Asset,
      Category
    } = await getModels({ platformId, env })

    const {
      categoryId
    } = req

    const category = await Category.query().findById(categoryId)
    if (!category) {
      return { id: categoryId }
    }

    const [
      [{ count: nbAssets }],
      [{ count: nbCategories }]
    ] = await Promise.all([
      Asset.query().count().where({ categoryId }),
      Category.query().count().where({ parentId: categoryId })
    ])

    if (nbAssets) {
      throw createError(422, 'Assets are still associated with this category')
    }
    if (nbCategories) {
      throw createError(422, 'Children categories are still associated with this category')
    }

    await Category.query().deleteById(categoryId)

    publisher.publish('categoryDeleted', {
      categoryId,
      category,
      eventDate: new Date().toISOString(),
      platformId,
      env,
      req
    })

    return { id: categoryId }
  })

  // EVENTS

  subscriber.on('categoryCreated', async ({ category, eventDate, platformId, env } = {}) => {
    try {
      const { Event, Category } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'category__created',
        objectId: category.id,
        object: Category.expose(category, { namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { categoryId: category.id },
        message: 'Fail to create event category__created'
      })
    }
  })

  subscriber.on('categoryUpdated', async ({
    category,
    updateAttrs,
    eventDate,
    platformId,
    env
  } = {}) => {
    try {
      const { Event, Category } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'category__updated',
        objectId: category.id,
        object: Category.expose(category, { namespaces: ['*'] }),
        changesRequested: Category.expose(updateAttrs, { namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { categoryId: category.id },
        message: 'Fail to create event category__updated'
      })
    }
  })

  subscriber.on('categoryDeleted', async ({ categoryId, category, eventDate, platformId, env, req } = {}) => {
    try {
      const { Category, Event } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'category__deleted',
        objectId: categoryId,
        object: Category.expose(category, { req, namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { categoryId },
        message: 'Fail to create event category__deleted'
      })
    }
  })
}

function stop () {
  responder.close()
  responder = null

  subscriber.close()
  subscriber = null

  publisher.close()
  publisher = null
}

module.exports = {
  start,
  stop
}
