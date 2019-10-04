require('dotenv').config()

const test = require('ava')

const {
  getAvailabilityPeriodGraph,
  getAvailabilityPeriodInfo,

  getInternalAvailabilityPeriods,
  getAvailabilityPeriods
} = require('../../../src/util/availability')

test('returns no dates if there is no transactions or availabilities', (t) => {
  const transactions = []
  const availabilities = []
  const defaultQuantity = 1
  const availabilityGraph = getAvailabilityPeriodGraph({ transactions, availabilities, defaultQuantity })

  t.is(availabilityGraph.graphDates.length, 0)
  t.is(availabilityGraph.defaultQuantity, defaultQuantity)
})

test('affects used quantity if there are transactions', (t) => {
  const transactions = [
    {
      startDate: '2018-01-01T00:00:00.000Z',
      endDate: '2018-01-10T00:00:00.000Z',
      quantity: 1
    },
    {
      startDate: '2018-01-05T00:00:00.000Z',
      endDate: '2018-01-15T00:00:00.000Z',
      quantity: 2
    },
    {
      startDate: '2018-02-01T00:00:00.000Z',
      endDate: '2018-02-10T00:00:00.000Z',
      quantity: 1
    },
    {
      startDate: '2018-02-01T00:00:00.000Z',
      endDate: null,
      quantity: 2
    }
  ]
  const availabilities = []
  const defaultQuantity = 5
  const graphDates = [
    { date: '2018-01-01T00:00:00.000Z', usedQuantity: 1, availableQuantity: 5 },
    { date: '2018-01-05T00:00:00.000Z', usedQuantity: 3, availableQuantity: 5 },
    { date: '2018-01-10T00:00:00.000Z', usedQuantity: 2, availableQuantity: 5 },
    { date: '2018-01-15T00:00:00.000Z', usedQuantity: 0, availableQuantity: 5 },
    { date: '2018-02-01T00:00:00.000Z', usedQuantity: 3, availableQuantity: 5 },
    { date: '2018-02-10T00:00:00.000Z', usedQuantity: 2, availableQuantity: 5 }
  ]
  const availabilityGraph = getAvailabilityPeriodGraph({ transactions, availabilities, defaultQuantity })

  t.deepEqual(availabilityGraph.graphDates, graphDates)
  t.is(availabilityGraph.defaultQuantity, defaultQuantity)
})

test('affects available quantity if there are availabilities', (t) => {
  const transactions = []
  const availabilities = [
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-01-03T00:00:00.000Z',
      endDate: '2018-01-11T00:00:00.000Z',
      quantity: '-1'
    },
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-01-07T00:00:00.000Z',
      endDate: '2018-01-18T00:00:00.000Z',
      quantity: '-1'
    },
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-01-16T00:00:00.000Z',
      endDate: '2018-01-22T00:00:00.000Z',
      quantity: '0'
    },
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-02-01T00:00:00.000Z',
      endDate: '2018-02-05T00:00:00.000Z',
      quantity: '-1'
    }
  ]
  const defaultQuantity = 5
  const graphDates = [
    { date: '2018-01-03T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-01-07T00:00:00.000Z', usedQuantity: 0, availableQuantity: 3 },
    { date: '2018-01-11T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-01-16T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-18T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-22T00:00:00.000Z', usedQuantity: 0, availableQuantity: 5 },
    { date: '2018-02-01T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-02-05T00:00:00.000Z', usedQuantity: 0, availableQuantity: 5 }
  ]
  const availabilityGraph = getAvailabilityPeriodGraph({ transactions, availabilities, defaultQuantity })

  t.deepEqual(availabilityGraph.graphDates, graphDates)
  t.is(availabilityGraph.defaultQuantity, defaultQuantity)
})

