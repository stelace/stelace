# Concurrency

As a webserver, Stelace API can handle several requests on the same resource at the same time.

It must deal with these concurrent requests properly to keep and update data in expected ways.

In particular, we want have to achieve [_Isolation_](https://en.wikipedia.org/wiki/ACID_(computer_science)#Isolation) to prevent overwrites with concurrent requests.

Stelace API relies on PostgreSQL as main database, that can handle concurrency issues very well.

Let’s explore how.

## Use cases

### Number increment

When you need to increment a number in the database, the following anti-pattern is often the first thing coming to mind.

Bad way:

```js
const workflow = await Workflow.query().findById('wfw_SEIfQps1I3a1gJYz2I3a') // [1]

// do some logic

await Workflow.query().patchAndFetchById(workflow.id, { // [2]
  stats: {
    nbTimesRun: (workflow.stats.nbTimesRun || 0) + 1
  }
})
```

Explanation:
Let’s suppose there are two requests that trigger the previous code at the same time.

`nbTimesRun` is 3 at the beginning.

1. Request 1 fetches the workflow [1]
2. Request 2 fetches the workflow [1]
3. Request 1 updates `nbTimesRun` from 3 to 4 [2]
4. Request 2 updates `nbTimesRun` from 3 to 4 [2]

We’re expecting `nbTimesRun` to be equal to 5 after these two runs. Instead we’re getting 4.

We’ve just lost some data.

Better way:

```js
const workflow = await Workflow.query().findById('wfw_SEIfQps1I3a1gJYz2I3a') // [1]

// do some logic

await Workflow.query().patchAndFetchById(workflow.id, { // [2]
  stats: knex.raw(
    `jsonb_set(stats, '{nbTimesRun}', (COALESCE(stats->>'nbTimesRun','0')::int + 1)::text::jsonb)`
  )
})
```

Explanation:

1. Request 1 fetches the workflow [1]
2. Request 2 fetches the workflow [1]
3. Request 1 updates `nbTimesRun` from the current number and add 1 to it (3 + 1 => 4) [2]
4. Request 2 updates `nbTimesRun` from the current number and add 1 to it (4 + 1 => 5) [2]

With this way, we get the right 5 value at the end.

**Whenever you need to edit some DB row attribute and there is some atomic way to proceed in PostgreSQL, use it.**

Raw JSONB queries as above are more involved than knex/objection helpers like [increment](https://knexjs.org/#Builder-increment) available on DB columns with other data types. Don’t hesitate to look for help if needed after reading what follows.


### JSONB array concatenation

Bad way:

```js
const newStatusHistoryStep = { status: 'new status', date: new Date().toISOString() }

await Transaction.query().patchAndFetchById(transaction.id, {
  statusHistory: [newStatusHistoryStep].concat(transaction.statusHistory)
})
```

Use the native PostgreSQL concatenation operator `||`.

Better way:

```js
const newStatusHistoryStep = { status: 'new status', date: new Date().toISOString() }

await Transaction.query().patchAndFetchById(transaction.id, {
  statusHistory: raw(`?::jsonb || "statusHistory"`, [
    JSON.stringify([newStatusHistoryStep])
  ])
})
```


### Partial updates

In Stelace API, we use PATCH to enable partial updates so that whole objects don’t have to be provided.

Only values passed explicitly should change, unless stated otherwise in the docs when we apply built-in logic as in transactions or orders.

We use [objection.js](https://vincit.github.io/objection.js/api/query-builder/mutate-methods.html#patch) patch(AndFetch(ById)) helper to make this easy.

Example:

Request:

```js
// PATCH /users/usr_1
{
  firstname: 'Foo'
}
```

Server logic:

```js
const user = await User.query().findById('usr_1')

// perform some logic

// Bad way
const updateAttrs = Object.assign({}, user, { firstname: 'Foo' })
// user data may be concurrently changed by other requests
await User.query().patchById('usr_1', updateAttrs)

// Better way
const updateAttrs = { firstname: 'Foo' }
await User.query().patchById('usr_1', updateAttrs)
```

#### Nested updates

Things get trickier when applying partial updates _inside_ JSON columns since Objection `patch` methods can’t do the job.

Once again we use PostgreSQL to safely perform updates with potential concurrency on JSONB columns such as `metadata`, `platformData` or `customAttributes`.

Please have a look at `stl_jsonb_deep_merge` PostgreSQL function with a quick search in current repository.

Extensive description is provided in migration file creating the function.

An [SQLfiddle](http://sqlfiddle.com/#!17/00c96/1) was also created to understand what happens under the hood.


### Rows locking

Sometimes, it’s not possible to perform simple atomic updates because multi-step logic and database calls are required.

Simplified example based on order service:

Bad way:

```js
const order = await Order.query().findById('ord_1') // [1]

const newOrderLine = {
  senderAmount: 1000,
  ...
}
order.lines.push(newOrderLine)

const amountDue = order.lines.reduce((sum, line) => sum + line.senderAmount, 0) // [2]

await Order.query().patchAndFetchById('ord_1', { amountDue }) // [3]
```

Explanation:
Let’s suppose there is no order line when starting the process, and that two concurrent requests create a new order line with `senderAmount === 1000`.

1. Request 1 fetches the order [1]
2. Same for request 2 [1]
3. Request 1 computes the amount due based on all lines amount (`amountDue === 1000`) [2]
4. Same for request 2 [2]
5. Request 1 saves the correct value `amountDue === 1000` [3]
6. Request 2 saves the incorrect value `amountDue === 1000` instead of `2000`) [3]

It’s quite difficult to perform a concatenation in database and retrieve the sum.

Here we can lock the rows that we’re using so that other requests join a waiting queue and must wait until the current request is completed.

We use SQL `SELECT` statement with a lock operator to lock individual rows.

Here are the row-level locks:

- `for update`
- `for no key update`
- `for share`
- `for key share`

Consult the [official documentation](https://www.postgresql.org/docs/9.4/explicit-locking.html#LOCKING-ROWS) for detailed explanations.

*Note: Currently, only `SELECT FOR UPDATE` [(`.forUpdate()`)](https://knexjs.org/#Builder-forUpdate) and `SELECT FOR SHARE` [(`.forShare()`)](https://knexjs.org/#Builder-forShare) are implemented in Knex.js. Please use `raw` if you need the other operators.*

Let's rewrite the code above to handle concurrency.

Better way:

```js
const { transaction } = require('objection')

const knex = Order.knex()

await transaction(knex, async (trx) => {
  const order = await Order.query(trx).forUpdate()
    .findById('ord_1')

  const newOrderLine = {
    senderAmount: 1000,
    ...
  }
  order.lines.push(newOrderLine)

  const amountDue = order.lines.reduce((sum, line) => sum + line.senderAmount, 0)

  await Order.query(trx).patchAndFetchById('ord_1', { amountDue })
})
```

This time, the first SQL query that fetches the Order object will lock the row.
Other SQL queries using this specific Order row will have to wait until the first SQL query completes.

**Warning: Only specific rows must be locked, as opposed to whole table. Locking too much and/or for too long can lead to slow responses because other queries wait for lock release. Worse, it can lead to deadlocks if two queries need the lock release of each other. As a last resort, PostgreSQL can handle some of deadlocks situations by killing one of the queries.**

### Object creation

In general, row object creation won’t cause any concurrent issue.
Should this happen, please follow the previous pieces of advice.

## Related links for more details

- https://www.postgresql.org/docs/10/explicit-locking.html#LOCKING-ROWS
- https://www.2ndquadrant.com/en/blog/postgresql-anti-patterns-read-modify-write-cycles
- http://shiroyasha.io/selecting-for-share-and-update-in-postgresql.html
