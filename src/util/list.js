module.exports = {

  parseArrayValues,
  replaceBy,

}

function parseArrayValues (values) {
  if (Array.isArray(values)) return values
  if (typeof values !== 'string') return values

  return values.split(',')
}

function replaceBy (array, elementToReplace, replaceFn) {
  return array.map(element => {
    const replace = replaceFn(element)
    if (replace) {
      return elementToReplace
    } else {
      return element
    }
  })
}
