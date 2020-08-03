// Copy this file to the root of stelace-core project

// Objective: migrate platforms from PostgreSQL to TimescaleDB

require('dotenv').config()
require('./src/secure-env').config() // load credentials from AWS SSM

const _ = require('lodash')
const script = require('commander')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const debug = require('debug')('stelace:scripts')

const { getConnection } = require('./src/models')
const { getKnex } = require('./src/models/util')
const { getPlatforms, setPlatformEnvData } = require('./src/redis')

const log = console.log
let errors = 0

const timescaleDBConnection = process.env.TIMESCALE_HOST &&
  process.env.TIMESCALE_PORT &&
  process.env.TIMESCALE_DB &&
  process.env.TIMESCALE_USER &&
  process.env.TIMESCALE_PASSWORD

if (!timescaleDBConnection) {
  throw new Error('Missing TimescaleDB connection')
}

script
  .option('-d, --drop', 'Drop TimescaleDB schema if exists.')
  .option('-u, --update', 'Update database connection into Redis. WARNING: it’s irreversible!')
  .parse(process.argv)

const dropSchema = script.drop === true
const updateConnection = script.update === true

async function run () {
  const platformIds = await getPlatforms()
  const lastPlatformId = await _.maxBy(platformIds, _.parseInt)

  const envs = ['test', 'live']

  log('Running…')
  log('Last platformId', lastPlatformId, '\n')
  for (const env of envs) {
    for (const platformId of platformIds) {
      try {
        if (updateConnection) {
          log('Updating platform', platformId, env, 'database connection')
          await updateDBConnection({ platformId, env })
        } else {
          log('Migrating platform', platformId, env)
          await migrateToTimescaleDB({ platformId, env })
        }
      } catch (err) {
        errors++
        log('error', platformId, env)
        log(err.message)
        log(err.stack)
      }
    }
  }

  log('')
  if (errors === 0) log('Success')
  else log(`${errors} error(s).`)

  process.exit(0)
}

async function migrateToTimescaleDB ({ platformId, env }) {
  const schema = await getSchema({ platformId, env })
  const pgKnex = await getPostgresKnex({ platformId, env })
  const timescaleKnex = await getTimescaleKnex({ platformId, env })
  const pgConnection = await getPostgresConnection({ platformId, env })
  const timescaleConnection = await getTimescaleConnection({ platformId, env })

  try {
    await addDateColumn({ knex: pgKnex, schema })
    await dump({ pgConnection })
    await restore({ timescaleConnection, knex: timescaleKnex })
    await createHyperTables({ knex: timescaleKnex, schema })
    await addIndexes({ knex: timescaleKnex, schema })
    await addCompressionPolicies({ knex: timescaleKnex, schema })
    await createContinuousAggregates({ knex: timescaleKnex, schema })
    await refreshKnexMigrations({ knex: timescaleKnex, schema })
  } finally {
    await removeDumpFiles(schema)
  }
}

async function updateDBConnection ({ platformId, env }) {
  const schema = await getSchema({ platformId, env })
  const timescaleKnex = await getTimescaleKnex({ platformId, env })
  const timescaleConnection = await getTimescaleConnection({ platformId, env })

  const existingSchema = await existsSchema({ knex: timescaleKnex, schema })
  if (!existingSchema) throw new Error(`Platform ${platformId} ${env} not migrated yet`)

  await setPlatformEnvData(platformId, env, 'postgresql', timescaleConnection)
}

async function getPostgresConnection ({ platformId, env }) {
  const { connection } = await getConnection({ platformId, env })

  const missingConnection = !connection || ['host', 'port', 'database'].some(p => !connection[p])
  if (missingConnection) return null
  else return connection
}

async function getTimescaleConnection ({ platformId, env }) {
  const pgConnection = await getPostgresConnection({ platformId, env })
  if (!pgConnection) return

  return {
    ...pgConnection,
    host: process.env.TIMESCALE_HOST,
    user: process.env.TIMESCALE_USER,
    password: process.env.TIMESCALE_PASSWORD,
    database: process.env.TIMESCALE_DB,
    port: process.env.TIMESCALE_PORT
  }
}

