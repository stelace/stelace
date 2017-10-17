/* global
    ElasticsearchService, Item, ItemCategory,
    MapService, Media, PricingService, SearchEvent,
    StelaceConfigService, StelaceEventService, UAService, User
    */

module.exports = {

    normalizeSearchQuery,
    getItemsFromQuery,

    createEvent,

    getItemsRelevance,
    getSimilarItems,

    getQueryHash,
    isWrongPageParams,
    getItemsByPagination,
    getItemsFromCache,
    setItemsToCache,

};

var NodeCache = require('node-cache');
var CryptoJS  = require('crypto-js');
var useragent = require('useragent');
var moment    = require('moment');
var geolib    = require('geolib');

var searchCache = new NodeCache({ stdTTL: 10 * 60 }); // 10 min
var SearchDebounceCache = new NodeCache({ stdTTL: 60 }); // 1 min

const SEARCH_QUERY_DEFAULTS = {
    page: 1,
    limit: 20,
    sorting: 'creationDate',
    transactionType: 'all',
};
const SEARCH_CONFIG = {
    nearItemsDurationInSeconds: 2 * 3600, // 2 hours
    meanDistanceMetersPerHour: 60 * 1000, // 60km
};
const queryModes = [
    'default',
    'relevance',
    'distance',
];
const transactionTypes = [
    'all',
    'rental',
    'sale',
];

async function getItemsFromQuery(searchQuery, type) {
    const {
        itemCategoryId,
        query,
        queryMode,
        locations,
        similarToItemsIds,
    } = searchQuery;

    const categoryActive = await StelaceConfigService.isFeatureActive('ITEM_CATEGORIES');

    const itemCategoriesIds = itemCategoryId && categoryActive ? await getMatchedItemCategoriesIds(itemCategoryId) : null;

    let items = await fetchPublishedItems(searchQuery, { itemCategoriesIds });

    let hashLocations = await getItemsLocations(items);
    let hashJourneys;
    items = removeEmptyLocationItems(items, hashLocations);

    // console.log('published and no empty location items', items.length);

    let itemsRelevanceMeta;
    let itemsRelevance;

    if (type === 'similar') {
        if (!similarToItemsIds || !similarToItemsIds.length) {
            throw new Error('Missing similar to items ids');
        }

        const similarItems = await getSimilarItems({ itemsIds: similarToItemsIds });
        items = mergePublishedAndQueryItems(items, similarItems);
    } else if (query) {
        itemsRelevance = await getItemsRelevance(query);
        // console.log('relevant items', itemsRelevance.length);
        itemsRelevanceMeta = getItemsRelevanceMeta(itemsRelevance);
        items = mergePublishedAndQueryItems(items, itemsRelevance);
        // console.log('merged published and relevant items', items.length);
    }

    const hasLocations = locations && locations.length;
    const displayLocation = hasLocations && queryMode !== 'relevance';
    if (displayLocation) {
        // remove items that are too far from given source locations
        const {
            nearItemsDurationInSeconds,
            meanDistanceMetersPerHour,
        } = SEARCH_CONFIG;
        const distanceLimit = Math.round(nearItemsDurationInSeconds / 3600 * meanDistanceMetersPerHour);
        items = filterItemsWithinDistance(locations, items, hashLocations, distanceLimit);
        // console.log('near items', items.length);

        hashLocations = refreshHashLocations(hashLocations, _.pluck(items, 'id'));
        hashJourneys = await getJourneysDuration(locations, hashLocations);
    }

    let combinedMetrics;

    // perform a sort only if query or source locations are provided
    if (query || hasLocations) {
        combinedMetrics = combineMetrics({ items, hashJourneys, itemsRelevance });
        if (query) {
            combinedMetrics = removeIrrelevantResults(combinedMetrics, itemsRelevanceMeta);
        }

        if (queryMode === 'default') {
            if (query && hasLocations) {
                combinedMetrics = sortByMixRelevanceDistance(combinedMetrics, itemsRelevanceMeta);
            } else if (query) {
                combinedMetrics = sortByRelevance(combinedMetrics);
            } else if (hasLocations) {
                combinedMetrics = sortByDistance(combinedMetrics);
            }
        } else if (queryMode === 'relevance') {
            if (query) {
                combinedMetrics = sortByRelevance(combinedMetrics);
            }
        } else if (queryMode === 'distance') {
            if (hasLocations) {
                combinedMetrics = sortByDistance(combinedMetrics);
            }
        }

        items = convertCombineMetricsToItems(combinedMetrics, items);
    }

    const {
        owners,
        itemsMedias,
        ownersMedias,
    } = await getItemsExtraInfo({ items, getMedia: false });
     // set getMedia to true when using owner media in search results

    items = getExposedItems({
        items,
        owners,
        itemsMedias,
        ownersMedias,
        displayDuration: displayLocation,
        fromLocations: locations,
        hashLocations,
        hashJourneys,
    });

    return items;
}

