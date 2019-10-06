const createError = require('http-errors')
const _ = require('lodash')
const debug = require('debug')('stelace:api:search')

const { logError } = require('../../logger')

const {
  getIndex,
  getClient
} = require('../elasticsearch')

const {
  syncAssetsWithElasticsearch
} = require('../elasticsearch-sync')

const {
  getPendingReindexingTask
} = require('../elasticsearch-reindex')

const { getModels } = require('../models')

let responder
let subscriber
let assetSubscriber
let publisher
let availabilityRequester
let configRequester

// Compile these once
const activeInFilterRegex = builtInUsedInFilterRegex('_active')
const validatedInFilterRegex = builtInUsedInFilterRegex('_validated')
const categoryIdInFilterRegex = builtInUsedInFilterRegex('_categoryId')
const assetTypeIdInFilterRegex = builtInUsedInFilterRegex('_assetTypeId')
const whitespaceInQueryRegex = /\s/

function start ({ communication, isSystem }) {
  const {
    getResponder,
    getSubscriber,
    getRequester,
    getPublisher,
    COMMUNICATION_ID
  } = communication

  responder = getResponder({
    name: 'Search Responder',
    key: 'search'
  })

  subscriber = getSubscriber({
    name: 'Search subscriber',
    key: 'search',
    namespace: COMMUNICATION_ID,
    subscribesTo: [
      'assetsSearched'
    ]
  })

  assetSubscriber = getSubscriber({
    name: 'Search-asset subscriber',
    key: 'asset',
    namespace: COMMUNICATION_ID,
    subscribesTo: [
      'assetCreated',
      'assetUpdated',
      'assetDeleted'
    ]
  })

  publisher = getPublisher({
    name: 'Search publisher',
    key: 'search',
    namespace: COMMUNICATION_ID
  })

  availabilityRequester = getRequester({
    name: 'Search service > Availability Requester',
    key: 'availability'
  })

  configRequester = getRequester({
    name: 'Search service > Config Requester',
    key: 'config'
  })

  responder.on('search', async (req) => {
    const platformId = req.platformId
    const env = req.env

    const { searchQuery, _size, _validateOnly, parsedFilter } = req

    const { CustomAttribute, Asset } = await getModels({ platformId, env })

    const config = await configRequester.send({
      type: '_getConfig',
      platformId,
      env,
      access: 'default'
    })
    const searchConfig = config.stelace.search || {}

    const defaultMaxDistance = searchConfig.maxDistance

    const defaultAvailabilityFilter = {
      enabled: true,
      fullPeriod: true
    }

    const {
      query,
      categoryId,
      assetTypeId,
      location,
      maxDistance = defaultMaxDistance,
      startDate,
      endDate,
      createdBefore,
      createdAfter,
      quantity,
      without,
      similarTo,
      page = 1,
      nbResultsPerPage = 20,
      customAttributes: customAttributesQuery,
      filter,
      active = true,
      validated,
      sort,
      availabilityFilter: userAvailabilityFilter
    } = searchQuery

    const availabilityFilter = Object.assign({}, defaultAvailabilityFilter, userAvailabilityFilter)

    if (startDate && endDate && endDate <= startDate) {
      throw createError(422, 'Start date must be before end date')
    }

    debug('Preparing ElasticSearch request…')

    let customAttributes = req._customAttributes // can be populated by some middleware
    let indexedCustomAttributes = {}

    if (_.isEmpty(customAttributes) && (
      !!customAttributesQuery || query || similarTo || (sort && sort.length))
    ) {
      customAttributes = await CustomAttribute.query()
    }
    if (!_.isEmpty(customAttributes)) {
      indexedCustomAttributes = await _.keyBy(customAttributes, 'name')
    }

    if (customAttributesQuery) {
      const validCustomAttributes = Object.keys(customAttributesQuery).reduce((memo, name) => {
        if (!indexedCustomAttributes[name]) {
          return memo && false
        }
        return memo
      }, true)

      if (!validCustomAttributes) {
        throw createError(422, 'Unknown attribute in custom attributes query object')
      }

      // TODO: make this check in dev env only and
      // restrict custom attributes reindexing in prod for performance
      const reindexingTask = await getPendingReindexingTask({ platformId, env })
      if (reindexingTask && customAttributesQuery[reindexingTask.newCustomAttributeName]) {
        const errorMsg = `Cannot filter with the custom attribute "${reindexingTask.newCustomAttributeName}" while reindexing is processing`
        throw createError(422, errorMsg)
      }
    }

    // keep the default size to 1000 as it is not big overhead, (readjust if needed)
    const DEFAULT_SIZE = 1000
    let size = DEFAULT_SIZE

    // only allow to override the default size in testing environment to check Elasticsearch pagination
    if (process.env.NODE_ENV === 'test' && _size) {
      size = _size
    }

    const body = {
      query: {},
      size
    }

    const index = getIndex({ platformId, env })

    const bool = {
      filter: [] // ES filter context
    }
    let moreLikeThis
    const sortParams = []

    const hasFilter = !!parsedFilter
    // Don’t filter assets on `active` by default when using null reset
    // or when `_active` is used in filter
    const activeInFilter = hasFilter && checkFilterBuiltIn(filter, activeInFilterRegex)
    if (active !== null && !activeInFilter) {
      bool.filter.push({ term: { active } })
    }
    // Same here: user filter’s `_validated` builtIn takes precedence over user `validated`
    const validatedInFilter = hasFilter && checkFilterBuiltIn(filter, validatedInFilterRegex)
    if (typeof validated === 'boolean' && !validatedInFilter) {
      bool.filter.push({ term: { validated } })
    }

    const categoryIdInFilter = hasFilter && checkFilterBuiltIn(filter, categoryIdInFilterRegex)
    // Note that in filter _categoryId[cat1, cat2] can be used as OR too. Same for assetType below
    if (categoryId && categoryId.length && !categoryIdInFilter) {
      bool.filter.push({
        terms: { categoryId }
      })
    }

    const assetTypeIdInFilter = hasFilter && checkFilterBuiltIn(filter, assetTypeIdInFilterRegex)
    if (assetTypeId && assetTypeId.length && !assetTypeIdInFilter) {
      bool.filter.push({
        terms: { assetTypeId }
      })
    }

    if (without && without.length) {
      bool.filter.push({
        bool: {
          must_not: { terms: { _id: without } }
        }
      })
    }

    if (location) {
      // Earth circumference
      // https://en.wikipedia.org/wiki/Earth%27s_circumference
      const maxLimit = '40000km'

      bool.filter.push({
        geo_distance: {
          distance: maxDistance ? `${maxDistance}m` : maxLimit,
          locations: {
            lat: location.latitude,
            lon: location.longitude
          }
        }
      })
    }

    if (createdBefore || createdAfter) {
      const createdDateQuery = {}
      if (createdBefore) createdDateQuery.lte = createdBefore
      if (createdAfter) createdDateQuery.gte = createdAfter

      bool.filter.push({
        range: {
          createdDate: createdDateQuery
        }
      })
    }

    if (customAttributesQuery) {
      const { filter } = transformCustomAttributesQuery({
        customAttributesQuery,
        indexedCustomAttributes
      })

      if (filter) {
        bool.filter = bool.filter.concat(filter)
      }
    }

    const textFields = [
      'name^2',
      'description'
    ]
    for (const attributeName in indexedCustomAttributes) {
      const attribute = indexedCustomAttributes[attributeName]
      if (attribute.type === 'text') textFields.push(`customAttributes.${attributeName}`)
    }

    if (_.isEmpty(similarTo)) {
      if (query) {
        const shortQuery = []
        if (query.length < 3) {
          // Specifically handle short queries for which we can’t use trigrams.
          // We use edge ngrams in Asset name only
          // to provide autocomplete-like functionality without lowering relevance.
          shortQuery.push({
            match: { 'name.edge_ngrams': query }
          })
        }
        const multiTokenQuery = []
        // Ensuring we don’t match too many assets for multi-token queries.
        // 3 tokens at least so we have two different shingles or more to check.
        if (query.split(whitespaceInQueryRegex).length >= 3) {
          multiTokenQuery.push({
            multi_match: {
              fields: ['allContent.shingles'],
              query,
              minimum_should_match: '70%' // 1 of 2 shingles (extracted from 3 tokens)
              // 2 of 3/4 shingles, 3 of 5…
            }
          })
        }

        // Two steps:
        // 1. We _filter_ results (no score yet):
        //    - on high trigram match rate for compounds words (languages like German)
        //    - OR matched ICU tokenized words (trigrams perform poorly on Asian languages)
        // 2. Then we boost results having shingles or token match with bool.should

        bool.filter.unshift({ // most specific filter first for performance
          bool: {
            should: [
              { // High trigram match rate, useful for compound words (e.g. German)
                // https://www.elastic.co/guide/en/elasticsearch/guide/current/ngrams-compound-words.html
                // Note that match must be (almost) exact with fuzziness limited to edges:
                // 'seeadler' or 'seeadlet' will match 'Weißkopfseeadler'
                // but unfortunately not 'seexdler' since its 'x'
                // introduces several trigrams that don’t match (eex, exd, xdl).
                multi_match: {
                  fields: ['allContent.trigrams'],
                  query,
                  // Both of 2 trigrams, (n-1) of n trigrams up to n=10, then (n-2) of n up to 20, …
                  minimum_should_match: '2<90%'
                  // Trigrams are a moving window: 'Naus' query has two trigrams 'Nau', 'aus',
                  // and will match 'Nausicaa' text, unlike 'Naur' query since 'aur' trigram does not match.
                }
              },
              { // Token fuzzy match _and_ control for relevance in multi-token queries
                bool: {
                  filter: [
                    {
                      multi_match: {
                        fields: ['allContent'],
                        query,
                        cutoff_frequency: 0.05,
                        fuzziness: 'AUTO',
                        prefix_length: 3,
                        minimum_should_match: '70%' // 1 of 2 tokens, 2 of 3/4, 3 of 5, 4 of 6/7
                      }
                    },
                    ...multiTokenQuery
                  ]
                }
              },
              ...shortQuery
            ]
          }
        })

        // Second step: boosting relevant results
        // We avoid using specific query boosting since it’s not linear and cause unpredictable results.
        // https://www.elastic.co/guide/en/elasticsearch/guide/master/_boosting_query_clauses.html
        // Adding specific rules is the preferred method to tune relevance.

        // TODO: add regression test suite with specific full-text scenarios
        // (e.g. using Stelace Heroes Demo), focusing on rules below and precision/recall.
        bool.should = [
          { // Fuzzy match
            match: {
              allContent: {
                query,
                cutoff_frequency: 0.05,
                fuzziness: 'AUTO',
                prefix_length: 3
              },
            }
          },
          { // “Boost” full-word shingles
            // + edge ngrams in Asset name for search-as-you-type experience
            multi_match: {
              fields: ['allContent.shingles', 'name.edge_ngrams'],
              query,
              // 'most_field' type only appropriate for allContent + name (redundant),
              // not for any additional field since it divides scores:
              // https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-multi-match-query.html#type-most-fields
              type: 'most_fields'
            }
          },
          { // Boost trigram shingles (+ additional boost for match on Asset name)
            multi_match: {
              fields: ['allContent.trigrams_shingles', 'name.trigrams_shingles'],
              query,
              // 'most_field' type only appropriate for allContent + name (redundant),
              // not for any additional field since it divides scores:
              // https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-multi-match-query.html#type-most-fields
              type: 'most_fields',
              // 'minimum_should_match' applies to each field when using 'multi_match' with default type or 'most_fields' type
              // https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-multi-match-query.html#operator-min
              // which is not a problem here since allContent already includes name, so we don’t need 'cross_fields' type
              minimum_should_match: '70%',
            }
          },
          ...shortQuery
        ]
      } else {
        bool.must = {
          match_all: {}
        }
      }
    } else { // similar assets search
      const like = []
      similarTo.forEach(assetId => {
        like.push({
          _index: index,
          _id: assetId
        })
      })

      if (query) like.push(query)

      moreLikeThis = {
        // https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-mlt-query.html
        fields: textFields,
        like,
        min_term_freq: 1, // Defaults to 2: we could miss rare words.
        max_query_terms: 25, // Default
        min_doc_freq: 1, // computed _per shard_, defaults to 5: might miss results
        // when using several primary shards with small index or rare words.
        min_word_length: 3, // consistent with our trigram-centric search. Defaults to 0.
        minimum_should_match: '1<50% 6<2 10<20%' // Default: 30%.
        // We expect 5 tokens if we have 25 query terms,
        // but only 1 of 2 or 3 tokens (like 30% default value) for assets with _really_ short text
        // 2 of 4/5/6 (stricter than default)
        // 2 of 7/8/9 tokens (same as default)
        // and 2 of 10/…/14 tokens (where it becomes looser than 30% default)
        // …
      }
    }

    let availabilitySortingActive = false
    let availabilitySortingOrder

    if (sort) {
      const sortableAvailabilityAttribute = '_available'
      const sortableBuiltInAttributes = [
        '_createdDate',
        '_updatedDate',
        '_name',
        '_validated',
        '_active',
        '_price'
      ]
      const sortableBuiltInAttributesWithKeyword = [
        '_name'
      ]
      const sortableAttributesTypes = ['text', 'number', 'boolean']

      /* Let’s turn
      [
        { customAttributeName: 'asc' },
        { _price: 'desc' }
      ]
      into
      [
        { 'customAttributes.customAttributeName': { order: 'asc', missing: '_last' } },
        { price: { order: 'desc', missing: '_last' } },
        '_score'
      ]
      */

      sort.forEach((step, i) => {
        const name = Object.keys(step)[0]
        const customAttribute = indexedCustomAttributes[name]

        const isSortableBuiltInAttributesKeyword = sortableBuiltInAttributes.includes(name)
        const isSortableBuiltInAttributesWithKeyword = sortableBuiltInAttributesWithKeyword.includes(name)

        if (name === sortableAvailabilityAttribute) {
          if (i === 0) {
            // do not push into sort params because the availability isn't handled by Elasticsearch
            availabilitySortingActive = true
            availabilitySortingOrder = step[name]
          } else {
            throw createError(422, `${sortableAvailabilityAttribute} sorting should come as the first element of the sorting array`)
          }
        } else if (isSortableBuiltInAttributesKeyword) {
          // remove the built-in character indicator '_' if needed
          let realName
          if (name.charAt(0) === '_') {
            realName = name.slice(1)
          } else {
            realName = name
          }

          let sortKey = realName

          if (isSortableBuiltInAttributesWithKeyword) {
            sortKey += '.keyword'
          }

          sortParams.push({
            [sortKey]: {
              order: step[name],
              missing: '_last'
            // All assets should have a price
            // but in the future other built-in attributes could be missing
            }
          })
        } else if (customAttribute && _.includes(sortableAttributesTypes, customAttribute.type)) {
          // Add '.keyword' to text field key to allow sorting
          // https://www.elastic.co/guide/en/elasticsearch/reference/current/fielddata.html
          const customAttributeKey =
            `customAttributes.${name}${customAttribute.type === 'text' ? '.keyword' : ''}`
          sortParams.push({
            [customAttributeKey]: {
              order: step[name],
              missing: '_last'
            // We must deal with assets missing this custom attribute
            }
          })
        } else {
          throw createError(422, `Can't sort by custom attribute ${name} of type ${
            customAttribute && customAttribute.type
          }`)
        }
      })

      // Must include ElasticSearch score event when not using query or location
      // Due to match_all used as a placeholder in empty ES query
      sortParams.push('_score')
    }

    // FINALIZE ELASTIC SEARCH QUERY

    // Useful links to adjust scoring:
    // https://www.elastic.co/guide/en/elasticsearch/guide/current/function-score-query.html
    // https://www.elastic.co/guide/en/elasticsearch/guide/current/decay-functions.html

    const queryBody = {}
    if (bool) queryBody.bool = bool

    // more_like_this can’t coexist with bool at root
    if (queryBody.bool && moreLikeThis) {
      if (!queryBody.bool.must) {
        queryBody.bool.must = { more_like_this: moreLikeThis }
      } else {
        if (Array.isArray(queryBody.bool.must)) {
          queryBody.bool.must = queryBody.bool.must.concat([{ more_like_this: moreLikeThis }])
        } else {
          queryBody.bool.must = [queryBody.bool.must].concat([{ more_like_this: moreLikeThis }])
        }
      }
    } else if (moreLikeThis) {
      queryBody.more_like_this = moreLikeThis
    }

    // Filter DSL parsed by Stelace plugin middleware
    if (parsedFilter && queryBody.bool && queryBody.bool.filter) {
      queryBody.bool.filter = queryBody.bool.filter.concat(parsedFilter)
    }

    body.query = queryBody

    if (sort) {
      body.sort = sortParams
    } else {
      // need to have some sort params for ES "search after" pagination
      body.sort = [
        '_score',
        { createdDate: { order: 'desc' } }
      ]
    }

    debug('ElasticSearch Query Body %j', body)

    const client = await getClient({ platformId, env })

    let hasAdditionalResults = true
    const indexedResultAssetsIds = {}
    let nbResultsFetched = 0 // depends on size
    const maxNbResults = page * nbResultsPerPage
    let maxNbResultsReached = false
    let currentNbResults = 0
    let allResults = []
    let availableResults = []
    let unavailableResults = []
    let nbTotalResults
    let results
    let searchAfterParams

    // each run can only have `size` (defined above) number of assets
    // but some asset are filtered by availability so this isn't the real number
    // until we run out of ES results, we continue until max count of results is reached
    while (hasAdditionalResults && !maxNbResultsReached) {
      // if there is search after params set from previous runs, use it to pagination ES results
      if (searchAfterParams) {
        const escapedSearchAfterParams = []

        searchAfterParams.forEach(value => {
          let escapedValue = value

          // When sort params has integer that goes beyond JS limit (Number.MIN_SAFE_INTEGER or Number.MAX_SAFE_INTEGER)
          // it will fail because JS doesn't handle properly them
          // That happens when there are missing values. Elasticsearch handles them by setting at min/max value of Java Integer (which is higher than JS Integer)
          // Solution: use string to express the min/max limit
          // See https://github.com/elastic/elasticsearch-js/issues/662
          if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
            const ES_MIN_LIMIT = '-9223372036854775808'
            const ES_MAX_LIMIT = '9223372036854775807'

            if (value > 0) {
              escapedValue = ES_MAX_LIMIT
            } else {
              escapedValue = ES_MIN_LIMIT
            }
          }

          escapedSearchAfterParams.push(escapedValue)
        })

        body.search_after = escapedSearchAfterParams
      }

      // do not trigger search but only validate the query
      if (isSystem(req._systemHash) && _validateOnly) {
        return { success: true }
      }

      results = await client.search({
        index,
        body
      })

      if (!_.isNumber(nbTotalResults)) {
        nbTotalResults = getNbTotalResults(results)
      }

      debug(`${nbTotalResults} new ElasticSearch results`)

      results = formatElasticsearchResults(results)

      nbResultsFetched += results.length

      // empty results, stop fetching new results
      if (!results.length) {
        hasAdditionalResults = false
        break
      }

      // set the search after params from the last results in case of next run
      searchAfterParams = _.last(results)._sort

      let tmpResults = []

      // only keep assets that haven't already been processed during previous runs
      results.forEach(asset => {
        if (!indexedResultAssetsIds[asset.id]) {
          indexedResultAssetsIds[asset.id] = true
          tmpResults.push(asset)
        }
      })

      // No tmp results means all assets haven’t been processed yet and we are in a loop
      // that can happen if many results have the same sort score (ES will misread the last result from the previous page)
      if (!tmpResults.length) {
        hasAdditionalResults = false
        break
      }

      results = tmpResults
      tmpResults = null

      results = removeIrrelevantResults(results)
      debug('Results:', results.map(r => _.pick(r, ['id', 'name', '_score', '_sort'])))
      results = removeESMetaField(results)

      const assetsIds = results.map(asset => asset.id)

      const allAvailable = await availabilityRequester.send({
        type: '_isAvailable',
        assetsIds,
        startDate,
        endDate,
        quantity,
        fullPeriod: availabilityFilter.fullPeriod,
        unavailableWhen: availabilityFilter.unavailableWhen,
        platformId,
        env
      })

      // show only available assets
      // do not take into account availability sort as only available assets will be displayed
      if (availabilityFilter.enabled) {
        results = results.filter(asset => {
          const available = allAvailable[asset.id]
          return available
        })

        allResults = allResults.concat(results)
        currentNbResults += results.length
      } else {
        // add the attribute 'available' to the assets
        results.forEach(asset => {
          const available = allAvailable[asset.id]
          asset.available = available
        })

        // if the availability sorting is active, we separate available from unavailable assets
        // so we can easily perform the sort by concatenate the two arrays in the right order
        if (availabilitySortingActive) {
          const [
            availableAssets,
            unavailableAssets
          ] = _.partition(results, asset => asset.available)

          availableResults = availableResults.concat(availableAssets)
          unavailableResults = unavailableResults.concat(unavailableAssets)

          // count the available or unavailable results depending the availability sorting order
          // if 'desc', count available assets
          // else if 'asc', count unavailable assets

          // example: if we query page = 1 and nbResultsPerPage = 100
          // and the availability order id 'desc'
          // we expect to fetch at least 100 available assets
          // and we will keep fetching results until we get them all
          if (availabilitySortingOrder === 'desc') {
            currentNbResults += availableAssets.length
          } else {
            currentNbResults += unavailableAssets.length
          }
        } else {
          allResults = allResults.concat(results)
          currentNbResults += results.length
        }
      }

      if (nbTotalResults <= nbResultsFetched) {
        hasAdditionalResults = false
      }

      // if the max count is reached, stop the process
      maxNbResultsReached = currentNbResults >= maxNbResults
    }

    // concat available and unavailable results if there are no more results to retrieve
    // because we are sure all results are covered so the order is correct
    if (availabilitySortingActive && !hasAdditionalResults) {
      if (availabilitySortingOrder === 'desc') {
        allResults = allResults.concat(availableResults).concat(unavailableResults)
      } else {
        allResults = allResults.concat(unavailableResults).concat(availableResults)
      }

      currentNbResults = allResults.length
    }

    debug('Availability filtering on search results done')

    let exposedResults = getResultsByPagination(allResults, page, nbResultsPerPage)
    exposedResults = formatResults(exposedResults)
    exposedResults = Asset.exposeAll(exposedResults, { req })

    const eventDate = new Date().toISOString()

    publisher.publish('assetsSearched', {
      firstResult: exposedResults[0],
      resultsIds: _.map(exposedResults, 'id'),
      searchQuery,
      eventDate,
      platformId,
      env
    })

    return {
      page,
      nbResultsPerPage,
      nbResults: currentNbResults,
      nbPages: Math.ceil(currentNbResults / nbResultsPerPage),
      exhaustiveNbResults: !hasAdditionalResults,
      results: exposedResults
    }
  })

  // EVENTS

  subscriber.on('assetsSearched', async ({
    firstResult,
    resultsIds,
    searchQuery,
    eventDate,
    platformId,
    env
  } = {}) => {
    try {
      const { Event } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'assets__searched',
        objectType: 'asset',
        objectId: firstResult ? firstResult.id : null, // event without object is an exception
        object: firstResult || null,
        metadata: {
          resultsIds,
          searchQuery
        }
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { searchQuery, resultsIds },
        message: 'Fail to create event assets__searched'
      })
    }
  })

  assetSubscriber.on('assetCreated', async ({ asset, eventDate, platformId, env } = {}) => {
    syncAssetsWithElasticsearch({
      assetId: asset.id,
      asset,
      action: 'create',
      platformId,
      env
    })
  })

  assetSubscriber.on('assetUpdated', async ({ assetId, updateAttrs, newAsset, eventDate, platformId, env } = {}) => {
    syncAssetsWithElasticsearch({
      assetId,
      asset: newAsset, // pass the entire object as it is needed in the search sync process
      action: 'update',
      platformId,
      env
    })
  })

  assetSubscriber.on('assetDeleted', async ({ assetId, eventDate, platformId, env } = {}) => {
    syncAssetsWithElasticsearch({
      assetId,
      action: 'delete',
      platformId,
      env
    })
  })
}

