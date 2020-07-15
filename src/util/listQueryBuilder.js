const _ = require('lodash')
const createError = require('http-errors')

const { Joi } = require('./validation')
const { parseArrayValues, getPaginationMeta } = require('./list')
const { roundDecimal } = require('./math')

const filtersSchema = Joi.object().pattern(
  Joi.string(),
  Joi.object().keys({
    dbField: Joi.string(),
    value: Joi.any(),
    minValue: Joi.any(),
    defaultValue: Joi.any(),
    transformValue: Joi.alternatives().try(
      Joi.string().valid('array'),
      Joi.func()
    ),
    query: Joi.alternatives().try(
      Joi.string().valid('range', 'inList', 'jsonSupersetOf'),
      Joi.func()
    )
  })
).min(1).required()

const rangeFilterSchema = Joi.alternatives().try(
  Joi.any(),
  Joi.object().pattern(
    Joi.string().valid('lt', 'lte', 'gt', 'gte'),
    Joi.any()
  )
).required()

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
    const { value, transformValue, defaultValue } = filter

    let newValue

    if (_.isUndefined(transformValue)) {
      newValue = value
    } else if (_.isString(transformValue)) {
      if (transformValue === 'array') {
        newValue = parseArrayValues(value)
      }
    } else if (_.isFunction(transformValue)) {
      newValue = transformValue(value)
    } else {
      throw new Error(`Unknown transformation value for filter on field ${filter.dbField}`)
    }

    if (_.isUndefined(newValue) && !_.isUndefined(defaultValue)) newValue = defaultValue

    values[key] = newValue
  })

  return values
}

/**
 * @param {Object} queryBuilder - Knex.js query builder
 *   do not use Objection.js functions because `addFiltersToQueryBuilder` is used for list and aggregation.
 *   However aggregations don't work so great with Objection.js due to `defaultSchema` that is applied to all queries
 *   even to WITH queries while this is unwanted
 * @param {Object} filters
 * @param {Object} transformedValues
 */
function addFiltersToQueryBuilder (queryBuilder, filters, transformedValues) {
  Object.keys(filters).forEach(key => {
    const filter = filters[key]
    const { dbField, value, query, minValue } = filter
    const transformedValue = transformedValues[key]

    // skip the filter if the value is not defined,
    if (_.isUndefined(transformedValue)) return

    const isCustomQuery = _.isFunction(query)
    if (!isCustomQuery && !dbField) {
      throw new Error(`dbField is needed for filter with key ${key}`)
    }

    if (_.isUndefined(query)) {
      queryBuilder.where(dbField, transformedValue)
    } else if (_.isString(query)) {
      if (query === 'range') {
        checkRangeFilter(transformedValue, key)

        const throwMinValueError = () => {
          throw createError(400, `${key} value cannot be lower than ${minValue}`)
        }

        const minRangeValue = getMinRangeValue(transformedValue)
        if (minRangeValue) {
          if (minRangeValue < minValue) throwMinValueError()
        } else {
          const isSingleValue = !_.isPlainObject(transformedValue)
          if (!isSingleValue && _.isUndefined(transformedValue.gt) && _.isUndefined(transformedValue.gte)) {
            transformedValue.gte = minValue
          }
        }

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
      } else if (query === 'jsonSupersetOf') {
        whereJsonbColumnSupersetOf(queryBuilder, { columnName: dbField, data: value })
      }
    } else if (isCustomQuery) {
      query(queryBuilder, transformedValue, transformedValues)
    } else {
      throw new Error(`Unknown query for filter on field ${filter.dbField}`)
    }
  })
}

function checkFilters (filters) {
  const { error } = filtersSchema.validate(filters, joiOptions)

  if (error) {
    error.message = `Bad filters: ${error.message}`
    throw error
  }
}

function checkRangeFilter (value, key) {
  const { error } = rangeFilterSchema.validate(value, joiOptions)

  if (error) {
    error.message = `Bad range filter ${key}: ${error.message}`
    throw error
  }
}

function checkOrderConfig (orderConfig) {
  const { error } = orderConfigSchema.validate(orderConfig, joiOptions)

  if (error) {
    error.message = `Bad order config: ${error.message}`
    throw error
  }
}

function checkPaginationConfig (paginationConfig) {
  const { error } = paginationConfigSchema.validate(paginationConfig, joiOptions)

  if (error) {
    error.message = `Bad pagination config: ${error.message}`
    throw error
  }
}

