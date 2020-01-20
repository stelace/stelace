const createError = require('http-errors')
const _ = require('lodash')
const bluebird = require('bluebird')
const { raw } = require('objection')

const { logError } = require('../../server/logger')
const { getModels } = require('../models')

const {
  getPendingReindexingTask,
  shouldReindex,
  startReindexingProcess
} = require('../elasticsearch-reindex')

const {
  updateMapping
} = require('../elasticsearch')

const { getObjectId } = require('stelace-util-keys')

const { performListQuery } = require('../util/listQueryBuilder')

let responder
let subscriber
let publisher
let assetPublisher

function start ({ communication }) {
  const {
    getResponder,
    getSubscriber,
    getPublisher,
    COMMUNICATION_ID
  } = communication

  responder = getResponder({
    name: 'Custom attribute Responder',
    key: 'custom-attribute'
  })

  subscriber = getSubscriber({
    name: 'Custom attribute subscriber',
    key: 'custom-attribute',
    namespace: COMMUNICATION_ID,
    subscribesTo: [
      'customAttributeCreated',
      'customAttributeUpdated',
      'customAttributeDeleted'
    ]
  })

  publisher = getPublisher({
    name: 'Custom attribute publisher',
    key: 'custom-attribute',
    namespace: COMMUNICATION_ID
  })

  assetPublisher = getPublisher({
    name: 'Custom attribute to Asset publisher',
    key: 'asset',
    namespace: COMMUNICATION_ID
  })

  responder.on('list', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { CustomAttribute } = await getModels({ platformId, env })

    const {
      orderBy,
      order,

      page,
      nbResultsPerPage,

      id
    } = req

    const queryBuilder = CustomAttribute.query()

    const paginationMeta = await performListQuery({
      queryBuilder,
      filters: {
        ids: {
          dbField: 'id',
          value: id,
          transformValue: 'array',
          query: 'inList'
        }
      },
      paginationActive: true,
      paginationConfig: {
        page,
        nbResultsPerPage
      },
      orderConfig: {
        orderBy,
        order
      }
    })

    paginationMeta.results = CustomAttribute.exposeAll(paginationMeta.results, { req })

    return paginationMeta
  })

  responder.on('read', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { CustomAttribute } = await getModels({ platformId, env })

    const customAttributeId = req.customAttributeId

    const customAttribute = await CustomAttribute.query().findById(customAttributeId)
    if (!customAttribute) {
      throw createError(404)
    }

    return CustomAttribute.expose(customAttribute, { req })
  })

  responder.on('create', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { CustomAttribute } = await getModels({ platformId, env })

    const {
      name,
      customAttributeType: type,
      listValues,
      metadata,
      platformData
    } = req

    const isESReindexing = await getPendingReindexingTask({ platformId, env })
    if (isESReindexing) {
      throw createError(422, 'Cannot create a Custom Attribute while reindexing is processing')
    }

    const customAttributes = await CustomAttribute.query().where({ name })
    if (customAttributes.length) {
      throw createError(422, `${name} Custom Attribute name has already been used.`)
    }

    if (listValues && !CustomAttribute.listValuesTypes.includes(type)) {
      throw createError(400,
        `${type} Custom Attribute type does not accept a list of values. ` +
        `Please use ${CustomAttribute.listValuesTypes.join(' or ')} type.`
      )
    }

    if (!listValues && CustomAttribute.requiredListValuesTypes.includes(type)) {
      throw createError(400,
        `${type} Custom Attribute type requires a list of values. `
      )
    }

    const needReindex = await shouldReindex({
      platformId,
      env,
      newCustomAttributeName: name,
      newCustomAttributeType: type
    })

    const customAttribute = await CustomAttribute.query().insert({
      id: await getObjectId({ prefix: CustomAttribute.idPrefix, platformId, env }),
      name,
      type,
      listValues,
      metadata,
      platformData
    })

    if (needReindex) {
      const newCustomAttributes = customAttributes.concat(customAttribute)

      await startReindexingProcess({
        platformId,
        env,
        customAttributes: newCustomAttributes,
        newCustomAttributeName: name,
        COMMUNICATION_ID
      })
    } else {
      try {
        // update Elasticsearch mapping
        await updateMapping({ platformId, env, type: 'asset', customAttributes: customAttributes.concat([customAttribute]) })
      } catch (err) {
        // remove the created attribute because it wasn't synchronized with Elasticsearch
        await CustomAttribute.query().deleteById(customAttribute.id)

        const exposedMessage = 'This Custom Attribute cannot be created due to an indexing problem. ' +
        'Please try again later.'

        const error = createError(500, exposedMessage, { nativeError: err })
        throw error
      }
    }

    publisher.publish('customAttributeCreated', {
      customAttribute,
      eventDate: customAttribute.createdDate,
      platformId,
      env
    })

    return CustomAttribute.expose(customAttribute, { req })
  })

  responder.on('update', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const {
      CustomAttribute,
      Asset
    } = await getModels({ platformId, env })

    const customAttributeId = req.customAttributeId

    const fields = [
      'listValues',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const {
      listValues,
      metadata,
      platformData
    } = payload

    const customAttribute = await CustomAttribute.query().findById(customAttributeId)
    if (!customAttribute) {
      throw createError(404)
    }

    if (listValues && !CustomAttribute.listValuesTypes.includes(customAttribute.type)) {
      throw createError(422,
        `${customAttribute.type} Custom Attribute type does not allow a list of values. ` +
        `Please use ${CustomAttribute.listValuesTypes.join(' or ')} type.`
      )
    }

    const updateAttrs = _.omit(payload, ['metadata', 'platformData'])
    const updateAttrsBeforeFullDataMerge = Object.assign({}, payload)

    if (!_.isEmpty(listValues)) {
      const key = `customAttributes:${customAttribute.name}`
      const [{ count: nbAssets }] = await Asset.query().count().whereJsonNotSubsetOf(key, listValues)
      if (nbAssets) {
        throw createError(422, `${nbAssets} Asset${nbAssets > 1 ? 's' : ''} have ` +
          'Custom Attribute values not fitting into this new list of values.')
      }
    }

    if (metadata) {
      updateAttrs.metadata = CustomAttribute.rawJsonbMerge('metadata', metadata)
    }
    if (platformData) {
      updateAttrs.platformData = CustomAttribute.rawJsonbMerge('platformData', platformData)
    }

    const newCustomAttribute = await CustomAttribute.query().patchAndFetchById(
      customAttributeId,
      updateAttrs
    )

    publisher.publish('customAttributeUpdated', {
      customAttribute,
      newCustomAttribute,
      updateAttrs: updateAttrsBeforeFullDataMerge,
      eventDate: newCustomAttribute.updatedDate,
      platformId,
      env
    })

    return CustomAttribute.expose(newCustomAttribute, { req })
  })

  responder.on('remove', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const {
      CustomAttribute,
      Asset
    } = await getModels({ platformId, env })

    const {
      customAttributeId
    } = req

    const isESReindexing = await getPendingReindexingTask({ platformId, env })
    if (isESReindexing) {
      throw createError(422, 'Cannot create a Custom Attribute while reindexing is processing')
    }

    const customAttribute = await CustomAttribute.query().findById(customAttributeId)
    if (!customAttribute) {
      return { id: customAttributeId }
    }

    const referencingAssetsQuery = Asset.query()
      .whereJsonHasAny('customAttributes', customAttribute.name)
    /*
      const referencingAssets = await referencingAssetsQuery.clone()
        .select('id', raw(`"customAttributes"->'${customAttribute.name}' AS value`))
      const indexedCustomAttributeValues = _.keyBy(referencingAssets, 'id')
    */
    /*
      For performance (memory) reasons we do not take full snapshots of assets.
      We might just capture Custom Attribute previous value as above for event sourcing
      but we don’t need to since previous 'asset__(updated|created)' event already did
    */
    const referencingAssetIds = await referencingAssetsQuery
      .patch({ customAttributes: raw(`"customAttributes" - '${customAttribute.name}'`) })
      .returning('id')

    // Delete as soon as possible since there may be many events to generate
    await CustomAttribute.query().deleteById(customAttributeId)

    // Not awaiting this non-critical step for potentially *much* faster response
    // OK as long as required DELETE logic was executed (just above).
    bluebird.map(referencingAssetIds, async (emptyAsset) => {
      const assetId = emptyAsset.id // only property

      try {
        // Just faking removal from object for event sourcing consistency
        // We currently expose no way to really remove a root jsonb column object property
        const updateAttrs = { customAttributes: { [customAttribute.name]: null } }
        const eventDelta = {
          // Must have the structure returned as object Event.getUpdatedEventDeltas
          asset__custom_attribute_changed: updateAttrs
        }
        const eventMetadata = {
          stelaceComment: `customAttribute '${
            customAttribute.name
          }' automatically removed from asset before DELETE.`
        }

        // throttle concurrent events to let local instance handle these
        // since we can’t await a publisher
        await new Promise(resolve => setTimeout(resolve, 10))

        assetPublisher.publish('assetUpdated', {
          assetId,
          deltas: eventDelta,
          // newAsset only has id key because it is not fetched for performance reasons (see above)
          newAsset: emptyAsset,
          eventMetadata,
          updateAttrs,
          platformId,
          env,
          req
        })
      } catch (err) {
        logError(err, {
          platformId,
          env,
          custom: { customAttribute },
          message: `Fail to create update events after dereferencing deleted Custom Attribute from ${assetId}`
        })
      }
    }, {
      // all events are generated on same current instance so let’s be gentle
      concurrency: 2
    }).finally(() => {
      publisher.publish('customAttributeDeleted', {
        customAttributeId,
        customAttribute,
        eventDate: new Date().toISOString(),
        platformId,
        env,
        req
      })
    })

    return { id: customAttributeId }
  })

  // EVENTS

  subscriber.on('customAttributeCreated', async ({ customAttribute, eventDate, platformId, env } = {}) => {
    try {
      const { CustomAttribute, Event } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'custom_attribute__created',
        object: CustomAttribute.expose(customAttribute, { namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { customAttributeId: customAttribute.id },
        message: 'Fail to create event custom_attribute__created'
      })
    }
  })

  subscriber.on('customAttributeUpdated', async ({
    // customAttribute,
    newCustomAttribute,
    updateAttrs,
    eventDate,
    platformId,
    env
  } = {}) => {
    try {
      const { CustomAttribute, Event } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'custom_attribute__updated',
        object: CustomAttribute.expose(newCustomAttribute, { namespaces: ['*'] }),
        changesRequested: CustomAttribute.expose(updateAttrs, { namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { customAttributeId: newCustomAttribute.id },
        message: 'Fail to create event custom_attribute__updated'
      })
    }
  })

  subscriber.on('customAttributeDeleted', async ({
    customAttributeId,
    customAttribute,
    eventDate,
    platformId,
    env,
    req
  } = {}) => {
    try {
      const { CustomAttribute, Event } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'custom_attribute__deleted',
        objectId: customAttributeId,
        object: CustomAttribute.expose(customAttribute, { req, namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { customAttributeId },
        message: 'Fail to create event custom_attribute__deleted'
      })
    }
  })
}

function stop () {
  responder.close()
  responder = null

  publisher.close()
  publisher = null

  assetPublisher.close()
  assetPublisher = null
}

module.exports = {
  start,
  stop
}
