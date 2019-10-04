const createError = require('http-errors')
const _ = require('lodash')
const { raw, transaction: knexTransaction } = require('objection')
const bluebird = require('bluebird')

const { logError } = require('../../logger')
const { getModels } = require('../models')

const {
  computeDate,
  diffDates,
  getDurationAs
} = require('../util/time')
const {
  getDefaultTransactionProcess,
  getTransactionProcess,
  isStatusBlockingAvailability,
  getBlockingAvailabilityChange,
  isValidDates,
  canComputePricing,
  getTransactionPricing
} = require('../util/transaction')

const { getObjectId } = require('stelace-util-keys')

const { performListQuery } = require('../util/listQueryBuilder')

const {
  getCurrentUserId
} = require('../util/user')

const {
  getTransition,
  computeTransitionsMeta
} = require('../util/transition')

let responder
let subscriber
let publisher
let availabilityRequester
let configRequester
let assetRequester
let requester

function start ({ communication }) {
  const {
    getResponder,
    getSubscriber,
    getRequester,
    getPublisher,
    COMMUNICATION_ID
  } = communication

  responder = getResponder({
    name: 'Transaction Responder',
    key: 'transaction'
  })

  subscriber = getSubscriber({
    name: 'Transaction subscriber',
    key: 'transaction',
    namespace: COMMUNICATION_ID,
    subscribesTo: [
      'transactionCreated',
      'transactionUpdated',
      'transactionStatusChanged'
    ]
  })

  publisher = getPublisher({
    name: 'Transaction publisher',
    key: 'transaction',
    namespace: COMMUNICATION_ID
  })

  availabilityRequester = getRequester({
    name: 'Transaction service > Availability Requester',
    key: 'availability'
  })

  configRequester = getRequester({
    name: 'Transaction service > Config Requester',
    key: 'config'
  })

  assetRequester = getRequester({
    name: 'Transaction service > Asset Requester',
    key: 'asset'
  })

  requester = getRequester({
    name: 'Transaction service > Transaction Requester',
    key: 'transaction'
  })

  responder.on('list', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Transaction } = await getModels({ platformId, env })

    const {
      orderBy,
      order,

      page,
      nbResultsPerPage,

      id,
      createdDate,
      updatedDate,
      assetId,
      assetTypeId,
      ownerId,
      takerId,
      value,
      ownerAmount,
      takerAmount,
      platformAmount
    } = req

    const queryBuilder = Transaction.query()

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
        assetIds: {
          dbField: 'assetId',
          value: assetId,
          transformValue: 'array',
          query: 'inList'
        },
        assetTypesIds: {
          dbField: 'assetTypeId',
          value: assetTypeId,
          transformValue: 'array',
          query: 'inList'
        },
        ownersIds: {
          dbField: 'ownerId',
          value: ownerId,
          transformValue: 'array',
          query: 'inList'
        },
        takersIds: {
          dbField: 'takerId',
          value: takerId,
          transformValue: 'array',
          query: 'inList'
        },
        value: {
          dbField: 'value',
          value: value,
          query: 'range'
        },
        ownerAmount: {
          dbField: 'ownerAmount',
          value: ownerAmount,
          query: 'range'
        },
        takerAmount: {
          dbField: 'takerAmount',
          value: takerAmount,
          query: 'range'
        },
        platformAmount: {
          dbField: 'platformAmount',
          value: platformAmount,
          query: 'range'
        },
      },
      beforeQueryFn: async ({ values }) => {
        const {
          ownersIds,
          takersIds,
          // signersIds
        } = values

        const currentUserId = getCurrentUserId(req)

        if (!req._matchedPermissions['transaction:list:all']) {
          const isAllowed = currentUserId &&
            (
              // (signersIds && signersIds.length === 1 && signersIds.includes(currentUserId)) ||
              (ownersIds && ownersIds.length === 1 && ownersIds.includes(currentUserId)) ||
              (takersIds && takersIds.length === 1 && takersIds.includes(currentUserId))
            )

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

    paginationMeta.results = Transaction.exposeAll(paginationMeta.results, { req })

    return paginationMeta
  })

  responder.on('read', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Transaction } = await getModels({ platformId, env })

    const transactionId = req.transactionId

    const transaction = await Transaction.query().findById(transactionId)
    if (!transaction) {
      throw createError(404)
    }

    const currentUserId = getCurrentUserId(req)

    const isSelf = Transaction.isSelf(transaction, currentUserId)
    if (!req._matchedPermissions['transaction:read:all'] && !isSelf) {
      throw createError(403)
    }

    return Transaction.expose(transaction, { req })
  })

  responder.on('preview', async (req) => {
    const fields = [
      'assetId',
      'startDate',
      'endDate',
      'duration',
      'quantity',
      'value',
      'ownerAmount',
      'takerAmount',
      'metadata',
      'platformData'
    ]

    const payload = _(req).pick(fields).defaults({ quantity: 1 }).value()

    const {
      metadata,
      platformData
    } = payload

    const platformId = req.platformId
    const env = req.env
    const { Transaction } = await getModels({ platformId, env })

    let transactionAttrs = await computeTransactionInformation(
      Object.assign(
        { platformId, env, req },
        _.omit(payload, ['metadata', 'platformData'])
      )
    )

    transactionAttrs.metadata = metadata
    transactionAttrs.platformData = platformData

    if (transactionAttrs.assetType) {
      const transactionProcess = getTransactionProcess({ assetType: transactionAttrs.assetType })
      transactionAttrs.status = transactionProcess.initStatus
    }

    return Transaction.expose(transactionAttrs, { req })
  })

  responder.on('create', async (req) => {
    const fields = [
      'assetId',
      'startDate',
      'endDate',
      'duration',
      'quantity',
      'takerId',
      'value',
      'ownerAmount',
      'takerAmount',
      'metadata',
      'platformData'
    ]

    const payload = _(req).pick(fields).defaults({ quantity: 1 }).value()

    const {
      value,
      ownerAmount,
      takerAmount,
      metadata,
      platformData
    } = payload

    let {
      takerId
    } = payload

    const currentUserId = getCurrentUserId(req)

    // if the "all" permission is missing, the user cannot create as another user
    if (!req._matchedPermissions['transaction:create:all'] && takerId && takerId !== currentUserId) {
      throw createError(403)
    }

    // automatically set to its own transaction if there is no taker id
    if (!takerId && currentUserId) {
      takerId = currentUserId
    }

    if (!takerId) {
      throw createError(422, 'Missing taker ID')
    }

    const platformId = req.platformId
    const env = req.env
    const { Transaction } = await getModels({ platformId, env })

    const isSelf = takerId === currentUserId
    if (!req._matchedPermissions['transaction:create:all'] && !isSelf) {
      throw createError(403)
    }

    const modifyingPrice = [value, ownerAmount, takerAmount].some(amount => !_.isUndefined(amount))
    if (modifyingPrice && !req._matchedPermissions['transaction:config:all']) {
      throw createError(403)
    }

    let transactionAttrs = await computeTransactionInformation(
      Object.assign(
        { takerId, platformId, env, req },
        _.omit(payload, ['metadata', 'platformData'])
      )
    )

    transactionAttrs.id = await getObjectId({ prefix: Transaction.idPrefix, platformId, env })
    transactionAttrs.metadata = metadata
    transactionAttrs.platformData = platformData

    const now = new Date().toISOString()

    if (transactionAttrs.assetType) {
      const transactionProcess = getTransactionProcess({ assetType: transactionAttrs.assetType })
      transactionAttrs.status = transactionProcess.initStatus
      transactionAttrs.statusHistory = [{ status: transactionAttrs.status, date: now }]
    }

    const transaction = await Transaction.query().insert(transactionAttrs)

    if (transaction.assetId) {
      await syncInternalAvailability({ platformId, env, transaction })
      await syncAssetQuantity({ platformId, env, transaction })
    }

    publisher.publish('transactionCreated', {
      transaction,
      eventDate: transaction.createdDate,
      platformId,
      env
    })

    return Transaction.expose(transaction, { req })
  })

  responder.on('update', async (req) => {
    const transactionId = req.transactionId

    const fields = [
      'assetId',
      'startDate',
      'endDate',
      'duration',
      'quantity',
      'value',
      'ownerAmount',
      'takerAmount',
      'status',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const {
      value,
      ownerAmount,
      takerAmount,
      status,
      metadata,
      platformData
    } = payload

    const currentUserId = getCurrentUserId(req)

    if (!req._matchedPermissions['transaction:config:all'] && status) {
      throw createError(403, `You haven't the permission to update the status`)
    }

    const platformId = req.platformId
    const env = req.env
    const { Transaction } = await getModels({ platformId, env })

    // cannot use `select for update` here
    // otherwise the transaction will be too long, possibly causing slow responses or worst deadlocks
    let transaction = await Transaction.query().findById(transactionId)
    if (!transaction) {
      throw createError(404)
    }

    const isSelf = transaction.takerId === currentUserId
    if (!req._matchedPermissions['transaction:edit:all'] && !isSelf) {
      throw createError(403)
    }

    // if any of the transaction core fields has changed, then we have to check again if the transaction parameters are correct
    // (no conflict with others, fulfill availability, ...)
    const transactionCoreFields = [
      'assetId',
      'startDate',
      'endDate',
      'duration',
      'quantity',
      'value',
      'ownerAmount',
      'takerAmount'
    ]

    const mergedTransactionData = transactionCoreFields.reduce((memo, field) => {
      memo[field] = payload[field] || transaction[field]
      return memo
    }, {})

    const modifyingPrice = [value, ownerAmount, takerAmount].some(amount => !_.isUndefined(amount))
    if (modifyingPrice && !req._matchedPermissions['transaction:config:all']) {
      throw createError(403)
    }

    const rebuildTransactionInformation = transactionCoreFields.some(field => {
      return mergedTransactionData[field] !== transaction[field]
    })

    // if no "all" permission, forbids the update if:
    // - there is an assigned asset to the transaction
    // - there is updates on core fields that trigger another transaction computation
    if (!req._matchedPermissions['transaction:config:all']) {
      if (transaction.assetId && rebuildTransactionInformation) {
        const message = 'If an asset is already associated to the transaction, "asset", "duration" and "quantity"' +
          ' cannot be updated without appropriate permissions ("transaction:config:all")'
        throw createError(403, message)
      }
    }

    const updateAttrsBeforeFullDataMerge = Object.assign({}, payload)

    let updateAttrs = {}
    if (rebuildTransactionInformation) {
      updateAttrs = await computeTransactionInformation(
        Object.assign(
          { transaction, platformId, env, req },
          _.omit(payload, ['metadata', 'platformData', 'status'])
        )
      )
    }

    const now = new Date().toISOString()

    if (status) {
      updateAttrs.status = status

      const newStatusHistoryStep = { status, date: now }
      updateAttrs.statusHistory = raw(`?::jsonb || "statusHistory"`, [ // prepend a jsonb array using PostgreSQL `||` operator
        JSON.stringify([newStatusHistoryStep])
      ])
    }

    if (metadata) {
      updateAttrs.metadata = Transaction.rawJsonbMerge('metadata', metadata)
    }
    if (platformData) {
      updateAttrs.platformData = Transaction.rawJsonbMerge('platformData', platformData)
    }

    const newTransaction = await Transaction.query().patchAndFetchById(transactionId, updateAttrs)

    // Synchronize internal availability when core transaction properties
    // (assetId, dates, quantity) or status are updated
    if (rebuildTransactionInformation || status) {
      await syncInternalAvailability({ platformId, env, transaction: newTransaction, oldAssetId: transaction.assetId })
    }
    // only synchronize if status has been provided
    if (status) {
      await syncAssetQuantity({ platformId, env, transaction: newTransaction })
    }

    publisher.publish('transactionUpdated', {
      transaction,
      newTransaction,
      eventDate: newTransaction.updatedDate,
      updateAttrs: updateAttrsBeforeFullDataMerge,
      platformId,
      env
    })

    return Transaction.expose(newTransaction, { req })
  })

  responder.on('createTransition', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Transaction } = await getModels({ platformId, env })

    const {
      transactionId,
      name,
      data = {}
    } = req

    const currentUserId = getCurrentUserId(req)

    let updateAttrs
    let transaction
    let assetType
    let updatedTransaction

    const knex = Transaction.knex()

    await knexTransaction(knex, async (trx) => {
      transaction = await Transaction.query(trx).forUpdate()
        .findById(transactionId)
      if (!transaction) {
        throw createError(404)
      }
      if (!transaction.assetId) {
        throw createError(422, 'This transaction is not associated to an asset')
      }

      assetType = transaction.assetType
      let transactionProcess = assetType.transactionProcess
      if (!transactionProcess) {
        transactionProcess = getDefaultTransactionProcess()
      }

      const isOwner = transaction.ownerId === currentUserId
      const isTaker = transaction.takerId === currentUserId

      // transition parameters validation
      if (name === 'cancel' && !data.cancellationReason) {
        throw createError(400, 'Missing cancellation reason')
      }

      // check if the transition can be performed
      const transition = getTransition({
        name,
        transitions: transactionProcess.transitions,
        from: transaction.status
      })
      if (!transition) {
        throw createError(422, 'Invalid transition')
      }

      // check if the transition can be performed by the current user
      if (transition.actors) {
        const allowed = (isOwner && transition.actors.includes('owner')) ||
          // (isSigner && transition.actors.includes('signer')) ||
          (isTaker && transition.actors.includes('taker')) ||
          req._matchedPermissions['transaction:transition:all']

        if (!allowed) {
          throw createError(403, 'You are not allowed to perform this transition')
        }
      }

      const now = new Date().toISOString()

      const newStatus = transition.to
      const newStatusHistoryStep = { status: newStatus, date: now, data }

      updateAttrs = {
        status: newStatus,
        statusHistory: raw(`?::jsonb || "statusHistory"`, [ // prepend a jsonb array using PostgreSQL `||` operator
          JSON.stringify([newStatusHistoryStep])
        ])
      }

      // custom transition update transaction logic
      if (name === 'cancel') {
        updateAttrs.cancellationReason = data.cancellationReason
        updateAttrs.cancelledDate = now
      }

      // detect if the new status is a process end state
      // if so, update the transaction `completedDate`
      const transitionsMeta = computeTransitionsMeta({ transitions: transactionProcess.transitions, initState: transactionProcess.initStatus })
      if (transitionsMeta.endStates.includes(newStatus)) {
        updateAttrs.completedDate = now
      }

      updatedTransaction = await Transaction.query(trx).patchAndFetchById(transactionId, updateAttrs)
    })

    if (transaction.assetId) {
      await syncAssetQuantity({ platformId, env, transaction: updatedTransaction })
    }

    try {
      await availabilityRequester.send({
        type: '_syncInternalAvailabilityTransaction',
        transactionIds: [transaction.id],
        platformId,
        env
      })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { transactionId: transaction.id },
        message: 'Fail to sync internal availability transaction'
      })
    }

    publisher.publish('transactionStatusChanged', {
      transactionId,
      transaction: updatedTransaction,
      updateAttrs,
      eventDate: updatedTransaction.updatedDate,
      platformId,
      env
    })

    return Transaction.expose(updatedTransaction, { req })
  })

  // EVENTS

  subscriber.on('transactionCreated', async ({ transaction, eventDate, platformId, env } = {}) => {
    try {
      const { Transaction, Event } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'transaction__created',
        objectId: transaction.id,
        object: Transaction.expose(transaction, { namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { transactionId: transaction.id },
        message: 'Fail to create event transaction__created'
      })
    }
  })

  subscriber.on('transactionUpdated', async ({
    transaction,
    newTransaction,
    updateAttrs,
    eventDate,
    platformId,
    env
  } = {}) => {
    try {
      const { Transaction, Event } = await getModels({ platformId, env })

      const config = Event.getUpdatedEventDeltasConfig('transaction')
      const deltas = Event.getUpdatedEventDeltas(config, updateAttrs, transaction)

      const knex = Event.knex()
      const parentEventId = await getObjectId({ prefix: Event.idPrefix, platformId, env })

      await knexTransaction(knex, async (trx) => {
        await bluebird.each(Object.keys(deltas), type => {
          return Event.createEvent({
            createdDate: eventDate,
            type,
            objectId: newTransaction.id,
            object: newTransaction,
            parentId: parentEventId
          }, { platformId, env, queryContext: trx })
        })

        await Event.createEvent({
          id: parentEventId,
          createdDate: eventDate,
          type: 'transaction__updated',
          objectId: newTransaction.id,
          object: Transaction.expose(newTransaction, { namespaces: ['*'] }),
          changesRequested: Transaction.expose(updateAttrs, { namespaces: ['*'] })
        }, { platformId, env, queryContext: trx })
      })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { transactionId: newTransaction.id },
        message: 'Fail to create event transaction__updated and associated events'
      })
    }
  })

  subscriber.on('transactionStatusChanged', async ({ transactionId, transaction, updateAttrs, eventDate, platformId, env } = {}) => {
    try {
      const { Transaction, Event } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'transaction__status_changed',
        objectId: transactionId,
        object: Transaction.expose(transaction, { namespaces: ['*'] })
      }, { platformId, env })

      await onTransactionBlockAvailability({ transaction, platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { transactionId },
        message: 'Fail to create event transaction__status_changed'
      })
    }
  })

  // INTERNAL

  // filter on transactions
  // can filter for a period
  responder.on('_filter', async (req) => {
    const {
      assetsIds,
      filterStartDate,
      filterEndDate,
      platformId,
      env
    } = req

    if (!assetsIds) {
      throw createError(400, 'Missing assets ids')
    }

    const { Transaction } = await getModels({ platformId, env })

    const queryBuilder = Transaction.query()
      .whereIn('assetId', assetsIds)
      .whereNull('cancelledDate')

    if (filterStartDate) {
      const period = `'[` +
        filterStartDate + ',' +
        (filterEndDate || '') +
        `)'`

      queryBuilder
        .where(builder => {
          return builder
            .whereNotNull('startDate')
            .whereNotNull('endDate')
        })
        .where(raw(`${period} && tstzrange("startDate"::timestamptz, "endDate"::timestamptz)`))
    }

    const transactions = await queryBuilder

    const indexedTransactions = _.groupBy(transactions, 'assetId')

    return assetsIds.reduce((memo, assetId) => {
      memo[assetId] = indexedTransactions[assetId] || []
      return memo
    }, {})
  })

  responder.on('_getTransaction', async (req) => {
    const {
      transactionId,
      platformId,
      env
    } = req

    const { Transaction } = await getModels({ platformId, env })

    const transaction = await Transaction.query().findById(transactionId)
    return transaction
  })

  responder.on('_updateTransaction', async (req) => {
    const {
      transactionId,
      updateAttrs,
      platformId,
      env
    } = req

    const { Transaction, Event } = await getModels({ platformId, env })

    const transaction = await Transaction.query().findById(transactionId)
    if (!transaction) {
      throw createError('Transaction not found', { transactionId })
    }

    const isUpdatingStatus = updateAttrs.status && transaction.status !== updateAttrs.status

    const updatedTransaction = await Transaction.query().patchAndFetchById(transactionId, updateAttrs)

    if (isUpdatingStatus) {
      try {
        await availabilityRequester.send({
          type: '_syncInternalAvailabilityTransaction',
          transactionIds: [transactionId],
          platformId,
          env
        })
      } catch (err) {
        logError(err, {
          platformId,
          env,
          custom: { transactionId },
          message: 'Fail to sync internal availability transaction'
        })
      }

      try {
        await Event.createEvent({
          createdDate: updatedTransaction.updatedDate,
          type: 'transaction__status_changed',
          objectId: transactionId,
          object: Transaction.expose(transaction, { namespaces: ['*'] })
        }, { platformId, env })
      } catch (err) {
        logError(err, {
          platformId,
          env,
          custom: { transactionId },
          message: 'Fail to update create event transaction__status_changed when internal transaction update is called'
        })
      }
    }
  })

  responder.on('cancelTransactions', async (req) => {
    const {
      transactions,
      cancellationReason,
      platformId,
      env
    } = req

    await cancelTransactions({ transactions, cancellationReason, platformId, env })
  })
}

