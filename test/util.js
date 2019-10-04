const { computeDate } = require('../src/util/time')
const { getModels } = require('../src/models')
const _ = require('lodash')

/**
 * May be required to let event propagate before moving on with current test
 * @constant {Number} testEventDelay
 * @default
 */
const testEventDelay = 1000 // ms

module.exports = {
  testEventDelay,

  computeDate,
  nullOrUndefinedFallback,
  getObjectEvent,
  testEventMetadata
}

/**
 * Checks if value is undefined or null and returns the value if it is not, fallbackValue otherwise.
 * @param {Any} value
 * @param {Any} fallbackValue
 * @return {Any} value or fallback
 */
function nullOrUndefinedFallback (value, fallbackValue) {
  return (typeof value === 'undefined' || value === null) ? fallbackValue : value
}

/**
 * Finds first event of given type related to a single object
 * @param {Object} params
 * @param {Array} params.events - Array of Event objects
 * @param {String} params.eventType - like 'asset__created'
 * @param {String} params.objectId
 * @return {Object} Event object
 */
function getObjectEvent ({ events, eventType, objectId }) {
  if (_.isEmpty(events)) throw new Error('No events to search for object event')
  return events.find(event => event.type === eventType && event.objectId === objectId)
}

/**
 * Includes boilerplate Event tests
 * @param {Object} params
 * @param {Object} params.t - Test execution object like ava’s 't'
 * @param {Object} params.event - event Object
 * @param {Object} params.object - Object to compare as a reference
 * @param {Object} [params.metadata] - expected event.metadata
 * @param {Object} [params.relatedObjectsIds] - Needed for related ids not root properties of `object`
 * @param {Object} [params.patchPayload] - If testing update
 * @return {Object} Event object
 */
async function testEventMetadata ({
  t,
  event,
  object,
  metadata,
  relatedObjectsIds,
  patchPayload
}) {
  const { Event } = await getModels({
    platformId: t.context.platformId,
    env: t.context.env
  })
  const shouldHaveChangesRegex = Event.hasChangesRequested
  const shouldHaveObjectRegex = Event.hasObjectRegex
  const shouldHaveRelatedObjectsIdsRegex = Event.hasRelatedObjectsIdsRegex

  if (!t || typeof t.fail !== 'function') throw new Error('Missing test execution object')
  if (_.isEmpty(event)) t.fail('Missing event')
  if (_.isEmpty(object)) t.fail('Missing object')
  if (!event.type) t.fail(`Missing event type, id: ${event.id}`)
  if (shouldHaveChangesRegex.test(event.type) && _.isUndefined(patchPayload)) {
    t.fail(`Missing patchPayload for ${event.type} event`)
  }

  const testMessage = event.type
  const objectType = event.objectType || _.camelCase(event.type.split('__')[0])
  const relatedIds = Object.assign(_.pick(object, Event.relatedObjectsWhitelist), relatedObjectsIds)
  const shouldHaveObject = shouldHaveObjectRegex.test(event.type)
  const shouldHaveRelatedObjectsIds = shouldHaveRelatedObjectsIdsRegex.test(event.type)
  const shouldHaveChangesRequested = shouldHaveChangesRegex.test(event.type)

  t.truthy(event, testMessage)
  t.is(event.objectId, object.id, testMessage)
  t.is(event.objectType, objectType, testMessage)

  if (shouldHaveObject) {
    t.true(event.object.id === object.id, testMessage)
    t.deepEqual(event.object.metadata, object.metadata)
    t.deepEqual(event.object.platformData, object.platformData)
  } else t.true(event.object === null, testMessage)

  const changesRequested = event.changesRequested

  if (shouldHaveChangesRequested) t.deepEqual(changesRequested, patchPayload, testMessage)
  else t.true(event.changesRequested === null, testMessage)

  if (shouldHaveRelatedObjectsIds) t.deepEqual(event.relatedObjectsIds, relatedIds, testMessage)
  else t.true(event.relatedObjectsIds === null, testMessage)

  if (metadata) t.deepEqual(event.metadata, metadata, testMessage)
}
