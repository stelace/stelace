require('dotenv').config()

const test = require('ava')

const _ = require('lodash')

const {
  getNewStatus,
  getFutureStatuses,
  isValidDates,

  getTransactionPricing
} = require('../../../src/util/transaction')

test('get the new status', (t) => {
  t.is(getNewStatus({ status: 'draft' }, 'pay'), 'pending-acceptance')
  t.is(getNewStatus({ status: 'pending-acceptance' }, 'accept'), 'validated')
  t.is(getNewStatus({ status: 'validated' }, 'complete'), 'completed')
})

test('get the future statuses', (t) => {
  const hasSameItems = (a, b) => a.length === b.length && _.intersection(a, b).length === a.length

  t.true(hasSameItems(getFutureStatuses('validated'), ['completed', 'cancelled']))
  t.true(hasSameItems(getFutureStatuses('confirmed'), ['pending-payment', 'pending-acceptance', 'validated', 'completed', 'cancelled']))
})

test('check if dates are valid', (t) => {
  let isValidDatesResult

  isValidDatesResult = isValidDates({
    startDate: '2018-01-01T00:00:00.000Z',
    duration: { d: 1 },
    refDate: '2018-01-01T00:00:00.000Z',
    config: {}
  })
  t.true(isValidDatesResult.result)
  t.true(Array.isArray(isValidDatesResult.errors))
  t.is(isValidDatesResult.errors.length, 0)

  isValidDatesResult = isValidDates({
    startDate: '2018-01-01T00:00:00.000Z',
    duration: { d: 0 }, // must be strictly positive
    refDate: '2018-01-01T00:00:00.000Z',
    config: {}
  })
  t.false(isValidDatesResult.result)
  t.true(Array.isArray(isValidDatesResult.errors))
  t.is(isValidDatesResult.errors.length, 1)

  isValidDatesResult = isValidDates({
    startDate: '2018-01-01T00:00:00.000ZZ', // invalid format
    duration: { d: 1 },
    refDate: '2018-01-01T00:00:00.000Z',
    config: {}
  })
  t.false(isValidDatesResult.result)

  isValidDatesResult = isValidDates({
    startDate: '2018-01-01T00:00:00.000Z',
    duration: { d: 1 },
    refDate: '2018-01-01T00:00:00.000ZZ', // invalid format
    config: {}
  })
  t.false(isValidDatesResult.result)
})

test('check if dates are valid with start date min delta active', (t) => {
  let isValidDatesResult

  isValidDatesResult = isValidDates({
    startDate: '2018-01-02T00:00:00.000Z',
    duration: { d: 1 },
    refDate: '2018-01-01T00:00:00.000Z',
    config: {
      startDateMinDelta: { d: 1 }
    },
    checkDateDeltas: true
  })
  t.true(isValidDatesResult.result)

  isValidDatesResult = isValidDates({
    startDate: '2018-01-01T23:59:59.999Z',
    duration: { d: 1 },
    refDate: '2018-01-01T00:00:00.000Z',
    config: {
      startDateMinDelta: { d: 1 }
    },
    checkDateDeltas: true
  })
  t.false(isValidDatesResult.result)
})

test('check if dates are valid with start date min delta active and there is a previous transaction whose end date is after ref date', (t) => {
  let isValidDatesResult

  isValidDatesResult = isValidDates({
    startDate: '2018-01-06T00:00:00.000Z',
    duration: { d: 1 },
    refDate: '2018-01-01T00:00:00.000Z',
    previousTransactionRefDate: '2018-01-05T00:00:00.000Z', // previous transaction end date is after ref date
    config: {
      startDateMinDelta: { d: 1 }
    },
    checkDateDeltas: true
  })
  t.true(isValidDatesResult.result)

  isValidDatesResult = isValidDates({
    startDate: '2018-01-05T23:59:59.999Z',
    duration: { d: 1 },
    refDate: '2018-01-01T00:00:00.000Z',
    previousTransactionRefDate: '2018-01-05T00:00:00.000Z', // previous transaction end date is after ref date
    config: {
      startDateMinDelta: { d: 1 }
    },
    checkDateDeltas: true
  })
  t.false(isValidDatesResult.result)
})

test('check if dates are valid with start date min delta active and there is a previous transaction whose end date is prior to the ref date', (t) => {
  let isValidDatesResult

  isValidDatesResult = isValidDates({
    startDate: '2018-01-02T00:00:00.000Z',
    duration: { d: 1 },
    refDate: '2018-01-01T00:00:00.000Z',
    previousTransactionRefDate: '2017-01-01T00:00:00.000Z', // previous transaction end date is prior to the ref date
    config: {
      startDateMinDelta: { d: 1 }
    },
    checkDateDeltas: true
  })
  t.true(isValidDatesResult.result)

  isValidDatesResult = isValidDates({
    startDate: '2018-01-01T23:59:59.999Z',
    duration: { d: 1 },
    refDate: '2018-01-01T00:00:00.000Z',
    previousTransactionRefDate: '2017-01-01T00:00:00.000Z', // previous transaction end date is prior to the ref date
    config: {
      startDateMinDelta: { d: 1 }
    },
    checkDateDeltas: true
  })
  t.false(isValidDatesResult.result)
})