/**
 * Generic query function to address filters, sort and pagination for list endpoints
 * @param {Object}  params.queryBuilder - Knex.js query builder
 * @param {Object}  [params.filters] - Filters for the query (like select on some IDs)
 * @param {Object}  [params.filters[key]]
 * @param {String}  [params.filters[key].dbField]
 * @param {String}  [params.filters[key].type]
 * @param {String|Function}  [params.filters[key].transformValue]
 * @param {String|Function}  [params.filters[key].query]
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

  if (_.isFunction(beforeQueryFn)) {
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

/**
 * Equivalent to `whereJsonSupersetOf` method of Objection.js, using PostgreSQL JSONB operator
 * applying to whole DB column instead of a specific nested field.
 * https://vincit.github.io/objection.js/api/query-builder/find-methods.html#wherejsonsupersetof
 * @param {Object} queryBuilder - Knex.js query builder
 * @param {Object} params
 * @param {String} params.columnName - DB column name
 * @param {Object} params.data - data object the column should be a superset of
 */
function whereJsonbColumnSupersetOf (queryBuilder, { columnName, data }) {
  if (!_.isString(columnName)) throw new Error('String `columnName` expected.')
  if (!_.isPlainObject(data)) throw new Error('`data` object expected')
  queryBuilder.whereRaw('??::jsonb @> ?::jsonb', [columnName, data])
}

/**
 * Generic query function to address filters, sort and pagination for stats endpoints
 * @param {Object}  params.queryBuilder - Knex.js query builder
 * @param {String}  [params.schema = 'public']
 * @param {String}  params.groupBy - Field to group by (can be nested like `metadata.nested.custom`)
 * @param {String}  [params.field] - Group by on this field if provided (can be nested like `metadata.nested.custom`)
 * @param {Number}  [params.avgPrecision = 2] - Round the average amount to this precision
 * @param {Object}  [params.filters] - Filters for the query (like select on some IDs)
 * @param {Object}  [params.filters[key]]
 * @param {String}  [params.filters[key].dbField]
 * @param {String}  [params.filters[key].type]
 * @param {String|Function}  [params.filters[key].transformValue]
 * @param {String|Function}  [params.filters[key].query]
 *
 * @param {Object}  params.paginationConfig
 * @param {Number}  params.paginationConfig.page
 * @param {Number}  params.paginationConfig.nbResultsPerPage
 *
 * @param {Object}  params.orderConfig
 * @param {Object}  params.orderConfig.orderBy - Order field
 * @param {Object}  params.orderConfig.order - Must be 'asc' or 'desc'
 *
 * @return {Object} paginationMeta
 * @return {Number} paginationMeta.nbResults
 * @return {Number} paginationMeta.nbPages
 * @return {Number} paginationMeta.page
 * @return {Number} paginationMeta.nbResultsPerPage
 * @return {Object[]} paginationMeta.results
 */
