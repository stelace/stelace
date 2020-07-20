function getPaginationMeta ({ nbResults, page, nbResultsPerPage }) {
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

module.exports = {
  getPaginationMeta,

  DEFAULT_NB_RESULTS_PER_PAGE: 20,
}