/**
 * Check and get transaction information based on asset and transaction quantity and/or duration
 * @param {Object} params
 * @param {String} [params.assetId]
 * @param {String} [params.startDate]
 * @param {String} [params.endDate] - if endDate and duration are both provided, we use endDate
 * @param {Object} [params.duration]
 * @param {Number} [params.quantity]
 * @param {String} [params.takerId] - must be provided at transaction creation
 * @param {Number} [params.value]
 * @param {Number} [params.ownerAmount]
 * @param {Number} [params.takerAmount]
 * @param {Object} [params.transaction] - provide the transaction if it's an update
 * @param {String} params.platformId
 * @param {String} params.env
 */
async function computeTransactionInformation ({
  assetId,
  startDate,
  endDate,
  duration,
  quantity,
  takerId,
  value,
  ownerAmount,
  takerAmount,
  transaction,
  platformId,
  env,
  req
}) {
  const now = new Date().toISOString()

  let asset
  let assetType

  const computedData = {
    startDate: null,
    endDate: null,
    duration: null,
    quantity: null
  }

  if (_.isUndefined(endDate) && _.isUndefined(duration)) {
    computedData.endDate = transaction && transaction.endDate
    computedData.duration = transaction && transaction.duration
  } else if (!_.isUndefined(endDate)) {
    computedData.endDate = endDate
    computedData.duration = null
  } else if (!_.isUndefined(duration)) {
    computedData.endDate = null
    computedData.duration = duration
  }

  computedData.startDate = _.isUndefined(startDate) ? transaction && transaction.startDate : startDate
  computedData.quantity = _.isUndefined(quantity) ? transaction && transaction.quantity : quantity

  let transactionAttrs = {
    takerId
  }

  // we should fetch and check asset information if any of the following:
  // - there is no existing transaction
  // - there is an existing transaction but it was not assigned any asset previously
  // - the asset ID has changed
  const shouldChangeAsset = !transaction || _.isEmpty(transaction.assetSnapshot) || transaction.assetId !== assetId

  // asset ID can not be set at transaction creation
  // skip any asset logic if so
  const assetIdToFetch = assetId || (transaction && transaction.assetId)

  if (assetIdToFetch) {
    if (shouldChangeAsset) {
      const checkAssetData = await checkAsset()

      asset = checkAssetData.asset
      assetType = checkAssetData.assetType
      const config = checkAssetData.config

      const assetInformation = {
        assetId: asset.id,
        ownerId: asset.ownerId,
        assetTypeId: assetType.id,
        assetType,
        assetSnapshot: asset,
        currency: asset.currency || _.get(config, 'stelace.instant.currency'),
        timeUnit: _.get(assetType, 'timing.timeUnit'),
        unitPrice: asset.price,
        status: transaction ? undefined : 'draft',
        statusHistory: transaction ? undefined : [{ status: 'draft', date: new Date().toISOString() }]
      }

      if (!assetInformation.currency) {
        throw createError(422, `No currency for the asset with ID ${asset.id}`)
      }

      transactionAttrs = Object.assign(transactionAttrs, assetInformation)
    } else {
      asset = transaction.assetSnapshot
      assetType = transaction.assetType
    }
  }

  const shouldCheckTiming = [startDate, endDate, duration].some(v => !_.isUndefined(v))

  if (shouldChangeAsset || shouldCheckTiming) {
    const hasAllTimingParamsToCompute = computedData.startDate && (computedData.endDate || computedData.duration)

    // compute missing timing params (e.g. compute duration if endDate is provided)
    if (shouldCheckTiming && hasAllTimingParamsToCompute) {
      // No asset type for we have no asset => defaulting to 'days'
      const timeUnit = assetType ? _.get(assetType, 'timing.timeUnit') : 'd'

      const transactionDatesParams = getTransactionDatesParams({
        startDate: computedData.startDate,
        endDate: computedData.endDate,
        duration: computedData.duration,
        timeUnit
      })

      if (!computedData.endDate) {
        computedData.endDate = transactionDatesParams.endDate
      }
      if (!computedData.duration) {
        computedData.duration = transactionDatesParams.duration
      }

      if (asset) {
        await checkTiming()
      }
    }

    transactionAttrs.startDate = computedData.startDate
    transactionAttrs.endDate = computedData.endDate
    transactionAttrs.duration = computedData.duration
  }

  const shouldCheckAvailability = [startDate, endDate, duration, quantity].some(v => !_.isUndefined(v))

  if (shouldChangeAsset || shouldCheckAvailability) {
    if (asset) {
      await checkAvailability()
    }

    transactionAttrs.quantity = quantity
  }

  const changingPricing = [value, ownerAmount, takerAmount].some(v => !_.isUndefined(v))

  // remove any undefined values from transactionAttrs
  const mergedTransaction = _.merge({}, transaction, transactionAttrs)

  const shouldChangePricing = shouldChangeAsset || shouldCheckTiming || shouldCheckAvailability || changingPricing
  if (shouldChangePricing) {
    if (asset && canComputePricing(mergedTransaction)) {
      const priceResult = getTransactionPricing(mergedTransaction, { value, ownerAmount, takerAmount })

      transactionAttrs.value = priceResult.value
      transactionAttrs.ownerAmount = priceResult.ownerAmount
      transactionAttrs.takerAmount = priceResult.takerAmount
      transactionAttrs.platformAmount = priceResult.platformAmount
      transactionAttrs.ownerFees = priceResult.ownerFees
      transactionAttrs.takerFees = priceResult.takerFees
    } else {
      transactionAttrs.value = value
      transactionAttrs.ownerAmount = ownerAmount
      transactionAttrs.takerAmount = takerAmount
    }
  }

  // do not save if it's the same value as before
  // this is to prevent unnecessary save in concurrent context if state doesn't change
  transactionAttrs = _.omitBy(transactionAttrs, (value, key) => {
    return transaction && (transaction[key] === value || _.isUndefined(value))
  })

  return transactionAttrs

  async function checkAsset () {
    const { Asset, AssetType } = await getModels({ platformId, env })

    const assetId = assetIdToFetch

    const asset = await Asset.query().findById(assetId)
    if (!asset) {
      throw createError(422, 'Asset is not found', { public: { assetId } })
    }
    if (asset.ownerId && asset.ownerId === takerId) {
      throw createError(422, 'Owner cannot book its own asset', { public: { ownerId: asset.ownerId } })
    }
    if (!asset.validated) {
      throw createError(422, 'Asset not validated', { public: { assetId } })
    }
    if (!asset.active) {
      throw createError(422, 'Asset not active', { public: { assetId } })
    }

    const assetType = await AssetType.query().findById(asset.assetTypeId)
    if (!assetType) {
      throw createError(422, 'Asset type is not found', { public: { assetTypeId: asset.assetTypeId } })
    }
    if (!assetType.active) {
      throw createError(422, 'Asset type inactive', { public: { assetTypeId: asset.assetTypeId } })
    }

    const config = await configRequester.send({
      type: '_getConfig',
      platformId,
      env,
      access: 'default'
    })

    return {
      asset,
      assetType,
      config
    }
  }

  async function checkTiming () {
    const { timeBased } = assetType

    const startDate = computedData.startDate
    const duration = computedData.duration

    const refDate = now

    if (!timeBased) return

    if (!startDate) {
      throw createError(400)
    }

    if (!duration) return

    const timeUnit = assetType.timing.timeUnit

    // DEPRECATED
    let checkDateDeltas = false

    // Attempt on deprecated logic that won't trigger after the version 2019-05-20
    if (req._selectedVersion <= '2019-05-20') {
      checkDateDeltas = !assetType.infiniteStock & asset.quantity === 1 // approximate old 'UNIQUE' dimension
    }

    let previousTransaction
    let lastTransaction

    if (checkDateDeltas) {
      previousTransaction = await getPreviousTransaction({ assetId: asset.id, platformId, env, refDate: startDate })
      lastTransaction = await getLastTransaction({ assetId: asset.id, platformId, env })
    }
    // DEPRECATED:END

    const validDates = isValidDates({
      startDate,
      timeUnit,
      duration,
      refDate,
      previousTransactionRefDate: previousTransaction && previousTransaction.endDate,
      lastTransactionRefDate: lastTransaction && lastTransaction.endDate,
      config: assetType.timing,
      checkDateDeltas
    })

    if (!validDates.result) {
      throw createError(422, 'Invalid dates', {
        public: {
          errors: validDates.errors
        }
      })
    }
  }

  async function checkAvailability () {
    const { timeBased, infiniteStock } = assetType

    const startDate = computedData.startDate
    const endDate = computedData.endDate
    const quantity = computedData.quantity

    if (infiniteStock) return

    if (timeBased) {
      const allAvailable = await availabilityRequester.send({
        type: '_isAvailable',
        assetsIds: [asset.id],
        startDate,
        endDate,
        quantity,
        platformId,
        env
      })

      const available = allAvailable[asset.id]
      if (!available) {
        throw createError(422, 'Asset not available')
      }
    } else {
      if (asset.quantity < quantity) {
        throw createError(400, 'Asset does not have enough quantity', {
          public: {
            quantity: asset.quantity,
            bookedQuantity: quantity
          }
        })
      }
    }
  }
}

