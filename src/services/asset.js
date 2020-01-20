const createError = require('http-errors')
const _ = require('lodash')
const { transaction } = require('objection')
const bluebird = require('bluebird')

const { getObjectId } = require('stelace-util-keys')

const { logError } = require('../../server/logger')
const { getModels } = require('../models')

const { isValidCurrency } = require('../util/currency')
const { performListQuery } = require('../util/listQueryBuilder')

const {
  getCurrentUserId
} = require('../util/user')

let responder
let subscriber
let publisher
let assetTypeRequester
let configRequester
let transactionRequester
let namespaceRequester
let availabilityRequester

function start ({ communication }) {
  const {
    getResponder,
    getSubscriber,
    getPublisher,
    getRequester,
    COMMUNICATION_ID
  } = communication

  responder = getResponder({
    name: 'Asset Responder',
    key: 'asset'
  })

  subscriber = getSubscriber({
    name: 'Asset subscriber',
    key: 'asset',
    namespace: COMMUNICATION_ID,
    subscribesTo: [
      'assetCreated',
      'assetUpdated',
      'assetDeleted'
    ]
  })

  publisher = getPublisher({
    name: 'Asset publisher',
    key: 'asset',
    namespace: COMMUNICATION_ID
  })

  assetTypeRequester = getRequester({
    name: 'Asset service > Asset type Requester',
    key: 'asset-type'
  })

  configRequester = getRequester({
    name: 'Asset service > Config Requester',
    key: 'config'
  })

  transactionRequester = getRequester({
    name: 'Asset service > Transaction Requester',
    key: 'transaction'
  })

  namespaceRequester = getRequester({
    name: 'Asset service > Namespace Requester',
    key: 'namespace'
  })

  availabilityRequester = getRequester({
    name: 'Asset service > Availability Requester',
    key: 'availability'
  })

  responder.on('list', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Asset } = await getModels({ platformId, env })

    const {
      orderBy,
      order,

      page,
      nbResultsPerPage,

      id,
      createdDate,
      updatedDate,
      ownerId,
      categoryId,
      assetTypeId,
      validated,
      active,
      quantity,
      price
    } = req

    const currentUserId = getCurrentUserId(req)

    const queryBuilder = Asset.query()

    const paginationMeta = await performListQuery({
      queryBuilder,
      filters: {
        ids: {
          dbField: 'id',
          value: id,
          transformValue: 'array',
          query: 'inList'
        },
        createdDate: {
          dbField: 'createdDate',
          value: createdDate,
          query: 'range'
        },
        updatedDate: {
          dbField: 'updatedDate',
          value: updatedDate,
          query: 'range'
        },
        ownersIds: {
          dbField: 'ownerId',
          value: ownerId,
          transformValue: 'array',
          query: 'inList'
        },
        categoriesIds: {
          dbField: 'categoryId',
          value: categoryId,
          transformValue: 'array',
          query: 'inList'
        },
        assetTypesIds: {
          dbField: 'assetTypeId',
          value: assetTypeId,
          transformValue: 'array',
          query: 'inList'
        },
        validated: {
          dbField: 'validated',
          value: validated
        },
        active: {
          dbField: 'active',
          value: active
        },
        quantity: {
          dbField: 'quantity',
          value: quantity,
          query: 'range'
        },
        price: {
          dbField: 'price',
          value: price,
          query: 'range'
        }
      },
      beforeQueryFn: async ({ values }) => {
        const { ownersIds } = values

        // the owner can only filter on its own assets if she has no all permissions
        if (!req._matchedPermissions['asset:list:all']) {
          const isAllowed = currentUserId && ownersIds && ownersIds.length === 1 && ownersIds.includes(currentUserId)

          if (!isAllowed) {
            throw createError(403)
          }
        }
      },
      paginationActive: true,
      paginationConfig: {
        page,
        nbResultsPerPage
      },
      orderConfig: {
        orderBy,
        order
      }
    })

    const indexedDynamicNamespaces = await namespaceRequester.send({
      type: 'getDynamicNamespaces',
      platformId,
      env,
      readNamespaces: req._readNamespaces,
      listObjects: paginationMeta.results,
      currentUserId,
      editActive: false
    })

    paginationMeta.results = paginationMeta.results.map(asset => {
      const dynamicResult = indexedDynamicNamespaces[asset.id]
      return Asset.expose(asset, { req, namespaces: dynamicResult.dynamicReadNamespaces })
    })

    return paginationMeta
  })

  responder.on('read', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Asset } = await getModels({ platformId, env })

    const assetId = req.assetId

    const asset = await Asset.query().findById(assetId)
    if (!asset) {
      throw createError(404)
    }

    const currentUserId = getCurrentUserId(req)

    const isSelf = Asset.isSelf(asset, currentUserId)
    if (!req._matchedPermissions['asset:read:all'] && !isSelf) {
      throw createError(403)
    }

    const { dynamicReadNamespaces } = await namespaceRequester.send({
      type: 'getDynamicNamespaces',
      platformId,
      env,
      readNamespaces: req._readNamespaces,
      object: asset,
      currentUserId,
      editActive: false
    })

    const readNamespaces = dynamicReadNamespaces

    return Asset.expose(asset, { req, namespaces: readNamespaces })
  })

  responder.on('create', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const {
      CustomAttribute,
      Asset,
      Category,
      AssetType
    } = await getModels({ platformId, env })

    const fields = [
      'name',
      'ownerId',
      'description',
      'categoryId',
      'validated',
      'active',
      'locations',
      'assetTypeId',
      'quantity',
      'price',
      'currency',
      'customAttributes',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const createAttrs = Object.assign({
      id: await getObjectId({ prefix: Asset.idPrefix, platformId, env })
    }, payload)

    const currentUserId = getCurrentUserId(req)

    // cannot create as another user
    if (!req._matchedPermissions['asset:create:all'] && createAttrs.ownerId && createAttrs.ownerId !== currentUserId) {
      throw createError(403)
    }

    // automatically set to its own asset if there is no ownerId param
    if (typeof createAttrs.ownerId === 'undefined' && currentUserId) {
      createAttrs.ownerId = currentUserId
    }

    const isSelf = Asset.isSelf(createAttrs, currentUserId)
    if (!req._matchedPermissions['asset:create:all'] && !isSelf) {
      throw createError(403)
    }

    const {
      dynamicReadNamespaces,
      isValidEditNamespaces
    } = await namespaceRequester.send({
      type: 'getDynamicNamespaces',
      platformId,
      env,
      readNamespaces: req._readNamespaces,
      editNamespaces: req._editNamespaces,
      object: createAttrs,
      currentUserId
    })

    if (!isValidEditNamespaces) {
      throw createError(403, 'Invalid namespaces')
    }

    const {
      categoryId,
      assetTypeId,
      customAttributes: customAttributesObj,
      currency,
      validated
    } = payload

    if (categoryId) {
      const category = await Category.query().findById(categoryId)
      if (!category) {
        throw createError(422, 'Asset category not found')
      }
    }

    if (currency && !isValidCurrency(currency)) {
      throw createError(400, 'Invalid currency')
    }

    let assetType

    if (assetTypeId) {
      assetType = await AssetType.query().findById(assetTypeId)
      if (!assetType) {
        throw createError(422, 'Asset type not found')
      }
    } else {
      const assetTypes = await AssetType.query()
      let defaultAssetType = assetTypes.find(assetType => assetType.isDefault)

      if (!assetTypes.length) {
        defaultAssetType = await assetTypeRequester.send({
          type: 'create',
          platformId,
          env,
          timeBased: false,
          infiniteStock: false
        })
      } else if (!defaultAssetType) {
        throw createError(400, 'Missing asset type ID and not asset type with `isDefault` enabled')
      }

      assetType = defaultAssetType
      createAttrs.assetTypeId = defaultAssetType.id
    }

    if (!assetType.active) {
      throw createError(422, 'Asset type inactive')
    }

    if (customAttributesObj) {
      const customAttributes = await CustomAttribute.query()

      const checkCustomAttribute = CustomAttribute.checkObject(customAttributesObj, customAttributes)
      if (!checkCustomAttribute.result) {
        const errorFields = checkCustomAttribute.errors.map(error => error.name)

        throw createError(422, `Invalid custom attributes (${errorFields.join(', ')})`, {
          public: {
            errors: checkCustomAttribute.errors
          }
        })
      }
    }

    if (assetType.infiniteStock) {
      createAttrs.quantity = 1
    }

    const config = await configRequester.send({
      type: '_getConfig',
      platformId,
      env,
      access: 'default'
    })

    if (typeof validated === 'undefined') {
      if (typeof config.stelace.assetsValidationAutomatic !== 'undefined') {
        createAttrs.validated = !!config.stelace.assetsValidationAutomatic
      } else {
        createAttrs.validated = true
      }
    }

    const asset = await Asset.query().insert(createAttrs)

    try {
      await availabilityRequester.send({
        type: '_syncInternalAvailability',
        assetsIds: [asset.id],
        platformId,
        env
      })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { assetId: asset.id },
        message: 'Fail to sync internal availability'
      })
    }

    publisher.publish('assetCreated', {
      asset,
      eventDate: asset.createdDate,
      platformId,
      env,
      req
    })

    return Asset.expose(asset, { req, namespaces: dynamicReadNamespaces })
  })

  responder.on('update', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const {
      CustomAttribute,
      Asset,
      Category,
      AssetType
    } = await getModels({ platformId, env })

    const assetId = req.assetId

    const fields = [
      'name',
      'description',
      'categoryId',
      'validated',
      'active',
      'locations',
      'assetTypeId',
      'quantity',
      'price',
      'currency',
      'customAttributes',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const {
      categoryId,
      assetTypeId,
      quantity,
      customAttributes: customAttributesObj,
      currency,
      metadata,
      platformData
    } = payload

    if (currency && !isValidCurrency(currency)) {
      throw createError(400, 'Invalid currency')
    }

    const asset = await Asset.query().findById(assetId)
    if (!asset) {
      throw createError(404)
    }

    const currentUserId = getCurrentUserId(req)

    const isSelf = Asset.isSelf(asset, currentUserId)
    if (!req._matchedPermissions['asset:edit:all'] && !isSelf) {
      throw createError(403)
    }

    if (categoryId) {
      const category = await Category.query().findById(categoryId)
      if (!category) {
        throw createError(422, 'Asset category not found')
      }
    }

    const assetType = await AssetType.query().findById(assetTypeId || asset.assetTypeId)
    if (!assetType) {
      throw createError(422, 'Asset type not found')
    }
    if (!assetType.active) {
      throw createError(422, 'Asset type inactive')
    }

    if (customAttributesObj) {
      const customAttributes = await CustomAttribute.query()

      const checkCustomAttribute = CustomAttribute.checkObject(customAttributesObj, customAttributes)
      if (!checkCustomAttribute.result) {
        const errorFields = checkCustomAttribute.errors.map(error => error.name)

        throw createError(422, `Invalid custom attributes (${errorFields.join(', ')})`, {
          public: {
            errors: checkCustomAttribute.errors
          }
        })
      }
    }

    const updateAttrs = _.omit(payload, ['customAttributes', 'metadata', 'platformData'])
    const updateAttrsBeforeFullDataMerge = Object.assign({}, payload)

    if (assetType && typeof quantity !== 'undefined') {
      // No equivalent to Javascript Infinity in PostgreSQL
      if (assetType.infiniteStock) updateAttrs.quantity = 1
    }

    /*
    // WARNING: WRONG way to update JSON objects since this can break simple concurrent requests
    // on different object keys
    // Example: metadata.paymentDate custom timestamp PATCH request can be overwritten
    // by another concurrent PATCH request on metadata.paymentAddress…

    // We need native PostgreSQL query for this (cf. concurrency.md docs)
    // as we do for column updates with Objection `patch` method

    // cf. docs: concurrency.md

    const newCustomAttributes = Asset.getCustomData(asset, {
      customAttributes: customAttributesObj
    })
    if (newCustomAttributes) {
      updateAttrs.customAttributes = newCustomAttributes
    }

    const newMetadata = Asset.getCustomData(asset, { metadata })
    if (newMetadata) {
      updateAttrs.metadata = newMetadata
    }

    const newplatformData = Asset.getCustomData(asset, { platformData })
    if (newplatformData) {
      updateAttrs.platformData = newplatformData
    }
    */

    // getCustomData can still be useful to save final diff object in …__updated event

    if (customAttributesObj) {
      updateAttrs.customAttributes = Asset.rawJsonbMerge('customAttributes', customAttributesObj)
    }
    if (metadata) {
      updateAttrs.metadata = Asset.rawJsonbMerge('metadata', metadata)
    }
    if (platformData) {
      updateAttrs.platformData = Asset.rawJsonbMerge('platformData', platformData)
    }

    const {
      dynamicReadNamespaces,
      isValidEditNamespaces
    } = await namespaceRequester.send({
      type: 'getDynamicNamespaces',
      platformId,
      env,
      readNamespaces: req._readNamespaces,
      editNamespaces: req._editNamespaces,
      object: Object.assign({}, asset, { metadata, platformData }),
      deltaObject: { metadata, platformData },
      currentUserId
    })

    if (!isValidEditNamespaces) {
      throw createError(403, 'Invalid namespace')
    }

    const newAsset = await Asset.query().patchAndFetchById(assetId, updateAttrs)

    try {
      const shouldSync = typeof updateAttrs.assetTypeId !== 'undefined' ||
        typeof updateAttrs.quantity !== 'undefined'

      if (shouldSync) {
        await availabilityRequester.send({
          type: '_syncInternalAvailability',
          assetsIds: [asset.id],
          platformId,
          env
        })
      }
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { assetId: asset.id },
        message: 'Fail to sync internal availability'
      })
    }

    publisher.publish('assetUpdated', {
      assetId,
      asset,
      newAsset,
      updateAttrs,
      updateAttrsBeforeFullDataMerge,
      eventDate: newAsset.updatedDate,
      platformId,
      env,
      req
    })

    return Asset.expose(newAsset, { req, namespaces: dynamicReadNamespaces })
  })

  responder.on('remove', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Transaction, Asset, Availability } = await getModels({ platformId, env })

    const {
      assetId
    } = req

    const asset = await Asset.query().findById(assetId)
    if (!asset) {
      return { id: assetId }
    }

    const currentUserId = getCurrentUserId(req)

    const isSelf = Asset.isSelf(asset, currentUserId)
    if (!req._matchedPermissions['asset:remove:all'] && !isSelf) {
      throw createError(403)
    }

    // fetch pending transactions
    // but haven't been not completed nor cancelled
    const [{ count: nbTransactions }] = await Transaction.query().count()
      .where({ assetId: asset.id })
      .whereNull('completedDate')
      .whereNull('cancelledDate')

    if (nbTransactions) {
      throw createError(422, 'Pending transactions for this asset')
    }

    // EXCEPTION: do not emit events for availability removal
    // Asset availabilities aren't core objects so we can "silently" remove them
    await Availability.query().delete().where({
      assetId: asset.id
    })

    await Asset.query().deleteById(assetId)

    try {
      await availabilityRequester.send({
        type: '_removeInternalAvailability',
        assetsIds: [asset.id],
        platformId,
        env
      })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { assetId: asset.id },
        message: 'Fail to remove internal availability'
      })
    }

    publisher.publish('assetDeleted', {
      assetId, // needed since…
      asset, // … this can be undefined
      eventDate: new Date().toISOString(),
      platformId,
      env,
      req
    })

    return { id: assetId }
  })

  // EVENTS

  subscriber.on('assetCreated', async ({ asset, eventDate, platformId, env, req } = {}) => {
    try {
      const { Event, Asset } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'asset__created',
        objectId: asset.id,
        object: Asset.expose(asset, { req, namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { assetId: asset.id },
        message: 'Fail to create event asset__created'
      })
    }
  })

  subscriber.on('assetUpdated', async ({
    assetId,

    // Full DB update object is needed to get deltas using _.isEqual
    updateAttrs,
    updateAttrsBeforeFullDataMerge,

    // This can be provided to get specific update event without passing full `asset`
    // `deltas` must have the same structure as object returned by Event.getUpdatedEventDeltas
    deltas,

    asset,
    newAsset,
    eventDate,
    eventMetadata,
    platformId,
    env,
    req
  } = {}) => {
    try {
      const { Event, Asset } = await getModels({ platformId, env })

      if (typeof deltas === 'undefined') {
        const config = Event.getUpdatedEventDeltasConfig('asset')
        deltas = Event.getUpdatedEventDeltas(config, updateAttrsBeforeFullDataMerge || updateAttrs, asset)
      }

      const knex = Event.knex()
      const parentEventId = await getObjectId({ prefix: Event.idPrefix, platformId, env })

      // newAsset can be omitted for performance reasons
      const exposedNewAsset = newAsset ? Asset.expose(newAsset, { req, namespaces: ['*'] }) : {}

      await transaction(knex, async (trx) => {
        await bluebird.each(Object.keys(deltas), type => {
          const delta = deltas[type]

          return Event.createEvent({
            createdDate: eventDate,
            type,
            objectId: assetId,
            // not exposing object in child events with deltas only
            changesRequested: Asset.expose(delta, { req, namespaces: ['*'] }),
            parentId: parentEventId,
            // populate relatedObjectsIds
            _tmpObject: exposedNewAsset,
            metadata: eventMetadata
          }, { platformId, env, queryContext: trx })
        })

        const changes = updateAttrsBeforeFullDataMerge || updateAttrs
        await Event.createEvent({
          id: parentEventId,
          createdDate: eventDate,
          type: 'asset__updated',
          objectId: assetId,
          object: exposedNewAsset,
          changesRequested: Asset.expose(changes, { req, namespaces: ['*'] }),
          metadata: eventMetadata
        }, { platformId, env, queryContext: trx })
      })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { assetId },
        message: 'Fail to create event asset__updated and associated events'
      })
    }
  })

  subscriber.on('assetDeleted', async ({
    assetId,
    asset,
    eventDate,
    platformId,
    env,
    req
  } = {}) => {
    try {
      const { Event, Asset } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'asset__deleted',
        objectId: assetId,
        object: Asset.expose(asset, { req, namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { assetId },
        message: 'Fail to create event asset__deleted'
      })
    }
  })

  // INTERNAL

  responder.on('_changeQuantity', async (req) => {
    const {
      transaction,
      actionType,
      platformId,
      env
    } = req

    if (!['add', 'remove'].includes(actionType)) {
      throw new Error('Action type should be: add or remove')
    }

    if (!transaction.assetId) return // stop here if transaciton has no associated asset

    const { Asset } = await getModels({ platformId, env })

    const asset = await Asset.query().findById(transaction.assetId)
    if (!asset) return // asset doesn't exist anymore

    const { timeBased, infiniteStock } = transaction.assetType

    // asset quantity change if this is timeless and there is a stock
    const quantityCanChange = (!timeBased && !infiniteStock)

    if (!quantityCanChange) return asset

    const updateAttrs = {}
    if (actionType === 'add') {
      updateAttrs.quantity = asset.quantity + transaction.quantity
    } else if (actionType === 'remove') {
      updateAttrs.quantity = Math.max(asset.quantity - transaction.quantity, 0)
    }

    const newAsset = await Asset.query().patchAndFetchById(asset.id, updateAttrs)

    publisher.publish('assetUpdated', {
      assetId: asset.id,
      asset,
      newAsset,
      updateAttrs,
      eventDate: newAsset.updatedDate,
      platformId,
      env,
      req
    })

    return newAsset
  })
}

function stop () {
  responder.close()
  responder = null

  subscriber.close()
  subscriber = null

  publisher.close()
  publisher = null

  assetTypeRequester.close()
  assetTypeRequester = null

  configRequester.close()
  configRequester = null

  transactionRequester.close()
  transactionRequester = null

  namespaceRequester.close()
  namespaceRequester = null

  availabilityRequester.close()
  availabilityRequester = null
}

module.exports = {
  start,
  stop
}
