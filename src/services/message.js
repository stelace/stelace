const createError = require('http-errors')
const _ = require('lodash')

const { logError } = require('../../server/logger')
const { getModels } = require('../models')

const { getObjectId } = require('stelace-util-keys')

const { performListQuery } = require('../util/listQueryBuilder')

const {
  getCurrentUserId
} = require('../util/user')

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
    name: 'Message Responder',
    key: 'message'
  })

  subscriber = getSubscriber({
    name: 'Message subscriber',
    key: 'message',
    namespace: COMMUNICATION_ID,
    subscribesTo: [
      'messageCreated'
    ]
  })

  publisher = getPublisher({
    name: 'Message publisher',
    key: 'message',
    namespace: COMMUNICATION_ID
  })

  responder.on('list', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Message } = await getModels({ platformId, env })

    const {
      orderBy,
      order,

      nbResultsPerPage,

      // offset pagination
      page,

      // cursor pagination
      startingAfter,
      endingBefore,

      id,
      createdDate,
      updatedDate,
      userId,
      senderId,
      receiverId,
      conversationId,
      topicId
    } = req

    const queryBuilder = Message.query()

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
        senderId: {
          dbField: 'senderId',
          value: senderId
        },
        receiverId: {
          dbField: 'receiverId',
          value: receiverId
        },
        userId: {
          value: userId,
          query: (queryBuilder, userId) => {
            queryBuilder.where(builder => {
              return builder
                .where('senderId', userId)
                .orWhere('receiverId', userId)
            })
          }
        },
        conversationId: {
          dbField: 'conversationId',
          value: conversationId
        },
        topicId: {
          dbField: 'topicId',
          value: topicId
        }
      },
      paginationActive: true,
      paginationConfig: {
        nbResultsPerPage,

        // offset pagination
        page,

        // cursor pagination
        startingAfter,
        endingBefore,
      },
      orderConfig: {
        orderBy,
        order
      },
      useOffsetPagination: req._useOffsetPagination,
    })

    const currentUserId = getCurrentUserId(req)

    paginationMeta.results = paginationMeta.results.map(message => {
      const isSelf = Message.isSelf(message, currentUserId)
      if (!req._matchedPermissions['message:list:all'] && !isSelf) {
        throw createError(403)
      }

      return Message.expose(message, { req })
    })

    return paginationMeta
  })

  responder.on('read', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Message } = await getModels({ platformId, env })

    const messageId = req.messageId

    const message = await Message.query().findById(messageId)
    if (!message) {
      throw createError(404)
    }

    const currentUserId = getCurrentUserId(req)

    const isSelf = Message.isSelf(message, currentUserId)
    if (!req._matchedPermissions['message:read:all'] && !isSelf) {
      throw createError(403)
    }

    return Message.expose(message, { req })
  })

  responder.on('create', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Message } = await getModels({ platformId, env })

    const fields = [
      'topicId',
      'conversationId',
      'content',
      'attachments',
      'read',
      'senderId',
      'receiverId',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const createAttrs = Object.assign({
      id: await getObjectId({ prefix: Message.idPrefix, platformId, env })
    }, payload)

    const currentUserId = getCurrentUserId(req)

    const {
      conversationId,
      senderId,
      receiverId
    } = payload

    if (senderId === receiverId) {
      throw createError(422, 'The sender cannot be the receiver')
    }

    // cannot create as another user
    if (!req._matchedPermissions['message:create:all'] && senderId && senderId !== currentUserId) {
      throw createError(403)
    }

    // automatically set to the current user id if there is no sender id
    if (!createAttrs.senderId && currentUserId) {
      createAttrs.senderId = currentUserId
    }

    if (!createAttrs.senderId) {
      throw createError(422, 'Missing sender ID')
    }

    if (!conversationId) {
      createAttrs.conversationId = await getObjectId({ prefix: Message.conversationIdPrefix, platformId, env })
    } else {
      const message = await Message.query().findOne({ conversationId })
      if (!message) {
        throw createError(422, `No conversation with ID ${conversationId}`)
      }

      const isSelf = Message.isSelf(message, createAttrs.senderId)
      if (!isSelf) {
        throw createError(403, 'The sender is not part of the conversation')
      }
    }

    const message = await Message.query().insert(createAttrs)

    publisher.publish('messageCreated', {
      message,
      eventDate: message.createdDate,
      platformId,
      env,
      req
    })

    return Message.expose(message, { req })
  })

  responder.on('update', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Message } = await getModels({ platformId, env })

    const messageId = req.messageId

    const fields = [
      'read',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const {
      metadata,
      platformData
    } = payload

    const message = await Message.query().findById(messageId)
    if (!message) {
      throw createError(404)
    }

    const currentUserId = getCurrentUserId(req)

    const isSender = Message.isSender(message, currentUserId)
    const isReceiver = Message.isReceiver(message, currentUserId)
    if (!req._matchedPermissions['message:edit:all'] && !isSender) {
      // if the permission 'all' is missing and the user isn't the sender
      // only the receiver can mark the message as read
      const onlyUpdateRead = Object.keys(payload).reduce((memo, key) => {
        if (key === 'read' && isReceiver) return memo
        return false
      }, true)

      if (!onlyUpdateRead) {
        throw createError(403)
      }
    }

    const updateAttrs = _.omit(payload, ['metadata', 'platformData'])

    if (metadata) {
      updateAttrs.metadata = Message.rawJsonbMerge('metadata', metadata)
    }
    if (platformData) {
      updateAttrs.platformData = Message.rawJsonbMerge('platformData', platformData)
    }

    const newMessage = await Message.query().patchAndFetchById(
      messageId,
      updateAttrs
    )

    return Message.expose(newMessage, { req })
  })

  responder.on('remove', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Message } = await getModels({ platformId, env })

    const {
      messageId
    } = req

    const message = await Message.query().findById(messageId)
    if (!message) {
      return { id: messageId }
    }

    const currentUserId = getCurrentUserId(req)

    const isSender = Message.isSender(message, currentUserId)
    if (!req._matchedPermissions['message:remove:all'] && !isSender) {
      throw createError(403)
    }

    await Message.query().deleteById(messageId)

    return { id: messageId }
  })

  // EVENTS

  subscriber.on('messageCreated', async ({ message, eventDate, platformId, env, req } = {}) => {
    try {
      const { Event, Message } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'message__created',
        objectId: message.id,
        object: Message.expose(message, { req, namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { messageId: message.id },
        message: 'Fail to create event message__created'
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
