require('dotenv').config()

const test = require('ava')
const _ = require('lodash')

const {
  isIntersection,
  computeDate,
  getRoundedDate,
  isValidCronPattern,
  isValidTimezone,
  computeRecurringDates,
  computeRecurringPeriods
} = require('../../../src/util/time')

test('detects period intersections', (t) => {
  const dates1 = [
    { startDate: '2018-01-01T00:00:00.000Z', endDate: '2018-01-05T00:00:00.000Z' },
    { startDate: '2018-01-05T00:00:00.000Z', endDate: '2018-01-08T00:00:00.000Z' }
  ]
  const newDates1 = { startDate: '2018-01-15T00:00:00.000Z', endDate: '2018-01-19T00:00:00.000Z' }

  t.false(isIntersection(dates1, newDates1))

  const dates2 = [
    { startDate: '2018-01-01T00:00:00.000Z', endDate: '2018-01-05T00:00:00.000Z' },
    { startDate: '2018-01-05T00:00:00.000Z', endDate: '2018-01-08T00:00:00.000Z' }
  ]
  const newDates2 = { startDate: '2018-01-07T00:00:00.000Z', endDate: '2018-01-19T00:00:00.000Z' }

  t.true(isIntersection(dates2, newDates2))
})

test('computes a date based on a string duration', (t) => {
  t.is(computeDate('2018-01-01T00:00:00.000Z', '2d'), '2018-01-03T00:00:00.000Z')
  t.is(computeDate('2018-01-01T00:00:00.000Z', '15m'), '2018-01-01T00:15:00.000Z')
})

test('computes a date based on an object duration', (t) => {
  t.is(computeDate('2018-01-01T00:00:00.000Z', { d: 2 }), '2018-01-03T00:00:00.000Z')
  t.is(computeDate('2018-01-01T00:00:00.000Z', { m: 15 }), '2018-01-01T00:15:00.000Z')
})

test('get rounded date', (t) => {
  // round to nearest minute
  t.is(getRoundedDate('2018-01-01T00:00:00.000Z'), '2018-01-01T00:00:00.000Z')
  t.is(getRoundedDate('2018-01-01T00:00:00.001Z'), '2018-01-01T00:00:00.000Z')
  t.is(getRoundedDate('2018-01-01T00:00:50.000Z'), '2018-01-01T00:01:00.000Z')

  // round to 5 minutes
  t.is(getRoundedDate('2018-01-01T00:00:50.000Z', 5), '2018-01-01T00:00:00.000Z')
  t.is(getRoundedDate('2018-01-01T00:03:10.000Z', 5), '2018-01-01T00:05:00.000Z')
})

test('validates the timezone', (t) => {
  t.true(isValidTimezone('Europe/London'))
  t.true(isValidTimezone('America/New_York'))
  t.false(isValidTimezone('Unknown/Timezone'))
})

test('detects valid and invalid cron patterns', (t) => {
  const validPatterns = [
    '* * * * *',
    '0 * * * *',
    '8 8 8 8 5',
    '0-10 1-10 1-10 0-6 0-1'
  ]
  const validPatternsWithSeconds = validPatterns.map(p => `* ${p}`)
  const invalidPatterns = [
    '* * *',
    '* * * * * * *',
    '* * * * 1234',
    '* * * * 0*',
    '* * * 1/0 *',
    '* 2-1 * * *',
    '* /4 * * *'
  ]
  const invalidPatternsWithSeconds = invalidPatterns.map(p => `* ${p}`)

  validPatterns.forEach(pattern => t.true(isValidCronPattern(pattern)))
  invalidPatterns.forEach(pattern => t.false(isValidCronPattern(pattern)))
  validPatternsWithSeconds.forEach(pattern => t.false(isValidCronPattern(pattern)))
  invalidPatternsWithSeconds.forEach(pattern => t.false(isValidCronPattern(pattern), pattern))

  validPatternsWithSeconds.forEach(pattern => t.true(isValidCronPattern(pattern, { allowSeconds: true })))
  validPatterns.forEach(pattern => t.true(isValidCronPattern(pattern, { allowSeconds: true })))
  invalidPatterns.forEach(pattern => t.false(isValidCronPattern(pattern, { allowSeconds: true })))
  invalidPatternsWithSeconds.forEach(pattern => t.false(isValidCronPattern(pattern, { allowSeconds: true })))
})

const padDayOrMonth = n => _.padStart(n + 1, 2, '0')
const padTime = t => _.padStart(t, 2, '0')

/**
 * @param {Function} expectedDatesFn - Accepts an object with the following arguments:
 *   - `m`: month such as '02'
 *   - `daysOfMonth`: array of all day strings like '28' to test in current month
 *   - `recurringDates`: value returned by computeRecurringDates function to test
 * @param {String} [frequency='day'] - allowed value: 'day', 'hour', 'minute'
 * @param {Object} options - for use in computeRecurringDates (timezone key/value expected)
 */
const testOverMonths = (expectedDatesFn, frequency = 'day', options = {}) => {
  const months = _.range(12).map(padDayOrMonth)

  const patterns = {
    day: '0 0 * * *',
    hour: '0 * * * *',
    minute: '* * * * *'
  }

  const pattern = patterns[frequency]

  // Test (almost) every day of the year to include Daylight Saving Time (DST)
  // switch dates of any timezone used by the matching running tests.
  // This test is mostly relevant on personal computers, generally not having UTC as timezone,
  // unlike most CI servers where test is therefore unlikely to fail since UTC
  // will be used as local timezone by underlying moment.js library anyway.
  for (const m of months) {
    const daysOfMonth = m === '02' ? 28 : 30
    // No DST switch happened on the 31th of any month in 2018.
    const startDate = `2018-${m}-01T00:00:00.000Z`
    const endDate = `2018-${m}-${daysOfMonth}T00:00:00.001Z`

    const recurringDates = computeRecurringDates(pattern, {
      startDate,
      endDate,
      ...options
      // timezone: 'UTC' // should be the default
    })

    expectedDatesFn({ m, daysOfMonth, recurringDates, startDate, endDate })
  }
}

