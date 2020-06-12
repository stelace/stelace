const http = require('http')
const createError = require('http-errors')
const bluebird = require('bluebird')
const request = require('superagent')

const { logError } = require('../../server/logger')
const { getModels } = require('../models')

const { getObjectId } = require('stelace-util-keys')

const { apiVersions } = require('../versions')

const { performListQuery } = require('../util/listQueryBuilder')
const { getRetentionLimitDate } = require('../util/timeSeries')

let responder
let eventSubscriber

function start ({ communication }) {
  const {
    getResponder,
    getSubscriber,
    COMMUNICATION_ID
  } = communication

  responder = getResponder({
    name: 'Webhook Responder',
    key: 'webhook'
  })

  eventSubscriber = getSubscriber({
    name: 'Webhook subscriber for events',
    key: 'event',
    namespace: COMMUNICATION_ID,
    subscribesTo: [
      'eventCreated'
    ]
  })

  responder.on('list', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Webhook } = await getModels({ platformId, env })

    const {
      orderBy,
      order,

      nbResultsPerPage,

      // cursor pagination
      startingAfter,
      endingBefore,

      id,
      createdDate,
      updatedDate,
      event,
      active,
    } = req

    const queryBuilder = Webhook.query()

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
        events: {
          dbField: 'event',
          value: event,
          transformValue: 'array',
          query: 'inList',
        },
        active: {
          dbField: 'active',
          value: active
        },
      },
      paginationActive: true,
      paginationConfig: {
        nbResultsPerPage,

        // cursor pagination
        startingAfter,
        endingBefore,
      },
      orderConfig: {
        orderBy,
        order
      }
    })

    paginationMeta.results = Webhook.exposeAll(paginationMeta.results, { req })

    return paginationMeta
  })

  responder.on('read', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const webhookId = req.webhookId
    const populateLogs = typeof req.logs !== 'undefined'
    const { Webhook, WebhookLog } = await getModels({ platformId, env })

    const webhook = await Webhook.query().findById(webhookId)
    if (!webhook) {
      throw createError(404)
    }

    if (populateLogs) {
      const webhookLogs = await WebhookLog.query()
        .where({ webhookId: webhook.id })
        .orderBy('createdDate', 'desc')
        .limit(100)

      webhook.logs = webhookLogs
    }

    return Webhook.expose(webhook, { req })
  })

  responder.on('create', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const {
      Event,
      Webhook
    } = await getModels({ platformId, env })

    const {
      name,
      targetUrl,
      event,
      apiVersion,
      active,
      metadata,
      platformData
    } = req

    if (event) {
      const isAllowedEvent = Event.isAllowedEvent(event)

      if (!isAllowedEvent) throw createError(422, `Invalid ${event} event`)
    }
    if (apiVersion && !apiVersions.includes(apiVersion)) {
      // Safeguard as it is already handled during Joi validation
      throw createError(400, 'Invalid API version', {
        public: { allowedVersions: apiVersions }
      })
    }

    const latestApiVersion = apiVersions[0]

    const webhook = await Webhook.query().insert({
      id: await getObjectId({ prefix: Webhook.idPrefix, platformId, env }),
      name,
      targetUrl,
      event,
      // Falling back to default platform version (req._platformVersion)
      apiVersion: apiVersion || req._platformVersion || latestApiVersion,
      active,
      metadata,
      platformData
    })

    return Webhook.expose(webhook, { req })
  })

  responder.on('update', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const {
      Event,
      Webhook
    } = await getModels({ platformId, env })

    const {
      webhookId,
      name,
      event,
      apiVersion,
      active,
      metadata,
      platformData
    } = req

    let webhook = await Webhook.query().findById(webhookId)
    if (!webhook) {
      throw createError(404)
    }

    if (event) {
      const isAllowedEvent = Event.isAllowedEvent(event)

      if (!isAllowedEvent) throw createError(422, `Invalid ${event} event`)
    }
    if (apiVersion && !apiVersions.includes(apiVersion)) {
      throw createError(422, 'Invalid API version', {
        public: {
          allowedVersions: apiVersions
        }
      })
    }

    const updateAttrs = {
      name,
      event,
      active
    }

    if (metadata) {
      updateAttrs.metadata = Webhook.rawJsonbMerge('metadata', metadata)
    }
    if (platformData) {
      updateAttrs.platformData = Webhook.rawJsonbMerge('platformData', platformData)
    }

    webhook = await Webhook.query().patchAndFetchById(webhookId, updateAttrs)

    return Webhook.expose(webhook, { req })
  })

  responder.on('remove', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Webhook } = await getModels({ platformId, env })

    const {
      webhookId
    } = req

    const webhook = await Webhook.query().findById(webhookId)
    if (!webhook) {
      return { id: webhookId }
    }

    await Webhook.query().deleteById(webhookId)

    return { id: webhookId }
  })

  // /////////// //
  // WEBHOOK LOG //
  // /////////// //

  responder.on('listLogs', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { WebhookLog } = await getModels({ platformId, env })

    const {
      orderBy,
      order,

      nbResultsPerPage,

      // cursor pagination
      startingAfter,
      endingBefore,

      id,
      createdDate,
      webhookId,
      eventId,
      status,
    } = req

    const queryBuilder = WebhookLog.query()

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
          dbField: 'createdDate',
          value: createdDate,
          query: 'range',
          defaultValue: { gte: minCreatedDate },
          minValue: minCreatedDate
        },
        webhookIds: {
          dbField: 'webhookId',
          value: webhookId,
          transformValue: 'array',
          query: 'inList'
        },
        eventIds: {
          dbField: 'eventId',
          value: eventId,
          transformValue: 'array',
          query: 'inList'
        },
        statuses: {
          dbField: 'statusCode',
          value: status,
          transformValue: 'array',
          query: 'inList'
        },
      },
      paginationActive: true,
      paginationConfig: {
        nbResultsPerPage,

        // cursor pagination
        startingAfter,
        endingBefore,
      },
      orderConfig: {
        orderBy,
        order
      }
    })

    paginationMeta.results = WebhookLog.exposeAll(paginationMeta.results, { req })

    return paginationMeta
  })

  responder.on('readLog', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { WebhookLog } = await getModels({ platformId, env })

    const webhookLogId = req.webhookLogId

    const minCreatedDate = getRetentionLimitDate()

    // without this filter, compressed chunk would be queried so the response would be long
    const webhookLog = await WebhookLog.query()
      .findById(webhookLogId)
      .where('createdTimestamp', '>=', minCreatedDate)

    if (!webhookLog) {
      throw createError(404)
    }

    return WebhookLog.expose(webhookLog, { req })
  })

  // EVENTS

  eventSubscriber.on('eventCreated', async ({ event, platformId, env } = {}) => {
    try {
      const { Webhook } = await getModels({ platformId, env })

      const webhooks = await Webhook.query()
        .where({
          active: true,
          event: event.type
        })

      await bluebird.map(webhooks, webhook => callWebhook({ webhook, platformId, env, event }))
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { eventId: event.id },
        message: 'Fail to handle eventCreated event in webhook service'
      })
    }
  })
}

