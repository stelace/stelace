# Testing

Tests are running in parallel thanks to [AVA](https://github.com/avajs/ava) test runner.

Each test `*.spec.js` integration suite starts a server instance with its own PostgreSQL schema and ElasticSearch index.

## Performance and failing tests

Integration tests are quite demanding and CPU-intensive. You probably need 4 CPU cores or more to run them in good conditions and avoid false negatives.

When running `yarn test`, two CPU cores are spared using `ava --c $(node -p 'Math.max(os.cpus().length - 2, 1)')` to avoid overflowing your machine so you can run tests as fast as possible.

### Workflow tests

Some Workflow tests specifically have tendency to fail when your machine gets too busy, despite existing delays added to mitigate this risk.

You can run a single test suite which is far easier to handle for your machine.
This way you can ensure tests are simply failing due to your strained machine resources:

```sh
yarn test test/integration/api/workflow.spec.js
```

This can also help to run single tests much faster using `match="test name"` AVA option.

## Custom attributes and re-indexing

A custom attribute creation can trigger a ElasticSearch reindexing process. This will happen when a custom attribute with the same name but a different type from a previously deleted one is about to be created.

In fact, ElasticSearch does not allow to update mappings so we need to create an index with the new mapping and copy existing data to this new index.

Testing custom attributes can be tricky as pending indexing process can trigger errors for creation operations.

**A simple solution is to avoid creating a custom attribute with the same name in different tests.**