async function getMatchedItemCategoriesIds(itemCategoryId) {
    const itemCategories = await ItemCategory.getChildrenCategories(itemCategoryId, true);
    return _.pluck(itemCategories, 'id');
}

async function fetchPublishedItems(searchQuery, { itemCategoriesIds }) {
    const {
        mode,
        transactionType,
        onlyFree,
        withoutIds,
        sorting,
    } = searchQuery;

    const findAttrs = {
        validated: true,
        broken: false,
        locked: false,
    };

    const transactionObjQuery = getTransactionObjQuery({ transactionType, onlyFree });
    _.assign(findAttrs, transactionObjQuery);

    if (itemCategoriesIds) {
        findAttrs.itemCategoryId = itemCategoriesIds;
    }
    if (mode) {
        findAttrs.mode = mode;
    }
    if (withoutIds) {
        findAttrs.id = { '!': withoutIds };
    }

    if (sorting === "creationDate") {
        findAttrs.sort = { createdDate: -1 };
    } else if (sorting === "lastUpdate") {
        findAttrs.sort = { updatedDate: -1 };
    } else {
        findAttrs.sort = { id: -1 };
    }

    findAttrs.soldDate = null;

    return await Item.find(findAttrs);
}

function getTransactionObjQuery({ transactionType, onlyFree }) {
    const getRentalObjQuery = (onlyFree) => {
        const obj = {
            rentable: true,
        };
        if (onlyFree) {
            _.assign(obj, { dayOnePrice: 0 });
        }
        return obj;
    };
    const getSaleObjQuery = (onlyFree) => {
        const obj = {
            sellable: true,
        };
        if (onlyFree) {
            _.assign(obj, { sellingPrice: 0 });
        }
        return obj;
    };

    if (transactionType === 'all') {
        return {
            or: [
                getRentalObjQuery(onlyFree),
                getSaleObjQuery(onlyFree),
            ],
        };
    } else if (transactionType === 'rental') {
        return getRentalObjQuery(onlyFree);
    } else if (transactionType === 'sale') {
        return getSaleObjQuery(onlyFree);
    }
}

/**
 * Get items by relevance
 * @param  {string}   query
 * @param  {boolean}  getSimilar
 * @return {object[]} results
 * @return {number}   results.id - item id
 * @return {float}    results.score - relevance score
 */
async function getItemsRelevance(query) {
    const params = { attributes: [] };

    const res = await ElasticsearchService.searchItems(query, params);
    return formatElasticsearchResults(res);
}

async function getSimilarItems({ itemsIds, texts }) {
    const params = { attributes: [] };

    const res = await ElasticsearchService.getSimilarItems({ itemsIds, texts }, params);
    return formatElasticsearchResults(res);
}

function formatElasticsearchResults(res) {
    if (!res || !res.hits || res.hits.total === 0) {
        return [];
    }

    return _.map(res.hits.hits, value => {
        return {
            id: parseInt(value._id, 10), // convert from string to number
            score: value._score,
            source: value._source,
        };
    });
}

