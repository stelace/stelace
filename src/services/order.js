const createError = require('http-errors')
const _ = require('lodash')
const { transaction } = require('objection')

const { logError } = require('../../server/logger')
const { getModels } = require('../models')

const { isValidCurrency } = require('../util/currency')

const { replaceBy } = require('../util/list')

const { getObjectId } = require('stelace-util-keys')

const {
  getLinesFromTransactions,
  getInformationFromLines,
  getInformationFromMoves,
  getOrderMeta
} = require('../util/order')

const {
  canComputePricing
} = require('../util/transaction')

const { performListQuery } = require('../util/listQueryBuilder')

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
    name: 'Order Responder',
    key: 'order'
  })

  subscriber = getSubscriber({
    name: 'Order subscriber',
    key: 'order',
    namespace: COMMUNICATION_ID,
    subscribesTo: [
      'orderCreated',
      'orderUpdated',
    ]
  })

  publisher = getPublisher({
    name: 'Order publisher',
    key: 'order',
    namespace: COMMUNICATION_ID
  })

  transactionRequester = getRequester({
    name: 'Order service > Transaction Requester',
    key: 'transaction'
  })

  responder.on('preview', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Order } = await getModels({ platformId, env })

    const {
      lines,
      moves,
      transactionIds
    } = req

    const hasAllPermissions = req._matchedPermissions['order:preview:all']
    const currentUserId = getCurrentUserId(req)

    const previewedOrder = await previewOrder({
      lines,
      moves,
      transactionIds,
      currentUserId,
      hasAllPermissions,
      req
    })

    const isSelf = Order.isSelf(previewedOrder, currentUserId)
    if (!hasAllPermissions && !isSelf) {
      throw createError(403)
    }

    return Order.expose(previewedOrder, { req })
  })

  responder.on('list', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Order } = await getModels({ platformId, env })

    const {
      orderBy,
      order,

      page,
      nbResultsPerPage,

      id,
      payerId,
      receiverId,
      transactionId
    } = req

    const currentUserId = getCurrentUserId(req)

    const queryBuilder = Order.query()

    const paginationMeta = await performListQuery({
      queryBuilder,
      filters: {
        ids: {
          dbField: 'id',
          value: id,
          transformValue: 'array',
          query: 'inList'
        },
        payersIds: {
          dbField: 'payerId',
          value: payerId,
          transformValue: 'array',
          query: 'inList'
        },
        receiverId: {
          dbField: 'receiverId',
          value: receiverId,
          query: (queryBuilder, receiverId) => {
            queryBuilder.whereJsonSupersetOf('lines', [{ receiverId }])
          }
        },
        transactionId: {
          dbField: 'transactionId',
          value: transactionId,
          query: (queryBuilder, transactionId) => {
            queryBuilder.whereJsonSupersetOf('lines', [{ transactionId }])
          }
        }
      },
      beforeQueryFn: async ({ values }) => {
        const {
          payersIds,
          receiverId
        } = values

        if (!req._matchedPermissions['order:list:all']) {
          const isAllowed = currentUserId &&
            (
              (payersIds && payersIds.length === 1 && payersIds.includes(currentUserId)) ||
              (receiverId && receiverId === currentUserId)
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

    paginationMeta.results = paginationMeta.results.map(order => Order.expose(order, { req }))

    return paginationMeta
  })

  responder.on('read', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Order } = await getModels({ platformId, env })

    const orderId = req.orderId

    const order = await Order.query().findById(orderId)
    if (!order) {
      throw createError(404)
    }

    const currentUserId = getCurrentUserId(req)

    const isSelf = Order.isSelf(order, currentUserId)
    if (!req._matchedPermissions['order:read:all'] && !isSelf) {
      throw createError(403)
    }

    return Order.expose(order, { req })
  })

  responder.on('create', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Order } = await getModels({ platformId, env })

    const fields = [
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const {
      lines,
      moves,
      transactionIds
    } = req

    const createAttrs = Object.assign({
      id: await getObjectId({ prefix: Order.idPrefix, platformId, env })
    }, payload)

    const hasAllPermissions = req._matchedPermissions['order:create:all']
    const currentUserId = getCurrentUserId(req)

    const previewedOrder = await previewOrder({
      lines,
      moves,
      transactionIds,
      currentUserId,
      hasAllPermissions,
      req
    })

    Object.assign(createAttrs, previewedOrder)

    for (let i = 0; i < createAttrs.lines.length; i++) {
      const line = createAttrs.lines[i]
      line.id = await getObjectId({ prefix: Order.lineIdPrefix, platformId, env })
    }
    for (let i = 0; i < createAttrs.moves.length; i++) {
      const move = createAttrs.moves[i]
      move.id = await getObjectId({ prefix: Order.moveIdPrefix, platformId, env })
    }

    const isSelf = Order.isSelf(createAttrs, currentUserId)
    if (!hasAllPermissions && !isSelf) {
      throw createError(403)
    }

    const order = await Order.query().insert(createAttrs)

    publisher.publish('orderCreated', {
      order,
      eventDate: order.createdDate,
      platformId,
      env,
      req
    })

    return Order.expose(order, { req })
  })

  responder.on('update', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Order } = await getModels({ platformId, env })

    const orderId = req.orderId

    const fields = [
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const {
      metadata,
      platformData
    } = payload

    const order = await Order.query().findById(orderId)
    if (!order) {
      throw createError(404)
    }

    const currentUserId = getCurrentUserId(req)

    const isSelf = Order.isSelf(order, currentUserId)
    if (!req._matchedPermissions['order:edit:all'] && !isSelf) {
      throw createError(403)
    }

    const updateAttrs = _.omit(payload, ['metadata', 'platformData'])
    const updateAttrsBeforeFullDataMerge = Object.assign({}, payload)

    if (metadata) {
      updateAttrs.metadata = Order.rawJsonbMerge('metadata', metadata)
    }
    if (platformData) {
      updateAttrs.platformData = Order.rawJsonbMerge('platformData', platformData)
    }

    const newOrder = await Order.query().patchAndFetchById(orderId, updateAttrs)

    publisher.publish('orderUpdated', {
      orderId,
      order,
      newOrder,
      updateAttrs: updateAttrsBeforeFullDataMerge,
      eventDate: newOrder.updatedDate,
      platformId,
      env,
      req
    })

    return Order.expose(newOrder, { req })
  })

  // ORDER LINE

  responder.on('readLine', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Order } = await getModels({ platformId, env })

    const orderLineId = req.orderLineId

    const orders = await Order.query()
      .whereJsonSupersetOf('lines', [{ id: orderLineId }])
      .limit(1)

    const order = orders[0]
    if (!order) {
      throw createError(404)
    }

    const currentUserId = getCurrentUserId(req)

    const orderLine = order.lines.find(line => line.id === orderLineId)

    const isSelf = Order.isSelfForLine(orderLine, currentUserId)
    if (!req._matchedPermissions['orderLine:read:all'] && !isSelf) {
      throw createError(403)
    }

    return Order.exposeLine(orderLine, { req })
  })

  responder.on('createLine', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Order } = await getModels({ platformId, env })

    const fields = [
      'orderId',
      'transactionId',
      'reversal',
      'payerId',
      'payerAmount',
      'receiverId',
      'receiverAmount',
      'platformAmount',
      'currency',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const {
      currency,
      transactionId,
      orderId,
      reversal
    } = payload
    let {
      payerId
    } = payload

    const knex = Order.knex()

    let newOrderLine

    await transaction(knex, async (trx) => {
      // use sql `SELECT FOR UPDATE` to wait for other sql orders to be completed
      // before reading the last version of Stelace order
      const order = await Order.query(trx).forUpdate()
        .findById(orderId)
      if (!order) {
        throw createError(404)
      }

      if (!reversal && order.paymentAttempted) {
        throw createError(422, 'Only reversal order lines are allowed for orders with attempted payments')
      }

      if (transactionId) {
        const transaction = await fetchTransaction(transactionId, { req })
        if (!transaction) {
          throw createError(422, 'Transaction not found')
        }
        if (payerId && transaction.takerId !== payerId) {
          throw createError(422, `The payer (${payerId}) doesn't match the transaction taker (${transaction.takerId})`)
        }
        if (!payerId && typeof payerAmount === 'number') {
          payerId = transaction.takerId
          payload.payerId = payerId
        }
      }

      if (!order.payerId && !payerId) {
        const msg = 'There is no payerId associated with the order. Please create an order line with a payerId.'
        throw createError(422, msg)
      }
      if (payerId && payerId !== order.payerId) {
        const msg = `The provided payer (${payerId}) doesn't match with the order's payer (${order.payerId})`
        throw createError(422, msg)
      }

      const linesInformation = getInformationFromLines(order.lines)
      const currentCurrency = linesInformation.currency || order.currency // there can be no line
      if (currentCurrency !== currency) {
        const msg = `The provided currency (${
          currency
        }) doesn't match with the order's currency (${currentCurrency})`
        throw createError(422, msg)
      }

      const currentUserId = getCurrentUserId(req)

      const now = new Date().toISOString()

      newOrderLine = Object.assign({
        id: await getObjectId({ prefix: Order.lineIdPrefix, platformId, env }),
        createdDate: now,
        updatedDate: now,
        transactionId: null,
        reversal: false,
        payerId: null,
        payerAmount: null,
        receiverId: null,
        receiverAmount: null,
        platformAmount: null,
        metadata: {},
        platformData: {}
      }, payload)

      const isSelf = Order.isSelfForLine(newOrderLine, currentUserId)
      if (!req._matchedPermissions['orderLine:create:all'] && !isSelf) {
        throw createError(403)
      }

      const newLines = order.lines.concat([newOrderLine])

      const updateAttrs = {
        lines: newLines
      }

      await updateOrder(order, updateAttrs, {
        req,
        trx,
        lines: newLines,
        moves: order.moves
      })
    })

    return Order.exposeLine(newOrderLine, { req })
  })

  responder.on('updateLine', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Order } = await getModels({ platformId, env })

    const orderLineId = req.orderLineId

    const fields = [
      'payerId',
      'payerAmount',
      'receiverId',
      'receiverAmount',
      'platformAmount',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const {
      payerId,
      payerAmount,
      receiverId,
      receiverAmount,
      platformAmount,
      metadata,
      platformData
    } = payload

    const knex = Order.knex()

    let newOrderLine

    await transaction(knex, async (trx) => {
      // use sql `SELECT FOR UPDATE` to wait for other sql orders to be completed
      // before reading the last version of Stelace order
      const orders = await Order.query(trx).forUpdate()
        .whereJsonSupersetOf('lines', [{ id: orderLineId }])
        .limit(1)

      const order = orders[0]
      if (!order) {
        throw createError(404)
      }

      const currentUserId = getCurrentUserId(req)

      const orderLine = order.lines.find(line => line.id === orderLineId)

      const isSelf = Order.isSelfForLine(orderLine, currentUserId)
      if (!req._matchedPermissions['orderLine:edit:all'] && !isSelf) {
        throw createError(403)
      }

      const updatingCoreData = typeof payerId !== 'undefined' ||
        typeof payerAmount !== 'undefined' ||
        typeof receiverId !== 'undefined' ||
        typeof receiverAmount !== 'undefined' ||
        typeof platformAmount !== 'undefined'

      const canUpdateCoreData = !orderLine.reversal && !order.paymentAttempted
      if (updatingCoreData && !canUpdateCoreData) {
        throw createError(422, 'Users and amounts cannot be updated anymore')
      }

      newOrderLine = _.cloneDeep(orderLine)
      const newMetadata = Order.getCustomData(orderLine, { metadata })
      if (newMetadata) {
        newOrderLine.metadata = newMetadata
      }

      const newplatformData = Order.getCustomData(orderLine, { platformData })
      if (newplatformData) {
        newOrderLine.platformData = newplatformData
      }

      if (updatingCoreData) {
        const coreValues = {
          payerId,
          payerAmount,
          receiverId,
          receiverAmount,
          platformAmount
        }
        Object.keys(coreValues).forEach(key => {
          const value = coreValues[key]
          if (typeof value !== 'undefined') {
            newOrderLine[key] = value
          }
        })
      }

      const newLines = replaceBy(order.lines, newOrderLine, line => line.id === newOrderLine.id)
      const linesInformation = getInformationFromLines(newLines)

      if (updatingCoreData) {
        if (!linesInformation.payerId) {
          throw createError(422, 'The attribute payerId is missing in the order lines')
        }
        if (payerId && payerId !== linesInformation.payerId) {
          throw createError(422, 'The specified payerId does not match with the order one')
        }
      }

      const updateAttrs = {
        lines: newLines
      }

      await updateOrder(order, updateAttrs, {
        req,
        trx,
        lines: newLines,
        moves: order.moves,
        linesInformation
      })
    })

    return Order.exposeLine(newOrderLine, { req })
  })

  // ORDER MOVE

  responder.on('readMove', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Order } = await getModels({ platformId, env })

    const orderMoveId = req.orderMoveId

    const orders = await Order.query()
      .whereJsonSupersetOf('moves', [{ id: orderMoveId }])
      .limit(1)

    const order = orders[0]
    if (!order) {
      throw createError(404)
    }

    const currentUserId = getCurrentUserId(req)

    const orderMove = order.moves.find(move => move.id === orderMoveId)

    const isSelf = Order.isSelfForMove(orderMove, currentUserId)
    if (!req._matchedPermissions['orderMove:read:all'] && !isSelf) {
      throw createError(403)
    }

    return Order.exposeMove(orderMove, { req })
  })

  responder.on('createMove', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Order } = await getModels({ platformId, env })

    const fields = [
      'orderId',
      'transactionId',
      'reversal',
      'payerId',
      'payerAmount',
      'receiverId',
      'receiverAmount',
      'platformAmount',
      'currency',
      'real',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const {
      currency,
      payerId,
      receiverId,
      transactionId,
      orderId
    } = payload

    const knex = Order.knex()

    let newOrderMove

    await transaction(knex, async (trx) => {
      // use sql `SELECT FOR UPDATE` to wait for other sql orders to be completed
      // before reading the last version of Stelace order
      const order = await Order.query(trx).forUpdate()
        .findById(orderId)
      if (!order) {
        throw createError(404)
      }

      if (!order.lines.length) {
        throw createError(422, 'Cannot create a move for an order that has no order line')
      }

      const linesInformation = getInformationFromLines(order.lines)
      if (transactionId && !linesInformation.transactionIds.includes(transactionId)) {
        throw createError(422, `The provided transactionId (${transactionId}) doesn't match any order line`)
      }
      if (payerId && payerId !== order.payerId) {
        const msg = `The provided payer (${payerId}) doesn't match with the order's payer (${order.payerId})`
        throw createError(422, msg)
      }
      if (receiverId && !linesInformation.receiverIds.includes(receiverId)) {
        const msg = `The provided receiver (${receiverId}) doesn't match with any order line receiver`
        throw createError(422, msg)
      }
      if (currency !== order.currency) {
        const msg = `The provided currency (${currency}) doesn't match with the order's currency (${order.currency})`
        throw createError(422, msg)
      }

      const currentUserId = getCurrentUserId(req)

      const now = new Date().toISOString()

      newOrderMove = Object.assign({
        id: await getObjectId({ prefix: Order.moveIdPrefix, platformId, env }),
        createdDate: now,
        updatedDate: now,
        transactionId: null,
        reversal: false,
        payerId: null,
        payerAmount: null,
        receiverId: null,
        receiverAmount: null,
        platformAmount: null,
        metadata: {},
        platformData: {}
      }, payload)

      if (newOrderMove.real) {
        if (typeof newOrderMove.real.payerAmount === 'undefined') {
          newOrderMove.real.payerAmount = null
        }
        if (typeof newOrderMove.real.receiverAmount === 'undefined') {
          newOrderMove.real.receiverAmount = null
        }
        if (typeof newOrderMove.real.platformAmount === 'undefined') {
          newOrderMove.real.platformAmount = null
        }

        if (!isValidCurrency(newOrderMove.real.currency)) {
          throw createError(422, 'Invalid currency for real amounts')
        }
      }

      const isSelf = Order.isSelfForLine(newOrderMove, currentUserId)
      if (!req._matchedPermissions['orderMove:create:all'] && !isSelf) {
        throw createError(403)
      }

      const newMoves = order.moves.concat([newOrderMove])

      const updateAttrs = {
        moves: newMoves
      }

      await updateOrder(order, updateAttrs, {
        req,
        trx,
        lines: order.lines,
        moves: newMoves
      })
    })

    return Order.exposeMove(newOrderMove, { req })
  })

  responder.on('updateMove', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Order } = await getModels({ platformId, env })

    const orderMoveId = req.orderMoveId

    const fields = [
      'real',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const {
      real,
      metadata,
      platformData
    } = payload

    const knex = Order.knex()

    let newOrderMove

    await transaction(knex, async (trx) => {
      // use sql `SELECT FOR UPDATE` to wait for other sql orders to be completed
      // before reading the last version of Stelace order
      const orders = await Order.query(trx).forUpdate()
        .whereJsonSupersetOf('moves', [{ id: orderMoveId }])
        .limit(1)

      const order = orders[0]
      if (!order) {
        throw createError(404)
      }

      const currentUserId = getCurrentUserId(req)

      const orderMove = order.moves.find(move => move.id === orderMoveId)

      const isSelf = Order.isSelfForMove(orderMove, currentUserId)
      if (!req._matchedPermissions['orderMove:edit:all'] && !isSelf) {
        throw createError(403)
      }

      newOrderMove = _.cloneDeep(orderMove)

      if (typeof real !== 'undefined') {
        if (real === null) {
          newOrderMove.real = null
        } else {
          if (typeof real.payerAmount !== 'undefined') {
            newOrderMove.real.payerAmount = real.payerAmount
          }
          if (typeof real.receiverAmount !== 'undefined') {
            newOrderMove.real.receiverAmount = real.receiverAmount
          }
          if (typeof real.platformAmount !== 'undefined') {
            newOrderMove.real.platformAmount = real.platformAmount
          }

          if (real.currency && !isValidCurrency(real.currency)) {
            throw createError(422, 'Invalid currency for real amounts')
          }
        }
      }

      const newMetadata = Order.getCustomData(orderMove, { metadata })
      if (newMetadata) {
        newOrderMove.metadata = newMetadata
      }

      const newplatformData = Order.getCustomData(orderMove, { platformData })
      if (newplatformData) {
        newOrderMove.platformData = newplatformData
      }

      const newMoves = replaceBy(order.moves, newOrderMove, move => move.id === newOrderMove.id)

      const updateAttrs = {
        moves: newMoves
      }

      await updateOrder(order, updateAttrs, {
        req,
        trx,
        lines: order.lines,
        moves: newMoves
      })
    })

    return Order.exposeMove(newOrderMove, { req })
  })

  // EVENTS

  subscriber.on('orderCreated', async ({ order, eventDate, platformId, env, req } = {}) => {
    try {
      const { Event, Order } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'order__created',
        objectId: order.id,
        object: Order.expose(order, { req, namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { orderId: order.id },
        message: 'Fail to create event order__created'
      })
    }
  })

  subscriber.on('orderUpdated', async ({
    orderId,
    updateAttrs,
    newOrder,
    eventDate,
    platformId,
    env,
    req
  } = {}) => {
    try {
      const { Event, Order } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'order__updated',
        objectId: orderId,
        object: Order.expose(newOrder, { req, namespaces: ['*'] }),
        changesRequested: Order.expose(updateAttrs, { req, namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { orderId },
        message: 'Fail to create event order__updated'
      })
    }
  })

  async function fetchTransaction (transactionId, { req }) {
    const transactions = await fetchTransactions([transactionId], { req })
    return transactions[0]
  }

  async function fetchTransactions (transactionIds, { req }) {
    if (!transactionIds.length) return []

    const transactionPaginationResult = await transactionRequester.communicate(req)({
      type: 'list',
      _matchedPermissions: {
        'transaction:list:all': true
      },
      id: transactionIds,
      orderBy: 'createdDate',
      order: 'desc',
      page: 1,
      nbResultsPerPage: 1000
    })

    return transactionPaginationResult.results
  }

  function checkTransactions (transactions) {
    let payerId
    let currency

    transactions.forEach(transaction => {
      if (!transaction.ownerId) {
        throw createError(422, `Missing owner for transaction with ID ${transaction.id}`)
      }
      if (!transaction.takerId) {
        throw createError(422, `Missing taker for transaction with ID ${transaction.id}`)
      }
      if (!canComputePricing(transaction)) {
        throw createError(422, `Missing asset for the transaction with ID ${transaction.id}`)
      }

      if (payerId !== transaction.takerId) {
        if (!payerId) {
          payerId = transaction.takerId
        } else {
          throw createError(422, `Multiple payers detected: ${payerId}, ${transaction.takerId}`)
        }
      }

      if (currency !== transaction.currency) {
        if (!currency) {
          currency = transaction.currency
        } else {
          throw createError(422, `Multiple currencies are not accepted: ${currency}, ${transaction.currency}`)
        }
      }
    })
  }

  function checkLines (lines, { transactions }) {
    let payerId
    let currency

    const indexedTransactions = _.keyBy(transactions, 'id')

    lines.forEach(line => {
      if (payerId !== line.payerId) {
        if (!payerId) {
          payerId = line.payerId
        } else {
          throw createError(422, `Multiple payers detected: ${payerId}, ${line.payerId}`)
        }
      }

      if (currency !== line.currency) {
        if (!currency) {
          currency = line.currency
        } else {
          throw createError(422, `Multiple currencies are not accepted: ${currency}, ${line.currency}`)
        }
      }

      if (line.transactionId) {
        const transaction = indexedTransactions[line.transactionId]
        if (!transaction) {
          throw createError(422, `Transaction ID ${line.transactionId} not found`)
        }

        if (line.payerId && transaction.takerId !== line.payerId) {
          throw createError(`The payer ${line.payerId} doesn't match with the transaction taker ${transaction.takerId}`)
        }
        if (line.currency !== transaction.currency) {
          throw createError(422, `Line's currency (${line.currency}) doesn't match with the transaction ${transaction.id} (${transaction.currency})`)
        }
      }
    })
  }

  function checkMoves (moves) {
    let payerId
    let currency

    moves.forEach(move => {
      if (payerId !== move.payerId) {
        if (!payerId) {
          payerId = move.payerId
        } else {
          throw createError(422, `Multiple payers detected: ${payerId}, ${move.payerId}`)
        }
      }

      if (currency !== move.currency) {
        if (!currency) {
          currency = move.currency
        } else {
          throw createError(422, `Multiple currencies are not accepted: ${currency}, ${move.currency}`)
        }
      }
    })
  }

  async function previewOrder ({
    lines,
    moves,
    transactionIds,
    currentUserId,
    hasAllPermissions = false,
    req
  }) {
    if (lines && transactionIds) {
      throw createError(422, 'Cannot provide lines and transactionIds at the same time')
    }
    if ((!lines || !lines.length) && (moves && moves.length)) {
      throw createError(422, 'Please also provide order lines if you want to specify order moves')
    }

    const previewedOrder = {}

    if (!hasAllPermissions) {
      if (!currentUserId) {
        throw createError(403)
      }
      if (!transactionIds) {
        throw createError(400, 'The parameter "transactionIds" is expected')
      }
    }

    if (transactionIds) {
      const transactions = await fetchTransactions(transactionIds, { req })
      checkTransactions(transactions)
      lines = getLinesFromTransactions(transactions)
    } else if (lines) {
      let transactionIds = []
      lines.forEach(line => {
        if (line.transactionId) {
          transactionIds.push(line.transactionId)
        }
      })

      transactionIds = _.uniq(transactionIds)

      if (transactionIds.length) {
        const transactions = await fetchTransaction(transactionIds, { req })
        checkTransactions(transactions)
        checkLines(lines, { transactions })
      }
    }

    if (moves) {
      checkMoves(moves)
    }

    lines = lines || []
    moves = moves || []

    const linesInformation = getInformationFromLines(lines)
    const movesInformation = getInformationFromMoves(moves)

    if (moves && moves.length) {
      if (linesInformation.payerId !== movesInformation.payerId) {
        const msg = `Order lines and moves payers don't match: ${linesInformation.payerId}, ${movesInformation.payerId}`
        throw createError(422, msg)
      }
      if (linesInformation.currency !== movesInformation.currency) {
        const msg = `Order lines and moves currencies don't match: ${linesInformation.currency}, ${movesInformation.currency}`
        throw createError(422, msg)
      }

      const movesExtraTransactions = _.difference(movesInformation.transactionIds, linesInformation.transactionIds)
      if (movesExtraTransactions.length) {
        const msg = `Order moves define receivers that don't exist in order lines: ${movesExtraTransactions.join(', ')}`
        throw createError(422, msg)
      }

      const movesExtraReceivers = _.difference(movesInformation.receiverIds, linesInformation.receiverIds)
      if (movesExtraReceivers.length) {
        const msg = `Order moves define receivers that don't exist in order lines: ${movesExtraReceivers.join(', ')}`
        throw createError(422, msg)
      }
    }

    if (lines.length && !linesInformation.payerId) {
      throw createError(422, 'There is no payerId specified in order lines')
    }

    // a user can only create an order if it's for herself
    if (!hasAllPermissions && linesInformation.payerId !== currentUserId) {
      throw createError(403)
    }

    const orderMeta = getOrderMeta({}, { lines, moves, linesInformation, movesInformation })
    Object.assign(previewedOrder, orderMeta)

    previewedOrder.lines = lines
    previewedOrder.moves = moves

    return previewedOrder
  }

  // Must be the last function in service logic
  // because an event is emitted
  async function updateOrder (order, updateAttrs, {
    req,
    trx,
    lines,
    moves,
    linesInformation,
    movesInformation,
    metadata,
    platformData
  }) {
    const platformId = req.platformId
    const env = req.env
    const { Order } = await getModels({ platformId, env })

    if (!linesInformation) {
      linesInformation = getInformationFromLines(lines)
    }
    if (!movesInformation) {
      movesInformation = getInformationFromMoves(moves)
    }

    const updateAttrsBeforeFullDataMerge = Object.assign({}, updateAttrs, {
      metadata,
      platformData
    })

    const orderMetaChanged = lines || moves || linesInformation || movesInformation
    if (orderMetaChanged) {
      const orderMeta = getOrderMeta(order, { lines, moves, linesInformation, movesInformation })
      Object.assign(updateAttrs, orderMeta)
    }

    const newOrder = await Order.query(trx).patchAndFetchById(order.id, updateAttrs)

    publisher.publish('orderUpdated', {
      orderId: order.id,
      order,
      newOrder,
      updateAttrs: updateAttrsBeforeFullDataMerge,
      eventDate: newOrder.updatedDate,
      platformId,
      env,
      req
    })

    return newOrder
  }
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