function builtInUsedInFilterRegex (name) {
  return new RegExp(`["'\\s(!]${name}`)
}

function checkFilterBuiltIn (filter, regexp) {
  // add one leading space to keep regex above simple
  return filter && regexp.test(` ${filter}`)
}

function getNbTotalResults (res) {
  if (!res) return 0

  const total = _.get(res, 'hits.total')
  if (!total) return 0

  // don't check `total.relation` that can be equal to 'eq' or 'gte'
  // because if 'gte' is returned, it would be a high total number of results
  // https://www.elastic.co/guide/en/elasticsearch/reference/7.0/search-request-track-total-hits.html#search-request-track-total-hits
  return total.value
}

function formatElasticsearchResults (res) {
  if (!res || !res.hits) {
    return []
  }

  return res.hits.hits.map(value => {
    const asset = value._source

    asset.id = value._id
    asset._score = value._score
    asset._sort = value.sort // useful for search after functionality

    return asset
  })
}

function removeIrrelevantResults (results) {
  return results.filter(result => result._score > 0)
}

function getResultsByPagination (results, page, limit) {
  return results.slice((page - 1) * limit, page * limit)
}

function formatResults (results) {
  return results.reduce((memo, result) => {
    const newResult = Object.assign({}, result)

    // rebuild locations as in the API
    if (newResult.rawLocations) {
      newResult.locations = newResult.rawLocations
    } else {
      // remove those lines when the reindexing with field `rawLocations` is done
      newResult.locations = newResult.locations.map(loc => {
        return {
          latitude: loc.lat,
          longitude: loc.lon
        }
      })
    }

    delete newResult.rawLocations
    memo.push(newResult)
    return memo
  }, [])
}

