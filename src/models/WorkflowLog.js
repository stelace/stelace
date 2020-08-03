const Base = require('./Base')

class WorkflowLog extends Base {
  static get tableName () {
    return 'workflowLog'
  }

  static get idPrefix () {
    return 'wfl'
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
        createdTimestamp: { // time column for hypertable
          type: 'string',
        },
        workflowId: {
          type: 'string'
        },
        eventId: {
          type: 'string'
        },
        runId: {
          type: 'string'
        },
        type: {
          type: 'string'
        },
        statusCode: {
          type: ['integer', 'null'],
          default: null,
        },
        step: {
          type: 'object',
          default: {
            // default only applies if object is totally missing,
            // but not when only some keys are missing.
            name: null,
            error: false,
            stopped: false,
            skipped: false,
            handleErrors: false
          }
        },
        metadata: {
          type: 'object',
          default: {}
        }
      }
    }
  }

  $beforeInsert () {
    const now = new Date().toISOString()

    this.createdDate = now
    this.createdTimestamp = now
    // no updatedDate
  }

  $beforeUpdate () { // no updatedDate
  }

  static getAccessFields (access) {
    const accessFields = {
      api: [
        'id',
        'createdDate',
        'workflowId',
        'eventId',
        'type',
        'statusCode',
        'step',
        'metadata',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }
}

module.exports = WorkflowLog
