const createError = require('http-errors')
const { getModels, getModelInfo } = require('../models')

const { performListQuery, performAggregationQuery } = require('../util/listQueryBuilder')
const { getRetentionLimitDate } = require('../util/timeSeries')

let responder

function start ({ communication }) {
  const {
    getResponder
  } = communication

  responder = getResponder({
    name: 'Event Responder',
    key: 'event'
  })

  responder.on('getStats', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Event } = await getModels({ platformId, env })

    const {
      orderBy,
      order,

      page,
      nbResultsPerPage,

      field,
      groupBy,
      avgPrecision,

      id,
      createdDate,
      eventType: type,
      objectType,
      objectId,
      emitter,
      emitterId,
      object,
      metadata
    } = req

    const queryBuilder = Event.knex()

    const minCreatedDate = getRetentionLimitDate()

    const paginationMeta = await performAggregationQuery({
      queryBuilder,
      groupBy,
      field,
      schema: Event.defaultSchema,
      avgPrecision,
      filters: {
        ids: {
          dbField: 'id',
          value: id,
          transformValue: 'array',
          query: 'inList'
        },
        createdDate: {
          dbField: 'createdTimestamp',
          value: createdDate,
          query: 'range',
          defaultValue: { gte: minCreatedDate },
          minValue: minCreatedDate
        },
        types: {
          dbField: 'type',
          value: type,
          transformValue: 'array',
          query: 'inList'
        },
        objectTypes: {
          dbField: 'objectType',
          value: objectType,
          transformValue: 'array',
          query: 'inList'
        },
        objectIds: {
          dbField: 'objectId',
          value: objectId,
          transformValue: 'array',
          query: 'inList'
        },
        emitter: {
          dbField: 'emitter',
          value: emitter
        },
        emitterIds: {
          dbField: 'emitterId',
          value: emitterId,
          transformValue: 'array',
          query: 'inList'
        },
        object: {
          value: object,
          dbField: 'object',
          query: 'jsonSupersetOf'
        },
        metadata: {
          value: metadata,
          dbField: 'metadata',
          query: 'jsonSupersetOf'
        }
      },
      paginationConfig: {
        page,
        nbResultsPerPage
      },
      orderConfig: {
        orderBy,
        order
      }
    })

    return paginationMeta
  })

  responder.on('list', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Event } = await getModels({ platformId, env })

    const {
      orderBy,
      order,

      page,
      nbResultsPerPage,

      id,
      createdDate,
      eventType: type,
      objectType,
      objectId,
      emitter,
      emitterId,
      object,
      metadata
    } = req

    const queryBuilder = Event.query()

    const minCreatedDate = getRetentionLimitDate()

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
          dbField: 'createdTimestamp',
          value: createdDate,
          query: 'range',
          defaultValue: { gte: minCreatedDate },
          minValue: minCreatedDate
        },
        types: {
          dbField: 'type',
          value: type,
          transformValue: 'array',
          query: 'inList'
        },
        objectTypes: {
          dbField: 'objectType',
          value: objectType,
          transformValue: 'array',
          query: 'inList'
        },
        objectIds: {
          dbField: 'objectId',
          value: objectId,
          transformValue: 'array',
          query: 'inList'
        },
        emitter: {
          dbField: 'emitter',
          value: emitter
        },
        emitterIds: {
          dbField: 'emitterId',
          value: emitterId,
          transformValue: 'array',
          query: 'inList'
        },
        object: {
          value: object,
          dbField: 'object',
          query: 'jsonSupersetOf'
        },
        metadata: {
          value: metadata,
          dbField: 'metadata',
          query: 'jsonSupersetOf'
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

    paginationMeta.results = Event.exposeAll(paginationMeta.results, { req })

    return paginationMeta
  })

  responder.on('read', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Event } = await getModels({ platformId, env })

    const eventId = req.eventId

    const minCreatedDate = getRetentionLimitDate()

    // without filter, compressed chunk will be queried so the response will be long
    const event = await Event.query().findById(eventId).where('createdTimestamp', '>=', minCreatedDate)
    if (!event) {
      throw createError(404)
    }

    return Event.expose(event, { req })
  })

  responder.on('create', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const Models = await getModels({ platformId, env })
    const { Event } = Models

    const {
      eventType: type,
      objectId,
      metadata,

      emitter, // For internal use: emitter can be set to values like task by services
      emitterId
    } = req

    if (Event.isCoreEventFormat(type)) {
      throw createError(422, Event.getBadCustomEventTypeMessage())
    }

    let object
    let objectType

    if (objectId) {
      const { objectType: type, Model } = getModelInfo({ objectId, Models })
      objectType = type
      object = Model ? await Model.query().findById(objectId) : null
      object = object && Model.expose(object, { namespaces: ['*'] })
    }

    const event = await Event.createEvent({
      type,
      objectId,
      objectType,
      object,
      metadata,
      emitterId,
      emitter: emitter || 'custom'
    }, { platformId, env })

    return Event.expose(event, { req })
  })
}

function stop () {
  responder.close()
  responder = null
}

module.exports = {
  start,
  stop
}
