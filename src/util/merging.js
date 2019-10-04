// To be used with Lodash.mergeWith
// https://lodash.com/docs/4.17.11#mergeWith
function mergeOrOverwrite (objValue, srcValue) {
  // replace the old array by the new array
  // default Lodash merge behaviour:
  // old: [1, 2, 3], new: [4, 5] => [4, 5, 3]
  if (Array.isArray(objValue)) {
    return srcValue
  }
}

module.exports = {
  mergeOrOverwrite
}
