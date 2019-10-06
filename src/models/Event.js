const Base = require('./Base')
const { apiVersions } = require('../versions')

const _ = require('lodash')

const { getObjectId } = require('stelace-util-keys')

const { getPublisher, COMMUNICATION_ID } = require('../communication')

const { applyObjectChanges } = require('../versions')

let publisher

const relatedObjectsWhitelist = [
  'assetId', // Assessment, Transaction, Availability, Search
  'categoryId', // Asset, Search
  'assetTypeId', // Asset, Search
  'ownerId', // Asset, Search, Assessment, Transaction
  'takerId', // Assessment, Transaction
  'transactionId', // Assessment
  'organizationId' // User
  // 'userId', // AuthMean
  // 'parentId', // Category, Role
  // 'receiverId', // Assessment
  // 'emitterId', // Assessment
]
const hasObjectRegex =
  /_created$|_updated$|_deleted$|^password__|^token__|^assessment__signed|transaction__status_changed$|^user__organization_|^assets_/
const hasRelatedObjectsIdsRegex =
  /^assets?__|_created$|_updated$|_deleted$|^password__|^token__|^assessment__signed|transaction__status_changed$|^user__organization_/
// V Including all asset__ events except for asset__created and asset__deleted
const hasChangesRequestedRegex =
  /^(?!asset__(crea|dele)ted)asset__|_updated|organization_rights_changed$/

const coreEventRegex = /^[a-z\d_]+__[a-z\d_]+$/i

class Event extends Base {
  static get tableName () {
    return 'event'
  }

  static get idPrefix () {
    return 'evt'
  }

  static get jsonSchema () {
    return {
      type: 'object',
      properties: {
        id: {
          type: 'string'
        },
        createdDate: {
          type: 'string',
          maxLength: 24
        },
        type: {
          type: 'string',
          maxLength: 255
        },
        objectType: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        objectId: {
          type: ['string', 'null'] // can be null (cf. search service with no results)
        },
        object: { // cf. hasObjectRegex
          type: ['object', 'null'],
          default: null
        },
        changesRequested: { // cf. hasChangesRequestedRegex
          type: ['object', 'null'],
          default: null
        },
        relatedObjectsIds: { // cf. hasRelatedObjectsIdsRegex
          // Empty object {} means there are no relatedObjectsIds (e.g. api_key events)
          type: ['object', 'null'],
          default: null
        },
        apiVersion: {
          type: ['string']
        },
        parentId: { // for events derived from updated events such as asset__name_changed
          type: ['string', 'null'],
          default: null
        },
        emitter: { // 'core' or 'custom' or 'task'
          type: 'string',
          maxLength: 255
        },
        emitterId: {
          type: ['string', 'null'],
          maxLength: 255,
          default: null
        },
        metadata: {
          type: 'object',
          default: {}
        }
      }
    }
  }

  static get relatedObjectsWhitelist () {
    return relatedObjectsWhitelist
  }

  static get hasObjectRegex () {
    return hasObjectRegex
  }

  static get hasRelatedObjectsIdsRegex () {
    return hasRelatedObjectsIdsRegex
  }

  static get hasChangesRequested () {
    return hasChangesRequestedRegex
  }

