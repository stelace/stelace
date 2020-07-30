const Knex = require('knex')

const knexInstances = {}

function getKnex (connection = {}, options = {}) {
  const key = getKnexCacheKey(connection)
  if (knexInstances[key]) return knexInstances[key]

  const {
    host,
    user,
    password,
    database,
    port,
    ssl,
  } = connection
  const {
    pool = {
      min: 2,
      max: 10
    }
  } = options

  const knex = Knex({
    client: 'pg',
    useNullAsDefault: true,
    connection: {
      host,
      user,
      password,
      database,
      port,
      ssl,
    },
    pool
  })

  knexInstances[key] = knex

  return knex
}

function getKnexCacheKey (connection) {
  const {
    host,
    user,
    password,
    database,
    port,
    ssl,
  } = connection

  return JSON.stringify({
    host,
    user,
    password,
    database,
    port,
    ssl,
  })
}

module.exports = {
  getKnex
}
