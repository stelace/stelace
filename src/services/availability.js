const createError = require('http-errors')
const _ = require('lodash')

const { logError } = require('../../server/logger')
const { getModels } = require('../models')

const {
  getAvailabilityPeriodGraph
} = require('../util/availability')
const {
  shouldAffectAvailability
} = require('../util/transaction')

const { getObjectId } = require('stelace-util-keys')

const { performListQuery } = require('../util/listQueryBuilder')

const {
  // getPureDate,
  isValidCronPattern,
  isValidTimezone,
  computeRecurringPeriods,
  computeDate
} = require('../util/time')

const {
  getCurrentUserId
} = require('../util/user')

let responder
let subscriber
let publisher
let transactionRequester

function start ({ communication }) {
  const {
    getResponder,
    getSubscriber,
    getRequester,
    getPublisher,
    COMMUNICATION_ID
  } = communication

  responder = getResponder({
    name: 'Availability Responder',
    key: 'availability'
  })

  subscriber = getSubscriber({
    name: 'Availability subscriber',
    key: 'availability',
    namespace: COMMUNICATION_ID,
    subscribesTo: [
      'availabilityCreated',
      'availabilityUpdated',
      'availabilityDeleted'
    ]
  })

  publisher = getPublisher({
    name: 'Availability publisher',
    key: 'availability',
    namespace: COMMUNICATION_ID
  })

  transactionRequester = getRequester({
    name: 'Availability service > Transaction Requester',
    key: 'transaction'
  })

  responder.on('getGraph', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const {
      Asset,
      AssetType,
      Availability
    } = await getModels({ platformId, env })

    const {
      assetId
    } = req

    const asset = await Asset.query().findById(assetId)
    if (!asset) {
      throw createError(422, 'Asset not found')
    }

    if (!req._matchedPermissions['availability:list:all']) {
      const currentUserId = getCurrentUserId(req)

      const isSelf = Asset.isSelf(asset, currentUserId)
      if (!req._matchedPermissions['availability:list:all'] && !isSelf) {
        throw createError(403)
      }
    }

    const [
      assetType,
      availabilities,
      indexedTransactions
    ] = await Promise.all([
      AssetType.query().findById(asset.assetTypeId),
      Availability.query().where('assetId', assetId),
      transactionRequester.send({
        type: '_filter',
        assetsIds: [assetId],
        platformId,
        env
      })
    ])

    if (!assetType) {
      throw createError(422, 'Asset type not found')
    }

    const transactions = indexedTransactions[assetId]
    const filteredTransactions = transactions.filter(shouldAffectAvailability)

    const graph = getAvailabilityPeriodGraph({
      transactions: filteredTransactions,
      availabilities,
      defaultQuantity: asset.quantity
    })

    // explicitly expose properties to not "leak" properties
    // just in case the function returns more properties in the future
    return {
      graphDates: graph.graphDates,
      defaultQuantity: graph.defaultQuantity,
      totalUsedQuantity: graph.totalUsedQuantity
    }
  })

  responder.on('list', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const {
      Asset,
      Availability
    } = await getModels({ platformId, env })

    const {
      orderBy,
      order,

      page,
      nbResultsPerPage,

      assetId
    } = req

    if (!req._matchedPermissions['availability:list:all']) {
      const asset = await Asset.query().findById(assetId)
      if (!asset) {
        throw createError(422, 'Asset not found')
      }

      const currentUserId = getCurrentUserId(req)

      const isSelf = Asset.isSelf(asset, currentUserId)
      if (!req._matchedPermissions['availability:list:all'] && !isSelf) {
        throw createError(403)
      }
    }

    const queryBuilder = Availability.query()

    const paginationMeta = await performListQuery({
      queryBuilder,
      filters: {
        assetId: {
          dbField: 'assetId',
          value: assetId
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

    paginationMeta.results = Availability.exposeAll(paginationMeta.results, { req })

    return paginationMeta
  })

  responder.on('create', async (req) => {
    const assetId = req.assetId

    const fields = [
      'startDate',
      'endDate',
      'quantity',
      'recurringPattern',
      'recurringTimezone',
      'recurringDuration',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    if (typeof payload.quantity === 'number') {
      payload.quantity = '' + payload.quantity
    }

    const {
      startDate,
      endDate,
      recurringPattern,
      recurringDuration,
      recurringTimezone,
    } = payload

    const platformId = req.platformId
    const env = req.env
    const {
      InternalAvailability,
      Asset,
      Availability,
      AssetType
    } = await getModels({ platformId, env })

    const createAttrs = Object.assign({
      id: await getObjectId({ prefix: Availability.idPrefix, platformId, env }),
      assetId
    }, payload)

    if (endDate <= startDate) {
      throw createError(422, 'Start date must be before end date')
    }

    const creatingRecurring = recurringPattern || recurringDuration

    if (creatingRecurring) {
      if (!recurringPattern) {
        throw createError(400, 'Missing recurring pattern')
      }
      if (!recurringDuration) {
        throw createError(400, 'Missing recurring duration')
      }
      if (!recurringTimezone) {
        createAttrs.recurringTimezone = recurringTimezone
      }

      if (recurringPattern && !isValidCronPattern(recurringPattern)) {
        throw createError(400, 'Invalid recurring pattern')
      }
      if (recurringTimezone && !isValidTimezone(recurringTimezone)) {
        throw createError(400, 'Invalid recurring timezone')
      }

      const recurringPeriods = computeRecurringPeriods(recurringPattern, {
        startDate,
        endDate,
        timezone: recurringTimezone,
        duration: recurringDuration
      })

      if (isRecurringPeriodsOverlapped(recurringPeriods)) {
        throw createError(422, 'Recurring periods overlap each other')
      }
    }

    const checkPeriodRange = creatingRecurring

    if (checkPeriodRange) {
      const maxEndDate = getAvailabilityMaxEndDate(startDate)
      if (maxEndDate < endDate) {
        throw createError(422,
          'Recurring availbility period cannot exceed one year. ' +
          `End date must be before the date "${maxEndDate}"`
        )
      }
    }

    const asset = await Asset.query().findById(assetId)
    if (!asset) {
      throw createError(422, 'Asset not found')
    }

    const currentUserId = getCurrentUserId(req)

    const isSelf = Asset.isSelf(asset, currentUserId)
    if (!req._matchedPermissions['availability:create:all'] && !isSelf) {
      throw createError(403)
    }

    const assetType = await AssetType.query().findById(asset.assetTypeId)
    if (!assetType) {
      throw createError(422, 'No asset type is associated to the asset')
    }

    const { timeBased, infiniteStock } = assetType

    if (!timeBased || infiniteStock) {
      throw createError(400)
    }

    const availability = await Availability.query().insert(createAttrs)

    try {
      await InternalAvailability.syncInternalAvailability({ assetsIds: [asset.id], platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { assetId: asset.id },
        message: 'Fail to sync internal availability'
      })
    }

    publisher.publish('availabilityCreated', {
      availability,
      eventDate: availability.createdDate,
      platformId,
      env
    })

    return Availability.expose(availability, { req })
  })

  responder.on('update', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const {
      InternalAvailability,
      Asset,
      Availability,
      AssetType
    } = await getModels({ platformId, env })

    const {
      availabilityId
    } = req

    const fields = [
      'startDate',
      'endDate',
      'quantity',
      'recurringPattern',
      'recurringTimezone',
      'recurringDuration',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    if (typeof payload.quantity === 'number') {
      payload.quantity = '' + payload.quantity
    }

    const {
      startDate,
      endDate,
      recurringPattern,
      recurringDuration,
      recurringTimezone,
      metadata,
      platformData
    } = payload

    const updateAttrs = _.omit(payload, ['metadata', 'platformData'])
    const updateAttrsBeforeFullDataMerge = Object.assign({}, payload)

    const availability = await Availability.query().findById(availabilityId)
    if (!availability) {
      throw createError(404)
    }

    const newStartDate = startDate || availability.startDate
    const newEndDate = endDate || availability.endDate

    if (newEndDate <= newStartDate) {
      throw createError(422, 'Start date must be before end date')
    }

    const hadRecurring = !!availability.recurringPattern
    const updatingRecurring = typeof recurringPattern !== 'undefined' ||
      typeof recurringTimezone !== 'undefined' ||
      typeof recurringDuration !== 'undefined'

    if (updatingRecurring) {
      if (hadRecurring) {
        if (!recurringPattern || !recurringTimezone || !recurringDuration) {
          throw createError(422, 'Recurring parameters that are previously set are not nullable')
        }
      } else {
        if (!recurringPattern) {
          throw createError(400, 'Missing recurring pattern')
        }
        if (!recurringDuration) {
          throw createError(400, 'Missing recurring duration')
        }
        if (recurringTimezone) {
          updateAttrs.recurringTimezone = recurringTimezone
        }
      }

      if (recurringPattern && !isValidCronPattern(recurringPattern)) {
        throw createError(400, `Invalid recurring pattern ${recurringPattern}`)
      }
      if (recurringTimezone && !isValidTimezone(recurringTimezone)) {
        throw createError(400, `Invalid recurring timezone ${recurringTimezone}`)
      }

      const pattern = recurringPattern || availability.recurringPattern
      const timezone = recurringTimezone || availability.recurringTimezone
      const duration = recurringDuration || availability.recurringDuration

      const recurringPeriods = computeRecurringPeriods(pattern, {
        startDate: newStartDate,
        endDate: newEndDate,
        timezone,
        duration
      })

      if (isRecurringPeriodsOverlapped(recurringPeriods)) {
        throw createError(422, 'Recurring periods overlap each other')
      }
    }

    const checkPeriodRange = hadRecurring || updatingRecurring
    if (endDate && checkPeriodRange) {
      const maxEndDate = getAvailabilityMaxEndDate(newStartDate)
      if (maxEndDate < newEndDate) {
        throw createError(422,
          'Recurring availability period cannot exceed one year. ' +
          `End date must be before the date "${maxEndDate}"`
        )
      }
    }

    const asset = await Asset.query().findById(availability.assetId)
    if (!asset) {
      throw createError(422, 'Asset not found')
    }

    const currentUserId = getCurrentUserId(req)

    const isSelf = Asset.isSelf(asset, currentUserId)
    if (!req._matchedPermissions['availability:edit:all'] && !isSelf) {
      throw createError(403)
    }

    const assetType = await AssetType.query().findById(asset.assetTypeId)
    if (!assetType) {
      throw createError(422, 'No asset type is associated to the asset')
    }

    const { timeBased, infiniteStock } = assetType

    if (!timeBased || infiniteStock) {
      throw createError(400)
    }

    if (metadata) {
      updateAttrs.metadata = Availability.rawJsonbMerge('metadata', metadata)
    }
    if (platformData) {
      updateAttrs.platformData = Availability.rawJsonbMerge('platformData', platformData)
    }

    const newAvailability = await Availability.query().patchAndFetchById(availabilityId, updateAttrs)

    try {
      await InternalAvailability.syncInternalAvailability({ assetsIds: [asset.id], platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { assetId: asset.id },
        message: 'Fail to sync internal availability'
      })
    }

    publisher.publish('availabilityUpdated', {
      newAvailability,
      eventDate: newAvailability.updatedDate,
      updateAttrs: updateAttrsBeforeFullDataMerge,
      platformId,
      env
    })

    return Availability.expose(newAvailability, { req })
  })

  responder.on('remove', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const {
      InternalAvailability,
      Asset,
      Availability
    } = await getModels({ platformId, env })

    const {
      availabilityId
    } = req

    const availability = await Availability.query().findById(availabilityId)
    if (!availability) {
      return { id: availabilityId }
    }

    const asset = await Asset.query().findById(availability.assetId)
    if (!asset) {
      throw createError(422, 'Asset not found')
    }

    const currentUserId = getCurrentUserId(req)

    const isSelf = Asset.isSelf(asset, currentUserId)
    if (!req._matchedPermissions['availability:remove:all'] && !isSelf) {
      throw createError(403)
    }

    await Availability.query().deleteById(availabilityId)

    try {
      await InternalAvailability.syncInternalAvailability({ assetsIds: [asset.id], platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { assetId: asset.id },
        message: 'Fail to sync internal availability'
      })
    }

    publisher.publish('availabilityDeleted', {
      availabilityId, // needed since…
      availability, // … this can be undefined
      eventDate: new Date().toISOString(),
      platformId,
      env
    })

    return { id: availabilityId }
  })

  // EVENTS

  subscriber.on('availabilityCreated', async ({ availability, eventDate, platformId, env } = {}) => {
    try {
      const { Event, Availability } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'availability__created',
        objectId: availability.id,
        object: Availability.expose(availability, { namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { availabilityId: availability.id },
        message: 'Fail to create event availability__created'
      })
    }
  })

  subscriber.on('availabilityUpdated', async ({
    newAvailability,
    updateAttrs,
    eventDate,
    platformId,
    env
  } = {}) => {
    try {
      const { Event, Availability } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'availability__updated',
        objectId: newAvailability.id,
        object: Availability.expose(newAvailability, { namespaces: ['*'] }),
        changesRequested: Availability.expose(updateAttrs, { namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { availabilityId: newAvailability.id },
        message: 'Fail to create event availability__updated'
      })
    }
  })

  subscriber.on('availabilityDeleted', async ({
    availabilityId,
    availability,
    eventDate,
    platformId,
    env
  } = {}) => {
    try {
      const { Event, Availability } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'availability__deleted',
        objectId: availabilityId,
        object: Availability.expose(availability, { namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { availabilityId },
        message: 'Fail to create event availability__deleted'
      })
    }
  })

  // INTERNAL

  /**
   * check assets availability based on period, quantity and transaction status
   * @param {String[]} assetsIds - only compute the availability on those assets IDs
   * @param {String}   [startDate = now] - start date of the searched period
   * @param {String}   [endDate] - end date of the searched period, if only startDate is provided then the searched period is from startDate to Infinity
   * @param {Number}   [quantity = 1] - the searched quantity
   * @param {Boolean}  [fullPeriod = true] - if true and startDate, endDate are provided, the asset must be available during the full searched period
   * @param {String|String[]} [unavailableWhen = ['validated', 'completed']] - only transactions with the provided status block availability
   * @param {String}   platformId
   * @param {String}   env
   */
  responder.on('_isAvailable', async (req) => {
    const {
      assetsIds,
      startDate = new Date().toISOString(),
      endDate,
      quantity = 1,
      fullPeriod = true,
      unavailableWhen,
      platformId,
      env
    } = req

    const {
      Asset,
      AssetType
    } = await getModels({ platformId, env })

    const [
      assets,
      assetTypes
    ] = await Promise.all([
      Asset.query().whereIn('id', assetsIds),
      AssetType.query()
    ])

    const indexedAssetTypes = _.keyBy(assetTypes, 'id')

    let hashAssets = {}

    const searchAvUnlimitedAssetsIds = []
    const searchAvAssetsIds = []

    assets.forEach(asset => {
      const assetType = indexedAssetTypes[asset.assetTypeId]
      if (!assetType) {
        throw new Error('Unfound asset type')
      }

      const { timeBased, infiniteStock } = assetType

      // separate assets based on their asset type

      // if this is timeless, only compute with the asset quantity
      if (!timeBased) {
        hashAssets[asset.id] = quantity <= asset.quantity
      // if the quantity is unlimited, only search for available periods (no transactions involved and no quantity issues)
      } else if (infiniteStock) {
        searchAvUnlimitedAssetsIds.push(asset.id)
      } else {
        searchAvAssetsIds.push(asset.id)
      }
    })

    const [
      avResult,
      unlimitedAvResult
    ] = await Promise.all([
      searchAvAssetsIds.length ? getAvailableAssets({
        assetsIds: searchAvAssetsIds,
        startDate,
        endDate,
        quantity,
        unavailableWhen,
        assetTypes,
        isUnlimitedQuantity: false,
        fullPeriod,
        platformId,
        env
      }) : {},
      searchAvUnlimitedAssetsIds.length ? getAvailableAssets({
        assetsIds: searchAvUnlimitedAssetsIds,
        startDate,
        endDate,
        quantity,
        unavailableWhen,
        assetTypes,
        isUnlimitedQuantity: true,
        fullPeriod,
        platformId,
        env
      }) : {}
    ])

    hashAssets = Object.assign({}, hashAssets, unlimitedAvResult, avResult)

    return hashAssets
  })

  responder.on('_syncInternalAvailability', async (req) => {
    const {
      assetsIds,
      platformId,
      env
    } = req

    const { InternalAvailability } = await getModels({ platformId, env })

    await InternalAvailability.syncInternalAvailability({ assetsIds, platformId, env })

    return { success: true }
  })

  responder.on('_syncInternalAvailabilityTransaction', async (req) => {
    const {
      transactionIds,
      platformId,
      env
    } = req

    const { InternalAvailability } = await getModels({ platformId, env })

    await InternalAvailability.syncInternalAvailabilityTransaction({ transactionIds, platformId, env })

    return { success: true }
  })

  responder.on('_removeInternalAvailability', async (req) => {
    const {
      assetsIds,
      platformId,
      env
    } = req

    const { InternalAvailability } = await getModels({ platformId, env })

    await InternalAvailability.removeInternalAvailability({ assetsIds, platformId, env })

    return { success: true }
  })
}

function getAvailabilityMaxEndDate (startDate) {
  const maxEndDate = computeDate(startDate, { y: 1 })
  return maxEndDate
}

function isRecurringPeriodsOverlapped (periods) {
  let overlapped = false
  let previousEndDate

  periods.forEach((period, index) => {
    if (overlapped) return

    if (index !== 0 && period.startDate < previousEndDate) {
      overlapped = true
    }

    previousEndDate = period.endDate
  })

  return overlapped
}

async function getAvailableAssets ({
  assetsIds,
  startDate,
  endDate,
  quantity,
  unavailableWhen,
  assetTypes,
  isUnlimitedQuantity = false,
  fullPeriod = true,
  platformId,
  env
}) {
  const { InternalAvailability } = await getModels({ platformId, env })

  if (_.isString(unavailableWhen)) unavailableWhen = [unavailableWhen]
  const useCustomUnavailableWhen = unavailableWhen && unavailableWhen.length

  const hasEndDate = !!endDate

  const knex = InternalAvailability.knex()

  let queryBuilder = knex

  // Here's the SQLFiddle to play with:
  // http://sqlfiddle.com/#!17/6dfe1/1

  // Specifying the schema as we build the SQL query manually
  const schema = InternalAvailability.defaultSchema

  queryBuilder = queryBuilder.with('periods', qb => {
    // by asset and dates range, get the quantity sum
    // filter on assets ids or dates range
    qb = qb.select('assetId', 'datesRange', knex.raw('GREATEST(sum(quantity), 0) as "sumQuantity"'))
      .from(`${schema}.internalAvailability`)
      .whereIn('assetId', assetsIds)
      .where(knex.raw('"datesRange" && tstzrange(?, ?)', [startDate, endDate || 'infinity']))
      .groupBy('assetId', 'datesRange')

    // filter transactions with the right status
    if (useCustomUnavailableWhen || assetTypes.length) {
      qb = qb.where(builder => {
        return builder.whereNull('transactionId')
          .orWhere(builder2 => {
            return builder2.whereNotNull('transactionId')
              .where(builder3 => {
                if (useCustomUnavailableWhen) {
                  // only consider transactions that have the given transaction status
                  return builder3.whereIn('transactionStatus', unavailableWhen)
                } else {
                  return builder3.where('unavailable', true)
                }
              })
          })
      })
    } else {
      qb = qb.whereNull('transactionId')
    }

    return qb
  })

  // get the min and max quantity for period by asset
  queryBuilder = queryBuilder.with('assetQuantities', qb => {
    qb = qb.select('assetId', knex.raw('min("sumQuantity") as "minQuantity"'), knex.raw('max("sumQuantity") as "maxQuantity"'))
      .from('periods')
      .groupBy('assetId')
  })

  // if we don't care about quantity, let's search for quantity >= 1
  const queryQuantity = isUnlimitedQuantity ? 1 : quantity

  queryBuilder = queryBuilder
    .select('assetId')
    .from('assetQuantities')

  // if the searched period has end date, we want at least the searched quantity during the full period
  // unless the parameter `fullPeriod` is false
  if (hasEndDate && fullPeriod) {
    queryBuilder = queryBuilder.where('minQuantity', '>=', queryQuantity)
  // if the searched period hasn't end date, we want at least the searched quantity for a period even if it's not total
  } else {
    queryBuilder = queryBuilder.where('maxQuantity', '>=', queryQuantity)
  }

  const lines = await queryBuilder

  // if the asset is present, then it's available
  const indexedAvailableAssets = lines.reduce((memo, line) => {
    memo[line.assetId] = true
    return memo
  }, {})

  return assetsIds.reduce((memo, assetId) => {
    memo[assetId] = indexedAvailableAssets[assetId] || false
    return memo
  }, {})
}

function stop () {
  responder.close()
  responder = null

  subscriber.close()
  subscriber = null

  publisher.close()
  publisher = null

  transactionRequester.close()
  transactionRequester = null
}

module.exports = {
  start,
  stop
}