test('affects max quantity with availabilities', (t) => {
  const transactions = [
    {
      startDate: '2018-01-01T00:00:00.000Z',
      endDate: '2018-01-10T00:00:00.000Z',
      quantity: 1
    },
    {
      startDate: '2018-01-05T00:00:00.000Z',
      endDate: '2018-01-15T00:00:00.000Z',
      quantity: 2
    },
    {
      startDate: '2018-02-01T00:00:00.000Z',
      endDate: '2018-02-10T00:00:00.000Z',
      quantity: 1
    },
    {
      startDate: '2018-02-01T00:00:00.000Z',
      endDate: null,
      quantity: 2
    }
  ]
  const availabilities = [
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-01-03T00:00:00.000Z',
      endDate: '2018-01-11T00:00:00.000Z',
      quantity: '-1'
    },
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-01-07T00:00:00.000Z',
      endDate: '2018-01-18T00:00:00.000Z',
      quantity: '-1'
    },
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-01-16T00:00:00.000Z',
      endDate: '2018-01-22T00:00:00.000Z',
      quantity: '0'
    },
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-02-01T00:00:00.000Z',
      endDate: '2018-02-05T00:00:00.000Z',
      quantity: '-1'
    }
  ]
  const defaultQuantity = 5
  const graphDates = [
    { date: '2018-01-01T00:00:00.000Z', usedQuantity: 1, availableQuantity: 5 },
    { date: '2018-01-03T00:00:00.000Z', usedQuantity: 1, availableQuantity: 4 },
    { date: '2018-01-05T00:00:00.000Z', usedQuantity: 3, availableQuantity: 4 },
    { date: '2018-01-07T00:00:00.000Z', usedQuantity: 3, availableQuantity: 3 },
    { date: '2018-01-10T00:00:00.000Z', usedQuantity: 2, availableQuantity: 3 },
    { date: '2018-01-11T00:00:00.000Z', usedQuantity: 2, availableQuantity: 4 },
    { date: '2018-01-15T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-01-16T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-18T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-22T00:00:00.000Z', usedQuantity: 0, availableQuantity: 5 },
    { date: '2018-02-01T00:00:00.000Z', usedQuantity: 3, availableQuantity: 4 },
    { date: '2018-02-05T00:00:00.000Z', usedQuantity: 3, availableQuantity: 5 },
    { date: '2018-02-10T00:00:00.000Z', usedQuantity: 2, availableQuantity: 5 }
  ]
  const availabilityGraph = getAvailabilityPeriodGraph({ transactions, availabilities, defaultQuantity })

  t.deepEqual(availabilityGraph.graphDates, graphDates)
  t.is(availabilityGraph.defaultQuantity, defaultQuantity)
})

test('gets the availability graph with overlapping fixed quantity availabilities', (t) => {
  const transactions = []
  const availabilities = [
    {
      updatedDate: '2018-01-10T00:00:00.000Z',
      startDate: '2018-01-03T00:00:00.000Z',
      endDate: '2018-01-11T00:00:00.000Z',
      quantity: '4'
    },
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-01-07T00:00:00.000Z',
      endDate: '2018-01-18T00:00:00.000Z',
      quantity: '2'
    },
    {
      updatedDate: '2018-01-07T00:00:00.000Z',
      startDate: '2018-01-16T00:00:00.000Z',
      endDate: '2018-01-22T00:00:00.000Z',
      quantity: '0'
    },
    {
      updatedDate: '2018-01-08T00:00:00.000Z',
      startDate: '2018-02-01T00:00:00.000Z',
      endDate: '2018-02-05T00:00:00.000Z',
      quantity: '3'
    }
  ]
  const defaultQuantity = 5
  const graphDates = [
    { date: '2018-01-03T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-01-07T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-01-11T00:00:00.000Z', usedQuantity: 0, availableQuantity: 2 },
    { date: '2018-01-16T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-18T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-22T00:00:00.000Z', usedQuantity: 0, availableQuantity: 5 },
    { date: '2018-02-01T00:00:00.000Z', usedQuantity: 0, availableQuantity: 3 },
    { date: '2018-02-05T00:00:00.000Z', usedQuantity: 0, availableQuantity: 5 }
  ]
  const availabilityGraph = getAvailabilityPeriodGraph({ transactions, availabilities, defaultQuantity })

  t.deepEqual(availabilityGraph.graphDates, graphDates)
  t.is(availabilityGraph.defaultQuantity, defaultQuantity)
})

