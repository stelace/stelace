const bluebird = require('bluebird')
const Knex = require('knex')

// Proper migration would be needed to update PostgreSQL function name
const jsonDeepMergeDef = require('../migrations/util/stl_jsonb_deep_merge')

async function existColumns (knex, tableName, columns) {
  const mapExist = await bluebird.map(columns, column => {
    return knex.schema.hasColumn(tableName, column)
  })

  return columns.reduce((memo, column, index) => {
    memo[column] = mapExist[index]
    return memo
  }, {})
}

async function dropColumnsIfExist (knex, tableName, columns) {
  if (!Array.isArray(columns)) {
    columns = [columns]
  }

  const mapExist = await bluebird.map(columns, column => {
    return knex.schema.hasColumn(tableName, column)
  })

  const columnsToDrop = []
  columns.forEach((column, index) => {
    if (mapExist[index]) {
      columnsToDrop.push(column)
    }
  })

  if (!columnsToDrop.length) return

  await knex.schema.alterTable(tableName, table => {
    columnsToDrop.forEach(column => {
      table.dropColumn(column)
    })
  })
}

/**
 * @param {Object}  connection - provide `connection` or `knex`
 * @param {Object}  knex - Knex.js query builder
 * @param {String}  schema
 * @param {String}  [destroyKnex = true] - if false, knex isn't destroyed so it can be reused
 * @return {Object|Undefined} returns knex if `destroyKnex` is false
 */
async function createSchema ({ connection, schema, knex, destroyKnex = true }) {
  if (!knex) knex = getKnex({ connection, schema })

  const adminUser = process.env.POSTGRES_ADMIN_USER || 'postgres'

  await knex.raw('CREATE SCHEMA IF NOT EXISTS ?? AUTHORIZATION ??', [schema, adminUser])

  if (destroyKnex) {
    await knex.destroy()
  } else {
    return knex
  }
}

/**
 * @param {Object}  connection - provide `connection` or `knex`
 * @param {Object}  knex - Knex.js query builder
 * @param {String}  schema
 * @param {Boolean} [cascade = false] - if true, will force the schema drop even if there are remaining tables
 * @param {String}  [destroyKnex = true] - if false, knex isn't destroyed so it can be reused
 * @return {Object|Undefined} returns knex if `destroyKnex` is false
 */
async function dropSchema ({ connection, schema, knex, cascade = false, destroyKnex = true }) {
  if (!knex) knex = getKnex({ connection, schema })

  let sqlQuery = 'DROP SCHEMA IF EXISTS ??'

  // schema with remaining tables cannot be dropped
  // using cascade will force the drop but be careful
  if (cascade) {
    sqlQuery += ' CASCADE'
  }

  await knex.raw(sqlQuery, [schema])

  if (destroyKnex) {
    await knex.destroy()
  } else {
    return knex
  }
}

/**
 * @param {Object}  connection - provide `connection` or `knex`
 * @param {Object}  knex - Knex.js query builder
 * @param {String}  schema
 * @param {String}  [destroyKnex = true] - if false, knex isn't destroyed so it can be reused
 * @return {Object|Undefined} returns knex if `destroyKnex` is false
 */
async function dropSchemaViews ({ connection, schema, knex, destroyKnex = true }) {
  if (!knex) knex = getKnex({ connection, schema })

  const viewsQuery = 'SELECT table_name FROM INFORMATION_SCHEMA.views WHERE table_schema = ?'

  const { rows } = await knex.raw(viewsQuery, [schema])
  const views = rows.map(({ table_name }) => table_name) // eslint-disable-line camelcase

  // dropping TimescaleDB continuous aggregates requires cascade option
  // https://docs.timescale.com/latest/using-timescaledb/continuous-aggregates#alter-drop
  const dropView = 'DROP VIEW IF EXISTS ??.?? CASCADE'

  await knex.transaction(async (trx) => {
    for (const view of views) {
      await trx.raw(dropView, [schema, view])
    }
  })

  if (destroyKnex) {
    await knex.destroy()
  } else {
    return knex
  }
}

function getKnex ({ connection, schema }) {
  const params = {
    client: 'pg',
    useNullAsDefault: true,
    connection,
    searchPath: [schema]
  }

  return Knex(params)
}

/**
 * @constant {String} - Custom PostgreSQL function name
 */
const mergeFunctionName = jsonDeepMergeDef.mergeFunctionName

module.exports = {
  existColumns,
  dropColumnsIfExist,

  createSchema,
  dropSchema,

  dropSchemaViews,

  mergeFunctionName
}