function removeESMetaField (results) {
  return results.map(result => {
    return _.omit(result, ['_score', '_sort'])
  })
}

function transformCustomAttributesQuery ({ customAttributesQuery, indexedCustomAttributes }) {
  const filter = []

  Object.keys(customAttributesQuery).forEach(name => {
    const customAttribute = indexedCustomAttributes[name]
    const key = `customAttributes.${name}`
    const value = customAttributesQuery[name]

    // TODO: manage null values
    if (value === null) {
      return
    }

    switch (customAttribute.type) {
      case 'number':
        if (typeof value === 'number') {
          filter.push({
            term: { [key]: value }
          })
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          const diff = _.difference(Object.keys(value), ['gt', 'gte', 'lt', 'lte'])
          if (diff.length) {
            _throwInvalidCustomAttributeError({ name, type: customAttribute.type })
          }

          filter.push({
            range: { [key]: value }
          })
        } else {
          _throwInvalidCustomAttributeError({ name, type: customAttribute.type })
        }
        break

      case 'boolean':
        if (typeof value === 'boolean') {
          filter.push({
            term: { [key]: value }
          })
        } else {
          _throwInvalidCustomAttributeError({ name, type: customAttribute.type })
        }
        break

      case 'select':
        if (Array.isArray(value)) {
          filter.push({
            terms: { [key]: value }
          })
        } else {
          filter.push({
            term: { [key]: value }
          })
        }
        break

      case 'tags':
        if (Array.isArray(value)) {
          filter.push({
            bool: {
              // TODO: rework this if performance issue for long lists of values
              must: value.map(val => {
                return { term: { [key]: val } }
              })
            }
          })
        } else {
          filter.push({
            term: { [key]: value }
          })
        }
        break

      case 'text':
        if (typeof value === 'string') {
          filter.push({
            term: { [`${key}.keyword`]: value }
          })
        } else {
          _throwInvalidCustomAttributeError({ name, type: customAttribute.type })
        }
        break

      default:
        break
    }
  })

  return {
    filter: filter.length ? filter : null
  }

  function _throwInvalidCustomAttributeError ({ name, type }) {
    throw createError(422, `Invalid value for custom attribute ${name} of type ${type}`)
  }
}

function stop () {
  responder.close()
  responder = null

  subscriber.close()
  subscriber = null

  assetSubscriber.close()
  assetSubscriber = null

  publisher.close()
  publisher = null

  availabilityRequester.close()
  availabilityRequester = null

  configRequester.close()
  configRequester = null
}

module.exports = {
  start,
  stop
}
