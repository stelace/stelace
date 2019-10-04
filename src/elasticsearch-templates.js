const _ = require('lodash')

const autoExpandReplicas = '1-3'
const elisionArticles = getElisionArticles()

/**
 * Populates the index body to post when creating a new index in ElasticSearch.
 * @param {Object}
 * @param {String} [type=asset] - Type of object stored in the index
 * @param {Boolean} [addMapping] - Add mapping to index creation body
 * @param {Function} [customBodyFn] - Allow to customize the body, should return the new body
 * @param {Array.<Object>} [customAttributes] - Inject some custom attribute objects into index mappings
 * @return {Object} - Index body to post with ElasticSearch indices.create method
 */
function getNewIndexProperties ({
  type = 'asset',
  customBodyFn,
  addMapping,
  customAttributes = []
}) {
  const defaultBody = {}

  if (addMapping === true) {
    defaultBody.mappings = getIndexMappingTemplate({ type, customAttributes })
    defaultBody.settings = getIndexSettingsTemplate({ type })
  }

  let indexBody = defaultBody
  if (typeof customBodyFn === 'function') {
    const newBody = customBodyFn(_.cloneDeep(indexBody))
    if (!_.isPlainObject(newBody)) {
      throw new Error('Expected an object for custom body')
    }

    indexBody = newBody
  }

  return {
    body: indexBody
  }
}

function getIndexMappingTemplate ({ type, customAttributes }) {
  switch (type) {
    case 'asset':
      return getAssetMappingTemplate(customAttributes)
    default:
      throw new Error(`Can’t get mapping for invalid object type "${type}"`)
  }
}

function getCustomAttributesMapping (customAttributes = []) {
  const customAttributesMapping = {
    type: 'object'
  }

  if (customAttributes.length) {
    customAttributesMapping.properties = {}
  }

  customAttributes.forEach(customAttribute => {
    const key = customAttribute.name

    switch (customAttribute.type) {
      case 'number':
        customAttributesMapping.properties[key] = {
          type: 'float'
        }
        break

      case 'boolean':
        customAttributesMapping.properties[key] = {
          type: 'boolean'
        }
        break

      case 'text':
        customAttributesMapping.properties[key] = {
          type: 'text',
          analyzer: 'stl_icu_analyzer',
          copy_to: 'allContent',
          fields: {
            keyword: {
              type: 'keyword',
              ignore_above: 256
            }
          }
        }
        break

      case 'select':
        customAttributesMapping.properties[key] = {
          type: 'keyword'
        }
        break

      case 'tags':
        customAttributesMapping.properties[key] = {
          type: 'keyword'
        }
        break

      default:
        break
    }
  })

  return customAttributesMapping
}

function getAssetMappingTemplate (customAttributes = []) {
  const customAttributesMapping = getCustomAttributesMapping(customAttributes)

  return {
    date_detection: false,
    properties: {
      createdDate: {
        type: 'date'
      },
      updatedDate: {
        type: 'date'
      },
      name: {
        type: 'text',
        analyzer: 'stl_icu_analyzer',
        copy_to: 'allContent',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256
          },
          edge_ngrams: {
            type: 'text',
            analyzer: 'stl_edge_ngrams_analyzer',
            // This is only used for short queries so we don’t need to extract edge ngrams from search query.
            // https://www.elastic.co/guide/en/elasticsearch/guide/current/_index_time_search_as_you_type.html
            search_analyzer: 'stl_icu_analyzer'
          },
          trigrams_shingles: {
            type: 'text',
            analyzer: 'stl_trigrams_shingles_analyzer'
          }
        }
      },
      ownerId: {
        type: 'keyword'
      },
      description: {
        type: 'text',
        analyzer: 'stl_icu_analyzer',
        copy_to: 'allContent'
      },
      locations: {
        type: 'geo_point'
      },
      // add raw locations because geo points don't allow custom data like 'name'
      rawLocations: {
        type: 'object'
      },
      categoryId: {
        type: 'keyword'
      },
      validated: {
        type: 'boolean'
      },
      active: {
        type: 'boolean'
      },
      assetTypeId: {
        type: 'keyword'
      },
      quantity: {
        type: 'integer'
      },
      price: {
        type: 'float'
      },
      currency: {
        type: 'keyword'
      },
      customAttributes: customAttributesMapping,
      metadata: {
        type: 'object'
      },
      platformData: {
        type: 'object'
      },

      // All text fields are copied into `allContent` field to enable term-centric instead of field-centric search
      // https://www.elastic.co/guide/en/elasticsearch/guide/current/field-centric.html
      // https://github.com/stelace/stelace-core/issues/14
      allContent: {
        type: 'text',
        analyzer: 'stl_icu_analyzer',
        fields: {
          trigrams: {
            type: 'text',
            analyzer: 'stl_trigrams_analyzer'
          },
          shingles: {
            type: 'text',
            analyzer: 'stl_token_shingles_analyzer'
          },
          trigrams_shingles: {
            type: 'text',
            analyzer: 'stl_trigrams_shingles_analyzer'
          }
        }
      }
    }
  }
}

function getIndexSettingsTemplate ({ type }) {
  switch (type) {
    case 'asset':
      return getAssetSettingsTemplate()
    default:
      throw new Error(`Can’t get settings for invalid object type "${type}"`)
  }
}

