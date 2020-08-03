const { computeDate, truncateDate } = require('./time')
const ms = require('ms')

const retentionLogDuration = '31 days'

function getRetentionLimitDate () {
  // truncate date to have a relatively stable value to display if there is any error value
  // example: from 2020-01-31 (included) to 2020-02-01 (excluded) will have 2020-01-01
  // as retention limit date if the retention duration is '31 days'
  const today = truncateDate(new Date().toISOString())
  const durationToRemove = ms(retentionLogDuration) - ms('1 day')
  return computeDate(today, ms(-durationToRemove, { long: true }))
}

module.exports = {
  retentionLogDuration,
  getRetentionLimitDate,
}
