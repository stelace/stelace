/* global
    ElasticsearchService, Listing, ListingCategory, Location,
    MapService, Media, MicroService, SearchEvent,
    StelaceConfigService, StelaceEventService, UAService, User
*/

module.exports = {

    normalizeSearchQuery,
    getListingsFromQuery,

    createEvent,

    getListingsRelevance,
    getSimilarListings,

    getQueryHash,
    isWrongPageParams,
    getListingsByPagination,
    getListingsFromCache,
    setListingsToCache,

};

var NodeCache = require('node-cache');
var CryptoJS = require('crypto-js');
var useragent = require('useragent');
var moment = require('moment');
var geolib = require('geolib');
const _ = require('lodash');
const Promise = require('bluebird');

var searchCache = new NodeCache({ stdTTL: 10 * 60 }); // 10 min
var SearchDebounceCache = new NodeCache({ stdTTL: 60 }); // 1 min

const SEARCH_QUERY_DEFAULTS = {
    page: 1,
    limit: 20,
    sorting: 'creationDate',
};
const queryModes = [
    'default',
    'relevance',
    'distance',
];

async function getListingsFromQuery(searchQuery, type) {
    const {
        listingCategoryId,
        query,
        queryMode,
        locations,
        similarToListingsIds,
        distanceLimitMeters,
    } = searchQuery;

    const config = await StelaceConfigService.getConfig();

    const categoryActive = await StelaceConfigService.isFeatureActive('LISTING_CATEGORIES');

    const listingCategoriesIds = listingCategoryId && categoryActive ? await getMatchedListingCategoriesIds(listingCategoryId) : null;

    let listings = await fetchPublishedListings(searchQuery, { listingCategoriesIds });

    let hashLocations = await getListingsLocations(listings);
    let hashJourneys;

    // TODO: do not remove if PLACE === 'NONE'
    listings = removeEmptyLocationListings(listings, hashLocations);

    // console.log('published and no empty location listings', listings.length);

    let listingsRelevanceMeta;
    let listingsRelevance;

    if (type === 'similar') {
        if (!similarToListingsIds || !similarToListingsIds.length) {
            throw new Error('Missing similar to listings ids');
        }

        const similarListings = await getSimilarListings({ listingsIds: similarToListingsIds, lang: config.lang });
        listings = mergePublishedAndQueryListings(listings, similarListings);
    } else if (query) {
        listingsRelevance = await getListingsRelevance(query, config.lang);
        // console.log('relevant listings', listingsRelevance.length);
        listingsRelevanceMeta = getListingsRelevanceMeta(listingsRelevance);
        listings = mergePublishedAndQueryListings(listings, listingsRelevance);
        // console.log('merged published and relevant listings', listings.length);
    }

    const hasLocations = locations && locations.length;
    const displayJourneys = hasLocations && queryMode !== 'relevance';

    // remove listings that are too far from given source locations
    if (hasLocations) {
        if (distanceLimitMeters) {
            listings = filterListingsWithinDistance(locations, listings, hashLocations, distanceLimitMeters);
            // console.log('near listings', listings.length);

            hashLocations = refreshHashLocations(hashLocations, _.pluck(listings, 'id'));
        }
        hashJourneys = await getJourneysInfo(locations, hashLocations);
    }

    let combinedMetrics;

    // perform a sort only if query or source locations are provided
    if (type !== 'similar' && (query || hasLocations)) {
        combinedMetrics = combineMetrics({ listings, hashJourneys, listingsRelevance });
        if (query) {
            combinedMetrics = removeIrrelevantResults(combinedMetrics, listingsRelevanceMeta);
        }

        if (queryMode === 'default') {
            if (query && hasLocations) {
                combinedMetrics = sortByMixRelevanceDistance(combinedMetrics, listingsRelevanceMeta);
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

        listings = convertCombineMetricsToListings(combinedMetrics, listings);
    }

    const {
        owners,
        listingsMedias,
        ownersMedias,
    } = await getListingsExtraInfo({ listings, getMedia: false });
    // set getMedia to true when using owner media in search results

    listings = getExposedListings({
        listings,
        owners,
        listingsMedias,
        ownersMedias,
        displayJourneys,
        fromLocations: locations,
        hashLocations,
        hashJourneys,
        locale: config.lang,
        fallbackLocale: config.lang,
    });

    return listings;
}

async function getMatchedListingCategoriesIds(listingCategoryId) {
    const listingCategories = await ListingCategory.getChildrenCategories(listingCategoryId);
    return _.pluck(listingCategories, 'id');
}

async function fetchPublishedListings(searchQuery, { listingCategoriesIds }) {
    const {
        listingTypesIds,
        withoutIds,
        sorting,
    } = searchQuery;

    const findAttrs = {
        validated: true,
        broken: false,
        locked: false,
    };

    if (listingCategoriesIds) {
        findAttrs.listingCategoryId = MicroService.escapeListForQueries(listingCategoriesIds);
    }
    if (withoutIds) {
        findAttrs.id = { '!=': withoutIds };
    }

    findAttrs.quantity = { '>': 0 };

    const modelQuery = Listing.find(findAttrs);

    let sortQuery;
    if (sorting === "creationDate") {
        sortQuery = 'createdDate DESC';
    } else if (sorting === "lastUpdate") {
        sortQuery = 'updatedDate DESC';
    } else {
        sortQuery = 'id DESC';
    }

    if (sortQuery) {
        modelQuery.sort(sortQuery);
    }

    let listings = await modelQuery;

    if (!listingTypesIds || !listingTypesIds.length) {
        return listings;
    }

    const indexedListingTypesIds = _.indexBy(listingTypesIds);

    listings = _.filter(listings, listing => {
        return _.reduce(listing.listingTypesIds, (memo, id) => {
            if (indexedListingTypesIds[id]) {
                return true;
            }
            return memo;
        }, false);
    });

    return listings;
}

/**
 * Get listings by relevance
 * @param  {string}   query
 * @return {object[]} results
 * @return {number}   results.id - listing id
 * @return {float}    results.score - relevance score
 */
async function getListingsRelevance(query, lang) {
    const params = { attributes: [], lang };

    const res = await ElasticsearchService.searchListings(query, params);
    return formatElasticsearchResults(res);
}

async function getSimilarListings({ listingsIds, texts, lang }) {
    const params = { attributes: [] };

    const res = await ElasticsearchService.getSimilarListings({ listingsIds, texts, lang }, params);
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

function getListingsRelevanceMeta(listingsRelevance) {
    const listingsRelevanceMeta = {
        maxScore: 0,
        minScore: 0,
        nbResults: 0,
    };

    if (listingsRelevance.length) {
        listingsRelevanceMeta.maxScore = _.first(listingsRelevance).score;
        listingsRelevanceMeta.minScore = _.last(listingsRelevance).score;
        listingsRelevanceMeta.nbResults = listingsRelevance.length;
    }

    return listingsRelevanceMeta;
}

function mergePublishedAndQueryListings(listings, queryListings) {
    const listingsIds = _.pluck(listings, 'id');
    const queryListingsIds = _.map(queryListings, value => value.id);

    const mergedIds = _.intersection(listingsIds, queryListingsIds);
    const indexedMergedIds = _.indexBy(mergedIds);

    return _.reduce(listings, (memo, listing) => {
        if (indexedMergedIds[listing.id]) {
            memo.push(listing);
        }
        return memo;
    }, []);
}

/**
 * Get listings locations indexed by listing id
 * @param  {object[]} listings
 * @return {object}   hashLocations
 */
async function getListingsLocations(listings) {

    const listingsLocations = await _getListingsLocations(listings);

    const hashLocations = {};

    const indexedListingsLocations = _.indexBy(listingsLocations, 'id');
    _.forEach(listings, listing => {
        hashLocations[listing.id] = _.map(listing.locations, locationId => indexedListingsLocations[locationId]);
    });

    return hashLocations;
}

async function _getListingsLocations(listings) {
    if (!listings.length) {
        return [];
    }

    let locationIds = _.reduce(listings, (memo, listing) => {
        memo = memo.concat(listing.locations || []);
        return memo;
    }, []);
    locationIds = _.uniq(locationIds);

    return await Location.find({ id: locationIds });
}

/**
 * Remove listings that have no locations
 * @param  {object[]} listings
 * @param  {object} hashLocations
 * @return {object[]} listings that have locations
 */
function removeEmptyLocationListings(listings, hashLocations) {
    return _.filter(listings, listing => {
        const locations = hashLocations[listing.id];
        return locations && locations.length;
    });
}

/**
 * Remove key from hashLocations that isn't present in list listingsIds
 * @param  {object}   hashLocations [description]
 * @param  {number[]} listingsIds
 * @return {object}   refreshed hash locations
 */
function refreshHashLocations(hashLocations, listingsIds) {
    return _.pick(hashLocations, listingsIds);
}

/**
 * Combine all metrics before applying a sort
 * @param  {object[]} listings
 * @param  {object}   hashJourneys
 * @param  {object[]} listingsRelevance
 * @return {object[]} res - combined metrics listings
 * @return {number}   res.id - listing id
 * @return {number}   res.distance
 * @return {float}    res.score
 */
function combineMetrics({ listings, hashJourneys, listingsRelevance }) {
    const indexedListingsRelevance = listingsRelevance ? _.indexBy(listingsRelevance, 'id') : null;

    return _.map(listings, listing => {
        const obj = {
            id: listing.id,
        };

        if (indexedListingsRelevance) {
            const relevance = indexedListingsRelevance[listing.id];
            obj.score = relevance ? relevance.score : 0;
        }

        if (hashJourneys) {
            const journeys = hashJourneys[listing.id];
            if (journeys && journeys.length) {
                obj.distance = _.first(journeys).distanceMeters;
            } else {
                obj.distance = Infinity;
            }
        }

        return obj;
    });
}

function removeIrrelevantResults(combinedMetrics, listingsRelevanceMeta) {
    if (!combinedMetrics.length) {
        return combinedMetrics;
    }

    const minLimit = listingsRelevanceMeta.maxScore / 10;
    return _.filter(combinedMetrics, metrics => metrics.score >= minLimit);
}

function convertCombineMetricsToListings(combinedMetrics, listings) {
    const indexedListings = _.indexBy(listings, 'id');

    return _.map(combinedMetrics, metrics => {
        return indexedListings[metrics.id];
    });
}

function sortByRelevance(combinedMetrics) {
    return _.sortBy(combinedMetrics, metrics => - metrics.score);
}

function sortByMixRelevanceDistance(combinedMetrics, listingsRelevanceMeta) {
    const relevanceGroups = clusterByRelevance(combinedMetrics, listingsRelevanceMeta);

    return _.reduce(relevanceGroups, (memo, group) => {
        memo = memo.concat(sortByDistance(group));
        return memo;
    }, []);
}

function clusterByRelevance(combinedMetrics, listingsRelevanceMeta) {
    let groups = [];

    const { maxScore } = listingsRelevanceMeta;
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
    return _.sortBy(combinedMetrics, metrics => metrics.distance);
}

/**
 * Get journeys info from hash locations, indexed by listing id
 * @param  {object[]} fromLocations - user locations
 * @param  {object} hashLocations
 * @return {object} hashJourneys
 */
async function getJourneysInfo(fromLocations, hashLocations) {
    const listingsIds = _.keys(hashLocations);
    const hashJourneys = {};

    await Promise.map(listingsIds, async (listingId) => {
        // this listing has no locations
        if (!hashLocations[listingId].length) {
            return;
        }

        const journeys = MapService.getDistanceTable(fromLocations, hashLocations[listingId]);
        // sort by shortest distance first
        hashJourneys[listingId] = _.sortBy(journeys, journey => journey.distanceMeters);
    });

    return hashJourneys;
}

/**
 * Get extra info related to search results listings
 * @param  {object[]} listings - search results
 * @param  {boolean}  [getMedia] - whether ownerMedia should be retrieved
 * @return {object} extraInfo
 */
async function getListingsExtraInfo({ listings, getMedia }) {
    const ownersIds = MicroService.escapeListForQueries(_.pluck(listings, 'ownerId'));
    let infoPromises = [Listing.getMedias(listings)];
    let owners;

    if (getMedia) {
        owners = await User.find({ id: ownersIds });
        infoPromises.push(User.getMedia(owners));
    } else {
        infoPromises.push({});
    }

    const [
        listingsMedias,
        ownersMedias,
    ] = await Promise.all(infoPromises);

    return {
        owners,
        listingsMedias,
        ownersMedias,
    };
}

/**
 * Expose listings with only filtered fields
 * @param  {object[]} listings
 * @param  {object[]} owners
 * @param  {object}   listingsMedias
 * @param  {object}   ownersMedias
 * @param  {boolean}  displayJourneys
 * @param  {object}   fromLocations
 * @param  {object}   hashLocations
 * @param  {object}   hashJourneys
 * @param  {String}   locale
 * @param  {String}   fallbackLocale
 * @return {object[]} exposed listings
 */
function getExposedListings({
    listings,
    owners,
    listingsMedias,
    ownersMedias,
    displayJourneys,
    fromLocations,
    hashLocations,
    hashJourneys,
    locale,
    fallbackLocale,
}) {
    let journeys;
    const indexedOwners = _.indexBy(owners, 'id');

    if (displayJourneys) {
        journeys = convertJourneys(fromLocations, hashJourneys, hashLocations);
    }

    const exposedListings = _.map(listings, listing => {
        listing = Listing.expose(listing, 'others', { locale, fallbackLocale });
        listing.medias = Media.exposeAll(listingsMedias[listing.id], 'others');
        listing.ownerRating = _.pick(indexedOwners[listing.ownerId], ['nbRatings', 'ratingScore']);
        listing.completeLocations = _.map(hashLocations[listing.id], location => {
            return Location.expose(location, 'others');
        });

        if (ownersMedias && !_.isEmpty(ownersMedias)) {
            listing.ownerMedia = Media.expose(ownersMedias[listing.ownerId], 'others');
        }

        if (displayJourneys) {
            listing.journeys = journeys[listing.id];
        }

        return listing;
    });

    return exposedListings;
}

function convertJourneys(fromLocations, hashJourneys, hashLocations) {
    return _.reduce(_.keys(hashJourneys), (memo, listingId) => {
        memo[listingId] = _.map(hashJourneys[listingId], journey => {
            return {
                index: journey.fromIndex,
                fromLocation: fromLocations[journey.fromIndex],
                toLocation: Location.expose(hashLocations[listingId][journey.toIndex], "others"),
                distanceMeters: journey.distanceMeters,
                durationSeconds: journey.durationSeconds,
            };
        });

        return memo;
    }, {});
}

/**
 * Only get listings that are within a distance range
 * @param  {object[]} fromLocations - user locations
 * @param  {object[]} listings
 * @param  {object}   hashLocations
 * @param  {number}   withinDistanceLimitMeters - distance limit
 * @return {object[]} filtered listings
 */
function filterListingsWithinDistance(fromLocations, listings, hashLocations, withinDistanceLimitMeters) {
    return _.reduce(listings, (memo, listing) => {
        // security in case listings has no locations
        var toLocations = hashLocations[listing.id];
        if (!toLocations || !toLocations.length) {
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

        // if any listing locations are near one of fromLocations, it's ok
        if (nearLocations.length) {
            memo.push(listing);
        }

        return memo;
    }, []);
}

function getListingsFromCache(cacheKey) {
    const listings = searchCache.get(cacheKey);

    if (listings) {
        searchCache.set(cacheKey, listings); // refresh TTL
    }

    return listings;
}

function setListingsToCache(cacheKey, listings) {
    searchCache.set(cacheKey, listings);
}

/**
 * Normalize the search parameters
 * @param {Object}   params
 * @param {Number}   [params.listingCategoryId]
 * @param {String}   [params.query]
 * @param {String}   [params.listingTypesIds]
 * @param {String}   [params.queryMode] - allowed values: ['relevance', 'default', 'distance']
 * @param {String}   [params.locationsSource] - indicate where the locations come from
 * @param {Object[]} [params.locations]
 * @param {Float}    params.locations[i].latitude
 * @param {Float}    params.locations[i].longitude
 * @param {Number}   [params.distanceLimitMeters] - drop any results beyond this limit
 * @param {String}   [params.sorting]
 * @param {Number[]} [params.withoutIds] - filter out listings with this ids (useful for similar listings)
 * @param {Number[]} [params.similarToListingsIds]
 * @param {Number}   [params.page]
 * @param {Number}   [params.limit]
 * @param {Number}   [params.timestamp] - useful to prevent requests racing from client-side
 */
function normalizeSearchQuery(params) {
    var searchFields = [
        'listingCategoryId',
        'query',
        'listingTypesIds',
        'queryMode',
        'locationsSource',
        'locations',
        'distanceLimitMeters',
        'sorting',
        'withoutIds',
        'similarToListingsIds',
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

            case 'listingCategoryId':
            case 'timestamp':
                isValid = !isNaN(value);
                break;

            case 'queryMode':
                isValid = _.includes(queryModes, value);
                break;

            case 'locations':
                isValid = MapService.isValidGpsPts(value);
                break;

            case 'listingTypesIds':
            case 'withoutIds':
            case 'similarToListingsIds':
                isValid = MicroService.checkArray(value, 'id');
                break;

            case 'page':
            case 'limit':
            case 'distanceLimitMeters':
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
        listingTypesIds: searchQuery.listingTypesIds,
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
            label: 'Search',
            req: req,
            res: res,
            type: 'ui',
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

function isWrongPageParams(listings, page, limit) {
    if (page === 1) {
        return false;
    }

    return (listings.length <= (page - 1) * limit);
}

function getListingsByPagination(listings, page, limit) {
    return listings.slice((page - 1) * limit, page * limit);
}
