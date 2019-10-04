
const table = 'user'
const newColumnName = 'orgOwnerId'

exports.up = async knex => {
  const exists = await knex.schema.hasColumn(table, newColumnName)
  if (exists) return
  await knex.schema.alterTable(table, async t => {
    t.string(newColumnName)
    t.index(newColumnName)
  })
}

exports.down = async knex => {
  const exists = await knex.schema.hasColumn(table, newColumnName)
  if (!exists) return
  await knex.schema.alterTable(table, async t => {
    t.dropColumn(newColumnName)
  })
}