async function getSchema ({ platformId, env }) {
  const pgConnection = await getPostgresConnection({ platformId, env })
  return pgConnection.schema
}

function getDumpFilenames (schema) {
  return {
    preData: `${schema}_pre-data.dump`,
    data: `${schema}_data.dump`,
  }
}

async function getPostgresKnex ({ platformId, env }) {
  const pgConnection = await getPostgresConnection({ platformId, env })
  return getKnex(pgConnection)
}

async function getTimescaleKnex ({ platformId, env }) {
  const pgConnection = await getTimescaleConnection({ platformId, env })
  return getKnex(pgConnection)
}

async function addDateColumn ({ knex, schema }) {
  debug('Creating date columns')

  // Using `knex.raw` with transaction
  // https://github.com/knex/knex/issues/232#issuecomment-249601819
  const addColumn = (table) => `
    ALTER TABLE ${schema}."${table}"
    ADD COLUMN IF NOT EXISTS "createdTimestamp" timestamp(3) with time zone
  `

  await knex.transaction(async (trx) => {
    await trx.raw(addColumn('event'))
    await trx.raw(addColumn('webhookLog'))
    await trx.raw(addColumn('workflowLog'))
  })

  debug('Filling date columns')

  const updateColumn = (table) => `
    UPDATE ${schema}."${table}"
    SET "createdTimestamp" = "${table}"."createdDate"::timestamptz
    WHERE "createdTimestamp" IS NULL
  `

  await knex.transaction(async (trx) => {
    await trx.raw(updateColumn('event'))
    await trx.raw(updateColumn('webhookLog'))
    await trx.raw(updateColumn('workflowLog'))
  })
}

// https://gist.github.com/vielhuber/96eefdb3aff327bdf8230d753aaee1e1
// pg_dump and pg_restore with password

async function dump ({ pgConnection }) {
  const {
    host,
    user,
    password,
    database,
    port,
    schema,
  } = pgConnection

  debug('Dumping database')

  const filenames = getDumpFilenames(schema)

  execMultiLines(`
    PGPASSWORD="${password}"
    pg_dump --schema-only --section=pre-data
    -h ${host} -p ${port} -U ${user} -n '${schema}' -Fc ${database}
    > ${filenames.preData}
  `)
  execMultiLines(`
    PGPASSWORD="${password}"
    pg_dump --data-only
    -h ${host} -p ${port} -U ${user} -n '${schema}' -Fc ${database}
    > ${filenames.data}
  `)
}

