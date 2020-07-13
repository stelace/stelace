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

module.exports = {
  createHypertable,
  addCompressionPolicy,
}