function getItemsRelevanceMeta(itemsRelevance) {
    const itemsRelevanceMeta = {
        maxScore: 0,
        minScore: 0,
        nbResults: 0,
    };

    if (itemsRelevance.length) {
        itemsRelevanceMeta.maxScore = _.first(itemsRelevance).score;
        itemsRelevanceMeta.minScore = _.last(itemsRelevance).score;
        itemsRelevanceMeta.nbResults = itemsRelevance.length;
    }

    return itemsRelevanceMeta;
}

function mergePublishedAndQueryItems(items, queryItems) {
    const itemsIds = _.pluck(items, 'id');
    const queryItemsIds = _.map(queryItems, value => value.id);

    const mergedIds = _.intersection(itemsIds, queryItemsIds);
    const indexedMergedIds = _.indexBy(mergedIds);

    return _.reduce(items, (memo, item) => {
        if (indexedMergedIds[item.id]) {
            memo.push(item);
        }
        return memo;
    }, []);
}

/**
 * Get items locations indexed by item id
 * @param  {object[]} items
 * @return {object}   hashLocations
 */
async function getItemsLocations(items) {

    const classicItemsLocations = await getClassicItemsLocations(items);

    const hashLocations = {};

    const indexedClassicItemsLocations = _.indexBy(classicItemsLocations, 'id');
    _.forEach(items, item => {
        hashLocations[item.id] = _.map(item.locations, locationId => indexedClassicItemsLocations[locationId]);
    });

    return hashLocations;
}

async function getClassicItemsLocations(items) {
    if (!items.length) {
        return [];
    }

    let locationIds = _.reduce(items, (memo, item) => {
        memo = memo.concat(item.locations || []);
        return memo;
    }, []);
    locationIds = _.uniq(locationIds);

    return await Location.find({ id: locationIds });
}

/**
 * Remove items that have no locations
 * @param  {object[]} items
 * @param  {object} hashLocations
 * @return {object[]} items that have locations
 */
function removeEmptyLocationItems(items, hashLocations) {
    return _.filter(items, item => {
        const locations = hashLocations[item.id];
        return locations && locations.length;
    });
}

/**
 * Remove key from hashLocations that isn't present in list itemsIds
 * @param  {object}   hashLocations [description]
 * @param  {number[]} itemsIds
 * @return {object}   refreshed hash locations
 */
function refreshHashLocations(hashLocations, itemsIds) {
    return _.pick(hashLocations, itemsIds);
}

/**
 * Combine all metrics before applying a sort
 * @param  {object[]} items
 * @param  {object}   hashJourneys
 * @param  {object[]} itemsRelevance
 * @return {object[]} res - combined metrics items
 * @return {number}   res.id - item id
 * @return {number}   res.duration
 * @return {float}    res.score
 */
function combineMetrics({ items, hashJourneys, itemsRelevance }) {
    const indexedItemsRelevance = itemsRelevance ? _.indexBy(itemsRelevance, 'id') : null;
    const longDuration = 8 * 3600; // 8 hours

    return _.map(items, item => {
        const obj = {
            id: item.id,
        };

        if (indexedItemsRelevance) {
            const relevance = indexedItemsRelevance[item.id];
            obj.score = relevance ? relevance.score : 0;
        }

        if (hashJourneys) {
            const journeys = hashJourneys[item.id];
            if (journeys && journeys.length) {
                obj.duration = _.first(journeys).durationSeconds;
            } else {
                obj.duration = longDuration;
            }
        }

        return obj;
    });
}

function removeIrrelevantResults(combinedMetrics, itemsRelevanceMeta) {
    if (!combinedMetrics.length) {
        return combinedMetrics;
    }

    const minLimit = itemsRelevanceMeta.maxScore / 10;
    return _.filter(combinedMetrics, metrics => metrics.score >= minLimit);
}

function convertCombineMetricsToItems(combinedMetrics, items) {
    const indexedItems = _.indexBy(items, 'id');

    return _.map(combinedMetrics, metrics => {
        return indexedItems[metrics.id];
    });
}

