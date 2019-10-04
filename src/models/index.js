const createError = require('http-errors')
const _ = require('lodash')
const { raw } = require('objection')
const pg = require('pg')
const { extractDataFromObjectId } = require('stelace-util-keys')

const { getKnex } = require('./util')
const { getPlatformEnvData } = require('../redis')
const { mergeFunctionName } = require('../database')

const models = {
  ApiKey: require('./ApiKey'),
  Assessment: require('./Assessment'),
  Asset: require('./Asset'),
  AssetType: require('./AssetType'),
  AuthMean: require('./AuthMean'),
  AuthToken: require('./AuthToken'),
  Availability: require('./Availability'),
  Category: require('./Category'),
  Config: require('./Config'),
  CustomAttribute: require('./CustomAttribute'),
  Document: require('./Document'),
  Entry: require('./Entry'),
  Event: require('./Event'),
  Message: require('./Message'),
  Order: require('./Order'),
  Role: require('./Role'),
  SavedSearch: require('./SavedSearch'),
  Task: require('./Task'),
  Transaction: require('./Transaction'),
  User: require('./User'),
  Webhook: require('./Webhook'),
  WebhookLog: require('./WebhookLog'),
  Workflow: require('./Workflow'),
  WorkflowLog: require('./WorkflowLog'),

  InternalAvailability: require('./InternalAvailability')
}

// map only models that can be exposed via event
const mapIdPrefixToModelNames = {
  [models.ApiKey.idPrefix]: 'ApiKey',
  [models.Assessment.idPrefix]: 'Assessment',
  [models.Asset.idPrefix]: 'Asset',
  [models.AssetType.idPrefix]: 'AssetType',
  [models.Availability.idPrefix]: 'Availability',
  [models.Category.idPrefix]: 'Category',
  [models.CustomAttribute.idPrefix]: 'CustomAttribute',
  [models.Entry.idPrefix]: 'Entry',
  [models.Message.idPrefix]: 'Message',
  [models.Order.idPrefix]: 'Order',
  [models.Transaction.idPrefix]: 'Transaction',
  [models.User.idPrefix]: 'User',
  [models.User.organizationIdPrefix]: 'User'
}

const getObjectTypeFromModelName = (modelName) => {
  return _.camelCase(modelName)
}

const getModelNameFromObjectType = (objectType) => {
  return objectType.charAt(0).toUpperCase() + objectType.slice(1)
}

const cacheModels = {}

// must run before establishing any Knex connections
loadTypeParser()

function loadTypeParser () {
  // https://github.com/tgriesser/knex/issues/387
  // converts PostgreSQL `bigint` into Javascript integers
  pg.types.setTypeParser(20, 'text', (value) => {
    if (Number.MAX_SAFE_INTEGER < value) {
      throw new Error(`The value ${value} exceeds the JS max integer value ${Number.MAX_SAFE_INTEGER}`)
    }

    return parseInt(value, 10)
  })
}

async function getConnection ({ platformId, env } = {}) {
  if (!platformId) {
    throw new Error('Missing platformId when retrieving PostgreSQL connection')
  }
  if (!env) {
    throw new Error('Missing environment when retrieving PostgreSQL connection')
  }

  let connection
  let schema

  const useRemoteStore = process.env.REMOTE_STORE === 'true'

  if (useRemoteStore) {
    const postgresqlData = await getPlatformEnvData(platformId, env, 'postgresql')
    if (!postgresqlData) {
      throw createError(500, 'PostgreSQL missing environment variables', { platformId, env })
    }

    connection = {
      host: postgresqlData.host,
      user: postgresqlData.user,
      password: postgresqlData.password,
      database: postgresqlData.database,
      port: postgresqlData.port,
      schema: postgresqlData.schema
    }
    schema = postgresqlData.schema
  } else {
    connection = {
      host: process.env.POSTGRES_HOST,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
      port: process.env.POSTGRES_PORT,
      schema: 'public'
    }
    schema = 'public'
  }

  return {
    connection,
    schema
  }
}

