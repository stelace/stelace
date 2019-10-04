# SQL queries

## Knex query builder

You may come across complex queries in source code relying on [Objection.js](
  https://vincit.github.io/objection.js
)/[Knex](
  http://knexjs.org
) query builder to tap the full potential of PostgreSQL jsonb type.

```js
const queryBuilder = Document.query()

// data jsonb column must be a superset of object
queryBuilder.whereRaw('?? @> ?::jsonb', ['data', object])
```

### Debugging

Knex [`debug`](http://knexjs.org/#Builder-debug) method can be really useful to see how this translate to SQL.

```js
queryBuilder
  .whereRaw('?? @> ?::jsonb', ['data', object])
  .debug() // can be very useful to develop and debug
```
