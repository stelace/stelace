require('dotenv').config()

const test = require('ava')

const {
  roundDecimal
} = require('../../../src/util/math')

test('rounds number with precision', (t) => {
  t.is(roundDecimal(8.325, 2), 8.33)
  t.is(roundDecimal(8.325, 2, Math.floor), 8.32)
  t.is(roundDecimal(8.325, 2, Math.ceil), 8.33)
})