  $beforeInsert () {
    const now = new Date().toISOString()

    if (!this.createdDate) {
      this.createdDate = now
    }

    if (_.isEmpty(this.relatedObjectsIds) && !_.isEmpty(this.object)) {
      this.relatedObjectsIds = _.pick(this.object, relatedObjectsWhitelist)
    }
    if (_.isEmpty(this.relatedObjectsIds) && !_.isEmpty(this._tmpObject)) {
      this.relatedObjectsIds = _.pick(this._tmpObject, relatedObjectsWhitelist)
    }
    // fallback if this.relatedObjectsIds is still null but shouldn’t be
    if (!this.relatedObjectsIds && hasRelatedObjectsIdsRegex.test(this.type)) {
      this.relatedObjectsIds = {}
    }

    if (this.emitter === 'core') {
      if (!this.objectType && this.type) this.objectType = _.camelCase(this.type.split('__')[0])

      const parsedObjectId = _.get(this.object || this._tmpObject, 'id') ||
        this.objectId ||
        null // null matters here, see below

      const initialObjectId = this.objectId
      this.objectId = this.objectId || parsedObjectId

      if (this.objectId !== parsedObjectId) { // Note that undefined !== null
        // meaning given objectId shall not be undefined if it can’t be parsed in (_tmp)object
        throw new Error(`Invalid objectId ${initialObjectId} in ${this.type} event`, {
          parsedObjectId
        })
      }
    }

    delete this._tmpObject // can be falsy but we still have to remove this if set

    this.apiVersion = apiVersions[0]
  }

  $beforeUpdate () {}

  static async createEvent (params, { platformId, env, queryContext } = {}) {
    const { getModels } = require('./index')

    const { Event } = await getModels({ platformId, env })

    if (!publisher) {
      publisher = getPublisher({
        name: 'Event publisher',
        key: 'event',
        namespace: COMMUNICATION_ID
      })
    }

    const newParams = Object.assign({}, {
      id: await getObjectId({ prefix: Event.idPrefix, platformId, env }),
      emitter: 'core'
    }, params)

    // remove the attribute "livemode" added in the expose function
    if (newParams.changesRequested && typeof newParams.changesRequested.livemode !== 'undefined') {
      delete newParams.changesRequested.livemode
    }

    const event = await Event.query(queryContext).insert(newParams)

    publisher.publish('eventCreated', { event, platformId, env })

    return event
  }