test('computes recurring dates with UTC by default, ignoring any local DST shift', (t) => {
  const getExpectedDates = ({ m, daysOfMonth, endDate, frequency = 'day' }) => {
    if (frequency === 'day') {
      return _.range(daysOfMonth).map(padDayOrMonth)
        .map(d => `2018-${m}-${d}T00:00:00.000Z`)
    } else if (frequency === 'hour') {
      const dates = _.range(daysOfMonth).map(padDayOrMonth)
        .map(d => `2018-${m}-${d}`)

      return dates.reduce((expected, d) => {
        const time = _.range(0, 24).map(padTime)
          .map(h => `${h}:00:00.000Z`)

        const fullDates = time.map(t => `${d}T${t}`)
        return expected.concat(fullDates).filter(d => d < endDate)
      }, [])
    }
  }

  testOverMonths(({ m, daysOfMonth, recurringDates }) => {
    const expectedDates = getExpectedDates({ m, daysOfMonth })
    t.deepEqual(recurringDates, expectedDates)
  })

  testOverMonths(({ m, daysOfMonth, recurringDates }) => {
    const expectedDates = getExpectedDates({ m, daysOfMonth })
    t.deepEqual(recurringDates, expectedDates)
  }, 'day', { timezone: null })

  testOverMonths(({ m, daysOfMonth, recurringDates, endDate }) => {
    const expectedDates = getExpectedDates({ m, daysOfMonth, frequency: 'hour', endDate })
    t.deepEqual(recurringDates, expectedDates)
  }, 'hour')

  testOverMonths(({ m, daysOfMonth, recurringDates, endDate }) => {
    const expectedDates = getExpectedDates({ m, daysOfMonth, frequency: 'hour', endDate })
    t.deepEqual(recurringDates, expectedDates)
  }, 'hour')
})

test('computes recurring dates with custom timezone', (t) => {
  const timezone = 'Europe/Paris'
  const recurringDates = computeRecurringDates('0 0 * * *', {
    startDate: '2018-01-01T00:00:00.000Z',
    endDate: '2018-01-05T00:00:00.000Z',
    timezone
  })

  t.deepEqual(recurringDates, [
    '2018-01-01T23:00:00.000Z',
    '2018-01-02T23:00:00.000Z',
    '2018-01-03T23:00:00.000Z',
    '2018-01-04T23:00:00.000Z'
  ])

  const extractHour = date => date.match(/T(\d{2})/)[1]
  const monthHours = dates => dates.reduce((h, d) => h.add(extractHour(d)), new Set())

  testOverMonths(({ m, recurringDates }) => {
    const month = parseInt(m, 10)
    const hours = monthHours(recurringDates) // Set
    if (month < 3 || month > 10) { // no DST
      t.is(hours.size, 1)
      t.true(hours.has('23'))
    } else if (month === 3 || month === 10) { // DST switch during the month
      t.is(hours.size, 2)
      t.true(hours.has('22'))
      t.true(hours.has('23'))
    } else { // DST
      t.is(hours.size, 1)
      t.true(hours.has('22'))
    }
  }, 'day', { timezone })
})

test('computes recurring dates with fancy pattern', (t) => {
  const recurringDates = computeRecurringDates('0-5 4,6 * * 1,5', {
    startDate: '2018-01-01T00:00:00.000Z',
    endDate: '2018-01-08T00:00:00.000Z'
  })

  t.deepEqual(recurringDates, [
    '2018-01-01T04:00:00.000Z',
    '2018-01-01T04:01:00.000Z',
    '2018-01-01T04:02:00.000Z',
    '2018-01-01T04:03:00.000Z',
    '2018-01-01T04:04:00.000Z',
    '2018-01-01T04:05:00.000Z',
    '2018-01-01T06:00:00.000Z',
    '2018-01-01T06:01:00.000Z',
    '2018-01-01T06:02:00.000Z',
    '2018-01-01T06:03:00.000Z',
    '2018-01-01T06:04:00.000Z',
    '2018-01-01T06:05:00.000Z',

    '2018-01-05T04:00:00.000Z',
    '2018-01-05T04:01:00.000Z',
    '2018-01-05T04:02:00.000Z',
    '2018-01-05T04:03:00.000Z',
    '2018-01-05T04:04:00.000Z',
    '2018-01-05T04:05:00.000Z',
    '2018-01-05T06:00:00.000Z',
    '2018-01-05T06:01:00.000Z',
    '2018-01-05T06:02:00.000Z',
    '2018-01-05T06:03:00.000Z',
    '2018-01-05T06:04:00.000Z',
    '2018-01-05T06:05:00.000Z'
  ])
})

test('computes recurring periods', (t) => {
  const recurringPeriods = computeRecurringPeriods('0 0 * * 2-4', {
    startDate: '2018-01-01T00:00:00.000Z',
    endDate: '2018-01-08T00:00:00.000Z',
    duration: '1d'
  })

  t.deepEqual(recurringPeriods, [
    { startDate: '2018-01-02T00:00:00.000Z', endDate: '2018-01-03T00:00:00.000Z' },
    { startDate: '2018-01-03T00:00:00.000Z', endDate: '2018-01-04T00:00:00.000Z' },
    { startDate: '2018-01-04T00:00:00.000Z', endDate: '2018-01-05T00:00:00.000Z' }
  ])
})
