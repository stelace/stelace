module.exports = {

  getClient,

  isIndexExisting,
  createIndex,
  deleteIndex,
  getIndex,
  getListIndices,
  getCurrentIndex,

  getMapping,
  updateMapping,

  getErrorType

}

// Elasticsearch Node.js API: https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html
const elasticsearch = require('elasticsearch')
const createError = require('http-errors')
const _ = require('lodash')

const { getPlatformEnvData } = require('./redis')
const {
  autoExpandReplicas,
  getNewIndexProperties,
  getIndexMappingTemplate
} = require('./elasticsearch-templates')

const connectionClients = {}
const cacheClients = {}

function getClientCacheKey (connection) {
  const {
    host,
    protocol,
    port,
    user,
    password
  } = connection

  return JSON.stringify({
    host,
    protocol,
    port,
    user,
    password
  })
}

function getConnectionClient (connection = {}) {
  const key = getClientCacheKey(connection)
  if (connectionClients[key]) return connectionClients[key]

  const {
    host,
    protocol,
    port,
    user,
    password
  } = connection

  const useAuth = user && password

  const params = {
    host: {
      host,
      protocol,
      port
    }
  }

  if (useAuth) {
    params.host.auth = `${user}:${password}`
  }

  const client = new elasticsearch.Client(params)

  connectionClients[key] = client
  return client
}

async function getClient ({ platformId, env } = {}) {
  if (!platformId) {
    throw new Error('Missing platformId when creating an Elasticsearch client')
  }
  if (!env) {
    throw new Error('Missing environment when creating an Elasticsearch client')
  }

  const cacheKey = `${platformId}_${env}`

  if (cacheClients[cacheKey]) return cacheClients[cacheKey]

  const useRemoteStore = process.env.REMOTE_STORE === 'true'

  let connection

  if (useRemoteStore) {
    const elasticsearchData = await getPlatformEnvData(platformId, env, 'elasticsearch')
    if (!elasticsearchData) {
      throw createError(500, 'ElasticSearch missing environment variables', { platformId, env })
    }

    connection = {
      host: elasticsearchData.host,
      protocol: elasticsearchData.protocol,
      port: elasticsearchData.port,
      user: elasticsearchData.user,
      password: elasticsearchData.password
    }
  } else {
    connection = {
      host: process.env.ELASTIC_SEARCH_HOST,
      protocol: process.env.ELASTIC_SEARCH_PROTOCOL,
      port: process.env.ELASTIC_SEARCH_PORT,
      user: process.env.ELASTIC_SEARCH_USER,
      password: process.env.ELASTIC_SEARCH_PASSWORD
    }
  }

  const client = getConnectionClient(connection)

  cacheClients[cacheKey] = client
  return client
}

/**
 * Get index name, that is an alias by default.
 * Aliases are a powerful way to re-index data with no downtime.
 * https://www.elastic.co/guide/en/elasticsearch/guide/current/index-aliases.html
 * @param {Object}
 * @param {String} platformId - Name of new index used to produce alias if aliasWithoutVersionSuffix
 * @param {String} env
 * @param {Boolean} [type=asset] - type of index objects
 * @param {String}  [tag] - index tag (e.g. 'new')
 * @return {String} - Index name/alias
 */
function getIndex ({ platformId, env, type = 'asset', tag } = {}) {
  let index = `index_${type}`

  if (!env) throw new Error('Missing environment')

  if (process.env.REMOTE_STORE === 'true') {
    index += `_${platformId ? `${platformId}_${env}` : ''}`
  }

  index += `${tag ? `__${tag}` : ''}`

  return index
}

async function getListIndices ({ platformId, env, type }) {
  const client = await getClient({ platformId, env })
  const indexPattern = getIndex({ platformId, env, type }) + '*'

  const result = await client.indices.getAlias({
    index: indexPattern
  })

  return result
}

