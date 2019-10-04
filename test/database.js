const path = require('path')
const SqlFixtures = require('sql-fixtures')
const Knex = require('knex')

const { createSchema, dropSchema } = require('../src/database')
const { getModels } = require('../src/models')

function getKnex (connection) {
  const options = {
    client: 'pg',
    useNullAsDefault: true,
    connection,
    searchPath: [connection.schema]
  }

  const knex = Knex(options)
  return knex
}

async function init ({ connection }) {
  const { schema } = connection

  await createSchema({ connection: connection, schema })

  const knex = getKnex(connection)

  await knex.migrate.latest({
    schemaName: schema,
    directory: path.join(__dirname, '../migrations/knex')
  })

  await knex.destroy()
}

async function createFixture ({ platformId, env, connection, data }) {
  const fixturesParams = {
    client: 'pg',
    connection,
    searchPath: [connection.schema]
  }

  const fixtureCreator = new SqlFixtures(fixturesParams)

  await fixtureCreator.create(data)
  await fixtureCreator.destroy()

  // automatically fill internal data based on fixtures data
  await syncInternalAvailability(platformId, env)
}

async function syncInternalAvailability (platformId, env) {
  const { InternalAvailability, Asset } = await getModels({ platformId, env })

  const rows = await Asset.query().select('id')
  const assetsIds = rows.map(row => row.id)

  await InternalAvailability.syncInternalAvailability({ assetsIds, platformId, env })
}

async function reset ({ connection }) {
  const knex = getKnex(connection)

  const { schema } = connection

  await createSchema({ connection, schema })

  const MIGRATION_CORRUPTION = 'The migration directory is corrupt, the following files are missing'

  // When the rollback fails, drop the schema and re-create it
  // Usually it's because there are missing knex migration files due to branch changing
  // But if the error comes from a bad migration rollback function (.down() in knex migration files)
  // Log the error to fix it
  try {
    await knex.migrate.rollback({
      schemaName: schema,
      directory: path.join(__dirname, '../migrations/knex')
    })
  } catch (err) {
    if (!err.message.startsWith(MIGRATION_CORRUPTION)) {
      console.log(`Rollback schema ${schema} failed`, err)
    }

    await drop({ connection, cascade: true })
    await createSchema({ connection, schema })
  }

  await knex.destroy()
}

async function drop ({ connection, cascade }) {
  const { schema } = connection

  await dropSchema({ connection, schema, cascade })
}

module.exports = {
  init,
  reset,
  drop,
  createFixture,
  syncInternalAvailability
}
