module.exports = {

  getPaginationMeta,
  parseArrayValues,
  replaceBy,

  DEFAULT_NB_RESULTS_PER_PAGE: 20

}

function getPaginationMeta ({ nbResults, page, nbResultsPerPage, allResults = false }) {
  if (allResults) {
    const paginationMeta = {
      nbResults,
      nbPages: 1,
      page: 1,
      nbResultsPerPage: null
    }

    return paginationMeta
  }

  let nbPages = Math.floor(nbResults / nbResultsPerPage)
  if (nbResults % nbResultsPerPage !== 0) {
    nbPages += 1
  }

  const paginationMeta = {
    nbResults,
    nbPages,
    page,
    nbResultsPerPage
  }

  return paginationMeta
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