test('gets the availability graph with mixed fixed and relative quantity availabilities', (t) => {
  const transactions = []
  const availabilities = [
    {
      updatedDate: '2018-01-10T00:00:00.000Z',
      startDate: '2018-01-03T00:00:00.000Z',
      endDate: '2018-01-11T00:00:00.000Z',
      quantity: '4'
    },
    {
      updatedDate: '2018-01-05T00:00:00.000Z',
      startDate: '2018-01-08T00:00:00.000Z',
      endDate: '2018-01-12T00:00:00.000Z',
      quantity: '+2'
    },
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-01-07T00:00:00.000Z',
      endDate: '2018-01-18T00:00:00.000Z',
      quantity: '2'
    },
    {
      updatedDate: '2018-01-07T00:00:00.000Z',
      startDate: '2018-01-16T00:00:00.000Z',
      endDate: '2018-01-22T00:00:00.000Z',
      quantity: '0'
    },
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-01-29T00:00:00.000Z',
      endDate: '2018-02-02T00:00:00.000Z',
      quantity: '-1'
    },
    {
      updatedDate: '2018-01-08T00:00:00.000Z',
      startDate: '2018-02-01T00:00:00.000Z',
      endDate: '2018-02-05T00:00:00.000Z',
      quantity: '3'
    }
  ]
  const defaultQuantity = 5
  const graphDates = [
    { date: '2018-01-03T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-01-07T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-01-08T00:00:00.000Z', usedQuantity: 0, availableQuantity: 6 },
    { date: '2018-01-11T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-01-12T00:00:00.000Z', usedQuantity: 0, availableQuantity: 2 },
    { date: '2018-01-16T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-18T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-22T00:00:00.000Z', usedQuantity: 0, availableQuantity: 5 },
    { date: '2018-01-29T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-02-01T00:00:00.000Z', usedQuantity: 0, availableQuantity: 2 },
    { date: '2018-02-02T00:00:00.000Z', usedQuantity: 0, availableQuantity: 3 },
    { date: '2018-02-05T00:00:00.000Z', usedQuantity: 0, availableQuantity: 5 }
  ]
  const availabilityGraph = getAvailabilityPeriodGraph({ transactions, availabilities, defaultQuantity })

  t.deepEqual(availabilityGraph.graphDates, graphDates)
  t.is(availabilityGraph.defaultQuantity, defaultQuantity)
})

test('affects available quantity with recurring availabilities', (t) => {
  const transactions = []
  const availabilities = [
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-01-01T00:00:00.000Z',
      endDate: '2018-01-12T00:00:00.000Z',
      quantity: '+1',
      recurringPattern: '0 0 * * 2,4-6',
      recurringTimezone: 'Europe/London',
      recurringDuration: { d: 1 }
    }
  ]
  const defaultQuantity = 0
  const graphDates = [
    { date: '2018-01-02T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-03T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-04T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-05T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-06T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-07T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-09T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-10T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-11T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-12T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 }
  ]
  const availabilityGraph = getAvailabilityPeriodGraph({ transactions, availabilities, defaultQuantity })

  t.deepEqual(availabilityGraph.graphDates, graphDates)
  t.is(availabilityGraph.defaultQuantity, defaultQuantity)
})

test('affects available quantity with multiple recurring availabilities', (t) => {
  const transactions = []
  const availabilities = [
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-01-01T00:00:00.000Z',
      endDate: '2018-01-12T00:00:00.000Z',
      quantity: '+1',
      recurringPattern: '0 0 * * 2,4-6',
      recurringTimezone: 'Europe/London',
      recurringDuration: { d: 1 }
    },
    {
      updatedDate: '2018-01-02T00:00:00.000Z',
      startDate: '2018-01-08T00:00:00.000Z',
      endDate: '2018-01-10T00:00:00.000Z',
      quantity: '5',
      recurringPattern: '0 0 * * 1',
      recurringTimezone: 'Europe/London',
      recurringDuration: { d: 1 }
    }
  ]
  const defaultQuantity = 0
  const graphDates = [
    { date: '2018-01-02T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-03T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-04T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-05T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-06T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-07T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-08T00:00:00.000Z', usedQuantity: 0, availableQuantity: 5 },
    { date: '2018-01-09T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-10T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-11T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-12T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 }
  ]
  const availabilityGraph = getAvailabilityPeriodGraph({ transactions, availabilities, defaultQuantity })

  t.deepEqual(availabilityGraph.graphDates, graphDates)
  t.is(availabilityGraph.defaultQuantity, defaultQuantity)
})

test('affects available quantity with mixed recurring and non-recurring availabilities', (t) => {
  const transactions = []
  const availabilities = [
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-01-01T00:00:00.000Z',
      endDate: '2018-01-12T00:00:00.000Z',
      quantity: '+1',
      recurringPattern: '0 0 * * 2,4-6',
      recurringTimezone: 'Europe/London',
      recurringDuration: { d: 1 }
    },
    {
      updatedDate: '2018-01-02T00:00:00.000Z',
      startDate: '2018-01-08T00:00:00.000Z',
      endDate: '2018-01-10T00:00:00.000Z',
      quantity: '5',
      recurringPattern: null,
      recurringTimezone: null,
      recurringDuration: null
    }
  ]
  const defaultQuantity = 0
  const graphDates = [
    { date: '2018-01-02T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-03T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-04T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-05T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-06T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-07T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-08T00:00:00.000Z', usedQuantity: 0, availableQuantity: 5 },
    { date: '2018-01-09T00:00:00.000Z', usedQuantity: 0, availableQuantity: 6 },
    { date: '2018-01-10T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-11T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-12T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 }
  ]
  const availabilityGraph = getAvailabilityPeriodGraph({ transactions, availabilities, defaultQuantity })

  t.deepEqual(availabilityGraph.graphDates, graphDates)
  t.is(availabilityGraph.defaultQuantity, defaultQuantity)
})

