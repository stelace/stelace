function getOffsetPaginationMeta ({ nbResults, page, nbResultsPerPage }) {
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

async function offsetPaginate ({
  queryBuilder,
  orderBy,
  order,
  nbResultsPerPage,
  page,
  applyOrder = true,
}) {
  // Clone the query builder to have the count for all matched results before pagination filtering
  const countQueryBuilder = queryBuilder.clone()

  if (applyOrder) {
    queryBuilder.orderBy(orderBy, order)
  }

  queryBuilder
    .offset((page - 1) * nbResultsPerPage)
    .limit(nbResultsPerPage)

  const [
    results,
    [{ count: nbResults }]
  ] = await Promise.all([
    queryBuilder,
    countQueryBuilder.count()
  ])

  const paginationMeta = getOffsetPaginationMeta({
    nbResults,
    nbResultsPerPage,
    page
  })

  paginationMeta.results = results
  return paginationMeta
}

module.exports = {
  offsetPaginate,
  getOffsetPaginationMeta,

  DEFAULT_NB_RESULTS_PER_PAGE: 20,
}
