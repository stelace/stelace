require('dotenv').config()

const test = require('ava')

const {
  isIntersection,
  computeDate,
  getRoundedDate,
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

test('computes recurring dates with default timezone', (t) => {
  const recurringDates = computeRecurringDates('0 0 * * *', {
    startDate: '2018-01-01T00:00:00.000Z',
    endDate: '2018-01-05T00:00:00.000Z'
  })

  t.deepEqual(recurringDates, [
    '2018-01-01T00:00:00.000Z',
    '2018-01-02T00:00:00.000Z',
    '2018-01-03T00:00:00.000Z',
    '2018-01-04T00:00:00.000Z'
  ])
})

test('computes recurring dates with custom timezone', (t) => {
  const recurringDates = computeRecurringDates('0 0 * * *', {
    startDate: '2018-01-01T00:00:00.000Z',
    endDate: '2018-01-05T00:00:00.000Z',
    timezone: 'Europe/Paris'
  })

  t.deepEqual(recurringDates, [
    '2018-01-01T23:00:00.000Z',
    '2018-01-02T23:00:00.000Z',
    '2018-01-03T23:00:00.000Z',
    '2018-01-04T23:00:00.000Z'
  ])
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
