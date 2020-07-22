require('dotenv').config()

const test = require('ava')

const {
  sumDecimals,
  roundDecimal
} = require('../../../src/util/math')

test('sum numbers', (t) => {
  t.is(sumDecimals([8.1, 8.2]), 16.3) // 16.299999999999997 in JS

  t.is(sumDecimals([8.3, 8.7, 8, 8.1]), 33.1) // 33.1 in JS
  t.is(sumDecimals([8, 8.7, 8.1, 8.3]), 33.1) // 33.099999999999994 in JS
})

test('rounds number with precision', (t) => {
  t.is(roundDecimal(8.325, 2), 8.33)
  t.is(roundDecimal(8.325, 2, Math.floor), 8.32)
  t.is(roundDecimal(8.325, 2, Math.ceil), 8.33)
})
