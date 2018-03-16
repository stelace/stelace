/* global Listing, ListingCategory, LoggerService, MicroService, StelaceConfigService */

module.exports = {

    syncListings,

    searchListings,
    getSimilarListings,
    getListing,

    shouldSyncListings,

    getClient,

};

const elasticsearch = require('elasticsearch');
const Promise = require('bluebird');
const _ = require('lodash');

const { initializeIndex } = require('./elasticsearch');

const LISTING_FIELDS = [
    'id',
    'name',
    'description',
    'listingCategoryId',
];

const langs = [
    'en',
    'fr',
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

function getIndex(lang) {
    let index = 'catalog';

    const stelaceId = sails.config.stelace.stelaceId;
    if (stelaceId) {
        index = stelaceId + '__' + index;
    }

    index += '_' + lang;

    return index;
}

async function syncListings() {
    const client = getClient();

    const [
        listings,
        listingCategories,
    ] = await Promise.all([
        Listing.find({ validated: true }),
        ListingCategory.find(),
    ]);

    let indexedCategories;

    const activeListingCategories = await StelaceConfigService.isFeatureActive('LISTING_CATEGORIES');
    if (activeListingCategories) {
        indexedCategories = _.indexBy(listingCategories, 'id');
    } else {
        indexedCategories = {};
    }

    await Promise.each(langs, async (lang) => {
        const index = getIndex(lang);
        await initializeIndex({ client, index, lang, dropIfExists: true });

        await syncListingsByLanguage({
            client,
            lang,
            listings,
            indexedCategories,
        }).catch(() => null);
    });
}

async function syncListingsByLanguage({
    client,
    lang,
    listings,
    indexedCategories,
}) {
    const index = getIndex(lang);

    const normalizedListings = _.map(listings, listing => {
        return normalizeListing(listing, { lang, indexedCategories });
    });

    let body = [];

    for (let i = 0, l = normalizedListings.length; i < l; i++) {
        const listing = normalizedListings[i];
        if (listing.name) { // can be undefined for some languages
            body.push({ update: { _index: index, _type: 'listing', _id: listing.id } });
            body.push({ doc: _.omit(listing, 'id'), doc_as_upsert: true });
        }

        if (i !== 0 && i % maxDocPerBulk === 0) {
            await client.bulk({ body });
            body = [];
        }
    }

    if (body.length) {
        await client.bulk({ body });
    }
}

async function syncDeltaListingsByLanguage({
    client,
    lang,
    listingsIds,
    indexedListings,
    indexedCategories,
}) {
    const index = getIndex(lang);

    let body = [];

    for (let i = 0, l = listingsIds.length; i < l; i++) {
        const listingId = listingsIds[i];
        const listing = indexedListings[listingId];

        // if the listing is not found or is not validated, remove it from ElasticSearch
        if (! listing || ! listing.validated) {
            body.push({ delete: { _index: index, _type: 'listing', _id: listingId } });
        } else {
            const normalizedListing = normalizeListing(listing, { lang, indexedCategories });
            if (normalizedListing.name) { // can be undefined for some languages
                body.push({ update: { _index: index, _type: 'listing', _id: normalizedListing.id } });
                body.push({ doc: _.omit(normalizedListing, 'id'), doc_as_upsert: true });
            }
        }

        if (i !== 0 && i % maxDocPerBulk === 0) {
            await client.bulk({ body });
            body = [];
        }
    }

    if (body.length) {
        await client.bulk({ body });
    }
}

async function searchListings(query, {
    attributes = false,
    miniShouldMatch = '2<90%',
    lang,
} = {}) {
    const client = getClient();
    const index = getIndex(lang);

    // https://stackoverflow.com/questions/22695749/how-to-use-minimum-should-match-to-search-in-multiple-fields
    const body = {
        query: {
            multi_match: {
                query,
                minimum_should_match: miniShouldMatch,
                fuzziness: 'auto',
                prefix_length: 2,
                fields: [
                    'name^4',
                    'description^2',
                    'listingCategoryLabel^2',
                ],
            },
        },
        _source: attributes,
        size: 5000, // big number
    };

    return await client.search({
        index,
        type: 'listing',
        body: body,
    });
}

async function getSimilarListings({ listingsIds = [], texts = [], lang }, { attributes = false }) {
    const client = getClient();
    const index = getIndex(lang);

    const like = [];
    _.forEach(listingsIds, listingId => {
        like.push({
            _index: index,
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
                ],
                like,
                min_term_freq : 1,
                max_query_terms : 12,

                // set min_doc_freq to 1 because words with accent aren't 'stemmed' to its form without accent
                // for the frequency calculation
                min_doc_freq: 1,
            },
        },
        _source: attributes,
    };

    return await client.search({
        index,
        type: 'listing',
        body,
    });
}

async function getListing(listingId, { lang } = {}) {
    const client = getClient();
    const index = getIndex(lang);

    return await client.get({
        index,
        type: 'listing',
        id: listingId,
    });
}

function normalizeListing(listing, { lang, indexedCategories }) {
    listing = Listing.getI18nModel(listing, { locale: lang, useOnlyLocale: false });
    const transformedListing = _.pick(listing, LISTING_FIELDS);

    transformedListing.listingCategoryLabel = getCategoryLabel(listing, { lang, indexedCategories });

    return transformedListing;
}

function getCategoryLabel(listing, { lang, indexedCategories }) {
    if (! listing.listingCategoryId) {
        return null;
    }

    let childCategory = indexedCategories[listing.listingCategoryId];
    if (! childCategory) {
        return null;
    }

    let label = '';

    let parentCategory;
    if (childCategory.parentId) {
        parentCategory = indexedCategories[childCategory.parentId];
    }

    if (parentCategory) {
        parentCategory = ListingCategory.getI18nModel(parentCategory, { locale: lang, useOnlyLocale: false });
        if (parentCategory.name) {
            label += `${parentCategory.name} > `;
        }
    }

    childCategory = ListingCategory.getI18nModel(childCategory, { locale: lang, useOnlyLocale: false });
    if (childCategory.name) {
        label += `${childCategory.name}`;
    }

    return label;
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
        listingsIds = MicroService.escapeListForQueries(listingsIds);

        const [
            listings,
            listingCategories,
        ] = await Promise.all([
            Listing.find({ id: listingsIds }),
            ListingCategory.find(),
        ]);

        let indexedCategories;

        const activeListingCategories = await StelaceConfigService.isFeatureActive('LISTING_CATEGORIES');

        if (activeListingCategories) {
            indexedCategories = _.indexBy(listingCategories, 'id');
        } else {
            indexedCategories = {};
        }

        const indexedListings = _.indexBy(listings, 'id');

        await Promise.each(langs, async (lang) => {
            const index = getIndex(lang);
            await initializeIndex({ client, index, lang }); // create the index if it doesn't exist

            await syncDeltaListingsByLanguage({
                client,
                lang,
                listingsIds,
                indexedListings,
                indexedCategories,
            }).catch(() => null);
        });
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