function sortByRelevance(combinedMetrics) {
    return _.sortBy(combinedMetrics, metrics => - metrics.score);
}

function sortByMixRelevanceDistance(combinedMetrics, itemsRelevanceMeta) {
    const relevanceGroups = clusterByRelevance(combinedMetrics, itemsRelevanceMeta);

    return _.reduce(relevanceGroups, (memo, group) => {
        memo = memo.concat(sortByDistance(group));
        return memo;
    }, []);
}

function clusterByRelevance(combinedMetrics, itemsRelevanceMeta) {
    let groups = [];

    const { maxScore } = itemsRelevanceMeta;
    let tmpMetrics = combinedMetrics;

    const separateGroups = (limit) => {
        const [
            aboveLimit,
            belowLimit
        ] = _.partition(tmpMetrics, metrics => metrics.score >= limit);
        groups.push(aboveLimit);
        tmpMetrics = belowLimit;
    };

    if (maxScore >= 15) {
        separateGroups(0.75 * maxScore);
    }

    separateGroups(0.5 * maxScore);
    separateGroups(0.25 * maxScore);

    if (tmpMetrics && tmpMetrics.length) {
        groups.push(tmpMetrics);
    }

    return groups;
}

function sortByDistance(combinedMetrics) {
    return _.sortBy(combinedMetrics, metrics => metrics.duration);
}

/**
 * Get journeys durations from hash locations, indexed by item id
 * @param  {object[]} fromLocations - user locations
 * @param  {object} hashLocations
 * @return {object} hashJourneys
 */
async function getJourneysDuration(fromLocations, hashLocations) {
    const itemsIds = _.keys(hashLocations);
    const hashJourneys = {};

    await Promise.map(itemsIds, async (itemId) => {
        // this item has no locations
        if (!hashLocations[itemId].length) {
            return;
        }

        const journeys = await MapService.getOsrmJourneys(fromLocations, hashLocations[itemId]);
        // sort by shortest duration first
        hashJourneys[itemId] = _.sortBy(journeys, journey => journey.durationSeconds);
    });

    return hashJourneys;
}

/**
 * Get extra info related to search results items
 * @param  {object[]} items - search results
 * @param  {boolean}  [getMedia] - whether ownerMedia should be retrieved
 * @return {object} extraInfo
 */
async function getItemsExtraInfo({ items, getMedia }) {
    const ownersIds  = _.pluck(items, 'ownerId');
    let infoPromises = [Item.getMedias(items)];
    let owners;

    if (getMedia) {
        owners = await User.find({ id: ownersIds });
        infoPromises.push(User.getMedia(owners));
    } else {
        infoPromises.push({});
    }

    const [
        itemsMedias,
        ownersMedias,
    ] = await Promise.all(infoPromises);

    return {
        owners,
        itemsMedias,
        ownersMedias,
    };
}

/**
 * Expose items with only filtered fields
 * @param  {object[]} items
 * @param  {object[]} owners
 * @param  {object}   itemsMedias
 * @param  {object}   ownersMedias
 * @param  {boolean}  displayDuration
 * @param  {object}   fromLocations
 * @param  {object}   hashLocations
 * @param  {object}   hashJourneys
 * @return {object[]} exposed items
 */
function getExposedItems({
    items,
    owners,
    itemsMedias,
    ownersMedias,
    displayDuration,
    fromLocations,
    hashLocations,
    hashJourneys,
}) {
    let journeysDurations;
    const pricingHash = getPricingHash(items);
    const indexedOwners = _.indexBy(owners, 'id');

    if (displayDuration) {
        journeysDurations = convertOsrmDurations(fromLocations, hashJourneys, hashLocations);
    }

    const exposedItems = _.map(items, item => {
        item             = Item.expose(item, 'others');
        item.medias      = Media.exposeAll(itemsMedias[item.id], 'others');
        item.ownerRating = _.pick(indexedOwners[item.ownerId], ['nbRatings', 'ratingScore']);
        item.pricing     = pricingHash[item.pricingId];
        item.completeLocations = _.map(hashLocations[item.id], location => {
            return Location.expose(location, 'others');
        });

        if (ownersMedias && ! _.isEmpty(ownersMedias)) {
            item.ownerMedia  = Media.expose(ownersMedias[item.ownerId], 'others');
        }

        if (displayDuration) {
            item.journeysDurations = journeysDurations[item.id];
        }

        return item;
    });

    return exposedItems;
}