test('check if dates are valid with start date max delta active', (t) => {
  let isValidDatesResult

  isValidDatesResult = isValidDates({
    startDate: '2018-01-02T00:00:00.000Z',
    duration: { d: 1 },
    refDate: '2018-01-01T00:00:00.000Z',
    config: {
      startDateMaxDelta: { d: 1 }
    },
    checkDateDeltas: true
  })
  t.true(isValidDatesResult.result)

  isValidDatesResult = isValidDates({
    startDate: '2018-01-02T00:00:00.001Z',
    duration: { d: 1 },
    refDate: '2018-01-01T00:00:00.000Z',
    config: {
      startDateMaxDelta: { d: 1 }
    },
    checkDateDeltas: true
  })
  t.false(isValidDatesResult.result)
})

test('check if dates are valid with start date min delta active and there is a last transaction whose end date is after ref date', (t) => {
  let isValidDatesResult

  isValidDatesResult = isValidDates({
    startDate: '2018-01-06T00:00:00.000Z',
    duration: { d: 1 },
    refDate: '2018-01-01T00:00:00.000Z',
    lastTransactionRefDate: '2018-01-05T00:00:00.000Z', // last transaction end date is after ref date
    config: {
      startDateMaxDelta: { d: 1 }
    },
    checkDateDeltas: true
  })
  t.true(isValidDatesResult.result)

  isValidDatesResult = isValidDates({
    startDate: '2018-01-06T00:00:00.001Z',
    duration: { d: 1 },
    refDate: '2018-01-01T00:00:00.000Z',
    lastTransactionRefDate: '2018-01-05T00:00:00.000Z', // last transaction end date is after ref date
    config: {
      startDateMaxDelta: { d: 1 }
    },
    checkDateDeltas: true
  })
  t.false(isValidDatesResult.result)
})

test('check if dates are valid with start date min delta active and there is a last transaction whose end date is prior to the ref date', (t) => {
  let isValidDatesResult

  isValidDatesResult = isValidDates({
    startDate: '2018-01-02T00:00:00.000Z',
    duration: { d: 1 },
    refDate: '2018-01-01T00:00:00.000Z',
    lastTransactionRefDate: '2017-01-01T00:00:00.000Z', // last transaction end date is prior to the ref date
    config: {
      startDateMaxDelta: { d: 1 }
    },
    checkDateDeltas: true
  })
  t.true(isValidDatesResult.result)

  isValidDatesResult = isValidDates({
    startDate: '2018-01-02T00:00:00.001Z',
    duration: { d: 1 },
    refDate: '2018-01-01T00:00:00.000Z',
    lastTransactionRefDate: '2017-01-01T00:00:00.000Z', // last transaction end date is prior to the ref date
    config: {
      startDateMaxDelta: { d: 1 }
    },
    checkDateDeltas: true
  })
  t.false(isValidDatesResult.result)
})