  static getAccessFields (access) {
    const accessFields = {
      api: [
        'id',
        'createdDate',
        'type',
        'objectType',
        'objectId',
        'object',
        'changesRequested',
        'relatedObjectsIds',
        'apiVersion',
        // 'parentId',
        'emitter',
        'emitterId',
        'metadata',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }

  static getListEvents () {
    return [
      'api_key__created',
      'api_key__updated',
      'api_key__deleted',

      'category__created',
      'category__updated',
      'category__deleted',

      'asset__created',
      'asset__name_changed',
      'asset__description_changed',
      'asset__category_switched',
      'asset__type_switched',
      'asset__custom_attribute_changed',
      'asset__locations_changed',
      'asset__quantity_changed',
      'asset__pricing_changed',
      'asset__activated',
      'asset__deactivated',
      'asset__validated',
      'asset__updated',
      'asset__deleted',

      'asset_type__created',
      'asset_type__updated',
      'asset_type__deleted',

      'availability__created',
      'availability__updated',
      'availability__deleted',

      'assets__searched',

      'custom_attribute__created',
      'custom_attribute__updated',
      'custom_attribute__deleted',

      'message__created',

      'assessment__created',
      'assessment__draft_updated',
      'assessment__signed_once',
      'assessment__signed',
      'assessment__deleted',

      'entry__created',
      'entry__updated',
      'entry__deleted',

      'order__created',
      'order__updated',

      'token__check_requested',
      'token__check_confirmed',

      'transaction__created',
      'transaction__updated',
      'transaction__status_changed',

      'user__created',
      'user__updated',
      'user__deleted',
      'user__organization_joined',
      'user__organization_left',
      'user__organization_rights_changed',

      'password__changed',
      'password__reset_requested',
      'password__reset_confirmed'
    ]
  }

  static isCoreEventFormat (event) {
    return coreEventRegex.test(event)
  }

  static getBadCustomEventTypeMessage () {
    return 'Cannot provide a type with 2 underscore characters' +
      ' to help distinguishing custom event types from core ones'
  }

  static isAllowedCoreEvents (event) {
    const allowedEvents = this.getListEvents()
    return allowedEvents.includes(event)
  }

  static isAllowedEvent (event) {
    const isCoreFormat = this.isCoreEventFormat(event)

    return (isCoreFormat && this.isAllowedCoreEvents(event)) ||
      (!isCoreFormat && typeof event === 'string' && event)
  }

  /**
   * Returns a config object for given object, mapping events to specific attribute checks
   * @param {String} objectType - like 'assetType'
   * @return {Object} Object to use with `getUpdatedEventDeltas` function. Event name keys map to:
   *   - (array of) string values to check for changes using Base model `getUpdateDeltaFields`
   *   - or a function taking updateAttrs and the object as arguments, returning event delta
   */
  static getUpdatedEventDeltasConfig (objectType) {
    if (typeof objectType !== 'string') {
      throw new Error(`string objectType expected in deltas config, got ${typeof objectType}`)
    }

    const deltasConfigs = {
      asset: {
        asset__name_changed: 'name',
        asset__description_changed: 'description',
        asset__category_switched: 'categoryId',
        asset__type_switched: 'assetTypeId',
        asset__locations_changed: 'locations',
        asset__quantity_changed: 'quantity',
        asset__pricing_changed: [
          'price',
          'currency'
        ],
        asset__activated: (updateAttrs, asset) => {
          if (updateAttrs.active !== true) return {}
          if (asset && asset.active === updateAttrs.active) return {}
          return { active: true }
        },
        asset__deactivated: (updateAttrs, asset) => {
          if (updateAttrs.active !== false) return {}
          if (asset && asset.active === updateAttrs.active) return {}
          return { active: false }
        },
        asset__validated: (updateAttrs, asset) => {
          if (updateAttrs.validated !== true) return {}
          if (asset && asset.validated === updateAttrs.validated) return {}
          return { validated: true }
        },
        asset__custom_attribute_changed: (updateAttrs, asset) => {
          if (typeof updateAttrs.customAttributes === 'undefined') return {}
          if (_.isEqual(updateAttrs.customAttributes, asset.customAttributes)) return {}

          return { customAttributes: updateAttrs.customAttributes }
        }
      },
      transaction: {
        transaction__status_changed: 'status'
      }
    }

    if (!Object.keys(deltasConfigs).includes(objectType)) {
      throw new Error(`Missing internal deltas config when emitting ${objectType}__updated event`)
    }

    return deltasConfigs[objectType]
  }

  static getUpdatedEventDeltas (config, rawPayload, element) {
    const deltas = {}

    Object.keys(config).forEach(key => {
      const value = config[key]

      let result

      if (typeof value === 'function') {
        result = value(rawPayload, element)
      } else if (typeof value === 'string') {
        result = this.getUpdateDeltaFields(rawPayload, [value], element)
      } else if (Array.isArray(value)) { // e.g. 'asset__pricing_changed'
        result = this.getUpdateDeltaFields(rawPayload, value, element)
      } else {
        throw new Error('Unknown config type')
      }

      if (Object.keys(result).length) {
        deltas[key] = result
      }
    })

    return deltas
  }

  static getVersioningObjectType (objectType) {
    return _.camelCase(objectType)
  }

  static async getVersionedEvent (event, toVersion) {
    const objectType = this.getVersioningObjectType(event.objectType)

    const fromVersion = event.apiVersion

    const [
      changesRequested,
      object,
    ] = await Promise.all([
      applyObjectChanges({
        fromVersion,
        toVersion,
        target: objectType,
        params: {
          result: event.changesRequested
        }
      }),
      applyObjectChanges({
        fromVersion,
        toVersion,
        target: objectType,
        params: {
          result: event.object
        }
      })
    ])

    let versionedEvent = Object.assign({}, event, {
      changesRequested: changesRequested.result,
      object: await object.result
    })
    versionedEvent = await applyObjectChanges({
      fromVersion,
      toVersion,
      target: 'event',
      params: {
        result: versionedEvent
      }
    })

    return versionedEvent.result
  }
}

module.exports = Event
