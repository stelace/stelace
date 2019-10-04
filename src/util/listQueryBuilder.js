const Joi = require('@hapi/joi')
const { parseArrayValues, getPaginationMeta } = require('./list')

const filtersSchema = Joi.object().pattern(
  Joi.string(),
  Joi.object().keys({
    dbField: Joi.string(),
    value: Joi.any(),
    transformValue: Joi.alternatives().try([
      Joi.string().valid('array'),
      Joi.func()
    ]),
    query: Joi.alternatives().try([
      Joi.string().valid('range', 'inList'),
      Joi.func()
    ])
  })
).min(1).required()

const rangeFilterSchema = Joi.alternatives().try([
  Joi.any(),
  Joi.object().pattern(
    Joi.string().valid('lt', 'lte', 'gt', 'gte'),
    Joi.any()
  )
]).required()

const orderConfigSchema = Joi.object().keys({
  orderBy: Joi.string().required(),
  order: Joi.string().valid('asc', 'desc').required()
}).required()

const paginationConfigSchema = Joi.object().keys({
  page: Joi.number().integer().min(1).required(),
  nbResultsPerPage: Joi.number().integer().min(1).required()
}).required()

const joiOptions = {
  convert: true,
  allowUnknown: false,
  abortEarly: false
}

function getTransformedValues (filters) {
  const values = {}

  Object.keys(filters).forEach(key => {
    const filter = filters[key]
    const { value, transformValue } = filter

    let newValue

    if (typeof transformValue === 'undefined') {
      newValue = value
    } else if (typeof transformValue === 'string') {
      if (transformValue === 'array') {
        newValue = parseArrayValues(value)
      }
    } else if (typeof transformValue === 'function') {
      newValue = transformValue(value)
    } else {
      throw new Error(`Unknown transformation value for filter on field ${filter.dbField}`)
    }

    values[key] = newValue
  })

  return values
}

function addFiltersToQueryBuilder (queryBuilder, filters, transformedValues) {
  Object.keys(filters).forEach(key => {
    const filter = filters[key]
    const { dbField, value, query } = filter
    const transformedValue = transformedValues[key]

    // skip the filter if the value is not defined
    if (typeof value === 'undefined') {
      return
    }

    const isCustomQuery = typeof query === 'function'
    if (!isCustomQuery && !dbField) {
      throw new Error(`dbField is needed for filter with key ${key}`)
    }

    if (typeof query === 'undefined') {
      queryBuilder.where(dbField, transformedValue)
    } else if (typeof query === 'string') {
      if (query === 'range') {
        checkRangeFilter(transformedValue, key)

        if (transformedValue.lt) {
          queryBuilder.where(dbField, '<', transformedValue.lt)
        }
        if (transformedValue.lte) {
          queryBuilder.where(dbField, '<=', transformedValue.lte)
        }
        if (transformedValue.gt) {
          queryBuilder.where(dbField, '>', transformedValue.gt)
        }
        if (transformedValue.gte) {
          queryBuilder.where(dbField, '>=', transformedValue.gte)
        }
      } else if (query === 'inList') {
        queryBuilder.whereIn(dbField, transformedValue)
      }
    } else if (isCustomQuery) {
      query(queryBuilder, transformedValue, transformedValues)
    } else {
      throw new Error(`Unknown query for filter on field ${filter.dbField}`)
    }
  })
}

function checkFilters (filters) {
  const { error } = Joi.validate(filters, filtersSchema, joiOptions)

  if (error) {
    error.message = `Bad filters: ${error.message}`
    throw error
  }
}

function checkRangeFilter (value, key) {
  const { error } = Joi.validate(value, rangeFilterSchema, joiOptions)

  if (error) {
    error.message = `Bad range filter ${key}: ${error.message}`
    throw error
  }
}

function checkOrderConfig (orderConfig) {
  const { error } = Joi.validate(orderConfig, orderConfigSchema, joiOptions)

  if (error) {
    error.message = `Bad order config: ${error.message}`
    throw error
  }
}

function checkPaginationConfig (paginationConfig) {
  const { error } = Joi.validate(paginationConfig, paginationConfigSchema, joiOptions)

  if (error) {
    error.message = `Bad pagination config: ${error.message}`
    throw error
  }
}

/**
 * Generic query function to address filters, sort and pagination for list endpoints
 * @param {Object}  params.queryBuilder - Objection.js query builder
 * @param {Object}  [params.filters] - Filters for the query (like select on some IDs)
 * @param {Object}  [params.filters[key]]
 * @param {Object}  [params.filters[key].dbField]
 * @param {Object}  [params.filters[key].type]
 * @param {Object}  [params.filters[key].]
 *
 * @param {Boolean} [params.paginationActive = true]
 * @param {Object}  [params.paginationConfig]
 * @param {Number}  [params.paginationConfig.page]
 * @param {Number}  [params.paginationConfig.nbResultsPerPage]
 *
 * @param {Object}  params.orderConfig
 * @param {Object}  params.orderConfig.orderBy - Order field
 * @param {Object}  params.orderConfig.order - Must be 'asc' or 'desc'
 *
 * If pagination is active
 * @return {Object} paginationMeta
 * @return {Number} paginationMeta.nbResults
 * @return {Number} paginationMeta.nbPages
 * @return {Number} paginationMeta.page
 * @return {Number} paginationMeta.nbResultsPerPage
 * @return {Object[]} paginationMeta.results
 *
 * If pagination is inactive
 * @return {Object[]} results
 */
async function performListQuery ({
  queryBuilder,
  filters,
  paginationActive = true,
  paginationConfig,
  orderConfig,
  beforeQueryFn
}) {
  checkOrderConfig(orderConfig)

  if (filters) {
    checkFilters(filters)
  }
  if (paginationActive) {
    checkPaginationConfig(paginationConfig)
  }

  let transformedValues

  if (filters) {
    transformedValues = getTransformedValues(filters)
    addFiltersToQueryBuilder(queryBuilder, filters, transformedValues)
  }

  if (typeof beforeQueryFn === 'function') {
    await beforeQueryFn({ queryBuilder, values: transformedValues })
  }

  if (paginationActive) {
    // Clone the query builder to have the count for all matched results before pagination filtering
    const countQueryBuilder = queryBuilder.clone()

    const { orderBy, order } = orderConfig
    queryBuilder.orderBy(orderBy, order)

    const { page, nbResultsPerPage } = paginationConfig

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

    const paginationMeta = getPaginationMeta({
      nbResults,
      nbResultsPerPage,
      page
    })

    paginationMeta.results = results
    return paginationMeta
  } else {
    const { orderBy, order } = orderConfig
    queryBuilder.orderBy(orderBy, order)

    const results = await queryBuilder
    return results
  }
}

module.exports = {
  performListQuery
}