async function performAggregationQuery ({
  queryBuilder,
  schema = 'public',
  groupBy,
  field,
  avgPrecision = 2,
  filters,
  paginationConfig,
  orderConfig
}) {
  checkOrderConfig(orderConfig)

  if (filters) {
    checkFilters(filters)
  }
  checkPaginationConfig(paginationConfig)

  if (field === groupBy) {
    throw createError(422, `${field} cannot be field and groupBy at the same time`)
  }

  const knex = queryBuilder

  const sqlGroupByExpression = getSqlExpression(groupBy)
  const sqlStatsFieldExpression = field ? getSqlExpression(field) : null

  queryBuilder = queryBuilder.with('aggregations', qb => {
    const selectExpressions = [
      knex.raw(`${sqlGroupByExpression} as "groupByField"`)
    ]

    qb
      .from(`${schema}.event`)
      .select(selectExpressions)
      .count()
      .groupBy('groupByField')
      .orderBy(orderBy, order)

    // If the stats field isn't provided, we cannot perform aggregation operations except for count (done above)
    if (sqlStatsFieldExpression) {
      // Convert the stats field into real (PostgreSQL decimal number)
      // from default json text value
      // Aggregation operations can only work with numbers
      qb
        .avg({ avg: knex.raw(`(${sqlStatsFieldExpression})::REAL`) })
        .sum({ sum: knex.raw(`(${sqlStatsFieldExpression})::REAL`) })
        .min({ min: knex.raw(`(${sqlStatsFieldExpression})::REAL`) })
        .max({ max: knex.raw(`(${sqlStatsFieldExpression})::REAL`) })
    }

    let transformedValues

    if (filters) {
      transformedValues = getTransformedValues(filters)
      addFiltersToQueryBuilder(qb, filters, transformedValues)
    }

    return qb
  })

  queryBuilder
    .select()
    .from('aggregations')
    .whereNotNull('groupByField')

  // Clone the query builder to have the count for all matched results before pagination filtering
  const countQueryBuilder = queryBuilder.clone()

  const { orderBy, order } = orderConfig
  queryBuilder.orderBy(orderBy, order)

  const { page, nbResultsPerPage } = paginationConfig

  queryBuilder
    .offset((page - 1) * nbResultsPerPage)
    .limit(nbResultsPerPage)

  let results
  let nbResults

  try {
    const [
      queryResults,
      [{ count }]
    ] = await Promise.all([
      queryBuilder,
      countQueryBuilder.count()
    ])

    results = queryResults
    nbResults = count
  } catch (err) {
    // PostgreSQL error codes
    // https://www.postgresql.org/docs/10/errcodes-appendix.html
    if (err.code === '22P02') { // invalid_text_representation
      // fail to convert a non-number to real in the aggregation query
      throw createError(422, `Non-number value was found for field "${field}"`)
    } else {
      throw err
    }
  }

  const paginationMeta = getPaginationMeta({
    nbResults,
    nbResultsPerPage,
    page
  })

  paginationMeta.results = results.map(r => {
    const clonedResult = _.cloneDeep(r)

    clonedResult.groupBy = groupBy
    clonedResult.groupByValue = clonedResult.groupByField
    delete clonedResult.groupByField

    if (clonedResult.count) clonedResult.count = parseInt(clonedResult.count, 10)
    if (_.isNumber(clonedResult.avg)) clonedResult.avg = roundDecimal(clonedResult.avg, avgPrecision)

    const operators = ['avg', 'sum', 'min', 'max']
    operators.forEach(op => {
      if (_.isUndefined(clonedResult[op])) clonedResult[op] = null
    })

    return clonedResult
  })
  return paginationMeta
}

/**
 * Generic query function to address filters, sort and pagination for stats endpoints
 * @param {Object}  params.queryBuilder - Knex.js query builder
 * @param {String}  params.schema
 * @param {String}  params.table
 * @param {String}  [params.timeFilter = 'createdDate'] - Other filters will be disabled
 *    if date filter is beyond retention period
 * @param {String}  [params.timeColumn = 'createdTimestamp'] - Internal name of time column
 * @param {Object}  [params.groupByViews] - Views configuration that will be used to speed up query
 *    when only time filter is provided
 * @param {String}  [params.views[groupBy]] - View name
 * @param {String}  params.retentionLimitDate - Beyond that limit, all filters (except time) will be disabled
 * @param {String}  params.groupBy - Field to group by (must be 'hour', 'day' or 'month')
 * @param {Object}  [params.filters] - Filters for the query (like select on some IDs)
 * @param {Object}  [params.filters[key]]
 * @param {String}  [params.filters[key].dbField]
 * @param {String}  [params.filters[key].type]
 * @param {String|Function}  [params.filters[key].transformValue]
 * @param {String|Function}  [params.filters[key].query]
 *
 * @param {Object}  params.paginationConfig
 * @param {Number}  params.paginationConfig.page
 * @param {Number}  params.paginationConfig.nbResultsPerPage
 *
 * @param {Object}  params.orderConfig
 * @param {Object}  params.orderConfig.order - Must be 'asc' or 'desc'
 *
 * @return {Object} paginationMeta
 * @return {Number} paginationMeta.nbResults
 * @return {Number} paginationMeta.nbPages
 * @return {Number} paginationMeta.page
 * @return {Number} paginationMeta.nbResultsPerPage
 * @return {Object[]} paginationMeta.results
 */
