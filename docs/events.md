# Event Concept

Events represent a change of state for an API object.

They enable to keep track of object history, notify external systems with Webhooks and run automated logic with Workflows and Tasks.

## List of objects

Some objects aren’t tracked by Events either, generally because they don’t really matter to the platform business (e.g. authTokens)

Here’s the list of objects emitting Events:

- asset type
- availability
- asset
- category
- custom attribute
- search
- assessment
- transaction
- user
- password
- api key

## Skipping events

When an object is tracked by Events, any change should emit a new Event.

Here is the list of current exceptions introduced to reduce noise:

- When an asset is removed, do not emit events when removing its availabilities.
