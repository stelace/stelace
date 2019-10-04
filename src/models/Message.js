const Base = require('./Base')

class Message extends Base {
  static get tableName () {
    return 'message'
  }

  static get idPrefix () {
    return 'msg'
  }

  static get conversationIdPrefix () {
    return 'conv'
  }

  static get jsonSchema () {
    return {
      type: 'object',
      properties: {
        id: {
          type: 'string'
        },
        createdDate: {
          type: 'string',
          maxLength: 24
        },
        updatedDate: {
          type: 'string',
          maxLength: 24
        },
        topicId: {
          type: 'string',
          maxLength: 255
        },
        conversationId: {
          type: 'string',
          maxLength: 255
        },
        content: {
          type: 'string'
        },
        attachments: {
          type: 'array',
          default: []
        },
        read: {
          type: 'boolean',
          default: false
        },
        senderId: {
          type: 'string',
          maxLength: 255
        },
        receiverId: {
          type: 'string',
          maxLength: 255
        },
        metadata: {
          type: 'object',
          default: {}
        },
        platformData: {
          type: 'object',
          default: {}
        }
      }
    }
  }

  static getAccessFields (access) {
    const accessFields = {
      api: [
        'id',
        'createdDate',
        'updatedDate',
        'topicId',
        'conversationId',
        'content',
        'attachments',
        'read',
        'senderId',
        'receiverId',
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }

  static isSelf (message, userId) {
    return [message.senderId, message.receiverId].includes(userId)
  }

  static isSender (message, userId) {
    return message.senderId === userId
  }

  static isReceiver (message, userId) {
    return message.receiverId === userId
  }
}

module.exports = Message
