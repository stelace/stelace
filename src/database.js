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

async function createSchema ({ connection, schema, destroyKnex = true }) {
  const params = {
    client: 'pg',
    useNullAsDefault: true,
    connection,
    searchPath: [schema]
  }

  // get a new connection because we have to set schema if needed
  const knex = Knex(params)

  const adminUser = process.env.POSTGRES_ADMIN_USER || 'postgres'

  await knex.raw('CREATE SCHEMA IF NOT EXISTS ?? AUTHORIZATION ??', [schema, adminUser])

  if (destroyKnex) {
    await knex.destroy()
  } else {
    return knex
  }
}

/**
 * @param {Object}  connection
 * @param {String}  schema
 * @param {Boolean} [cascade = false] - if true, will force the schema drop even if there are remaining tables
 * @param {String}  [destroyKnex = true] - if false, knex isn't destroyed so it can be reused
 * @return {Object|Undefined} returns knex if `destroyKnex` is false
 */
async function dropSchema ({ connection, schema, cascade = false, destroyKnex = true }) {
  const params = {
    client: 'pg',
    useNullAsDefault: true,
    connection,
    searchPath: [schema]
  }

  // get a new connection because we have to set schema if needed
  const knex = Knex(params)

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
 * @constant {String} - Custom PostgreSQL function name
 */
const mergeFunctionName = jsonDeepMergeDef.mergeFunctionName

module.exports = {
  existColumns,
  dropColumnsIfExist,

  createSchema,
  dropSchema,

  mergeFunctionName
}