function convertOsrmDurations(fromLocations, hashJourneys, hashLocations) {
    return _.reduce(_.keys(hashJourneys), (memo, itemId) => {
        memo[itemId] = _.map(hashJourneys[itemId], journey => {
            return {
                index: journey.fromIndex,
                fromLocation: fromLocations[journey.fromIndex],
                toLocation: Location.expose(hashLocations[itemId][journey.toIndex], "others"),
                durationSeconds: journey.durationSeconds
            };
        });

        return memo;
    }, {});
}

function getPricingHash(items) {
    const pricingIds = _.uniq(_.pluck(items, 'pricingId'));

    return _.reduce(pricingIds, (memo, pricingId) => {
        const pricing = memo[pricingId];
        if (! pricing) {
            memo[pricingId] = PricingService.getPricing(pricingId);
        }
        return memo;
    }, {});
}

/**
 * Only get items that are within a distance range
 * @param  {object[]} fromLocations - user locations
 * @param  {object[]} items
 * @param  {object}   hashLocations
 * @param  {number}   withinDistanceLimitMeters - distance limit
 * @return {object[]} filtered items
 */
function filterItemsWithinDistance(fromLocations, items, hashLocations, withinDistanceLimitMeters) {
    return _.reduce(items, (memo, item) => {
        // security in case items has no locations
        var toLocations = hashLocations[item.id];
        if (! toLocations || ! toLocations.length) {
            return memo;
        }

        var nearLocations = _.reduce(fromLocations, (memo, fromLocation) => {
            var isNearDistance = _.find(toLocations, toLocation => {
                return geolib.getDistance(fromLocation, toLocation) <= withinDistanceLimitMeters;
            });
            if (isNearDistance) {
                memo.push(fromLocation);
            }
            return memo;
        }, []);

        // if any item locations are near one of fromLocations, it's ok
        if (nearLocations.length) {
            memo.push(item);
        }

        return memo;
    }, []);
}

function getItemsFromCache(cacheKey) {
    const items = searchCache.get(cacheKey);

    if (items) {
        searchCache.set(cacheKey, items); // refresh TTL
    }

    return items;
}

function setItemsToCache(cacheKey, items) {
    searchCache.set(cacheKey, items);
}

/**
 * Normalize the search parameters
 * @param {object}   params
 * @param {number}   [params.itemCategoryId]
 * @param {string}   [params.query]
 * @param {string}   [params.mode]
 * @param {string}   [params.transactionType] - allowed values: ['all', 'rental', 'sale']
 * @param {boolean}  [params.onlyFree]
 * @param {string}   [params.queryMode] - allowed values: ['relevance', 'default', 'distance']
 * @param {string}   [params.locationsSource] - indicate where the locations come from
 * @param {object[]} [params.locations]
 * @param {float}    params.locations.latitude
 * @param {float}    params.locations.longitude
 * @param {string}   [params.sorting]
 * @param {number[]} [params.withoutIds] - filter out items with this ids (useful for similar items)
 * @param {number[]} [params.similarToItemsIds]
 * @param {number}   [params.page]
 * @param {number}   [params.limit]
 * @param {number}   [params.timestamp] - useful to prevent requests racing from client-side
 */