test('should not go beyong the max quantity', (t) => {
  const transactions = []
  const availabilities = [
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-01-03T00:00:00.000Z',
      endDate: '2018-01-11T00:00:00.000Z',
      quantity: '-1'
    },
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-01-07T00:00:00.000Z',
      endDate: '2018-01-18T00:00:00.000Z',
      quantity: '-1'
    },
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-01-16T00:00:00.000Z',
      endDate: '2018-01-22T00:00:00.000Z',
      quantity: '0'
    },
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-02-01T00:00:00.000Z',
      endDate: '2018-02-05T00:00:00.000Z',
      quantity: '-1'
    }
  ]
  const defaultQuantity = 5
  const maxQuantity = 1
  const graphDates = [
    { date: '2018-01-03T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-07T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-11T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-01-16T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-18T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-22T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-02-01T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 },
    { date: '2018-02-05T00:00:00.000Z', usedQuantity: 0, availableQuantity: 1 }
  ]
  const availabilityGraph = getAvailabilityPeriodGraph({ transactions, availabilities, defaultQuantity, maxQuantity })

  t.deepEqual(availabilityGraph.graphDates, graphDates)
  t.is(availabilityGraph.defaultQuantity, defaultQuantity)
})

test('is available if no graph and quantity is inferior than default quantity', (t) => {
  const transactions = []
  const availabilities = []
  const defaultQuantity = 5
  const availabilityGraph = getAvailabilityPeriodGraph({ transactions, availabilities, defaultQuantity })

  const newTransaction = {
    startDate: '2018-01-03T00:00:00.000Z',
    endDate: '2018-01-05T00:00:00.000Z',
    quantity: 2
  }

  const info = getAvailabilityPeriodInfo(availabilityGraph, newTransaction)
  t.true(info.isAvailable)
  t.is(info.remainingQuantity, 5)
})

test('is not available if the new transaction quantity exceeds remaining quantity', (t) => {
  const transactions = [
    {
      startDate: '2018-01-01T00:00:00.000Z',
      endDate: '2018-01-10T00:00:00.000Z',
      quantity: 1
    },
    {
      startDate: '2018-01-05T00:00:00.000Z',
      endDate: '2018-01-15T00:00:00.000Z',
      quantity: 2
    },
    {
      startDate: '2018-02-01T00:00:00.000Z',
      endDate: '2018-02-10T00:00:00.000Z',
      quantity: 1
    },
    {
      startDate: '2018-02-01T00:00:00.000Z',
      endDate: null,
      quantity: 2
    }
  ]
  const availabilities = [
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-01-03T00:00:00.000Z',
      endDate: '2018-01-11T00:00:00.000Z',
      quantity: '-1'
    },
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-01-07T00:00:00.000Z',
      endDate: '2018-01-18T00:00:00.000Z',
      quantity: '-1'
    },
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-01-16T00:00:00.000Z',
      endDate: '2018-01-22T00:00:00.000Z',
      quantity: '0'
    },
    {
      updatedDate: '2018-01-01T00:00:00.000Z',
      startDate: '2018-02-01T00:00:00.000Z',
      endDate: '2018-02-05T00:00:00.000Z',
      quantity: '-1'
    }
  ]
  const defaultQuantity = 5
  const availabilityGraph = getAvailabilityPeriodGraph({ transactions, availabilities, defaultQuantity })

  const newTransaction1 = {
    startDate: '2018-01-05T00:00:00.000Z',
    endDate: '2018-01-08T00:00:00.000Z',
    quantity: 7
  }
  const newTransaction2 = {
    startDate: '2018-01-05T00:00:00.000Z',
    endDate: null, // no end date
    quantity: 6
  }

  const info1 = getAvailabilityPeriodInfo(availabilityGraph, newTransaction1)
  t.false(info1.isAvailable)
  t.is(info1.remainingQuantity, 0)

  const info2 = getAvailabilityPeriodInfo(availabilityGraph, newTransaction2)
  t.false(info2.isAvailable)
  t.is(info2.remainingQuantity, 0)
})

