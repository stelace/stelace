const { retentionLogDuration } = require('../../src/util/timeSeries')

// https://docs.timescale.com/latest/using-timescaledb/hypertables
function createHypertable (schema, table, { column = 'createdTimestamp', migrateData = false } = {}) {
  return `
    SELECT public.create_hypertable(
      '${schema}."${table}"', '${column}'
      ${migrateData ? ', migrate_data => true' : ''}
    )
  `
}

// https://docs.timescale.com/latest/using-timescaledb/compression
function addCompressionPolicy (schema, table, segmentBy, duration = retentionLogDuration) {
  return `
    ALTER TABLE ${schema}."${table}" SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = '"${segmentBy}"'
    );

    SELECT public.add_compress_chunks_policy('"${schema}"."${table}"', INTERVAL '${duration}')
  `
}

// https://docs.timescale.com/v1.3/using-timescaledb/continuous-aggregates
function createContinuousAggregate ({
  viewName,
  schema,
  table,
  interval,
  timeBucketLabel,
  column = 'createdTimestamp',
  secondaryColumn
} = {}) {
  return `
    CREATE OR REPLACE VIEW ${schema}.${viewName} WITH (timescaledb.continuous)
    AS
    SELECT public.time_bucket(INTERVAL '${interval}', "${column}") as ${timeBucketLabel}, COUNT(*) as count
    ${secondaryColumn ? `, ${secondaryColumn}` : ''}
    FROM ${schema}."${table}"
    GROUP BY ${timeBucketLabel}${secondaryColumn ? `, ${secondaryColumn}` : ''}
  `
}

function removeContinuousAggregate ({ viewName, schema }) {
  return `
    DROP VIEW IF EXISTS "${schema}"."${viewName}" CASCADE
  `
}

module.exports = {
  createHypertable,
  addCompressionPolicy,
  createContinuousAggregate,
  removeContinuousAggregate,
}
