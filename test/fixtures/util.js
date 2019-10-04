module.exports = {

  escapeFixture

}

function escapeString (str) {
  return str.replace(/:/g, '::')
}

/**
 * @param {Any} value
 * @return {Any}
 */
function escapeFixture (value) {
  if (typeof value === 'string') {
    return escapeString(value)
  } else if (typeof value === 'object' && value !== null) {
    return escapeString(JSON.stringify(value))
  } else {
    return value
  }
}