test('generate internal availability periods without transactions', (t) => {
  const defaultQuantity = 5
  const graphDates = [
    { date: '2018-01-03T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-01-07T00:00:00.000Z', usedQuantity: 0, availableQuantity: 3 },
    { date: '2018-01-11T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-01-16T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-18T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-22T00:00:00.000Z', usedQuantity: 0, availableQuantity: 5 },
    { date: '2018-02-01T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-02-05T00:00:00.000Z', usedQuantity: 0, availableQuantity: 5 }
  ]

  const expectedAvailablePeriods = [
    { startDate: null, endDate: '2018-01-03T00:00:00.000Z', quantity: 5 },
    { startDate: '2018-01-03T00:00:00.000Z', endDate: '2018-01-07T00:00:00.000Z', quantity: 4 },
    { startDate: '2018-01-07T00:00:00.000Z', endDate: '2018-01-11T00:00:00.000Z', quantity: 3 },
    { startDate: '2018-01-11T00:00:00.000Z', endDate: '2018-01-16T00:00:00.000Z', quantity: 4 },
    { startDate: '2018-01-16T00:00:00.000Z', endDate: '2018-01-18T00:00:00.000Z', quantity: 0 },
    { startDate: '2018-01-18T00:00:00.000Z', endDate: '2018-01-22T00:00:00.000Z', quantity: 0 },
    { startDate: '2018-01-22T00:00:00.000Z', endDate: '2018-02-01T00:00:00.000Z', quantity: 5 },
    { startDate: '2018-02-01T00:00:00.000Z', endDate: '2018-02-05T00:00:00.000Z', quantity: 4 },
    { startDate: '2018-02-05T00:00:00.000Z', endDate: null, quantity: 5 }
  ]

  const {
    chunkAvailabilities,
    chunkTransactions
  } = getInternalAvailabilityPeriods({ defaultQuantity, graphDates })

  t.deepEqual(chunkAvailabilities, expectedAvailablePeriods)
  t.deepEqual(chunkTransactions, [])
})

