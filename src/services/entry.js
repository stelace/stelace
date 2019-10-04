const createError = require('http-errors')
const { UniqueViolationError } = require('objection-db-errors')

const { logError } = require('../../logger')
const { getModels } = require('../models')

const { getObjectId } = require('stelace-util-keys')

const { performListQuery } = require('../util/listQueryBuilder')

let responder
let subscriber
let publisher

function start ({ communication }) {
  const {
    getResponder,
    getSubscriber,
    getPublisher,
    COMMUNICATION_ID
  } = communication

  responder = getResponder({
    name: 'Entry Responder',
    key: 'entry'
  })

  subscriber = getSubscriber({
    name: 'Entry subscriber',
    key: 'entry',
    namespace: COMMUNICATION_ID,
    subscribesTo: [
      'entryCreated',
      'entryUpdated',
      'entryDeleted'
    ]
  })

  publisher = getPublisher({
    name: 'Entry publisher',
    key: 'entry',
    namespace: COMMUNICATION_ID
  })

  responder.on('list', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Entry } = await getModels({ platformId, env })

    const {
      orderBy,
      order,

      page,
      nbResultsPerPage,

      id,
      collection,
      locale,
      name
    } = req

    const queryBuilder = Entry.query()

    const paginationMeta = await performListQuery({
      queryBuilder,
      filters: {
        ids: {
          dbField: 'id',
          value: id,
          transformValue: 'array',
          query: 'inList'
        },
        collection: {
          dbField: 'collection',
          value: collection,
          transformValue: 'array',
          query: 'inList'
        },
        locale: {
          dbField: 'locale',
          value: locale,
          transformValue: 'array',
          query: 'inList'
        },
        name: {
          dbField: 'name',
          value: name,
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

    paginationMeta.results = Entry.exposeAll(paginationMeta.results, { req })

    return paginationMeta
  })

  responder.on('read', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Entry } = await getModels({ platformId, env })

    const entryId = req.entryId

    const entry = await Entry.query().findById(entryId)
    if (!entry) {
      throw createError(404)
    }

    return Entry.expose(entry, { req })
  })

  responder.on('create', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Entry } = await getModels({ platformId, env })

    const {
      collection,
      locale,
      name,
      fields,
      metadata
    } = req

    const createAttrs = {
      id: await getObjectId({ prefix: Entry.idPrefix, platformId, env }),
      collection,
      locale,
      name,
      fields,
      metadata
    }

    let entry

    try {
      entry = await Entry.query().insert(createAttrs)
    } catch (err) {
      await handleUniqueValidationError(err, { platformId, env, locale, name })
    }

    publisher.publish('entryCreated', {
      entry,
      eventDate: entry.createdDate,
      platformId,
      env,
      req
    })

    return Entry.expose(entry, { req })
  })

  responder.on('update', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Entry } = await getModels({ platformId, env })

    const {
      entryId,
      collection,
      locale,
      name,
      fields,
      metadata
    } = req

    const payload = {
      collection,
      locale,
      name,
      fields,
      metadata
    }

    let entry = await Entry.query().findById(entryId)
    if (!entry) {
      throw createError(404)
    }

    const updateAttrsBeforeFullDataMerge = Object.assign({}, payload)

    const updateAttrs = {
      collection,
      locale,
      name
    }

    if (fields) {
      const newFields = Object.assign({}, entry.fields)
      Object.keys(fields).forEach(key => {
        const value = fields[key]

        if (value === null) {
          delete newFields[key]
        } else {
          newFields[key] = value
        }
      })

      updateAttrs.fields = newFields
    }
    if (metadata) {
      updateAttrs.metadata = Entry.rawJsonbMerge('metadata', metadata)
    }

    let newEntry

    try {
      newEntry = await Entry.query().patchAndFetchById(
        entryId,
        updateAttrs
      )
    } catch (err) {
      await handleUniqueValidationError(err, {
        platformId,
        env,
        locale: locale || entry.locale,
        name: name || entry.name,
        omitId: entryId
      })
    }

    publisher.publish('entryUpdated', {
      entryId,
      newEntry,
      updateAttrs: updateAttrsBeforeFullDataMerge,
      eventDate: newEntry.updatedDate,
      platformId,
      env,
      req
    })

    return Entry.expose(newEntry, { req })
  })

  responder.on('remove', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Entry } = await getModels({ platformId, env })

    const {
      entryId
    } = req

    const entry = await Entry.query().findById(entryId)
    if (!entry) {
      return { id: entryId }
    }

    await Entry.query().deleteById(entryId)

    publisher.publish('entryDeleted', {
      entryId,
      entry,
      eventDate: new Date().toISOString(),
      platformId,
      env,
      req
    })

    return { id: entryId }
  })

  // EVENTS

  subscriber.on('entryCreated', async ({ entry, eventDate, platformId, env, req } = {}) => {
    try {
      const { Event, Entry } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'entry__created',
        objectId: entry.id,
        object: Entry.expose(entry, { req, namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { entryId: entry.id },
        message: 'Fail to create event entry__created'
      })
    }
  })

  subscriber.on('entryUpdated', async ({
    entryId,
    updateAttrs,
    newEntry,
    eventDate,
    platformId,
    env,
    req
  } = {}) => {
    try {
      const { Event, Entry } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'entry__updated',
        objectId: entryId,
        object: Entry.expose(newEntry, { req, namespaces: ['*'] }),
        changesRequested: Entry.expose(updateAttrs, { req, namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { entryId },
        message: 'Fail to create event entry__updated'
      })
    }
  })

  subscriber.on('entryDeleted', async ({ entryId, entry, eventDate, platformId, env, req } = {}) => {
    try {
      const { Entry, Event } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'entry__deleted',
        objectId: entryId,
        object: Entry.expose(entry, { req, namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { entryId },
        message: 'Fail to create event entry__deleted'
      })
    }
  })

  async function handleUniqueValidationError (err, { platformId, env, locale, name, omitId }) {
    const { Entry } = await getModels({ platformId, env })

    if (err instanceof UniqueViolationError) {
      const queryBuilder = Entry.query().findOne({ locale, name })
      if (omitId) {
        queryBuilder.whereNot('id', omitId)
      }

      const conflictingEntry = await queryBuilder
      if (conflictingEntry) {
        const msg = `The entry with ID "${conflictingEntry.id}" already has the same name and locale`
        throw createError(422, msg)
      } else {
        throw createError(500, `Conflicting entry for locale ${locale} and name ${name} not found`)
      }
    } else {
      throw err
    }
  }
}

function stop () {
  responder.close()
  responder = null
}

module.exports = {
  start,
  stop
}
