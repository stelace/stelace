// Do not use "classic" rounding method (e.g `Math.round(8.325 * 100) / 100 === 8.32`)
// Instead use a more accurate rounding with exponential notation (e.g `Number(Math.round(8.325 + 'e2') + 'e-2') === 8.33`)
// https://www.jacklmoore.com/notes/rounding-in-javascript/
function roundDecimal (number, precision, customFn = Math.round) {
  return Number(customFn(`${number}e${precision}`) + `e-${precision}`)
}

module.exports = {
  roundDecimal
}
