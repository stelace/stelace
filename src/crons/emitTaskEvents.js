const CronJob = require('cron').CronJob
const Redlock = require('redlock')
const _ = require('lodash')
const apm = require('elastic-apm-node')

const { logError } = require('../../logger')

const {
  getRedisClient,
  getAllStelaceTasks,

  didStelaceTaskExecute,
  addStelaceTaskExecutionDate
} = require('../redis')

const {
  getRoundedDate,
  computeRecurringDates,
  computeDate
} = require('../util/time')

let eventRequester

let client
let redlock

// get date rounded to nearest minute
// WARNING: MUST match cron job interval, adjust it if the cron interval changes
const nbMinutes = 1

const randomSecond = _.random(0, 20) // random second that will be rounded to inferior minute

const job = new CronJob(
  `${randomSecond} * * * * *`, // check every minute
  emitTaskEvents
)

// create a lock time so another server can claim the lock after that duration
// even if the server that has the lock crashes
const lockTtl = nbMinutes * 60 * 1000 // milliseconds

async function emitTaskEvents () {
  let fetchEventsTransaction = apm.startTransaction(`Fetch task events to emit via cron`)

  try {
    // use ref date because cron job cannot trigger at the specified time (with 0 millisecond)
    const refDate = getRoundedDate(new Date(), nbMinutes)

    const taskConfigs = await getAllStelaceTasks()

    const filteredTaskConfigs = filterTasks(taskConfigs, refDate, nbMinutes)

    fetchEventsTransaction.end()
    fetchEventsTransaction = null // set null to prevent stopping a second time in the finally block

    for (let i = 0; i < filteredTaskConfigs.length; i++) {
      const taskConfig = filteredTaskConfigs[i]
      const { platformId, env, task } = taskConfig

      const emitEventTransaction = apm.startTransaction('Emit task event via cron')
      apm.setUserContext({ id: platformId })
      apm.addLabels({ env, platformId, eventType: task.eventType })
      apm.setCustomContext({ taskId: task.id })

      try {
        // use redlock to ensure the cron process is handled only by one server at a time
        // even within a distributed system
        const lockResource = `locks:stelace_tasks:${task.id}_${refDate}`
        const lock = await redlock.lock(lockResource, lockTtl)

        const alreadyExecuted = await didStelaceTaskExecute({ taskId: task.id, executionDate: refDate })

        if (!alreadyExecuted) {
          await addStelaceTaskExecutionDate({ taskId: task.id, executionDate: refDate })
          await emitTaskEvent({ platformId, env, task })
        }

        await lock.unlock()
      } catch (err) {
        if (err.name !== 'LockError') {
          logError(err, { platformId, env, message: 'Fail to emit task event' })
        }
      } finally {
        emitEventTransaction.end()
      }
    }
  } catch (err) {
    logError(err, { message: 'Fail to load Stelace tasks' })
  } finally {
    fetchEventsTransaction && fetchEventsTransaction.end()
  }
}

function filterTasks (taskConfigs, refDate, nbMinutes) {
  return taskConfigs.filter(taskConfig => {
    const invalidConfig = !taskConfig.platformId ||
      !taskConfig.env ||
      !taskConfig.task

    if (invalidConfig) return false

    const { task } = taskConfig
    if (!task.active) return false

    // if task date matches exactly the ref date, then it's time to trigger the task event
    const isRecurringTask = !!task.recurringPattern
    if (isRecurringTask) {
      const intervalSeconds = nbMinutes * 30

      const computedRecurringDates = computeRecurringDates(task.recurringPattern, {
        startDate: computeDate(refDate, { s: -intervalSeconds }),
        endDate: computeDate(refDate, { s: intervalSeconds }),
        timezone: task.recurringTimezone
      })

      return computedRecurringDates.includes(refDate)
    } else {
      return task.executionDate === refDate
    }
  })
}

async function emitTaskEvent ({ platformId, env, task }) {
  await eventRequester.send({
    type: 'create',
    platformId,
    env,
    emitter: 'task',
    emitterId: task.id,
    eventType: task.eventType,
    objectId: task.eventObjectId,
    metadata: task.eventMetadata
  })
}

function start ({ communication }) {
  const { getRequester } = communication

  eventRequester = getRequester({
    name: 'Emit task event cron > Event Requester',
    key: 'event'
  })

  if (!client) {
    client = getRedisClient()
  }
  if (!redlock) {
    redlock = new Redlock([client], { retryCount: 3 })
  }

  job.start()
}

function stop () {
  eventRequester.close()
  eventRequester = null

  job.stop()
}

module.exports = {
  start,
  stop
}
