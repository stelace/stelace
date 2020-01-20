const createError = require('http-errors')
const _ = require('lodash')
const { transaction } = require('objection')

const { logError } = require('../../server/logger')
const { getModels } = require('../models')

const { getObjectId } = require('stelace-util-keys')

const { performListQuery } = require('../util/listQueryBuilder')
const { mergeOrOverwrite } = require('../util/merging')

const {
  computeTransitionsMeta
} = require('../util/transition')

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
    name: 'Asset type Responder',
    key: 'asset-type'
  })

  subscriber = getSubscriber({
    name: 'Asset type subscriber',
    key: 'asset-type',
    namespace: COMMUNICATION_ID,
    subscribesTo: [
      'assetTypeCreated',
      'assetTypeUpdated',
      'assetTypeDeleted'
    ]
  })

  publisher = getPublisher({
    name: 'Asset type publisher',
    key: 'asset-type',
    namespace: COMMUNICATION_ID
  })

  responder.on('list', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { AssetType } = await getModels({ platformId, env })

    const queryBuilder = AssetType.query()

    const assetTypes = await performListQuery({
      queryBuilder,
      paginationActive: false,
      orderConfig: {
        orderBy: 'createdDate',
        order: 'asc'
      }
    })

    return AssetType.exposeAll(assetTypes, { req })
  })

  responder.on('read', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { AssetType } = await getModels({ platformId, env })

    const assetTypeId = req.assetTypeId

    const assetType = await AssetType.query().findById(assetTypeId)
    if (!assetType) {
      throw createError(404)
    }

    return AssetType.expose(assetType, { req })
  })

  responder.on('create', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { AssetType } = await getModels({ platformId, env })

    const fields = [
      'name',
      'timeBased',
      'infiniteStock',
      'pricing',
      'timing',
      'unavailableWhen',
      'transactionProcess',
      'namespaces',
      'isDefault',
      'active',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const createAttrs = Object.assign({
      id: await getObjectId({ prefix: AssetType.idPrefix, platformId, env })
    }, payload)

    if (_.isUndefined(createAttrs.infiniteStock)) createAttrs.infiniteStock = false

    if (createAttrs.transactionProcess) {
      checkTransactionProcess(createAttrs.transactionProcess)
    }

    // if `isDefault` isn't provided, the first asset type is the default
    if (_.isUndefined(createAttrs.isDefault)) {
      const [{ count: nbAssetTypes }] = await AssetType.query().count()
      if (nbAssetTypes === 0) {
        createAttrs.isDefault = true
      }
    }

    // the parameter `isDefault` can change other asset types
    const assetType = await updateDefaultAssetType({
      changeAssetTypeFn: (trx) => {
        return AssetType.query(trx).insert(createAttrs)
      },
      publishEventsFn: (assetType) => {
        publisher.publish('assetTypeCreated', {
          assetType,
          eventDate: assetType.createdDate,
          platformId,
          env,
          req
        })
      },
      isDefault: createAttrs.isDefault,
      platformId,
      env,
      req
    })

    return AssetType.expose(assetType, { req })
  })

  responder.on('update', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { AssetType } = await getModels({ platformId, env })

    const assetTypeId = req.assetTypeId

    const fields = [
      'name',
      'timeBased',
      'infiniteStock',
      'QUANTITY',
      'pricing',
      'timing',
      'unavailableWhen',
      'transactionProcess',
      'namespaces',
      'isDefault',
      'active',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const {
      pricing,
      timing,
      unavailableWhen,
      transactionProcess,
      namespaces,
      isDefault,
      metadata,
      platformData
    } = payload

    const assetType = await AssetType.query().findById(assetTypeId)
    if (!assetType) {
      throw createError(404)
    }

    const updateAttrs = _.omit(payload, ['metadata', 'platformData'])
    const updateAttrsBeforeFullDataMerge = Object.assign({}, payload)

    if (pricing) {
      updateAttrs.pricing = AssetType.rawJsonbMerge('pricing', pricing)
    }
    if (timing) {
      updateAttrs.timing = AssetType.rawJsonbMerge('timing', timing)
    }
    if (unavailableWhen) {
      updateAttrs.unavailableWhen = unavailableWhen
    }
    if (transactionProcess) {
      updateAttrs.transactionProcess = AssetType.rawJsonbMerge('transactionProcess', transactionProcess)
      const newTransactionProcess = _.mergeWith({}, assetType.transactionProcess, transactionProcess, mergeOrOverwrite)
      checkTransactionProcess(newTransactionProcess)
    }
    if (namespaces) {
      updateAttrs.namespaces = AssetType.rawJsonbMerge('namespaces', namespaces)
    }

    if (metadata) {
      updateAttrs.metadata = AssetType.rawJsonbMerge('metadata', metadata)
    }
    if (platformData) {
      updateAttrs.platformData = AssetType.rawJsonbMerge('platformData', platformData)
    }

    // the parameter `isDefault` can change other asset types
    const newAssetType = await updateDefaultAssetType({
      changeAssetTypeFn: (trx) => {
        return AssetType.query(trx).patchAndFetchById(assetTypeId, updateAttrs)
      },
      publishEventsFn: (newAssetType) => {
        publisher.publish('assetTypeUpdated', {
          assetTypeId,
          newAssetType,
          updateAttrs: updateAttrsBeforeFullDataMerge,
          eventDate: newAssetType.updatedDate,
          platformId,
          env,
          req
        })
      },
      isDefault,
      platformId,
      env,
      req
    })

    return AssetType.expose(newAssetType, { req })
  })

  responder.on('remove', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const {
      Asset,
      AssetType
    } = await getModels({ platformId, env })

    const {
      assetTypeId
    } = req

    const assetType = await AssetType.query().findById(assetTypeId)
    if (!assetType) {
      return { id: assetTypeId }
    }

    const [{ count: nbAssets }] = await Asset.query().count().where({ assetTypeId })
    if (nbAssets) {
      throw createError(422, 'Some assets are still associated with this asset type')
    }

    await AssetType.query().deleteById(assetTypeId)

    publisher.publish('assetTypeDeleted', {
      assetTypeId,
      assetType,
      eventDate: new Date().toISOString(),
      platformId,
      env,
      req
    })

    return { id: assetTypeId }
  })

  // EVENTS

  subscriber.on('assetTypeCreated', async ({ assetType, eventDate, platformId, env, req } = {}) => {
    try {
      const { Event, AssetType } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'asset_type__created',
        objectId: assetType.id,
        object: AssetType.expose(assetType, { req, namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { assetTypeId: assetType.id },
        message: 'Fail to create event asset_type__created'
      })
    }
  })

  subscriber.on('assetTypeUpdated', async ({
    assetTypeId,
    updateAttrs,
    newAssetType,
    eventDate,
    platformId,
    env,
    req
  } = {}) => {
    try {
      const { Event, AssetType } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'asset_type__updated',
        objectId: assetTypeId,
        object: AssetType.expose(newAssetType, { req, namespaces: ['*'] }),
        changesRequested: AssetType.expose(updateAttrs, { req, namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { assetTypeId },
        message: 'Fail to create event asset_type__updated and associated events'
      })
    }
  })

  subscriber.on('assetTypeDeleted', async ({ assetTypeId, assetType, eventDate, platformId, env, req } = {}) => {
    try {
      const { AssetType, Event } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'asset_type__deleted',
        objectId: assetTypeId,
        object: AssetType.expose(assetType, { req, namespaces: ['*'] }),
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { assetTypeId },
        message: 'Fail to create event asset_type__deleted'
      })
    }
  })

  // INTERNAL

  responder.on('_getAssetType', async (req) => {
    const { assetTypeId, platformId, env } = req

    const { AssetType } = await getModels({ platformId, env })

    const assetType = await AssetType.query().findById(assetTypeId)
    return assetType
  })
}

