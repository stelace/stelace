# Testing

## Recommendations

### Custom attributes

A custom attribute creation can trigger a Elasticsearch reindexing process. This will happen when a custom attribute with the same name but a different type from a previously deleted one is about to be created.

In fact, Elasticsearch does not allow to update mappings so we need to create an index with the new mapping and copy existing data into this new index.

Testing custom attributes can be tricky as the indexing process can trigger error for creation operations.

**To counter this, a solution is not to create a custom attribute with the same name as another test.**