async function performHistoryQuery ({
  queryBuilder,
  schema,
  table,
  timeFilter = 'createdDate',
  timeColumn = 'createdTimestamp',
  groupByViews = {},
  retentionLimitDate,
  groupBy,
  filters,
  paginationConfig,
  orderConfig
}) {
  checkOrderConfig(orderConfig)

  let onlyTimeFilter = true

  if (filters) {
    checkFilters(filters)

    const nonTimeFilterKeys = _.without(Object.keys(filters), [timeFilter])
    onlyTimeFilter = nonTimeFilterKeys.map(key => _.get(filters, `${key}.value`)).every(_.isUndefined)
    const minRangeValue = getMinRangeValue(filters[timeFilter].value)

    if (minRangeValue && minRangeValue < retentionLimitDate && !onlyTimeFilter) {
      throw createError(400, `All filters are disabled before ${retentionLimitDate}`)
    }
  }
  checkPaginationConfig(paginationConfig)

  if (!['hour', 'day', 'month'].includes(groupBy)) throw new Error(`Invalid groupBy value: ${groupBy}`)

  const intervals = {
    hour: '1 hour',
    day: '1 day',

    // TimescaleDB doesn't support month interval (https://github.com/timescale/timescaledb/issues/414)
    month: '30 days'
  }

  const knex = queryBuilder

  const interval = intervals[groupBy]
  const view = groupByViews[groupBy]

  let allResults

  if (onlyTimeFilter && view) {
    // `AT TIME ZONE 'UTC'` statement is important to add to have the type 'timestamptz'
    // otherwise the type 'timestamp' is returned and the date won't be UTC
    const select = knex.raw('?? AT TIME ZONE \'UTC\' as ??, count', [groupBy, groupBy])

    queryBuilder = queryBuilder
      .select(select)
      .from(knex.raw('??.??', [schema, view]))

    if (filters) {
      const newFilters = _.pick(filters, timeFilter)
      newFilters[timeFilter].dbField = groupBy
      const transformedValues = getTransformedValues(newFilters)
      addFiltersToQueryBuilder(queryBuilder, newFilters, transformedValues)
    }

    const { orderBy, order } = orderConfig
    queryBuilder.orderBy(orderBy, order)

    allResults = await queryBuilder
  } else {
    // `AT TIME ZONE 'UTC'` statement is important to add to have the type 'timestamptz'
    // otherwise the type 'timestamp' is returned and the date won't be UTC
    const select = knex.raw(`public.time_bucket(INTERVAL '${interval}', ??) AT TIME ZONE 'UTC' as ??`, [timeColumn, groupBy])

    queryBuilder = queryBuilder
      .select(select)
      .from(knex.raw('??.??', [schema, table]))
      .count()
      .groupBy(groupBy)

    if (filters) {
      const transformedValues = getTransformedValues(filters)
      addFiltersToQueryBuilder(queryBuilder, filters, transformedValues)
    }

    const { orderBy, order } = orderConfig
    queryBuilder.orderBy(orderBy, order)

    allResults = await queryBuilder
  }

  const { page, nbResultsPerPage } = paginationConfig

  // To avoid query complexity, data retrieval for pagination aren't split into results query and count query.
  // TODO: improve it with the incoming cursor-based pagination
  const nbResults = allResults.length
  const results = allResults.slice((page - 1) * nbResultsPerPage, page * nbResultsPerPage)

  const paginationMeta = getPaginationMeta({
    nbResults,
    nbResultsPerPage,
    page
  })

  paginationMeta.results = results
  return paginationMeta
}

/**
 * Transform attribute passed to API to expression that can be used in SQL query
 * e.g.
 * `someAttribute` => `"someAttribute"`
 * `root.property` => `"root"#>>'{property}'`
 * `root.nested.property` => `"root"#>>'{nested,property}'`
 * `root.nested.property[index]` => `"root"#>>'{nested,property,index}'`
 * @param {String} attr
 * @return {String} expr - SQL expression
 */
function getSqlExpression (attr) {
  // transform 'root.nested.property[index]' into `['root', 'nested', 'property', index]`
  const parts = attr.split(/\.|\[|\]/).filter(str => str)

  const column = parts[0]
  if (parts.length === 1) return `"${column}"`

  return `"${column}"#>>'{${parts.slice(1).join(',')}}'`
}

function getMinRangeValue (rangeOrValue) {
  if (_.isUndefined(rangeOrValue)) return

  const isSingleValue = !_.isPlainObject(rangeOrValue)
  if (isSingleValue) return rangeOrValue

  const rangeValues = [rangeOrValue.gt, rangeOrValue.gte]
  const [minValue] = rangeValues.sort((a, b) => {
    if (_.isUndefined(a)) return 1
    else if (_.isUndefined(b)) return -1
    else return a < b ? -1 : 1
  })

  return minValue
}

module.exports = {
  performListQuery,
  performAggregationQuery,
  performHistoryQuery,
}