test('check if dates are valid with duration contraints', (t) => {
  let isValidDatesResult

  isValidDatesResult = isValidDates({
    startDate: '2018-01-01T00:00:00.000Z',
    duration: { d: 2 }, // must be >= 2
    refDate: '2018-01-01T00:00:00.000Z',
    config: {
      minDuration: { d: 2 }
    }
  })
  t.true(isValidDatesResult.result)

  isValidDatesResult = isValidDates({
    startDate: '2018-01-01T00:00:00.000Z',
    duration: { d: 1 }, // must be >= 2
    refDate: '2018-01-01T00:00:00.000Z',
    config: {
      minDuration: { d: 2 }
    }
  })
  t.false(isValidDatesResult.result)

  isValidDatesResult = isValidDates({
    startDate: '2018-01-01T00:00:00.000Z',
    duration: { d: 3 }, // must be <= 3
    refDate: '2018-01-01T00:00:00.000Z',
    config: {
      maxDuration: { d: 3 }
    }
  })
  t.true(isValidDatesResult.result)

  isValidDatesResult = isValidDates({
    startDate: '2018-01-01T00:00:00.000Z',
    duration: { d: 5 }, // must be <= 3
    refDate: '2018-01-01T00:00:00.000Z',
    config: {
      maxDuration: { d: 3 }
    }
  })
  t.false(isValidDatesResult.result)

  isValidDatesResult = isValidDates({
    startDate: '2018-01-01T00:00:00.000Z',
    duration: { d: 2 }, // must be between 2 and 4
    refDate: '2018-01-01T00:00:00.000Z',
    config: {
      minDuration: { d: 2 },
      maxDuration: { d: 4 }
    }
  })
  t.true(isValidDatesResult.result)

  isValidDatesResult = isValidDates({
    startDate: '2018-01-01T00:00:00.000Z',
    duration: { d: 4 }, // must be between 2 and 4
    refDate: '2018-01-01T00:00:00.000Z',
    config: {
      minDuration: { d: 2 },
      maxDuration: { d: 4 }
    }
  })
  t.true(isValidDatesResult.result)

  isValidDatesResult = isValidDates({
    startDate: '2018-01-01T00:00:00.000Z',
    duration: { d: 1 }, // must be between 2 and 4
    refDate: '2018-01-01T00:00:00.000Z',
    config: {
      minDuration: { d: 2 },
      maxDuration: { d: 4 }
    }
  })
  t.false(isValidDatesResult.result)

  isValidDatesResult = isValidDates({
    startDate: '2018-01-01T00:00:00.000Z',
    duration: { d: 5 }, // must be between 2 and 4
    refDate: '2018-01-01T00:00:00.000Z',
    config: {
      minDuration: { d: 2 },
      maxDuration: { d: 4 }
    }
  })
  t.false(isValidDatesResult.result)

  isValidDatesResult = isValidDates({
    startDate: '2018-01-01T00:00:00.000Z',
    duration: { d: 1 },
    refDate: '2018-01-01T00:00:00.000Z',
    config: {
      minDuration: { h: 20 }, // with different time units
      maxDuration: { w: 1 }
    }
  })
  t.true(isValidDatesResult.result)
})

test('get pricing for transaction without prices override', (t) => {
  const transaction1 = {
    quantity: 1,
    unitPrice: 100,
    currency: 'USD',
    assetType: {
      pricing: {
        ownerFeesPercent: 5,
        takerFeesPercent: 10
      }
    }
  }

  t.deepEqual(getTransactionPricing(transaction1), {
    value: 100,
    ownerAmount: 95,
    takerAmount: 111.1,
    ownerFees: 5,
    takerFees: 11.1,
    platformAmount: 16.1
  })

  const transaction2 = {
    quantity: 4,
    startDate: '2019-01-01T00:00:00.000Z',
    duration: { h: 12 },
    timeUnit: 'd',
    unitPrice: 200,
    currency: 'USD',
    assetType: {
      pricing: {
        ownerFeesPercent: 5,
        takerFeesPercent: 10
      }
    }
  }

  t.deepEqual(getTransactionPricing(transaction2), {
    value: 400,
    ownerAmount: 380,
    takerAmount: 444.4,
    ownerFees: 20,
    takerFees: 44.4,
    platformAmount: 64.4
  })

  const transaction3 = {
    quantity: 4,
    startDate: '2019-01-01T00:00:00.000Z',
    duration: { h: 12 },
    timeUnit: 'd',
    unitPrice: 0,
    currency: 'USD',
    assetType: {
      pricing: {
        ownerFeesPercent: 5,
        takerFeesPercent: 10
      }
    }
  }

  t.deepEqual(getTransactionPricing(transaction3), {
    value: 0,
    ownerAmount: 0,
    takerAmount: 0,
    ownerFees: 0,
    takerFees: 0,
    platformAmount: 0
  })
})

test('get pricing for transaction with prices override', (t) => {
  const transaction1 = {
    quantity: 1,
    unitPrice: 100,
    currency: 'USD',
    assetType: {
      pricing: {
        ownerFeesPercent: 5,
        takerFeesPercent: 10
      }
    }
  }

  t.deepEqual(getTransactionPricing(transaction1, { value: 200 }), {
    value: 200,
    ownerAmount: 190,
    takerAmount: 222.2,
    ownerFees: 10,
    takerFees: 22.2,
    platformAmount: 32.2
  })

  t.deepEqual(getTransactionPricing(transaction1, { value: 200, takerAmount: 210 }), {
    value: 200,
    ownerAmount: 190,
    takerAmount: 210,
    ownerFees: 10,
    takerFees: 10,
    platformAmount: 20
  })

  const transaction2 = {
    quantity: 4,
    startDate: '2019-01-01T00:00:00.000Z',
    duration: { h: 12 },
    timeUnit: 'd',
    unitPrice: 200,
    currency: 'USD',
    assetType: {
      pricing: {
        ownerFeesPercent: 5,
        takerFeesPercent: 10
      }
    }
  }

  t.deepEqual(getTransactionPricing(transaction2, { value: 0 }), {
    value: 0,
    ownerAmount: 0,
    takerAmount: 0,
    ownerFees: 0,
    takerFees: 0,
    platformAmount: 0
  })
})
