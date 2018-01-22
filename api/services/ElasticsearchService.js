/* global Listing, ListingCategory, ListingXTag, LoggerService, StelaceConfigService, Tag */

module.exports = {

    syncListings: syncListings,

    searchListings: searchListings,
    getSimilarListings: getSimilarListings,
    getListing: getListing,

    shouldSyncListings: shouldSyncListings,

    getClient: getClient,

};

const elasticsearch = require('elasticsearch');
const _ = require('lodash');

const LISTING_FIELDS = [
    'id',
    'name',
    'description',
    'stateComment',
    'bookingPreferences',
    'ownerId',
    'reference',
    'listingCategoryId',
];

let listingsIdsToSync = [];
let syncListingsTriggered = false;

// https://www.elastic.co/guide/en/elasticsearch/guide/2.x/bulk.html#_how_big_is_too_big
let maxDocPerBulk = 1000; // bulk can't be too big

let esClient;

function getHost() {
    const config = sails.config.elasticsearch;

    return {
        host: config.host,
        protocol: config.protocol,
        port: config.port,
        auth: `${config.user}:${config.password}`,
    };
}

// https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/logging.html
function LogToBunyan(/* config */) {
    // config is the object passed to the client constructor.
    const bun = LoggerService.getLogger('elasticsearch');
    this.error = bun.error.bind(bun);
    this.warning = bun.warn.bind(bun);
    this.info = bun.info.bind(bun);
    this.debug = bun.debug.bind(bun);
    this.trace = function (method, requestUrl, body, responseBody, responseStatus) {
        bun.trace({
            method: method,
            requestUrl: requestUrl,
            body: body,
            responseBody: responseBody,
            responseStatus: responseStatus
        });
    };
    this.close = function () { /* bunyan's loggers do not need to be closed */ };
}

function getClient() {
    if (esClient) {
        return esClient;
    }

    const host = getHost();

    esClient = new elasticsearch.Client({
        host: [host],
        log: LogToBunyan,
    });

    return esClient;
}

async function syncListings() {
    const client = getClient();

    const [
        listings,
        listingCategories,
        tags,
        listingsXTags,
    ] = await Promise.all([
        Listing.find({ validated: true }),
        ListingCategory.find(),
        Tag.find(),
        ListingXTag.find(),
    ]);

    const indexedCategories = _.indexBy(listingCategories, 'id');
    const indexedTags = _.indexBy(tags, 'id');
    const indexedListingsXTagsByListingId = _.groupBy(listingsXTags, 'listingId');

    const normalizedListings = _.map(listings, listing => {
        return normalizeListing(listing, { indexedCategories, indexedTags, indexedListingsXTagsByListingId });
    });

    const indexExists = await client.indices.exists({
        index: 'catalog',
    });

    if (indexExists) {
        await client.indices.delete({
            index: 'catalog',
        });
    }

    await client.indices.create({
        index: 'catalog',
    });

    await createCustomFrenchAnalyzer();
    await createTypeListingMapping();

    let body = [];

    for (let i = 0, l = normalizedListings.length; i < l; i++) {
        const listing = normalizedListings[i];

        body.push({ update: { _index: 'catalog', _type: 'listing', _id: listing.id } });
        body.push({ doc: _.omit(listing, 'id'), doc_as_upsert: true });

        if (i !== 0 && i % maxDocPerBulk === 0) {
            await client.bulk({ body });
            body = [];
        }
    }

    if (body.length) {
        await client.bulk({ body });
    }
}