async function restore ({ timescaleConnection, knex }) {
  const {
    host,
    user,
    password,
    database,
    port,
    schema,
  } = timescaleConnection

  debug('Restoring database')

  if (dropSchema) {
    const existingSchema = await existsSchema({ knex: knex, schema })
    if (existingSchema) {
      await removeContinuousAggregates({ knex, schema })
    }

    await knex.raw(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
  }

  const filenames = getDumpFilenames(schema)

  execMultiLines(`
    PGPASSWORD="${password}"
    pg_restore
    -h ${host} -p ${port} --no-owner --role=${user} -d ${database} -U ${user}
    ${filenames.preData}
  `)
  execMultiLines(`
    PGPASSWORD="${password}"
    pg_restore
    -h ${host} -p ${port} --no-owner --role=${user} -d ${database} -U ${user}
    ${filenames.data}
  `)
}

async function existsSchema ({ knex, schema }) {
  const { rowCount } = await knex.raw(`SELECT schema_name FROM information_schema.schemata WHERE schema_name = '${schema}'`)
  return rowCount !== 0
}

function removeDumpFiles (schema) {
  const filenames = getDumpFilenames(schema)

  debug('Removing temporary dump files')

  fs.unlinkSync(path.join(__dirname, filenames.preData))
  fs.unlinkSync(path.join(__dirname, filenames.data))
}

async function createHyperTables ({ knex, schema }) {
  debug('Creating hypertables')

  const createHypertable = (table) => `
    SELECT create_hypertable('${schema}."${table}"', 'createdTimestamp', migrate_data => true)
  `

  await knex.transaction(async (trx) => {
    await trx.raw(createHypertable('event'))
    await trx.raw(createHypertable('webhookLog'))
    await trx.raw(createHypertable('workflowLog'))
  })
}

async function addCompressionPolicies ({ knex, schema }) {
  debug('Adding compression policies')

  const addCompressionPolicy = (table, segmentBy, duration = '31 days') => `
    ALTER TABLE ${schema}."${table}" SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = '"${segmentBy}"'
    );

    SELECT add_compress_chunks_policy('${schema}."${table}"', INTERVAL '${duration}');
  `

  await knex.transaction(async (trx) => {
    await trx.raw(addCompressionPolicy('event', 'objectId'))
    await trx.raw(addCompressionPolicy('webhookLog', 'webhookId'))
    await trx.raw(addCompressionPolicy('workflowLog', 'workflowId'))
  })
}

async function createContinuousAggregates ({ knex, schema }) {
  debug('Creating continuous aggregates')

  const createContinuousAggregate = ({
    viewName,
    schema,
    table,
    interval,
    timeBucketLabel,
    secondaryColumn,
    column = 'createdTimestamp',
    refreshLag = '1 day',
    refreshInterval = '1 day',
    ignoreInvalidationOlderThan = '90 day',
  } = {}) => `
    CREATE OR REPLACE VIEW "${schema}"."${viewName}" WITH (timescaledb.continuous)
    AS
    SELECT public.time_bucket(INTERVAL '${interval}', "${column}") as ${timeBucketLabel}, COUNT(*) as count
    ${secondaryColumn ? `, ${secondaryColumn}` : ''}
    FROM ${schema}."${table}"
    GROUP BY ${timeBucketLabel}${secondaryColumn ? `, ${secondaryColumn}` : ''};

    ALTER VIEW "${schema}"."${viewName}" SET (
      timescaledb.refresh_lag = '${refreshLag}',
      timescaledb.refresh_interval = '${refreshInterval}',
      timescaledb.ignore_invalidation_older_than = '${ignoreInvalidationOlderThan}'
    )
  `

  await knex.transaction(async (trx) => {
    await trx.raw(createContinuousAggregate({
      viewName: 'event_hourly',
      schema,
      table: 'event',
      interval: '1 hour',
      timeBucketLabel: 'hour',
      refreshLag: '1 hour',
      refreshInterval: '1 hour',
      secondaryColumn: 'type',
    }))
    await trx.raw(createContinuousAggregate({
      viewName: 'event_daily',
      schema,
      table: 'event',
      interval: '1 day',
      timeBucketLabel: 'day',
      refreshLag: '1 day',
      refreshInterval: '1 day',
      secondaryColumn: 'type',
    }))
    await trx.raw(createContinuousAggregate({
      viewName: 'event_monthly',
      schema,
      table: 'event',
      interval: '30 day',
      timeBucketLabel: 'month',
      refreshLag: '1 day',
      refreshInterval: '1 day',
      secondaryColumn: 'type',
    }))

    await trx.raw(createContinuousAggregate({
      viewName: 'webhookLog_hourly',
      schema,
      table: 'webhookLog',
      interval: '1 hour',
      timeBucketLabel: 'hour',
      refreshLag: '1 hour',
      refreshInterval: '1 hour',
    }))
    await trx.raw(createContinuousAggregate({
      viewName: 'webhookLog_daily',
      schema,
      table: 'webhookLog',
      interval: '1 day',
      timeBucketLabel: 'day',
      refreshLag: '1 day',
      refreshInterval: '1 day',
    }))
    await trx.raw(createContinuousAggregate({
      viewName: 'webhookLog_monthly',
      schema,
      table: 'webhookLog',
      interval: '30 day',
      timeBucketLabel: 'month',
      refreshLag: '1 day',
      refreshInterval: '1 day',
    }))

    await trx.raw(createContinuousAggregate({
      viewName: 'workflowLog_hourly',
      schema,
      table: 'workflowLog',
      interval: '1 hour',
      timeBucketLabel: 'hour',
      refreshLag: '1 hour',
      refreshInterval: '1 hour',
      secondaryColumn: 'type',
    }))
    await trx.raw(createContinuousAggregate({
      viewName: 'workflowLog_daily',
      schema,
      table: 'workflowLog',
      interval: '1 day',
      timeBucketLabel: 'day',
      refreshLag: '1 day',
      refreshInterval: '1 day',
      secondaryColumn: 'type',
    }))
    await trx.raw(createContinuousAggregate({
      viewName: 'workflowLog_monthly',
      schema,
      table: 'workflowLog',
      interval: '30 day',
      timeBucketLabel: 'month',
      refreshLag: '1 day',
      refreshInterval: '1 day',
      secondaryColumn: 'type',
    }))
  })
}

async function removeContinuousAggregates ({ knex, schema }) {
  debug('Removing continuous aggregates')

  const removeContinuousAggregate = (viewName, schema) => `
    DROP VIEW IF EXISTS "${schema}"."${viewName}" CASCADE
  `

  await knex.transaction(async (trx) => {
    await trx.raw(removeContinuousAggregate('event_hourly', schema))
    await trx.raw(removeContinuousAggregate('event_daily', schema))
    await trx.raw(removeContinuousAggregate('event_monthly', schema))

    await trx.raw(removeContinuousAggregate('webhookLog_hourly', schema))
    await trx.raw(removeContinuousAggregate('webhookLog_daily', schema))
    await trx.raw(removeContinuousAggregate('webhookLog_monthly', schema))

    await trx.raw(removeContinuousAggregate('workflowLog_hourly', schema))
    await trx.raw(removeContinuousAggregate('workflowLog_daily', schema))
    await trx.raw(removeContinuousAggregate('workflowLog_monthly', schema))
  })
}

async function addIndexes ({ knex, schema }) {
  debug('Adding indexes')

  await knex.transaction(async (trx) => {
    await trx.schema.withSchema(schema).alterTable('apiKey', table => {
      table.string('id').primary().alter()
      table.index(['createdDate', 'id'], 'apiKey_createdDate_id_index')
      table.index(['updatedDate', 'id'], 'apiKey_updatedDate_id_index')
      table.unique('key', 'apiKey_key_unique')
    })

    await trx.schema.withSchema(schema).alterTable('assessment', table => {
      table.string('id').primary().alter()
      table.index('assetId', 'assessment_assetId_index')
      table.index('ownerId', 'assessment_ownerId_index')
      table.index('takerId', 'assessment_takerId_index')
      table.index('emitterId', 'assessment_emitterId_index')
      table.index('receiverId', 'assessment_receiverId_index')
    })

    await trx.schema.withSchema(schema).alterTable('asset', table => {
      table.string('id').primary().alter()
      table.index(['createdDate', 'id'], 'asset_createdDate_id_index')
      table.index(['updatedDate', 'id'], 'asset_updatedDate_id_index')
      table.index('ownerId', 'asset_ownerId_index')
      table.index('categoryId', 'asset_categoryId_index')
      table.index('assetTypeId', 'asset_assetTypeId_index')
      table.index('customAttributes', 'asset_customAttributes_gin_index', 'GIN')
    })

    await trx.schema.withSchema(schema).alterTable('assetType', table => {
      table.string('id').primary().alter()
      table.index(['createdDate', 'id'], 'assetType_createdDate_id_index')
      table.index(['updatedDate', 'id'], 'assetType_updatedDate_id_index')
    })

    await trx.schema.withSchema(schema).alterTable('authMean', table => {
      table.string('id').primary().alter()
      table.index('identifier', 'authMean_identifier_index')
      table.index('userId', 'authMean_userId_index')
    })

    await trx.schema.withSchema(schema).alterTable('authToken', table => {
      table.string('id').primary().alter()
      table.unique('value', 'authToken_value_unique')
      table.index('userId', 'authToken_userId_index')
    })

    await trx.schema.withSchema(schema).alterTable('availability', table => {
      table.string('id').primary().alter()
      table.index(['createdDate', 'id'], 'availability_createdDate_id_index')
      table.index(['updatedDate', 'id'], 'availability_updatedDate_id_index')
      table.index('assetId', 'availability_assetId_index')
    })

    await trx.schema.withSchema(schema).alterTable('category', table => {
      table.string('id').primary().alter()
      table.index(['createdDate', 'id'], 'category_createdDate_id_index')
      table.index(['updatedDate', 'id'], 'category_updatedDate_id_index')
    })

    await trx.schema.withSchema(schema).alterTable('config', table => {
      table.string('id').primary().alter()
      table.unique('access', 'config_access_unique')
    })

    await trx.schema.withSchema(schema).alterTable('customAttribute', table => {
      table.string('id').primary().alter()
      table.index(['createdDate', 'id'], 'customAttribute_createdDate_id_index')
      table.index(['updatedDate', 'id'], 'customAttribute_updatedDate_id_index')
      table.unique('name', 'customAttribute_name_unique')
    })

    await trx.schema.withSchema(schema).alterTable('document', table => {
      table.string('id').primary().alter()
      table.index(['createdDate', 'id'], 'document_createdDate_id_index')
      table.index(['updatedDate', 'id'], 'document_updatedDate_id_index')
      table.index('type', 'document_type_index')
      table.index('authorId', 'document_authorId_index')
      table.index('targetId', 'document_targetId_index')
      table.index('data', 'document_data_gin_index', 'GIN')
    })

    await trx.schema.withSchema(schema).alterTable('entry', table => {
      table.string('id').primary().alter()
      table.index(['createdDate', 'id'], 'entry_createdDate_id_index')
      table.index(['updatedDate', 'id'], 'entry_updatedDate_id_index')
      table.index('collection', 'entry_collection_index')
      table.index('name', 'entry_name_index')
      table.unique(['locale', 'name'], 'entry_locale_name_unique')
    })

    await trx.schema.withSchema(schema).alterTable('event', table => {
      table.index('id', 'event_id_index') // no longer primary key
      table.index(['createdTimestamp', 'id'], 'event_createdTimestamp_id_index')
      table.index('type', 'event_type_index')
      table.index('objectId', 'event_objectId_index')
      table.index('objectType', 'event_objectType_index')
      table.index('object', 'event_object_gin_index', 'GIN')
      table.index('parentId', 'event_parentId_index')
      table.index('emitterId', 'event_emitterId_index')
      table.index('metadata', 'event_metadata_gin_index', 'GIN')
    })

    await trx.schema.withSchema(schema).alterTable('internalAvailability', table => {
      table.string('id').primary().alter()
      table.index('assetId', 'internalAvailability_asset_index')
      table.index('transactionId', 'internalAvailability_transactionId_index')
      table.index(['assetId', 'datesRange'], 'internalAvailability_assetId_datesRange_index')
    })

    await trx.schema.withSchema(schema).alterTable('message', table => {
      table.string('id').primary().alter()
      table.index(['createdDate', 'id'], 'message_createdDate_id_index')
      table.index(['updatedDate', 'id'], 'message_updatedDate_id_index')
      table.index('conversationId', 'message_conversationId_index')
      table.index('topicId', 'message_topicId_index')
      table.index('senderId', 'message_senderId_index')
      table.index('receiverId', 'message_receiverId_index')
    })

    await trx.schema.withSchema(schema).alterTable('order', table => {
      table.string('id').primary().alter()
      table.index('lines', 'order_lines_gin_index', 'GIN')
      table.index('moves', 'order_moves_gin_index', 'GIN')
      table.index('payerId', 'order_payerId_index')
    })

    await trx.schema.withSchema(schema).alterTable('role', table => {
      table.string('id').primary().alter()
      table.index(['createdDate', 'id'], 'role_createdDate_id_index')
      table.index(['updatedDate', 'id'], 'role_updatedDate_id_index')
      table.index('value', 'role_value_index')
    })

    await trx.schema.withSchema(schema).alterTable('task', table => {
      table.string('id').primary().alter()
      table.index(['createdDate', 'id'], 'task_createdDate_id_index')
      table.index(['updatedDate', 'id'], 'task_updatedDate_id_index')
      table.index('eventType', 'task_eventType_index')
      table.index('eventObjectId', 'task_eventObjectId_index')
    })

    await trx.schema.withSchema(schema).alterTable('transaction', table => {
      table.string('id').primary().alter()
      table.index(['createdDate', 'id'], 'transaction_createdDate_id_index')
      table.index(['updatedDate', 'id'], 'transaction_updatedDate_id_index')
      table.index('assetTypeId', 'transaction_assetTypeId_index')
      table.index('ownerId', 'transaction_ownerId_index')
      table.index('takerId', 'transaction_takerId_index')
      table.index('assetId', 'transaction_assetId_index')
    })

    await trx.schema.withSchema(schema).alterTable('user', table => {
      table.string('id').primary().alter()
      table.index(['createdDate', 'id'], 'user_createdDate_id_index')
      table.index(['updatedDate', 'id'], 'user_updatedDate_id_index')
      table.unique('username', 'user_username_unique')
      table.index('organizations', 'user_organizations_gin_index', 'GIN')
      table.index('orgOwnerId', 'user_orgOwnerId_index')
      table.index('roles', 'user_roles_gin_index', 'GIN')
    })

    await trx.schema.withSchema(schema).alterTable('webhook', table => {
      table.string('id').primary().alter()
      table.index(['createdDate', 'id'], 'webhook_createdDate_id_index')
      table.index(['updatedDate', 'id'], 'webhook_updatedDate_id_index')
      table.index('event', 'webhook_event_index')
    })

    await trx.schema.withSchema(schema).alterTable('webhookLog', table => {
      table.index('id', 'webhookLog_id_index') // no longer primary key
      table.index(['createdTimestamp', 'id'], 'webhookLog_createdTimestamp_id_index')
      table.index('status', 'webhookLog_status_index')
      table.index('webhookId', 'webhookLog_webhookId_index')
      table.index('eventId', 'webhookLog_eventId_index')
    })

    await trx.schema.withSchema(schema).alterTable('workflow', table => {
      table.string('id').primary().alter()
      table.index(['createdDate', 'id'], 'workflow_createdDate_id_index')
      table.index(['updatedDate', 'id'], 'workflow_updatedDate_id_index')
      table.index('event', 'workflow_event_index')
    })

    await trx.schema.withSchema(schema).alterTable('workflowLog', table => {
      table.index('id', 'workflowLog_id_index') // no longer primary key
      table.index(['createdTimestamp', 'id'], 'workflowLog_createdTimestamp_id_index')
      table.index('type', 'workflowLog_type_index')
      table.index('workflowId', 'workflowLog_workflowId_index')
      table.index('eventId', 'workflowLog_eventId_index')
      table.index('runId', 'workflowLog_runId_index')
    })
  })
}

async function refreshKnexMigrations ({ knex, schema }) {
  debug('Refreshing knex migrations table')

  const refreshKnexMigration = (table, name) => `
    DELETE FROM ${schema}."${table}";

    INSERT INTO ${schema}."${table}" (name, batch, migration_time)
    VALUES ('${name}', 1, NOW())
  `

  await knex.raw(refreshKnexMigration('knex_migrations', '20200713111032_init.js'))
}

function minifyMultiLines (str) {
  return str
    .split('\n')
    .map(line => line.trim())
    .filter(line => !!line)
    .join(' ')
}

function execMultiLines (str) {
  execSync(minifyMultiLines(str))
}

run().catch(log)