function checkTransactionProcess (transactionProcess) {
  const meta = computeTransitionsMeta(transactionProcess)

  if (!meta.initStates.includes(transactionProcess.initStatus)) {
    throw createError(422, 'The provided init status does not appear as `from` property in transitions')
  }
  if (!meta.allStates.includes(transactionProcess.cancelStatus)) {
    throw createError(422, 'The provided cancel status does not appear in transitions')
  }
}

async function updateDefaultAssetType ({
  changeAssetTypeFn,
  publishEventsFn,
  isDefault,
  platformId,
  env,
  req
}) {
  const { AssetType } = await getModels({ platformId, env })

  const knex = AssetType.knex()
  let newAssetType
  let impactedAssetTypes // `isDefault` parameter can update other asset types

  if (isDefault) {
    await transaction(knex, async (trx) => {
      newAssetType = await changeAssetTypeFn(trx)

      impactedAssetTypes = await AssetType.query(trx)
        .patch({ isDefault: false })
        .where({ isDefault: true })
        .whereNot('id', newAssetType.id)
        .returning('*')
    })
  } else {
    newAssetType = await changeAssetTypeFn()
  }

  publishEventsFn(newAssetType)

  if (impactedAssetTypes) {
    impactedAssetTypes.forEach(assetType => {
      publisher.publish('assetTypeUpdated', {
        assetTypeId: assetType.id,
        newAssetType: assetType,
        updateAttrs: { isDefault: false },
        eventDate: assetType.updatedDate,
        platformId,
        env,
        req
      })
    })
  }

  return newAssetType
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