function getAssetSettingsTemplate () {
  const baseFilters = [
    'stl_elision_filter',
    'icu_normalizer',
    'icu_folding'
  ]

  return {
    analysis: {
      /*
        TIP: test analyzers with POST http://localhost:9200/index_asset_1_test/_analyze
        {
          "analyzer": "stl_icu_analyzer",
          "text": "風の谷"
        }
        https://www.elastic.co/guide/en/elasticsearch/reference/current/_testing_analyzers.html
      */
      analyzer: {
        stl_icu_analyzer: {
          type: 'custom',
          // // use icu_tokenizer to avoid over-tokenizing Asian languages
          // https://www.elastic.co/guide/en/elasticsearch/guide/current/icu-tokenizer.html
          tokenizer: 'icu_tokenizer',
          filter: baseFilters
        },
        stl_trigrams_analyzer: {
          type: 'custom',
          tokenizer: 'stl_trigrams_tokenizer',
          filter: baseFilters
          // No need to use stl_trigrams_filter since we already have trigram tokens
          // Dated but very clear example: https://stackoverflow.com/questions/37168764/tokenizer-vs-token-filters#answer-37169584
        },
        stl_token_shingles_analyzer: {
          type: 'custom',
          tokenizer: 'icu_tokenizer',
          filter: [
            ...baseFilters,
            'stl_token_shingle_filter'
          ]
        },
        stl_trigrams_shingles_analyzer: {
          type: 'custom',
          tokenizer: 'stl_trigrams_tokenizer',
          filter: [
            ...baseFilters,
            'stl_trigram_shingle_filter'
          ]
        },
        stl_edge_ngrams_analyzer: {
          type: 'custom',
          tokenizer: 'icu_tokenizer',
          filter: [
            ...baseFilters,
            'stl_edge_ngram_filter'
            // Extract small edge ngrams from each token for search-as-you type experience,
            // best suited for Asset name.
            // Again, we don’t need a full tokenizer but just a filter since we already have icu_tokenizer
            // https://www.elastic.co/guide/en/elasticsearch/reference/current/analysis-edgengram-tokenizer.html
          ]
        }
      },
      tokenizer: {
        // https://www.elastic.co/guide/en/elasticsearch/reference/6.6/analysis-ngram-tokenizer.html
        // Use a trigram tokenizer for compound words like in German language
        // to combine with minimum_should_match,
        // instead of a trigram filter as suggested in the following guide (loosing position of trigrams)
        // https://www.elastic.co/guide/en/elasticsearch/guide/current/ngrams-compound-words.html
        // Issue: https://github.com/elastic/elasticsearch/issues/21000
        stl_trigrams_tokenizer: {
          type: 'ngram',
          min_gram: 3,
          max_gram: 3,
          token_chars: [
            'letter',
            'digit',
            'symbol',
            'punctuation'
          ]
        }
      },
      char_filter: {

      },
      filter: {
        // https://www.elastic.co/guide/en/elasticsearch/reference/6.6/analysis-ngram-tokenfilter.html
        /* stl_trigrams_filter: {
          type: 'ngram',
          min_gram: 3,
          max_gram: 3
        }, */
        // https://www.elastic.co/guide/en/elasticsearch/reference/7.2/analysis-edgengram-tokenfilter.html
        stl_edge_ngram_filter: {
          type: 'edge_ngram',
          min_gram: 1,
          max_gram: 5,
        },
        // https://www.elastic.co/guide/en/elasticsearch/reference/6.6/analysis-shingle-tokenfilter.html
        stl_token_shingle_filter: {
          type: 'shingle',
          min_shingle_size: 2,
          max_shingle_size: 2,
          output_unigrams: false
        },
        stl_trigram_shingle_filter: {
          type: 'shingle',
          // Shingles are stored as tokens in the index, so that their TF-ID is calculated
          // and rare shingle matches enjoy a bigger score boost than more common phrases and simple trigrams
          min_shingle_size: 3, // focus on 5-char match: [Nausi]caa -> 'Nau aus usi' shingle
          // Better avoid multiple shingle sizes for performance and analysis:
          // https://github.com/elastic/elasticsearch/issues/23594#issuecomment-292997426
          max_shingle_size: 3,
          // Why set shingle size to 3 (5 chars window)?
          // We already have trigrams and size 2 (4 chars) would be too close to make a real difference.
          // Size 4 (6 chars) and 5 would be nice but 3 ensures we don’t miss too many significant matches.
          // Anyway longer matches (than 5 chars) will simply have several matching shingles instead of 1,
          // E.g What would be a shingle of size 4 match (6 chars) will span over two shingles of size 3 (5 chars).
          output_unigrams: false
        },
        // https://www.elastic.co/guide/en/elasticsearch/reference/6.6/analysis-elision-tokenfilter.html
        stl_elision_filter: {
          type: 'elision',
          articles: elisionArticles,
          articles_case: true
        }
      }
    }
  }
}

// https://www.elastic.co/guide/en/elasticsearch/reference/current/analysis-lang-analyzer.html
// we use elisions from all following languages as it should not cause major conflict
function getElisionArticles () {
  const catalan = ['d', 'l', 'm', 'n', 's', 't']
  const french = ['l', 'm', 't', 'qu', 'n', 's', 'j', 'd', 'c', 'jusqu', 'quoiqu', 'lorsqu', 'puisqu']
  const irish = ['d', 'm', 'b']
  const italian = [
    'c', 'l', 'all', 'dall', 'dell', 'nell', 'sull', 'coll', 'pell', 'gl', 'agl', 'dagl',
    'degl', 'negl', 'sugl', 'un', 'm', 't', 's', 'v', 'd'
  ]

  return _.uniqBy(
    []
      .concat(catalan)
      .concat(french)
      .concat(irish)
      .concat(italian)
  )
}

module.exports = {
  autoExpandReplicas,

  getNewIndexProperties,
  getIndexMappingTemplate,
  getIndexSettingsTemplate,
  getCustomAttributesMapping
}
