const table = 'order'
const oldColumnName = 'senderId'
const newColumnName = 'payerId'

exports.up = async knex => {
  const exists = await knex.schema.hasColumn(table, oldColumnName)
  if (!exists) return
  await knex.schema.alterTable(table, async t => {
    t.renameColumn(oldColumnName, newColumnName)
  })
}

exports.down = async knex => {
  const exists = await knex.schema.hasColumn(table, newColumnName)
  if (!exists) return
  await knex.schema.alterTable(table, async t => {
    t.renameColumn(newColumnName, oldColumnName)
  })
}
