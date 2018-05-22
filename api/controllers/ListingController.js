/* global
    AclService, BookingService, Listing, ListingAvailability, ListingService, ListingTypeService, Location, Media, MicroService,
    PriceRecommendationService, SearchEvent, SearchService, StelaceConfigService, TokenService, User
*/

/**
 * ListingController
 *
 * @description :: Server-side logic for managing listings
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

module.exports = {

    find,
    findOne,
    create,
    update,
    destroy,

    query,
    my,
    updateMedias,
    search,
    getLocations,
    getRecommendedPrices,
    getTimeUnitPriceFromSellingPrice,
    pauseListingToggle,
    getListingAvailability,
    createListingAvailability,
    updateListingAvailability,
    removeListingAvailability,

};

var moment    = require('moment');
var NodeCache = require('node-cache');
const _ = require('lodash');
const Promise = require('bluebird');
const createError = require('http-errors');

var landingCache = new NodeCache({ stdTTL: 5 * 60 }); // 5 min

async function find(req, res) {
    const landing = req.param('landing');
    const ownerId = req.param('ownerId');
    const access = 'others';

    if (! landing && ! ownerId) {
        return res.forbidden();
    }

    const config = await StelaceConfigService.getConfig();

    let listings;
    if (landing) {
        listings = await getLandingListings();
    } else if (ownerId) {
        listings = await Listing.find({ ownerId });
    }

    let locationsIds = _.reduce(listings, (memo, listing) => {
        memo = memo.concat(listing.locations);
        return memo;
    }, []);
    locationsIds = _.uniq(locationsIds);

    const [
        owners,
        locations,
    ] = await Promise.all([
        User.find({ id: MicroService.escapeListForQueries(_.pluck(listings, 'ownerId')) }),
        Location.find({ id: locationsIds }),
    ]);

    const [
        listingMedias,
        ownerMedias,
    ] = await Promise.all([
        Listing.getMedias(listings),
        User.getMedia(owners),
    ]);

    const indexedOwners = _.indexBy(owners, "id");

    listings = _.map(listings, listing => {
        listing            = Listing.expose(listing, access, { locale: config.lang, fallbackLocale: config.lang });
        listing.medias     = Media.exposeAll(listingMedias[listing.id], access);
        listing.owner      = User.expose(indexedOwners[listing.ownerId], access);
        listing.ownerMedia = Media.expose(ownerMedias[listing.ownerId], access);
        listing.locations  = _.filter(locations, location => {
            return _.contains(listing.locations, location.id);
        });
        listing.locations  = Location.exposeAll(listing.locations, access);

        return listing;
    });

    res.json(listings);



    async function getLandingListings() {
        const formatDate = 'YYYY-MM-DD';
        const landingPastLimit = moment().subtract(60, 'd').format(formatDate);
        const landingListings = landingCache.get('candidates');

        let listings;
        if (landingListings) {
            listings = landingListings;
        } else {
            listings = await Listing.find({
                validated: true,
                locked: false,
                updatedDate: { '>=': landingPastLimit },
            });
            landingCache.set('candidates', listings);
        }

        listings = _(listings)
            .filter(listing => listing.mediasIds.length)
            .uniq('ownerId')
            .sample(12)
            .value();

        return listings;
    }
}

async function findOne(req, res) {
    const id = parseInt(req.param('id'), 10);
    const snapshotAllowed = (req.param('snapshot') === 'true');
    let access;

    const formatDate = 'YYYY-MM-DD';
    const today = moment().format(formatDate);

    const config = await StelaceConfigService.getConfig();

    let listing;

    if (snapshotAllowed) {
        listing = await Listing.getListingsOrSnapshots(id);
    } else {
        listing = await Listing.findOne({ id });
    }

    if (!listing) {
        throw createError(404);
    }

    const [
        owner,
        futureBookings,
    ] = await Promise.all([
        User.findOne({ id: listing.ownerId }),
        ! listing.snapshot ? Listing.getFutureBookings(listing.id, today) : [],
    ]);

    if (!listing.snapshot) {
        await Listing.getTags(listing, true);
    }

    const [
        listingMedias,
        ownerMedia,
        listingInstructionsMedias,
    ] = await Promise.all([
        Listing.getMedias([listing]).then(listingMedias => listingMedias[listing.id]),
        User.getMedia([owner]).then(ownerMedias => ownerMedias[owner.id]),
        Listing.getInstructionsMedias([listing]).then(listingInstructionsMedias => listingInstructionsMedias[listing.id])
    ]);

    if (req.user && listing.ownerId === req.user.id) {
        access = 'self';
    } else {
        access = 'others';
    }

    listing = Listing.expose(listing, access, { locale: config.lang, fallbackLocale: config.lang });

    if (! listing.tags) {
        listing.tags         = [];
        listing.completeTags = [];
    }

    listing.owner              = User.expose(owner, access);
    listing.ownerMedia         = Media.expose(ownerMedia, access);
    listing.medias             = Media.exposeAll(listingMedias, access);
    listing.instructionsMedias = Media.exposeAll(listingInstructionsMedias, access);

    let listingType;
    if (listing.listingTypesIds.length) {
        listingType = await ListingTypeService.getListingType(listing.listingTypesIds[0]);
    }

    const availabilityGraphs = {
        periods: null,
        dates: null,
    };

    if (listingType) {
        const { TIME } = listingType.properties;

        const maxQuantity = Listing.getMaxQuantity(listing, listingType);

        if (TIME === 'TIME_FLEXIBLE') {
            const listingAvailabilities = await ListingAvailability.find({
                listingId: listing.id,
                type: 'period',
                endDate: { '>=': today },
            });

            const availabilityGraph = BookingService.getAvailabilityPeriodGraph({ futureBookings, listingAvailabilities, maxQuantity });
            availabilityGraphs.periods = availabilityGraph;

            listing.listingAvailabilities = listingAvailabilities;
        } else if (TIME === 'TIME_PREDEFINED') {
            const listingAvailabilities = await ListingAvailability.find({
                listingId: listing.id,
                type: 'date',
                startDate: { '>=': today },
            });

            const availabilityGraph = BookingService.getAvailabilityDateGraph({ futureBookings, listingAvailabilities, maxQuantity });
            availabilityGraphs.dates = availabilityGraph;

            listing.listingAvailabilities = listingAvailabilities;
        }
    }

    listing.availabilityGraphs = availabilityGraphs;
    listing.futureBookings = futureBookings;

    res.json(listing);
}

async function create(req, res) {
    const allowed = await AclService.isAllowed(req.user.roles, 'listing', 'create');
    if (!allowed) {
        throw createError(403);
    }

    const attrs = req.allParams();
    attrs.ownerId = req.user.id;

    const access = 'self';

    const config = await StelaceConfigService.getConfig();

    const listing = await ListingService.createListing(attrs, { req, res });
    res.json(Listing.expose(listing, access, { locale: config.lang, fallbackLocale: config.lang }));
}

async function update(req, res) {
    const id = req.param('id');
    const attrs = req.allParams();

    const access = 'self';

    const config = await StelaceConfigService.getConfig();

    const listing = await ListingService.updateListing(id, attrs, { userId: req.user.id });
    res.json(Listing.expose(listing, access, { locale: config.lang, fallbackLocale: config.lang }));
}

async function destroy(req, res) {
    const id = req.param('id');

    try {
        await ListingService.destroyListing(id, {
            keepCommittedBookings: true,
            trigger: 'owner',
        }, { req, res, userId: req.user.id });

        res.json({ id });
    } catch (err) {
        res.sendError(err);
    }
}

async function query(req, res) {
    var query = req.param("q");
    var access = "self";

    if (! TokenService.isRole(req, "admin")) {
        return res.forbidden();
    }

    query = query.trim();

    if (! query) {
        return res.json([]);
    }

    var listingId = getListingId(query);
    var listings = [];
    var listing;

    const config = await StelaceConfigService.getConfig();

    if (listingId) {
        listing = await Listing.findOne({ id: listingId });
        if (listing) {
            listings.push(listing);
        }
    } else {
        if (isEnoughLongToken(query)) {
            listings = await Listing.find({ name: { contains: query } });
        } else {
            listings = [];
        }
    }

    res.json(Listing.exposeAll(listings, access, { locale: config.lang, fallbackLocale: config.lang }));



    function getListingId(str) {
        var parsedStr = parseInt(str, 10);
        return ! isNaN(parsedStr) ? parsedStr : null;
    }

    function isEnoughLongToken(token) {
        return token.length >= 3;
    }
}

async function my(req, res) {
    const access = "self";

    let listings = await Listing.find({ ownerId: req.user.id });

    const [
        hashMedias,
        hashInstructionsMedias,
    ] = await Promise.all([
        Listing.getMedias(listings),
        Listing.getInstructionsMedias(listings),
        Listing.getTags(listings),
    ]);

    const config = await StelaceConfigService.getConfig();

    listings = Listing.exposeAll(listings, access, { locale: config.lang, fallbackLocale: config.lang });

    _.forEach(listings, listing => {
        const medias             = hashMedias[listing.id];
        const instructionsMedias = hashInstructionsMedias[listing.id];

        listing.medias             = _.map(medias, media => Media.expose(media, access));
        listing.instructionsMedias = _.map(instructionsMedias, media => Media.expose(media, access));
    });

    res.json(listings);
}

async function updateMedias(req, res) {
    const id = req.param('id');
    const mediasIds = req.param('mediasIds');
    const mediaType = req.param('mediaType');

    try {
        await ListingService.updateListingMedias(id, { mediasIds, mediaType }, { userId: req.user.id });
        res.json({ id });
    } catch (err) {
        res.sendError(err);
    }
}

async function search(req, res) {
    let searchQuery = req.param('searchQuery');
    const type = req.param('type'); // possible values: "search" or "similar"

    try {
        searchQuery = SearchService.normalizeSearchQuery(searchQuery, type);
    } catch (e) {
        return res.badRequest();
    }

    await (async function () {
        // track the search request
        const logConfig = await SearchService.createEvent({
            searchQuery,
            type,
            req,
            res,
        })
        .catch(() => null);

        const searchStartDate = new Date();

        const config = await StelaceConfigService.getConfig();
        const lang = config.lang;
        searchQuery.lang = lang;

        // retrieve the search query from the cache and use if it exists
        const cacheKey = SearchService.getQueryHash(searchQuery);
        let listings = SearchService.getListingsFromCache(cacheKey);

        // results not in cache, so compute the search
        if (! listings) {
            listings = await SearchService.getListingsFromQuery(searchQuery, type);
            SearchService.setListingsToCache(cacheKey, listings); // set results in cache
        }

        let { page, limit, timestamp } = searchQuery;

        if (SearchService.isWrongPageParams(listings, page, limit)) {
            page = 1;
        }

        // set the search completion duration
        if (logConfig && logConfig.searchEvent) {
            // asynchronous operation
            SearchEvent
                .updateOne(logConfig.searchEvent.id, {
                    completionDuration: new Date() - searchStartDate
                })
                .catch(() => null);
        }

        res.json({
            page,
            limit,
            timestamp, // is used for client-side to prevent old requests racing
            count: listings.length,
            listings: SearchService.getListingsByPagination(listings, page, limit), // return only listings based on pagination params
        });
    })()
    .catch(res.sendError);
}

async function getLocations(req, res) {
    const id = req.param('id');

    const access = 'others';

    try {
        const listing = await Listing.findOne({ id });
        if (!listing) {
            throw createError(404);
        }

        const locations = await Location.find({ id: MicroService.escapeListForQueries(listing.locations) });
        res.json(Location.exposeAll(locations, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function pauseListingToggle(req, res) {
    const id = req.param('id');
    const pausedUntil = req.param('pausedUntil');
    const pause = req.param('pause');

    const access = 'self';

    const config = await StelaceConfigService.getConfig();

    const listing = await ListingService.pauseListingToggle(
        id,
        { pausedUntil, pause },
        { req, res, userId: req.user.id },
    );

    res.json(Listing.expose(listing, access, { locale: config.lang, fallbackLocale: config.lang }));
}

function getRecommendedPrices(req, res) {
    var query = req.param("query");

    if (typeof query !== "string") {
        throw createError(400, 'Query string expected');
    }

    return PriceRecommendationService.getRecommendedPrices(query)
        .then(prices => {
            res.json(prices);
        })
        .catch(err => {
            req.logger.info({ err: err }, "Could not recommend a listing price.");
            return res.sendStatus(200);
        });
}

function getTimeUnitPriceFromSellingPrice(req, res) {
    var sellingPrice = req.param("value");

    if (! _.isFinite(sellingPrice)) {
        throw createError(400, 'Number expected');
    }

    return PriceRecommendationService.getTimeUnitPriceFromSellingPrice(sellingPrice)
        .then(prices => {
            res.json(prices);
        })
        .catch(res.sendError);
}

async function getListingAvailability(req, res) {
    const id = req.param('id');

    const access = 'others';

    try {
        const listing = await Listing.findOne({ id });
        if (!listing) {
            throw createError(404);
        }

        const listingAvailabilities = await ListingAvailability.find({ listingId: id });

        res.json(ListingAvailability.exposeAll(listingAvailabilities, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function createListingAvailability(req, res) {
    const id = req.param('id');
    const {
        startDate,
        endDate,
        quantity = 1,
    } = req.allParams();

    const access = 'others';

    const listingAvailability = await ListingService.createListingAvailability({
        listingId: id,
        startDate,
        endDate,
        quantity,
    }, { userId: req.user.id });

    res.json(ListingAvailability.expose(listingAvailability, access));
}

async function updateListingAvailability(req, res) {
    const id = req.param('id');
    const listingAvailabilityId = req.param('listingAvailabilityId');
    const quantity = req.param('quantity');

    const access = 'others';

    const listingAvailability = await ListingService.updateListingAvailability({
        listingId: id,
        listingAvailabilityId,
        quantity,
    }, { userId: req.user.id });

    res.json(ListingAvailability.expose(listingAvailability, access));
}

async function removeListingAvailability(req, res) {
    const id = req.param('id');
    const listingAvailabilityId = req.param('listingAvailabilityId');

    await ListingService.removeListingAvailability(
        { listingId: id, listingAvailabilityId },
        { userId: req.user.id }
    );

    res.json({ ok: true });
}