async function onTransactionBlockAvailability ({ transaction, platformId, env }) {
  if (!transaction.assetId) return

  const { previous, current } = getBlockingAvailabilityChange(transaction)
  if (previous || !current) return

  const { Transaction, Asset } = await getModels({ platformId, env })

  // cancel other transactions that overlaps this transaction that recently blocks availability

  const { timeBased, infiniteStock } = transaction.assetType

  // do not cancel any transactions if there is no availability issues
  if (infiniteStock) return

  let asset
  if (transaction.assetId) {
    asset = await Asset.query().findById(transaction.assetId)
  }
  let transactionsToCancel = []

  // time does not matter (like selling)
  // cancel transactions whose quantity is greater than remaining quantity
  if (!timeBased) {
    const quantity = asset ? asset.quantity : 1

    transactionsToCancel = await Transaction.query()
      .where({ assetId: transaction.assetId })
      .whereNull('cancelledDate')
      .whereNull('completedDate')
      .whereNot('id', transaction.id)
      .where('quantity', '>', quantity) // asset quantity has been updated previously
  // cancel pending transactions whose quantity exceeds the max quantity during the transaction period
  } else {
    const pendingTransactions = await Transaction.query()
      .where({ assetId: transaction.assetId })
      .whereNull('cancelledDate')
      .whereNull('completedDate')
      .whereNot('id', transaction.id)

    await bluebird.map(pendingTransactions, async (transaction) => {
      if (transaction.assetId) {
        const allAvailable = await availabilityRequester.send({
          type: '_isAvailable',
          assetsIds: [transaction.assetId],
          quantity: transaction.quantity,
          startDate: transaction.startDate,
          endDate: transaction.endDate,
          platformId,
          env
        })

        if (!allAvailable[transaction.assetId]) {
          transactionsToCancel.push(transaction)
        }
      }
    }, { concurrency: 10 })
  }

  await cancelTransactions({ transactions: transactionsToCancel, platformId, env, cancellationReason: 'transactionConflict' })
}