async function createCustomFrenchAnalyzer() {
    const client = getClient();

    await client.indices.close({
        index: 'catalog',
    });

    const body = {
        analysis: {
            filter: {
                french_elision: {
                    type: 'elision',
                    articles_case: true,
                    articles: [
                        'l', 'm', 't', 'qu', 'n', 's',
                        'j', 'd', 'c', 'jusqu', 'quoiqu',
                        'lorsqu', 'puisqu',
                    ],
                },
                french_stop: {
                    type: 'stop',
                    stopwords: '_french_',
                },
                custom_french_stop: {
                    type: 'stop',
                    stopwords: [
                        'a', // add it because 'à' is a stop word and with asciifolding, it's transformed into 'a'
                        'location',
                        'louer',
                        'vendre',
                        'vente',
                        'euro',
                        'renseignement',
                        'contact',
                    ],
                },
                // french_keywords: {
                //     type: 'keyword_marker',
                //     keywords: [], // use this fields if some words must be protected from stemming
                // },
                french_stemmer: {
                    type: 'stemmer',
                    language: 'light_french',
                },
                custom_asciifolder: {
                    type: 'asciifolding',
                    preserve_original: true,
                }
            },
            analyzer: {
                custom_french: {
                    tokenizer: 'standard',
                    filter: [
                        'french_elision',
                        'lowercase',
                        'french_stop',
                        'custom_french_stop',
                        'custom_asciifolder',
                        // 'french_keywords',
                        'french_stemmer',
                    ],
                },
            },
        },
    };

    await client.indices.putSettings({
        index: 'catalog',
        body,
    });

    await client.indices.open({
        index: 'catalog',
    });
}

async function createTypeListingMapping() {
    const client = getClient();

    await client.indices.putMapping({
        index: 'catalog',
        type: 'listing',
        body: {
            listing: {
                properties: {
                    name: {
                        type: 'text',
                        analyzer: 'custom_french',
                        fields: {
                            keyword: {
                                type: 'keyword',
                                ignore_above: 256,
                            },
                        },
                    },
                    description: {
                        type: 'text',
                        analyzer: 'custom_french',
                        fields: {
                            keyword: {
                                type: 'keyword',
                                ignore_above: 256,
                            },
                        },
                    },
                    listingCategoryLabel: {
                        type: 'text',
                        analyzer: 'custom_french',
                        fields: {
                            keyword: {
                                type: 'keyword',
                                ignore_above: 256,
                            },
                        },
                    },
                    tags: {
                        type: 'text',
                        analyzer: 'custom_french',
                        fields: {
                            keyword: {
                                type: 'keyword',
                                ignore_above: 256,
                            },
                        },
                    },
                    bookingPreferences: {
                        type: 'text',
                        analyzer: 'custom_french',
                        fields: {
                            keyword: {
                                type: 'keyword',
                                ignore_above: 256,
                            },
                        },
                    },
                    stateComment: {
                        type: 'text',
                        analyzer: 'custom_french',
                        fields: {
                            keyword: {
                                type: 'keyword',
                                ignore_above: 256,
                            },
                        },
                    },
                },
            },
        },
    });
}

async function searchListings(query, {
    attributes = false,
    miniShouldMatch = '2<90%',
} = {}) {
    const client = getClient();

    // https://stackoverflow.com/questions/22695749/how-to-use-minimum-should-match-to-search-in-multiple-fields
    const body = {
        query: {
            multi_match: {
                query,
                minimum_should_match: miniShouldMatch,
                fuzziness: 1,
                prefix_length: 3,
                fields: [
                    'name^4',
                    'description^2',
                    'listingCategoryLabel^2',
                    'stateComment',
                    'tags',
                ],
            },
        },
        _source: attributes,
        size: 5000, // big number
    };

    return await client.search({
        index: 'catalog',
        type: 'listing',
        body: body,
    });
}

async function getSimilarListings({ listingsIds = [], texts = [] }, { attributes = false }) {
    const client = getClient();

    const like = [];
    _.forEach(listingsIds, listingId => {
        like.push({
            _index: 'catalog',
            _type: 'listing',
            _id: listingId,
        });
    });
    _.forEach(texts, text => {
        like.push(text);
    });

    const body = {
        query: {
            more_like_this: {
                fields: [
                    'name',
                    'listingCategoryLabel',
                    'tags',
                ],
                like,
                min_term_freq : 1,
                max_query_terms : 12,

                // set min_doc_freq to 1 because words with accent aren't "stemmed" to its form without accent
                // for the frequency calculation
                min_doc_freq: 1,
            },
        },
        _source: attributes,
    };

    return await client.search({
        index: 'catalog',
        type: 'listing',
        body,
    });
}

async function getListing(listingId) {
    const client = getClient();

    return await client.get({
        index: 'catalog',
        type: 'listing',
        id: listingId,
    });
}

