const moment = require('moment')
// use plain moment library when moment-timezone is not needed
// for safer version upgrades (moment-timezone is still in v0)
const momentTimezone = require('moment-timezone')
const ms = require('ms')
const { CronTime } = require('cron')
const _ = require('lodash')

const allowedTimeUnits = [
  'm', // minute
  'h', // hour
  'd', // day
  'n', // night
  'w', // week
  'M' // month
]

// (key: value): stelace unit => moment unit
const mapMomentTimeUnits = {
  n: 'd'
}

/**
* Check if the provided date is an instance of Date and a valid date
* @param  {Date}  date
* @return {Boolean}
*/
function isDate (date) {
  return date && typeof date === 'object' && date.getTime && !isNaN(date.getTime())
}

/**
* Check if the provided value is UTC-format date string
* @param  {String}  value
* @param  {Object}  [options]
* @param  {Boolean} [options.onlyDate = false]
* @return {Boolean}
*/
function isDateString (value, { onlyDate = false } = {}) {
  if (typeof value !== 'string') return false

  let regex

  if (onlyDate) {
    regex = /^\d{4}-\d{2}-\d{2}$/
  } else {
    regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
  }

  if (!regex.test(value)) return false

  const date = new Date(value)
  return isDate(date)
}

function isIntersection (array, value) {
  return array.reduce((memo, element) => {
    if (value.endDate <= element.startDate || element.endDate <= value.startDate) {
      return memo
    } else {
      return memo || true
    }
  }, false)
}

/**
 * Utility function that converts multiple formats to milliseconds
 * - object duration (like Moment.js): { d: 10, h: 5 }
 * - string duration (like zeit/ms): "10m"
 * @param {Object|String} duration
 * @return {Number} milliseconds
 */
function convertToMs (duration) {
  if (typeof duration === 'undefined' || duration === null) {
    return duration
  }

  if (typeof duration === 'string') {
    if (!duration) {
      return
    }

    const milliseconds = ms(duration)
    if (typeof milliseconds === 'undefined') {
      throw new Error('Invalid string duration')
    }

    return milliseconds
  } else if (typeof duration === 'object') {
    if (!Object.keys(duration).length) {
      throw new Error('No unit detected')
    }

    return moment.duration(duration).asMilliseconds()
  } else {
    throw new Error('Object or string duration expected')
  }
}

/**
 * Get the new date based on a date and a duration (string or object format)
 * @param {Date|String} isoDate
 * @param {Object|String} duration
 */
function computeDate (isoDate, duration) {
  if (duration && typeof duration === 'object') {
    // use moment here to handle long durations (like 1 year, should be the same day number with year Y+1)
    const momentDuration = Object.keys(duration).reduce((memo, timeUnit) => {
      memo[getMomentTimeUnit(timeUnit)] = duration[timeUnit]
      return memo
    }, {})

    return moment.utc(isoDate).add(momentDuration).toISOString()
  } else {
    return new Date(new Date(isoDate).getTime() + convertToMs(duration)).toISOString()
  }
}

/**
 * Round the date, by default to the inferior date UTC with 0h0m0s
 * @param {String|Object} date
 * @param {Number} [options.nbMinutes] - if provided, round to the nearest multiple of minutes
 */
function getRoundedDate (date, { nbMinutes } = {}) {
  const d = isDate(date) ? date : new Date(date)

  const roundToDate = _.isUndefined(nbMinutes)

  if (roundToDate) {
    const m = moment.utc(date)
    return m.format('YYYY-MM-DD') + 'T00:00:00.000Z'
  } else {
    const ms = nbMinutes * 60 * 1000
    const roundedDate = new Date(Math.round(d.getTime() / ms) * ms)
    return roundedDate.toISOString()
  }
}

function isValidTimezone (timezone) {
  if (typeof timezone !== 'string') return false

  return !!momentTimezone.tz.zone(timezone)
}

function isValidCronPattern (pattern, { allowSeconds = false } = {}) {
  try {
    if (typeof pattern !== 'string') return false

    const nbParts = pattern.split(' ').length
    if (nbParts < 5 || nbParts > 6) return false
    if (!allowSeconds && nbParts !== 5) return false

    new CronTime(pattern) // eslint-disable-line no-new
    return true
  } catch (e) {
    return false
  }
}

/**
 * @param {String} pattern
 * @param {Object} attrs
 * @param {String} attrs.startDate - inclusive
 * @param {String} attrs.endDate - exclusive
 * @param {String} [attrs.timezone='UTC'] - https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
 *                  if `null`, `timezone` will also be set to the default value ('UTC')
 * @returns {String[]} ISO Dates
 */
function computeRecurringDates (pattern, { startDate, endDate, timezone = 'UTC' } = {}) {
  if (_.isNil(timezone)) timezone = 'UTC'

  if (!isDateString(startDate) || !isDateString(endDate)) {
    throw new Error('Expected start and end dates')
  }
  if (endDate < startDate) {
    throw new Error('Invalid dates')
  }

  const cronTime = new CronTime(pattern, timezone)

  let continueLoop = true
  const dates = []
  let cronISODate = new Date(new Date(startDate).getTime() - 1) // start from `startDate` minus 1 millisecond

  while (continueLoop) {
    // `_getNextDateFrom` is a private method from `CronTime.prototype`
    // Please check its availability when upgrading the library `cron`
    const cronMomentDate = cronTime._getNextDateFrom(cronISODate, timezone)

    cronISODate = cronMomentDate.toISOString()
    continueLoop = cronISODate < endDate

    if (continueLoop) {
      dates.push(cronISODate)
    }
  }

  return dates
}

/**
* @param {String} pattern
* @param {Object} options
* @param {String} options.startDate
* @param {String} options.endDate
* @param {String|Object} options.duration
* @param {String} [options.timezone='UTC'] - https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
* @return {Object[]} dates
* @return {String}   dates[i].startDate
* @return {String}   dates[i].endDate
*/
function computeRecurringPeriods (pattern, { startDate, endDate, timezone = 'UTC', duration }) {
  const startDates = computeRecurringDates(pattern, { startDate, endDate, timezone })

  return startDates.map(startDate => {
    return {
      startDate,
      endDate: computeDate(startDate, duration)
    }
  })
}

function getMomentTimeUnit (timeUnit) {
  return mapMomentTimeUnits[timeUnit] || timeUnit
}

/**
 * @param {String} endDate
 * @param {String} startDate
 * @param {String} timeUnit
 * @return {Number}
 */
function diffDates (endDate, startDate, timeUnit) {
  return moment.duration(
    moment.utc(endDate).diff(moment.utc(startDate))
  ).as(getMomentTimeUnit(timeUnit))
}

/**
 * @param {Object} duration
 * @param {String} timeUnit
 * @return {Number}
 */
function getDurationAs (duration, timeUnit) {
  return moment.duration(duration).as(getMomentTimeUnit(timeUnit))
}

module.exports = {
  allowedTimeUnits,

  isDate,
  isDateString,
  isIntersection,
  convertToMs,
  computeDate,
  getRoundedDate,
  isValidTimezone,
  isValidCronPattern,
  computeRecurringDates,
  computeRecurringPeriods,

  diffDates,
  getDurationAs
}
