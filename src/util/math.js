const Big = require('big.js')

// Classic native JS sum has floating precision issues:
// Basic sum: 8.1 + 8.2 = 16.299999999999997

// Transitive issue:
// 8.3 + 8.7 + 8 + 8.1 = 33.1
// 8 + 8.7 + 8.1 + 8.3 = 33.099999999999994
function sumDecimals (numbers, precision = 10) {
  return parseFloat(
    numbers
      .reduce(
        (big, n) => big.add(n),
        Big(0)
      ).toFixed(precision)
  )
}

// Do not use "classic" rounding method (e.g `Math.round(8.325 * 100) / 100 === 8.32`)
// Instead use a more accurate rounding with exponential notation (e.g `Number(Math.round(8.325 + 'e2') + 'e-2') === 8.33`)
// https://www.jacklmoore.com/notes/rounding-in-javascript/
function roundDecimal (number, precision, customFn = Math.round) {
  return Number(customFn(`${number}e${precision}`) + `e-${precision}`)
}

module.exports = {
  sumDecimals,
  roundDecimal
}
