const _ = require('lodash')
const createError = require('http-errors')
const { createCursor, parseCursor } = require('./cursor')

const reverseOrder = (order) => order === 'asc' ? 'desc' : 'asc'
const reverseOperator = (operator) => {
  // reverse the order, not negate the operator
  // (e.g. negation of '>' is '<=')
  const map = {
    '>': '<',
    '>=': '<=',
    '<': '>',
    '<=': '>=',
  }

  return map[operator]
}

const matchCursorResult = _.curry((decodedCursor, result) => {
  const normalizeValue = prop => prop instanceof Date ? prop.toISOString() : prop

  return Object.keys(decodedCursor).every(k => {
    return normalizeValue(result[k]) === normalizeValue(decodedCursor[k])
  })
})

// ///////////////// //
// OFFSET PAGINATION //
// ///////////////// //

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
}) {
  // Clone the query builder to have the count for all matched results before pagination filtering
  const countQueryBuilder = queryBuilder.clone()

  if (orderBy && order) {
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

// ///////////////// //
// CURSOR PAGINATION //
// ///////////////// //

/**
 * @param {Object}   queryBuilder - Knex.js query builder
 *
 * `startingAfter` and `endingBefore` are mutually exclusive
 * @param {String}   [startingAfter] - if specified, fetch first results after this cursor
 * @param {String}   [endingBefore] - if specified, fetch last results before this cursor
 *
 * @param {Number}   nbResultsPerPage
 *
 * @param {Object[]} cursorProps - will be used to create/parse cursor
 * @param {Object}   cursorProps[i]
 * @param {String}   cursorProps[i].name - object property to encode
 * @param {String}   cursorProps[i].type - allowed value: 'number', 'boolean', 'date', 'string'
 *
 * @param {String}   order - allowed values: 'asc', 'desc'
 */
async function cursorPaginate ({
  queryBuilder,
  startingAfter,
  endingBefore,
  nbResultsPerPage,
  cursorProps,
  order,
}) {
  if (startingAfter && endingBefore) throw new Error('Cannot provide both `startingAfter` and `endingBefore`')

  // if `endingBefore` is specified, this is equivalent to retrieving
  // the `nbResultsPerPage` last results.
  // To achieve it, this is done with 2 steps:
  // 1. reverse the `order` direction for the SQL query with limit to `nbResultsPerPage`
  // 2. reverse the obtained results in Javascript
  const shouldReverseOrder = !!endingBefore

  const cursor = startingAfter || endingBefore
  let decodedCursor

  try {
    if (cursor) {
      decodedCursor = parseCursor(cursor, cursorProps)

      queryBuilder = applyCursorPaginationParameters({
        queryBuilder,
        cursorProps,
        decodedCursor,
        order,
        shouldReverseOrder,
      })
    }
  } catch (err) {
    throw createError(422, 'Invalid cursor')
  }

  queryBuilder.orderBy(
    cursorProps.map(p => ({
      column: p.name,
      order: shouldReverseOrder ? reverseOrder(order) : order
    }))
  )

  // adds 2 to the limit to try to retrieve 1 result from previous and next pages
  let results = await queryBuilder.limit(nbResultsPerPage + 2)

  const paginationMeta = getCursorPaginationMeta({
    decodedCursor,
    results,
    startingAfter,
    endingBefore,
    nbResultsPerPage,
  })

  // remove cursor result
  if (decodedCursor) results = results.filter(_.negate(matchCursorResult(decodedCursor)))

  results = results.slice(0, nbResultsPerPage)
  if (shouldReverseOrder) results = results.reverse()

  const firstResult = _.first(results)
  const lastResult = _.last(results)

  paginationMeta.startCursor = firstResult ? createCursor(firstResult, cursorProps) : null
  paginationMeta.endCursor = lastResult ? createCursor(lastResult, cursorProps) : null

  paginationMeta.results = results
  return paginationMeta
}

function getCursorPaginationMeta ({
  decodedCursor,
  results,
  startingAfter,
  endingBefore,
  nbResultsPerPage,
}) {
  let hasPreviousPage = false
  let hasNextPage = false

  if (decodedCursor) {
    const matchingResult = matchCursorResult(decodedCursor)

    const cursorResult = results.find(matchingResult)
    const resultsWithoutCursorResult = results.filter(_.negate(matchingResult))

    if (startingAfter) {
      hasPreviousPage = Boolean(cursorResult)
      hasNextPage = resultsWithoutCursorResult.length > nbResultsPerPage
    } else if (endingBefore) {
      hasPreviousPage = resultsWithoutCursorResult.length > nbResultsPerPage
      hasNextPage = Boolean(cursorResult)
    }
  } else {
    if (endingBefore) hasPreviousPage = results.length > nbResultsPerPage
    else hasNextPage = results.length > nbResultsPerPage
  }

  return {
    hasPreviousPage,
    hasNextPage,
    nbResultsPerPage,
  }
}

function applyCursorPaginationParameters ({
  queryBuilder,
  cursorProps,
  decodedCursor,
  order,
  shouldReverseOrder,
}) {
  return queryBuilder
    .where(qb => {
      const firstProp = cursorProps[0].name
      const secondaryProp = cursorProps.length === 2 ? cursorProps[1].name : null

      let operator = order === 'asc' ? '>' : '<'
      let operatorWithEqual = order === 'asc' ? '>=' : '<='

      if (shouldReverseOrder) {
        operator = reverseOperator(operator)
        operatorWithEqual = reverseOperator(operatorWithEqual)
      }

      // We need to query results that are ordered before or after the cursor (depending on the order)
      // but we also need to include the cursor result to determine if there is a previous page
      if (cursorProps.length === 1) {
        // if one-column cursor, use operator with equal
        qb.where(firstProp, operatorWithEqual, decodedCursor[firstProp])
      } else {
        // if two-columns cursor, the query is split into two parts:
        // 1. fetch results strictly before or after the first column value
        // 2. OR fetch results whose first column value is equal to cursor first column value
        //    and use operator with equal to include the second column value,
        //    because the second column will make the difference
        qb
          .where(firstProp, operator, decodedCursor[firstProp])
          .orWhere(qb2 => {
            return qb2
              .where(firstProp, decodedCursor[firstProp])
              .where(secondaryProp, operatorWithEqual, decodedCursor[secondaryProp])
          })
      }

      return qb
    })
}

module.exports = {
  offsetPaginate,
  getOffsetPaginationMeta,

  cursorPaginate,
  getCursorPaginationMeta,

  DEFAULT_NB_RESULTS_PER_PAGE: 20,
}