async function cancelTransactions ({ transactions, platformId, env, cancellationReason }) {
  const { Transaction, Event } = await getModels({ platformId, env })

  const knex = Transaction.knex()

  await knexTransaction(knex, async (trx) => {
    await bluebird.map(transactions, async (transaction) => {
      let transactionProcess

      if (transaction.assetType) {
        transactionProcess = transaction.assetType.transactionProcess
        if (!transactionProcess) {
          transactionProcess = getDefaultTransactionProcess()
        }
      } else {
        transactionProcess = getDefaultTransactionProcess()
      }

      const status = transactionProcess.cancelStatus
      const now = new Date().toISOString()

      const newStatusHistoryStep = { status, date: now }

      const updateAttrs = {
        cancellationReason,
        cancelledDate: now,
        status,
        statusHistory: raw(`?::jsonb || "statusHistory"`, [ // prepend a jsonb array using PostgreSQL `||` operator
          JSON.stringify([newStatusHistoryStep])
        ])
      }

      const transitionsMeta = computeTransitionsMeta({ transitions: transactionProcess.transitions, initState: transactionProcess.initStatus })
      if (transitionsMeta.endStates.includes(status)) {
        updateAttrs.completedDate = now
      }

      const updatedTransaction = await Transaction.query(trx).patchAndFetchById(transaction.id, updateAttrs)

      try {
        await availabilityRequester.send({
          type: '_syncInternalAvailabilityTransaction',
          transactionIds: [transaction.id],
          platformId,
          env
        })
      } catch (err) {
        logError(err, {
          platformId,
          env,
          custom: { transactionId: transaction.id },
          message: 'Fail to sync internal availability transaction'
        })
      }

      await Event.createEvent({
        createdDate: updatedTransaction.updatedDate,
        type: 'transaction__status_changed',
        objectId: transaction.id,
        object: Transaction.expose(transaction, { namespaces: ['*'] })
      }, { platformId, env, queryContext: trx })
    }, { concurrency: 10 })
  })
}