/**
 * Calls webhook remote address, handles errors.
 * @param {Object} params
 * @param {Object} params.webhook
 * @param {Object} params.event
 * @return {Promise} webhook log
 */
async function callWebhook ({ webhook, event, platformId, env }) {
  const {
    Event,
    WebhookLog
  } = await getModels({ platformId, env })

  let exposedEvent = Event.expose(event, { namespaces: ['*'] })
  exposedEvent = await Event.getVersionedEvent(event, webhook.apiVersion)

  const payload = {
    event: exposedEvent
  }
  const log = {
    date: new Date().toISOString(),
    targetUrl: webhook.targetUrl,
    eventObjectId: exposedEvent.objectId
  }

  return request.post(webhook.targetUrl)
    .send(payload)
    .set({
      'x-webhook-source': 'stelace'
    })
    .catch(err => {
      logError(err.response ? err.response.body : err, {
        platformId,
        env,
        custom: {
          webhookId: webhook.id,
          eventId: event.id,
          objectId: event.objectId
        },
        message: 'Fail to send webhook event'
      })

      const statusCode = err.status || err.statusCode
      if (parseInt(statusCode, 10)) {
        log.statusCode = statusCode
        log.statusCodeName = http.STATUS_CODES[statusCode]
      }

      return log
    })
    .then(async () => {
      const webhookLog = await WebhookLog.query().insert({
        id: await getObjectId({ prefix: WebhookLog.idPrefix, platformId, env }),
        webhookId: webhook.id,
        eventId: exposedEvent.id,
        status: log.statusCode ? 'error' : 'success',
        metadata: log
      })

      return webhookLog
    })
}

function stop () {
  responder.close()
  responder = null

  eventSubscriber.close()
  eventSubscriber = null
}

module.exports = {
  start,
  stop
}
