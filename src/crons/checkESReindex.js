const CronJob = require('cron').CronJob
const Redlock = require('redlock')

const { logError } = require('../../logger')
const { getRedisClient } = require('../redis')

const { checkReindexing: esCheckReindexing } = require('../elasticsearch-reindex')

const isTestEnv = process.env.NODE_ENV === 'test'
const lockResource = 'locks:esCheckReindexing'
let communicationId

// create a lock time of 5 seconds so another server can claim the lock after that duration
// even if the server that has the lock crashes
const ttl = 5000

let client
let redlock

const job = new CronJob(
  '*/5 * * * * *', // check every 5 seconds
  checkReindexing,
  null,
  null,
  'Europe/London'
)

async function checkReindexing () {
  try {
    // use redlock to ensure the cron process is handled only by one server at a time
    // even within a distributed system

    // do not lock in test environment, each server will handle reindexing processes
    // that are triggered by itself

    let lock
    if (!isTestEnv) {
      lock = await redlock.lock(lockResource, ttl)
    }

    await esCheckReindexing({ COMMUNICATION_ID: communicationId })

    if (!isTestEnv) {
      await lock.unlock()
    }
  } catch (err) {
    if (err.name !== 'LockError') {
      logError(err, { message: 'Fail to check if Elasticsearch is reindexing' })
    }
  }
}

function start ({ communication }) {
  const { COMMUNICATION_ID } = communication
  communicationId = COMMUNICATION_ID

  if (!client) {
    client = getRedisClient()
  }
  if (!redlock) {
    redlock = new Redlock(
      [client],
      {
        retryCount: 3
      }
    )
  }

  job.start()
}

function stop () {
  job.stop()
}

module.exports = {
  start,
  stop
}