function normalizeSearchQuery(params) {
    var searchFields = [
        'itemCategoryId',
        'query',
        'mode',
        'transactionType',
        'onlyFree',
        'queryMode',
        'locationsSource',
        'locations',
        'sorting',
        'withoutIds',
        'similarToItemsIds',
        'page',
        'limit',
        'timestamp',
    ];

    var error = new Error('Bad search params');

    let searchQuery = _.reduce(_.pick(params, searchFields), (memo, value, key) => {
        let isValid;

        switch (key) {
            case 'query':
            case 'sorting':
                isValid = typeof value === 'string';
                break;

            case 'itemCategoryId':
            case 'timestamp':
                isValid = !isNaN(value);
                break;

            case 'mode':
                isValid = _.includes(Item.get('modes'), value);
                break;

            case 'transactionType':
                isValid = _.includes(transactionTypes, value);
                break;

            case 'queryMode':
                isValid = _.includes(queryModes, value);
                break;

            case 'locations':
                isValid = MapService.isValidGpsPts(value);
                break;

            case 'withoutIds':
            case 'similarToItemsIds':
                isValid = µ.checkArray(value, 'id');
                break;

            case 'onlyFree':
                isValid = typeof value === 'boolean';
                break;

            case 'page':
            case 'limit':
                isValid = (!isNaN(value) && value >= 1);
                break;

            default:
                isValid = true;
                break;
        }

        if (!isValid) {
            throw error;
        }

        memo[key] = value;
        return memo;
    }, {});

    searchQuery = Object.assign({}, SEARCH_QUERY_DEFAULTS, { timestamp: new Date().getTime() }, searchQuery);

    return searchQuery;
}

/**
 * Create search event
 * @param  {object} searchConfig
 * @param  {object} type
 * @param  {object} req
 * @param  {object} res
 * @result {object} [obj]
 * @result {object} obj.searchEvent
 * @result {object} [obj.stelaceEvent]
 */
async function createEvent({
    searchQuery,
    type,
    req,
    res,
}) {
    const userAgent = req.headers['user-agent'];
    // do not log a bot search
    if (userAgent && UAService.isBot(userAgent)) {
        return;
    }
    // do not log if same request within short period of time
    if (!canBeLogged(searchQuery)) {
        return;
    }

    const parsedUserAgent = useragent.parse(userAgent);

    const searchEvent = await SearchEvent.create({
        type,
        userAgent,
        userId: req.user && req.user.id,
        mode: searchQuery.mode,
        query: searchQuery.query,
        page: searchQuery.page,
        limit: searchQuery.limit,
        params: _.omit(searchQuery, 'timestamp'),
        os: parsedUserAgent.os.toString(),
        browser: parsedUserAgent.toAgent(),
        device: parsedUserAgent.device.toString(),
    });
    let stelaceEvent;

    if (type === "search") {
        stelaceEvent = await StelaceEventService.createEvent({
            label: 'Search event',
            req: req,
            res: res,
            type: 'null', // string on purpose
            searchId: searchEvent.id,
        });
    }

    return {
        searchEvent,
        stelaceEvent,
    };
}

function canBeLogged(searchQuery, newDate) {
    var debounceDuration = { s: 1 };
    newDate = newDate || moment().toISOString();

    var cacheKey = getQueryHash(searchQuery);

    var oldDate = SearchDebounceCache.get(cacheKey);

    if (! oldDate
     || (oldDate && oldDate < moment(newDate).subtract(debounceDuration).toISOString())
    ) {
        SearchDebounceCache.set(cacheKey, newDate);
        return true;
    } else {
        return false;
    }
}

function getQueryHash(searchQuery) {
    // do not take into account those fields because we want the cache
    // to return results that don't depend on pagination or timestamp
    const omitFields = [
        'page',
        'limit',
        'timestamp'
    ];
    var str = JSON.stringify(_.omit(searchQuery, omitFields));

    return str.length + '-' + CryptoJS.MD5(str).toString();
}

function isWrongPageParams(items, page, limit) {
    if (page === 1) {
        return false;
    }

    return (items.length <= (page - 1) * limit);
}

function getItemsByPagination(items, page, limit) {
    return items.slice((page - 1) * limit, page * limit);
}