async function getPreviousTransaction ({ assetId, refDate, platformId, env }) {
  const { Transaction } = await getModels({ platformId, env })

  const transactions = await Transaction.query()
    .where({ assetId })
    .whereNotNull('endDate')
    .where('endDate', '<', refDate)
    .whereNull('cancelledDate')
    .orderBy('endDate', 'desc')

  return transactions.find(t => isStatusBlockingAvailability(t, t.status))
}

async function getLastTransaction ({ assetId, platformId, env }) {
  const { Transaction } = await getModels({ platformId, env })

  const transactions = await Transaction.query()
    .where({ assetId })
    .whereNotNull('endDate')
    .whereNull('cancelledDate')
    .orderBy('endDate', 'desc')
    .limit(1)

  return transactions.find(t => isStatusBlockingAvailability(t, t.status))
}

function getTransactionDatesParams ({ startDate, endDate, duration, timeUnit }) {
  if (endDate && duration) {
    duration = null
  }

  let newDuration = duration
  let nbTimeUnits
  let newEndDate = endDate

  if (endDate) {
    nbTimeUnits = diffDates(endDate, startDate, timeUnit)
    newDuration = { [timeUnit]: nbTimeUnits }
  } else if (duration) {
    nbTimeUnits = getDurationAs(duration, timeUnit)
    newEndDate = computeDate(startDate, duration)
  }

  return {
    startDate,
    endDate: newEndDate,
    duration: newDuration,
    nbTimeUnits
  }
}

