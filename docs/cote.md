# Côte microservices

Côte.js is very powerful and we’re far from leveraging its true potential.

Here are some pieces of advice after experimenting over last few months.

Please have a look at official [docs](https://github.com/dashersw/cote) first.

## Should I use Requester/Responder or Publisher/Subscriber?

Requester speaks to only one Responder at a time, in round-robin fashion.

Only use Publisher if you need _fan out_ behavior to notify an event to multiple Subscribers.

Publisher & subscriber also allow to access côte `this.event` in callback, so we can use EventEmitter2 wildcards and custom logic that can depend on event name like "namespace::service::action".

_Note_: to be able to access `this.event` in subscriber, you can’t use an anonymous function.

```js
subscriber.on('eventCreated', async ({ platformId, env, event } = {}) => {
  debug(this.event) // undefined
})
// Better
subscriber.on('eventCreated', async function ({ platformId, env, event } = {}) {
  debug(this.event) // d251a048-550a-4494-994a-1d2e3975941c::eventCreated
})
// Wildcard works too
subscriber.on('event**', async function ({ platformId, env, event } = {}) {
  debug(this.event) // d251a048-550a-4494-994a-1d2e3975941c::eventCreated
})
```

## How to separate concerns?

You have namespace, key and undocumented [requester __subset](https://github.com/dashersw/cote/pull/150) to target groups of components.

### Namespace

We are currently setting `namespace` (or `key` for Signal service) to a random UUID per instance, mostly for testing environment.

This could change when we were able to use broadcast networking. Unfortunately most cloud providers don’t enable broadcast without using specific plugins.

Broadcast networking would make côte even more ways as we could distribute and scale microservices across the network.

### Key

Côte `key` is mostly used to separate services such as Asset and Search, except for Signal service where it replaces `namespace` to play well with socket.io.
