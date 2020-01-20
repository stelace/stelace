const createError = require('http-errors')
const _ = require('lodash')
const bluebird = require('bluebird')

const { getModels } = require('../models')

const { logError } = require('../../server/logger')

const {
  setStelaceTask,
  removeStelaceTask,
  removeStelaceTaskExecutionDates
} = require('../redis')

const { getObjectId } = require('stelace-util-keys')

const { performListQuery } = require('../util/listQueryBuilder')

const {
  isValidCronPattern,
  isValidTimezone,
  getRoundedDate
} = require('../util/time')

let responder
let eventSubscriber

function start ({ communication }) {
  const {
    getResponder,
    getSubscriber,
    COMMUNICATION_ID
  } = communication

  responder = getResponder({
    name: 'Task Responder',
    key: 'task'
  })

  eventSubscriber = getSubscriber({
    name: 'Task subscriber for events',
    key: 'event',
    namespace: COMMUNICATION_ID,
    subscribesTo: [
      'eventCreated'
    ]
  })

  responder.on('list', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Task } = await getModels({ platformId, env })

    const {
      orderBy,
      order,

      page,
      nbResultsPerPage,

      id,
      createdDate,
      updatedDate,
      eventType,
      eventObjectId,
      active
    } = req

    const queryBuilder = Task.query()

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
        eventTypes: {
          dbField: 'eventType',
          value: eventType,
          transformValue: 'array',
          query: 'inList'
        },
        eventObjectIds: {
          dbField: 'eventObjectId',
          value: eventObjectId,
          transformValue: 'array',
          query: 'inList'
        },
        active: {
          dbField: 'active',
          value: active
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

    paginationMeta.results = Task.exposeAll(paginationMeta.results, { req })

    return paginationMeta
  })

  responder.on('read', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Task } = await getModels({ platformId, env })

    const taskId = req.taskId

    const task = await Task.query().findById(taskId)
    if (!task) throw createError(404)

    return Task.expose(task, { req })
  })

  responder.on('create', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Event, Task } = await getModels({ platformId, env })

    const fields = [
      'executionDate',
      'recurringPattern',
      'recurringTimezone',
      'eventType',
      'eventMetadata',
      'eventObjectId',
      'active',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const createAttrs = Object.assign({
      id: await getObjectId({ prefix: Task.idPrefix, platformId, env })
    }, payload)

    const {
      eventType,
      executionDate,
      recurringPattern,
      recurringTimezone
    } = payload

    if (recurringPattern && executionDate) {
      throw createError(400, 'Cannot provide both executionDate and recurringPattern')
    }

    if (recurringPattern && !isValidCronPattern(recurringPattern)) {
      throw createError(400, 'Invalid recurring pattern')
    }
    if (recurringTimezone && !isValidTimezone(recurringTimezone)) {
      throw createError(400, 'Invalid recurring timezone')
    }

    if (executionDate) {
      createAttrs.executionDate = getRoundedDate(executionDate)
    }

    if (Event.isCoreEventFormat(eventType)) {
      throw createError(422, Event.getBadCustomEventTypeMessage())
    }

    const task = await Task.query().insert(createAttrs)

    if (task.active) {
      // Do not include `metadata` or `platformData` to save space in Redis
      await setStelaceTask({ platformId, env, task: _.omit(task, ['metadata', 'platformData']) })
    }

    return Task.expose(task, { req })
  })

  responder.on('update', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Event, Task } = await getModels({ platformId, env })

    const taskId = req.taskId

    const fields = [
      'executionDate',
      'recurringPattern',
      'recurringTimezone',
      'eventType',
      'eventMetadata',
      'eventObjectId',
      'active',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const {
      eventType,
      executionDate,
      recurringPattern,
      recurringTimezone,
      metadata,
      platformData
    } = payload

    const task = await Task.query().findById(taskId)
    if (!task) throw createError(404)

    const updateAttrs = _.omit(payload, ['metadata', 'platformData'])

    const newExecutionDate = typeof executionDate !== 'undefined' ? executionDate : task.executionDate
    const newRecurringPattern = typeof recurringPattern !== 'undefined' ? recurringPattern : task.recurringPattern

    if (newExecutionDate && newRecurringPattern) {
      throw createError(400, 'Cannot provide both executionDate and recurringPattern')
    }

    if (recurringPattern && !isValidCronPattern(recurringPattern)) {
      throw createError(400, 'Invalid recurring pattern')
    }
    if (recurringTimezone && !isValidTimezone(recurringTimezone)) {
      throw createError(400, 'Invalid recurring timezone')
    }

    if (executionDate) {
      updateAttrs.executionDate = getRoundedDate(executionDate)
    }

    if (eventType && Event.isCoreEventFormat(eventType)) {
      throw createError(422, Event.getBadCustomEventTypeMessage())
    }

    if (metadata) {
      updateAttrs.metadata = Task.rawJsonbMerge('metadata', metadata)
    }
    if (platformData) {
      updateAttrs.platformData = Task.rawJsonbMerge('platformData', platformData)
    }

    const newTask = await Task.query().patchAndFetchById(taskId, updateAttrs)

    if (newTask.active) {
      // Do not include `metadata` or `platformData` to save space in Redis
      await setStelaceTask({ platformId, env, task: _.omit(newTask, ['metadata', 'platformData']) })
    } else {
      await removeStelaceTask({ platformId, env, taskId: newTask.id })
    }

    return Task.expose(newTask, { req })
  })

  responder.on('remove', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Task } = await getModels({ platformId, env })

    const { taskId } = req

    const task = await Task.query().findById(taskId)
    if (!task) {
      return { id: taskId }
    }

    await removeTask({ taskId, platformId, env })

    return { id: taskId }
  })

  // EVENTS

  eventSubscriber.on('eventCreated', async ({ event, platformId, env } = {}) => {
    const { Event, Task } = await getModels({ platformId, env })

    const isDeletingObject = Event.isCoreEventFormat(event.type) && event.type.endsWith('__deleted')
    if (!isDeletingObject || !event.objectId) return

    const tasks = await Task.query().where({ eventObjectId: event.objectId })

    await bluebird.map(tasks, async (task) => {
      try {
        await removeTask({ taskId: task.id, platformId, env })
      } catch (err) {
        logError(err, { platformId, env, message: `Fail to remove task ID ${task.id} after object deletion` })
      }
    }, { concurrency: 5 })
  })
}

async function removeTask ({ taskId, platformId, env }) {
  const { Task } = await getModels({ platformId, env })

  await Task.query().deleteById(taskId)

  await removeStelaceTask({ platformId, env, taskId })
  await removeStelaceTaskExecutionDates({ taskId })
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
