// https://docs.timescale.com/latest/using-timescaledb/hypertables
function createHypertable (schema, table, { column = 'createdTimestamp', migrateData = false } = {}) {
  return `
    SELECT public.create_hypertable(
      '${schema}."${table}"', '${column}'
      ${migrateData ? ', migrate_data => true' : ''}
    )
  `
}

module.exports = {
  createHypertable,
}