async function syncInternalAvailability ({ platformId, env, transaction, oldAssetId }) {
  try {
    const assetsIds = _.uniqBy(_.compact([transaction.assetId, oldAssetId]))

    await availabilityRequester.send({
      type: '_syncInternalAvailability',
      assetsIds,
      platformId,
      env
    })
  } catch (err) {
    logError(err, {
      platformId,
      env,
      custom: {
        assetId: transaction.assetId,
        transactionId: transaction.id
      },
      message: 'Fail to sync internal availability'
    })
  }
}

async function syncAssetQuantity ({ platformId, env, transaction }) {
  if (!transaction.assetId) return

  const { Asset } = await getModels({ platformId, env })
  const asset = await Asset.query().findById(transaction.assetId)

  // for some asset type dimensions, asset quantity has to be updated
  // if availability has changed (from block to non-block or non-block to block)
  const { current, previous } = getBlockingAvailabilityChange(transaction)

  if (previous !== current) {
    let actionType
    if (previous && !current) {
      actionType = 'add'
    } else {
      actionType = 'remove'
    }

    // update quantity before cancelling other transactions
    await assetRequester.send({
      type: '_changeQuantity',
      transaction,
      asset,
      actionType,
      platformId,
      env
    })
  }
}

function stop () {
  responder.close()
  responder = null

  subscriber.close()
  subscriber = null

  publisher.close()
  publisher = null

  availabilityRequester.close()
  availabilityRequester = null

  configRequester.close()
  configRequester = null

  assetRequester.close()
  assetRequester = null

  requester.close()
  requester = null
}

module.exports = {
  start,
  stop
}
