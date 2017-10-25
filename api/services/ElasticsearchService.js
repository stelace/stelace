/* global Item, ListingCategory, ItemXTag, LoggerService, StelaceConfigService, Tag */

module.exports = {

    syncItems: syncItems,

    searchItems: searchItems,
    getSimilarItems: getSimilarItems,
    getItem: getItem,

    shouldSyncItems: shouldSyncItems,

    getClient: getClient,

};

const elasticsearch = require('elasticsearch');

const ITEM_FIELDS = [
    'id',
    'name',
    'description',
    'stateComment',
    'bookingPreferences',
    'ownerId',
    'reference',
    'listingCategoryId',
];

let itemsIdsToSync = [];
let syncItemsTriggered = false;

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

async function syncItems() {
    const client = getClient();

    const [
        items,
        listingCategories,
        tags,
        itemsXTags,
    ] = await Promise.all([
        Item.find({ validated: true }),
        ListingCategory.find(),
        Tag.find(),
        ItemXTag.find(),
    ]);

    const indexedCategories = _.indexBy(listingCategories, 'id');
    const indexedTags = _.indexBy(tags, 'id');
    const indexedItemsXTagsByItemId = _.groupBy(itemsXTags, 'itemId');

    const normalizedItems = _.map(items, item => {
        return normalizeItem(item, { indexedCategories, indexedTags, indexedItemsXTagsByItemId });
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
    await createTypeItemMapping();

    let body = [];

    for (let i = 0, l = normalizedItems.length; i < l; i++) {
        const item = normalizedItems[i];

        body.push({ update: { _index: 'catalog', _type: 'item', _id: item.id } });
        body.push({ doc: _.omit(item, 'id'), doc_as_upsert: true });

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

async function createTypeItemMapping() {
    const client = getClient();

    await client.indices.putMapping({
        index: 'catalog',
        type: 'item',
        body: {
            item: {
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

async function searchItems(query, {
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
        type: 'item',
        body: body,
    });
}

async function getSimilarItems({ itemsIds = [], texts = [] }, { attributes = false }) {
    const client = getClient();

    const like = [];
    _.forEach(itemsIds, itemId => {
        like.push({
            _index: 'catalog',
            _type: 'item',
            _id: itemId,
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
        type: 'item',
        body,
    });
}

async function getItem(itemId) {
    const client = getClient();

    return await client.get({
        index: 'catalog',
        type: 'item',
        id: itemId,
    });
}

function normalizeItem(item, { indexedCategories, indexedTags, indexedItemsXTagsByItemId }) {
    const transformedItem = _.pick(item, ITEM_FIELDS);

    transformedItem.mediasIds = transformedItem.mediasIds || [];
    transformedItem.instructionsMediasIds = transformedItem.instructionsMediasIds || [];
    transformedItem.locations = transformedItem.locations || [];
    transformedItem.listingCategoryLabel = getCategoryLabel(item, { indexedCategories });
    transformedItem.tags = getTags(item, { indexedTags, indexedItemsXTagsByItemId });

    return transformedItem;
}

function getCategoryLabel(item, { indexedCategories }) {
    if (! item.listingCategoryId) {
        return null;
    }

    const childCategory = indexedCategories[item.listingCategoryId];
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

function getTags(item, { indexedTags, indexedItemsXTagsByItemId }) {
    const itemsXTags = indexedItemsXTagsByItemId[item.id];

    if (! itemsXTags || ! itemsXTags.length) {
        return [];
    }

    const tags = [];

    _.forEach(itemsXTags, itemXTag => {
        const tag = indexedTags[itemXTag.tagId];
        if (tag) {
            tags.push(tag.name);
        }
    });

    return tags;
}

function shouldSyncItems(itemsIds) {
    itemsIdsToSync = itemsIdsToSync.concat(itemsIds || []);

    // sync items after debouncing some short time
    if (itemsIdsToSync.length && ! syncItemsTriggered) {
        syncItemsTriggered = true;

        setTimeout(() => triggerSyncItems(), 500);
    }
}

async function triggerSyncItems() {
    let itemsIds = itemsIdsToSync;
    itemsIdsToSync = [];

    const client = getClient();

    try {
        itemsIds = _.compact(_.uniq(itemsIds));

        const [
            items,
            listingCategories,
            tags,
            itemsXTags,
        ] = await Promise.all([
            Item.find({ id: itemsIds }),
            ListingCategory.find(),
            Tag.find(),
            ItemXTag.find(),
        ]);

        let indexedCategories;
        let indexedTags;
        let indexedItemsXTagsByItemId;

        const activeListingCategories = await StelaceConfigService.isFeatureActive('LISTING_CATEGORIES');
        const activeTags = await StelaceConfigService.isFeatureActive('TAGS');

        if (activeListingCategories) {
            indexedCategories = _.indexBy(listingCategories, 'id');
        }
        if (activeTags) {
            indexedTags = _.indexBy(tags, 'id');
            indexedItemsXTagsByItemId = _.groupBy(itemsXTags, 'itemId');
        }


        const indexedItems = _.indexBy(items, 'id');

        let body = [];

        for (let i = 0, l = itemsIds.length; i < l; i++) {
            const itemId = itemsIds[i];
            const item = indexedItems[itemId];

            // if the item is not found or is not validated, remove it from Elastic search
            if (! item || ! item.validated) {
                body.push({ delete: { _index: 'catalog', _type: 'item', _id: itemId } });
            } else {
                const normalizedItem = normalizeItem(item, { indexedCategories, indexedTags, indexedItemsXTagsByItemId });
                body.push({ update: { _index: 'catalog', _type: 'item', _id: normalizedItem.id } });
                body.push({ doc: _.omit(normalizedItem, 'id'), doc_as_upsert: true });
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
        if (itemsIdsToSync.length) {
            triggerSyncItems();
        } else {
            syncItemsTriggered = false;
        }
    }
}