async function getModels ({ platformId, env } = {}) {
  if (!platformId) {
    throw new Error('Missing platformId when getting models')
  }
  if (!env) {
    throw new Error('Missing environment when getting models')
  }

  const cacheKey = `${platformId}_${env}`

  if (cacheModels[cacheKey]) {
    return cacheModels[cacheKey]
  }

  const { schema, connection } = await getConnection({ platformId, env })

  const knex = getKnex(connection)

  const customModels = Object.keys(models).reduce((memo, key) => {
    const Model = models[key]

    // Set the schema automatically
    // https://github.com/Vincit/objection.js/issues/85
    class SchemaModel extends Model {
      static get defaultSchema () {
        return schema
      }

      /**
       * Returns raw PostgreSQL JSONB merge custom function call.
       * Algorithm is similar to a recursive Object.assign(base, changes).
       * This ensures we only update appropriate fields,
       * rather than passing whole object as in Base.getCustomData,
       * which used to break even simple concurrency: concurrent updates of different JSON fields.
       * @param {String} baseObjectName - same as column name such as "metadata"
       * @param {Object} changesObject - values (incl. `null`) overwrite any baseObject value with same key
       * @param {Object} [options]
       * @param {String} [options.jsonbAccessor] - using native Postgres operator like `->'field'`
       * @return {Object} knex `raw` query object
       */
      static rawJsonbMerge (baseObjectName, changesObject, { jsonbAccessor } = {}) {
        if (typeof baseObjectName !== 'string') throw new Error('String column name expected')
        if (!_.isObjectLike(changesObject)) throw new Error('changesObject expected as second argument')

        return raw(`${this.defaultSchema}.${mergeFunctionName}(${jsonbAccessor ? '(' : ''}"${
          baseObjectName // We need double quotes for column names with caps like 'platformData'
        }"${
          jsonbAccessor ? `${jsonbAccessor})::jsonb` : ''
        }, ?::jsonb)`, JSON.stringify(changesObject))
      }

      /**
       * Returns the updated model after updating a JSONB column (can replace a property instead of merging)
       *
       * WARNING: should only be used in specific locations as future implementation of advanced update will
       * be implemented in the future via JSON Patch (https://erosb.github.io/post/json-patch-vs-merge-patch/)
       * @param {Object} params
       * @param {String} params.modelId - model ID to update
       * @param {String} params.baseObjectName - same as column name such as "metadata"
       * @param {Object} params.changesObject - values (incl. `null`) overwrite any baseObject value with same key
       * @param {String[]} params.replacingProperties - array of `changesObject` property names that needs to be replaced
       *   instead of being merged with previous value
       * @param {Object} [params.trx] - Knex transaction object
       * @return {Object} updated model
       */
      static async updateJsonb ({
        modelId,
        baseObjectName,
        changesObject,
        replacingProperties,
        trx
      }) {
        if (!modelId) throw new Error('modelId expected')
        if (typeof baseObjectName !== 'string') throw new Error('String column name expected')
        if (!_.isObjectLike(changesObject)) throw new Error('changesObject expected as second argument')
        if (!trx) throw new Error('Transaction object trx expected')

        const beforeReplaceChanges = Object.assign({}, changesObject)
        const afterReplaceChanges = {}

        if (replacingProperties && Array.isArray(replacingProperties)) {
          replacingProperties.forEach(prop => {
            if (!_.isUndefined(changesObject[prop])) {
              beforeReplaceChanges[prop] = null
              afterReplaceChanges[prop] = changesObject[prop]
            }
          })
        }

        let updatedModel = await this.query(trx).patchAndFetchById(
          modelId,
          { [baseObjectName]: this.rawJsonbMerge(baseObjectName, beforeReplaceChanges) }
        )
        if (!_.isEmpty(afterReplaceChanges)) {
          updatedModel = await this.query(trx).patchAndFetchById(
            modelId,
            { [baseObjectName]: this.rawJsonbMerge(baseObjectName, afterReplaceChanges) }
          )
        }

        return updatedModel
      }
    }

    memo[key] = SchemaModel.bindKnex(knex)
    return memo
  }, {})

  cacheModels[cacheKey] = customModels
  return customModels
}

/**
 * Pass an ID or a prefix ID and retrieve
 * @param {Object} params
 * @param {String} [params.objectId]
 * @param {String} [params.idPrefix]
 * @param {String} [params.objectType]
 * @param {String} [params.Models] - models from `getModels({ platformId, env })`
 *   or defaults to models without attached platform DB.
 *   Passing models from getModels is useful to query database afterwards.
 * @return {Object} info
 * @return {String} info.idPrefix - can be null if no match
 * @return {String} info.objectType - can be null if no match
 * @return {Object} info.Model - can be null if no match, return the Objection.js model
 *                               useful to access model class methods or to query database
 */
function getModelInfo ({ objectId, objectType, idPrefix, Models = models }) {
  const info = {
    idPrefix: null,
    objectType: null,
    Model: null
  }

  let modelName

  if (objectId) {
    try {
      const { object: prefix } = extractDataFromObjectId(objectId) // can throw
      const modelName = mapIdPrefixToModelNames[prefix]
      if (modelName) info.idPrefix = prefix
    } catch (err) {}
  } else if (idPrefix) info.idPrefix = idPrefix

  if (info.idPrefix) {
    modelName = mapIdPrefixToModelNames[info.idPrefix]
    if (modelName) info.objectType = getObjectTypeFromModelName(modelName)
  } else if (objectType) info.objectType = objectType

  if (info.objectType) {
    if (!modelName) modelName = getModelNameFromObjectType(info.objectType)

    info.Model = Models[modelName]
  }

  return info
}

module.exports = Object.assign({}, models, {
  getConnection,
  getModels,

  getModelInfo
})
