const Base = require('./Base')

class Workflow extends Base {
  static get tableName () {
    return 'workflow'
  }

  static get idPrefix () {
    return 'wfw'
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
        name: {
          type: 'string',
          maxLength: 255
        },
        description: {
          type: 'string'
        },
        context: {
          type: ['array', 'null'],
          default: null
        },
        notifyUrl: {
          type: 'string',
          maxLength: 255
        },
        event: {
          type: 'string'
        },
        run: {
          type: ['array', 'null'],
          default: null
        },
        computed: {
          type: ['object', 'null'],
          default: null
        },
        active: {
          type: 'boolean',
          default: true
        },
        stats: {
          type: 'object',
          default: {
            nbTimesRun: 0
          }
        },
        apiVersion: {
          type: 'string',
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
        'name',
        'description',
        'context',
        'notifyUrl',
        'event',
        'run',
        'computed',
        'active',
        'stats',
        'apiVersion',
        'logs', // not in model, populated on the fly from WorkflowLog Model
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }
}

module.exports = Workflow