function normalizeListing(listing, { indexedCategories, indexedTags, indexedListingsXTagsByListingId }) {
    const transformedListing = _.pick(listing, LISTING_FIELDS);

    transformedListing.mediasIds = transformedListing.mediasIds || [];
    transformedListing.instructionsMediasIds = transformedListing.instructionsMediasIds || [];
    transformedListing.locations = transformedListing.locations || [];
    transformedListing.listingCategoryLabel = getCategoryLabel(listing, { indexedCategories });
    transformedListing.tags = getTags(listing, { indexedTags, indexedListingsXTagsByListingId });

    return transformedListing;
}

function getCategoryLabel(listing, { indexedCategories }) {
    if (! listing.listingCategoryId) {
        return null;
    }

    const childCategory = indexedCategories[listing.listingCategoryId];
    if (! childCategory) {
        return null;
    }

    let label = '';

    let parentCategory;
    if (childCategory.parentId) {
        parentCategory = indexedCategories[childCategory.parentId];
    }

    if (parentCategory) {
        label += `${parentCategory.name} > `;
    }

    label += `${childCategory.name}`;

    return label;
}

function getTags(listing, { indexedTags, indexedListingsXTagsByListingId }) {
    const listingsXTags = indexedListingsXTagsByListingId[listing.id];

    if (! listingsXTags || ! listingsXTags.length) {
        return [];
    }

    const tags = [];

    _.forEach(listingsXTags, listingXTag => {
        const tag = indexedTags[listingXTag.tagId];
        if (tag) {
            tags.push(tag.name);
        }
    });

    return tags;
}

function shouldSyncListings(listingsIds) {
    listingsIdsToSync = listingsIdsToSync.concat(listingsIds || []);

    // sync listings after debouncing some short time
    if (listingsIdsToSync.length && ! syncListingsTriggered) {
        syncListingsTriggered = true;

        setTimeout(() => triggerSyncListings(), 500);
    }
}

async function triggerSyncListings() {
    let listingsIds = listingsIdsToSync;
    listingsIdsToSync = [];

    const client = getClient();

    try {
        listingsIds = _.compact(_.uniq(listingsIds));

        const [
            listings,
            listingCategories,
            tags,
            listingsXTags,
        ] = await Promise.all([
            Listing.find({ id: listingsIds }),
            ListingCategory.find(),
            Tag.find(),
            ListingXTag.find(),
        ]);

        let indexedCategories;
        let indexedTags;
        let indexedListingsXTagsByListingId;

        const activeListingCategories = await StelaceConfigService.isFeatureActive('LISTING_CATEGORIES');
        const activeTags = await StelaceConfigService.isFeatureActive('TAGS');

        if (activeListingCategories) {
            indexedCategories = _.indexBy(listingCategories, 'id');
        }
        if (activeTags) {
            indexedTags = _.indexBy(tags, 'id');
            indexedListingsXTagsByListingId = _.groupBy(listingsXTags, 'listingId');
        }


        const indexedListings = _.indexBy(listings, 'id');

        let body = [];

        for (let i = 0, l = listingsIds.length; i < l; i++) {
            const listingId = listingsIds[i];
            const listing = indexedListings[listingId];

            // if the listing is not found or is not validated, remove it from Elastic search
            if (! listing || ! listing.validated) {
                body.push({ delete: { _index: 'catalog', _type: 'listing', _id: listingId } });
            } else {
                const normalizedListing = normalizeListing(listing, { indexedCategories, indexedTags, indexedListingsXTagsByListingId });
                body.push({ update: { _index: 'catalog', _type: 'listing', _id: normalizedListing.id } });
                body.push({ doc: _.omit(normalizedListing, 'id'), doc_as_upsert: true });
            }

            if (i !== 0 && i % maxDocPerBulk === 0) {
                await client.bulk({ body });
                body = [];
            }
        }

        if (body.length) {
            await client.bulk({ body });
        }
    } catch (e) {
        // do nothing
    } finally {
        if (listingsIdsToSync.length) {
            triggerSyncListings();
        } else {
            syncListingsTriggered = false;
        }
    }
}