test('generate internal availability periods with transactions', (t) => {
  const defaultQuantity = 5
  const graphDates = [
    { date: '2018-01-03T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-01-07T00:00:00.000Z', usedQuantity: 0, availableQuantity: 3 },
    { date: '2018-01-11T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-01-16T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-18T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-22T00:00:00.000Z', usedQuantity: 0, availableQuantity: 5 },
    { date: '2018-02-01T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-02-05T00:00:00.000Z', usedQuantity: 0, availableQuantity: 5 }
  ]

  const transactions = [
    { id: '1', startDate: '2018-01-04T00:00:00.000Z', endDate: '2018-01-06T00:00:00.000Z', quantity: 2, status: 'validated' },
    { id: '2', startDate: '2018-01-05T00:00:00.000Z', endDate: '2018-01-06T00:00:00.000Z', quantity: 1, status: 'validated' }, // overlap first transaction
    { id: '3', startDate: '2018-01-23T00:00:00.000Z', endDate: '2018-01-25T00:00:00.000Z', quantity: 1, status: 'validated' },
    { id: '4', startDate: '2018-01-25T00:00:00.000Z', endDate: null, quantity: 2, status: 'validated' } // no end date transaction
  ]

  const expectedChunkAvailabilities = [
    { startDate: null, endDate: '2018-01-03T00:00:00.000Z', quantity: 5 },
    { startDate: '2018-01-03T00:00:00.000Z', endDate: '2018-01-04T00:00:00.000Z', quantity: 4 },
    { startDate: '2018-01-04T00:00:00.000Z', endDate: '2018-01-05T00:00:00.000Z', quantity: 4 },
    { startDate: '2018-01-05T00:00:00.000Z', endDate: '2018-01-06T00:00:00.000Z', quantity: 4 },
    { startDate: '2018-01-06T00:00:00.000Z', endDate: '2018-01-07T00:00:00.000Z', quantity: 4 },
    { startDate: '2018-01-07T00:00:00.000Z', endDate: '2018-01-11T00:00:00.000Z', quantity: 3 },
    { startDate: '2018-01-11T00:00:00.000Z', endDate: '2018-01-16T00:00:00.000Z', quantity: 4 },
    { startDate: '2018-01-16T00:00:00.000Z', endDate: '2018-01-18T00:00:00.000Z', quantity: 0 },
    { startDate: '2018-01-18T00:00:00.000Z', endDate: '2018-01-22T00:00:00.000Z', quantity: 0 },
    { startDate: '2018-01-22T00:00:00.000Z', endDate: '2018-01-23T00:00:00.000Z', quantity: 5 },
    { startDate: '2018-01-23T00:00:00.000Z', endDate: '2018-01-25T00:00:00.000Z', quantity: 5 },
    { startDate: '2018-01-25T00:00:00.000Z', endDate: '2018-02-01T00:00:00.000Z', quantity: 5 },
    { startDate: '2018-02-01T00:00:00.000Z', endDate: '2018-02-05T00:00:00.000Z', quantity: 4 },
    { startDate: '2018-02-05T00:00:00.000Z', endDate: null, quantity: 5 }
  ]

  const expectedChunkTransactions = [
    { id: '1', startDate: '2018-01-04T00:00:00.000Z', endDate: '2018-01-05T00:00:00.000Z', quantity: 2, status: 'validated' },
    { id: '1', startDate: '2018-01-05T00:00:00.000Z', endDate: '2018-01-06T00:00:00.000Z', quantity: 2, status: 'validated' },
    { id: '2', startDate: '2018-01-05T00:00:00.000Z', endDate: '2018-01-06T00:00:00.000Z', quantity: 1, status: 'validated' },
    { id: '3', startDate: '2018-01-23T00:00:00.000Z', endDate: '2018-01-25T00:00:00.000Z', quantity: 1, status: 'validated' },
    { id: '4', startDate: '2018-01-25T00:00:00.000Z', endDate: '2018-02-01T00:00:00.000Z', quantity: 2, status: 'validated' },
    { id: '4', startDate: '2018-02-01T00:00:00.000Z', endDate: '2018-02-05T00:00:00.000Z', quantity: 2, status: 'validated' },
    { id: '4', startDate: '2018-02-05T00:00:00.000Z', endDate: null, quantity: 2, status: 'validated' },
  ]

  const {
    chunkAvailabilities,
    chunkTransactions
  } = getInternalAvailabilityPeriods({ defaultQuantity, graphDates }, transactions)

  t.deepEqual(chunkAvailabilities, expectedChunkAvailabilities)
  t.deepEqual(chunkTransactions, expectedChunkTransactions)
})

test('generate internal availability periods', (t) => {
  const defaultQuantity = 5
  const graphDates = [
    { date: '2018-01-03T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-01-07T00:00:00.000Z', usedQuantity: 0, availableQuantity: 3 },
    { date: '2018-01-11T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-01-16T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-18T00:00:00.000Z', usedQuantity: 0, availableQuantity: 0 },
    { date: '2018-01-22T00:00:00.000Z', usedQuantity: 0, availableQuantity: 5 },
    { date: '2018-02-01T00:00:00.000Z', usedQuantity: 0, availableQuantity: 4 },
    { date: '2018-02-05T00:00:00.000Z', usedQuantity: 0, availableQuantity: 5 }
  ]

  const expectedInternalPeriods = [
    { startDate: null, endDate: '2018-01-03T00:00:00.000Z', quantity: 5 },
    { startDate: '2018-01-03T00:00:00.000Z', endDate: '2018-01-07T00:00:00.000Z', quantity: 4 },
    { startDate: '2018-01-07T00:00:00.000Z', endDate: '2018-01-11T00:00:00.000Z', quantity: 3 },
    { startDate: '2018-01-11T00:00:00.000Z', endDate: '2018-01-16T00:00:00.000Z', quantity: 4 },
    { startDate: '2018-01-16T00:00:00.000Z', endDate: '2018-01-18T00:00:00.000Z', quantity: 0 },
    { startDate: '2018-01-18T00:00:00.000Z', endDate: '2018-01-22T00:00:00.000Z', quantity: 0 },
    { startDate: '2018-01-22T00:00:00.000Z', endDate: '2018-02-01T00:00:00.000Z', quantity: 5 },
    { startDate: '2018-02-01T00:00:00.000Z', endDate: '2018-02-05T00:00:00.000Z', quantity: 4 },
    { startDate: '2018-02-05T00:00:00.000Z', endDate: null, quantity: 5 }
  ]

  const internalPeriods = getAvailabilityPeriods({ defaultQuantity, graphDates })

  t.deepEqual(internalPeriods, expectedInternalPeriods)
})