async function isIndexExisting ({ platformId, env, type, tag } = {}) {
  const client = await getClient({ platformId, env })
  const index = getIndex({ platformId, env, type, tag })

  const indexExists = await client.indices.exists({ index })
  return indexExists
}

/**
 * Create index
 * 'useAlias' parameter should be set to false when creating a new index.
 * Aliases are a powerful way to re-index data with no downtime.
 * https://www.elastic.co/guide/en/elasticsearch/guide/current/index-aliases.html
 * @param {Object}
 * @param {String} platformId - Name of new index used to produce alias if aliasWithoutVersionSuffix
 * @param {String} env
 * @param {String} type - type of index objects
 * @param {Boolean} useAlias - if true, set an alias to this index
 * @param {String}  [aliasTag] - alias tag (e.g. 'new')
 * @param {Function}  [customBodyFn] - must return the customized body (custom mappings, settings...)
 * @return {String} - Index
 */
async function createIndex ({ platformId, env, type, customAttributes, useAlias = false, aliasTag, customBodyFn } = {}) {
  const client = await getClient({ platformId, env })

  // YYYY-MM-DDTHH:MM:SS.sssZ is converted into YYYY_MM_DD_HH_MM_SS_sssz
  // create a date tag so it is easy to identify them, must be lowercase
  const tag = new Date().toISOString().replace(/[T.:-]/gi, '_').toLowerCase()
  const index = getIndex({ platformId, env, tag })

  const { body } = getNewIndexProperties({
    customBodyFn: (body) => {
      body.aliases = {}

      if (env === 'live') {
        _.set(body, 'settings.index.auto_expand_replicas', autoExpandReplicas)
      }

      if (typeof customBodyFn === 'function') body = customBodyFn(body)
      return body
    },
    addMapping: true,
    customAttributes
  })

  if (useAlias) {
    const alias = getIndex({ platformId, env, type, tag: aliasTag })
    body.aliases[alias] = {}
  }

  await client.indices.create({ index, body })

  return index
}

async function deleteIndex ({ platformId, env, type, tag } = {}) {
  const client = await getClient({ platformId, env })
  const index = getIndex({ platformId, env, type, tag })

  await client.indices.delete({ index })
}

async function getCurrentIndex ({ platformId, env, type }) {
  const indices = await getListIndices({ platformId, env, type })
  const currentIndexAlias = getIndex({ platformId, env, type })

  let currentIndex

  Object.keys(indices).forEach(index => {
    if (currentIndex) return

    if (indices[index].aliases[currentIndexAlias]) {
      currentIndex = index
    }
  })

  return currentIndex
}

async function getMapping ({ platformId, env, type, tag }) {
  const client = await getClient({ platformId, env })
  const index = getIndex({ platformId, env, type, tag })

  const result = await client.indices.getMapping({
    index
  })

  if (!result) return result

  // can be different from searched index due to aliases
  const indexName = Object.keys(result)[0]

  return result[indexName].mappings
}

async function updateMapping ({ platformId, env, type = 'asset', customAttributes, tag } = {}) {
  const mapping = getIndexMappingTemplate({ type, customAttributes })

  const client = await getClient({ platformId, env })
  const index = getIndex({ platformId, env, type, tag })

  // With elasticsearch SDK, we need to pass type: '_doc' and include_type_name to true
  // Omiting them, an error message "Unable to build a path with those params" occurs
  // TODO: maybe it will be fixed to upgrade to the new supported SDK @elastic/elasticsearch
  await client.indices.putMapping({
    index,
    type: '_doc',
    include_type_name: true,
    body: mapping
  })
}

const REGEX_MAPPING_TYPE_ERROR = /mapper \[.*\] of different type/

/**
 * Standardize Elasticsearch error type
 * @param {String} message
 * @return {String} errorType
 */
function getErrorType (message) {
  if (REGEX_MAPPING_TYPE_ERROR.test(message)) {
    return 'MAPPING_TYPE_ERROR'
  } else {
    return 'OTHER'
  }
}
