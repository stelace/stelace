/* global
    BookingService, Bookmark, Listing, ListingService, ListingTypeService, Location, Media, ModelSnapshot,
    PriceRecommendationService, PricingService, SearchEvent, SearchService, StelaceEventService, Tag, TokenService, ToolsService, User
*/

/**
 * ListingController
 *
 * @description :: Server-side logic for managing listings
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

module.exports = {

    find: find,
    findOne: findOne,
    create: create,
    update: update,
    destroy: destroy,

    query: query,
    my: my,
    updateMedias: updateMedias,
    search: search,
    getLocations: getLocations,
    getPricing: getPricing,
    getRecommendedPrices: getRecommendedPrices,
    getRentingPriceFromSellingPrice: getRentingPriceFromSellingPrice,
    pauseListingToggle: pauseListingToggle

};

var moment    = require('moment');
var NodeCache = require('node-cache');

var landingCache = new NodeCache({ stdTTL: 5 * 60 }); // 5 min

function find(req, res) {
    var landing = req.param("landing");
    var ownerId = req.param("ownerId");
    var access = "others";

    if (! landing && ! ownerId) {
        return res.forbidden();
    }

    var formatDate = "YYYY-MM-DD";
    var landingPastLimit = moment().subtract(60, "d").format(formatDate);
    var landingListings = landingCache.get("candidates");

    return Promise
        .resolve()
        .then(() => {
            if (landing) {
                return landingListings || Listing.find({
                    validated: true,
                    locked: false,
                    updatedDate: {
                        ">=": landingPastLimit
                    }
                });
            } else if (ownerId) {
                return Listing.find({ ownerId: ownerId });
            }
        })
        .then(listings => {
            if (landing && ! landingListings) {
                landingCache.set("candidates", listings);
            }
            if (landing) {
                listings = _(listings)
                    .filter(listing => listing.mediasIds.length)
                    .uniq("ownerId")
                    .sample(12)
                    .value();
            }

            var locationsIds = _.reduce(listings, function (memo, listing) {
                memo = memo.concat(listing.locations);
                return memo;
            }, []);
            locationsIds = _.uniq(locationsIds);

            return [
                listings,
                User.find({ id: _.pluck(listings, "ownerId") }),
                Location.find({ id: locationsIds })
            ];
        })
        .spread((listings, owners, locations) => {
            return [
                listings,
                owners,
                locations,
                Listing.getMedias(listings),
                User.getMedia(owners)
            ];
        })
        .spread((listings, owners, locations, listingMedias, ownerMedias) => {
            var indexedOwners = _.indexBy(owners, "id");

            listings = _.map(listings, function (listing) {
                listing            = Listing.expose(listing, access);
                listing.medias     = Media.exposeAll(listingMedias[listing.id], access);
                listing.owner      = User.expose(indexedOwners[listing.ownerId], access);
                listing.ownerMedia = Media.expose(ownerMedias[listing.ownerId], access);
                listing.locations  = _.filter(locations, function (location) {
                    return _.contains(listing.locations, location.id);
                });
                listing.locations  = Location.exposeAll(listing.locations, access);

                return listing;
            });

            res.json(listings);
        })
        .catch(res.sendError);
}

async function findOne(req, res) {
    const id = parseInt(req.param('id'), 10);
    const snapshotAllowed = (req.param('snapshot') === 'true');
    let access;

    const formatDate = 'YYYY-MM-DD';
    const today = moment().format(formatDate);

    try {
        let listing;

        if (snapshotAllowed) {
            listing = await Listing.getListingsOrSnapshots(id);
        } else {
            listing = await Listing.findOne({ id });
        }

        if (!listing) {
            throw new NotFoundError();
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

        listing = Listing.expose(listing, access);

        if (! listing.tags) {
            listing.tags         = [];
            listing.completeTags = [];
        }

        listing.owner              = User.expose(owner, access);
        listing.ownerMedia         = Media.expose(ownerMedia, access);
        listing.pricing            = PricingService.getPricing(listing.pricingId);
        listing.medias             = Media.exposeAll(listingMedias, access);
        listing.instructionsMedias = Media.exposeAll(listingInstructionsMedias, access);

        const availableResult = BookingService.getAvailabilityPeriods(futureBookings);
        listing.availablePeriods = availableResult.availablePeriods;

        res.json(listing);
    } catch (err) {
        res.sendError(err);
    }
}

async function create(req, res) {
    var filteredAttrs = [
        "name",
        "reference",
        "description",
        "tags",
        "stateComment",
        "bookingPreferences",
        "accessories",
        "bookingStartDate",
        "bookingEndDate",
        "brandId",
        "listingCategoryId",
        "validation",
        "validationFields",
        "locations",
        "listingTypesIds",
        "dayOnePrice",
        "sellingPrice",
        "customPricingConfig",
        "deposit",
        "acceptFree",
    ];
    var createAttrs = _.pick(req.allParams(), filteredAttrs);
    createAttrs.ownerId = req.user.id;
    var access = "self";

    if (! createAttrs.name
        || (createAttrs.tags && ! µ.checkArray(createAttrs.tags, "id"))
        || (createAttrs.locations && ! µ.checkArray(createAttrs.locations, "id"))
        || typeof createAttrs.sellingPrice !== "number" || createAttrs.sellingPrice < 0
        || typeof createAttrs.dayOnePrice !== "number" || createAttrs.dayOnePrice < 0
        || ! PricingService.getPricing(createAttrs.pricingId)
        || typeof createAttrs.deposit !== "number" || createAttrs.deposit < 0
        || (!createAttrs.listingTypesIds || !µ.checkArray(createAttrs.listingTypesIds, 'id') || !createAttrs.listingTypesIds.length)
        || (createAttrs.customPricingConfig && ! PricingService.isValidCustomConfig(createAttrs.customPricingConfig))
    ) {
        return res.badRequest();
    }

    try {
        const validListingTypesIds = await ListingTypeService.isValidListingTypesIds(createAttrs.listingTypesIds);
        if (!validListingTypesIds) {
            return res.badRequest();
        }

        createAttrs.sellingPrice = PricingService.roundPrice(createAttrs.sellingPrice);
        createAttrs.dayOnePrice  = PricingService.roundPrice(createAttrs.dayOnePrice);
        createAttrs.deposit      = PricingService.roundPrice(createAttrs.deposit);

        var pricing = PricingService.getPricing();
        createAttrs.pricingId = pricing.id;

        const [
            myLocations,
            validReferences,
            validTags,
        ] = await Promise.all([
            Location.find({ userId: req.user.id }),
            Listing.isValidReferences({
                brandId: createAttrs.brandId,
                listingCategoryId: createAttrs.listingCategoryId,
            }),
            isValidTags(createAttrs.tags),
        ]);

        if (!validReferences || !validTags) {
            throw new BadRequestError();
        }

        var hashLocations = _.indexBy(myLocations, "id");

        if (createAttrs.locations) {
            if (!isValidLocations(createAttrs.locations, hashLocations)) {
                throw new BadRequestError();
            }
        } else {
            createAttrs.locations = _.pluck(myLocations, "id");
        }

        let listing = await Listing.create(createAttrs);
        listing = await Listing.updateTags(listing, createAttrs.tags);

        res.json(Listing.expose(listing, access));
    } catch (err) {
        res.sendError(err);
    }



    async function isValidTags(tagsIds) {
        if (!tagsIds) return true;

        const tags = await Tag.find({ id: _.uniq(tagsIds) });
        return tags.length === tagsIds.length;
    }

    function isValidLocations(locationsIds, hashLocations) {
        return _.reduce(locationsIds, (memo, locationId) => {
            if (!hashLocations[locationId]) {
                memo = memo && false;
            }
            return memo;
        }, true);
    }
}

async function update(req, res) {
    var id = req.param("id");
    var filteredAttrs = [
        "name",
        "reference",
        "description",
        "tags",
        "stateComment",
        "bookingPreferences",
        "accessories",
        "bookingStartDate",
        "bookingEndDate",
        "brandId",
        "listingCategoryId",
        "locations",
        "listingTypesIds",
        "dayOnePrice",
        "sellingPrice",
        "customPricingConfig",
        "deposit",
        "acceptFree"
    ];
    var updateAttrs = _.pick(req.allParams(), filteredAttrs);
    var access = "self";

    if ((updateAttrs.tags && ! µ.checkArray(updateAttrs.tags, "id"))
        || (updateAttrs.locations && ! µ.checkArray(updateAttrs.locations, "id"))
        || (updateAttrs.sellingPrice && (typeof updateAttrs.sellingPrice !== "number" || updateAttrs.sellingPrice < 0))
        || (updateAttrs.dayOnePrice && (typeof updateAttrs.dayOnePrice !== "number" || updateAttrs.dayOnePrice < 0))
        || (updateAttrs.deposit && (typeof updateAttrs.deposit !== "number" || updateAttrs.deposit < 0))
        || (updateAttrs.customPricingConfig && ! PricingService.isValidCustomConfig(updateAttrs.customPricingConfig))
    ) {
        return res.badRequest();
    }

    if (typeof updateAttrs.dayOnePrice === "number") {
        updateAttrs.dayOnePrice = PricingService.roundPrice(updateAttrs.dayOnePrice);
    }
    if (typeof updateAttrs.deposit === "number") {
        updateAttrs.deposit = PricingService.roundPrice(updateAttrs.deposit);
    }

    try {
        const validListingTypesIds = await ListingTypeService.isValidListingTypesIds(updateAttrs.listingTypesIds);
        if (!validListingTypesIds) {
            return res.badRequest();
        }

        const [
            listing,
            validReferences,
            validLocations,
            validTags,
        ] = await Promise.all([
            Listing.findOne({ id: id }),
            Listing.isValidReferences({
                brandId: updateAttrs.brandId,
                listingCategoryId: updateAttrs.listingCategoryId
            }),
            isValidLocations(updateAttrs.locations),
            isValidTags(updateAttrs.tags)
        ]);

        if (! listing) {
            throw new NotFoundError();
        }
        if (listing.ownerId !== req.user.id) {
            throw new ForbiddenError();
        }
        if (! validReferences
            || ! validLocations
            || ! validTags
            || listing.soldDate
        ) {
            throw new BadRequestError();
        }

        var isListingValidated = (! listing.validation || (listing.validation && listing.validated));
        if (typeof updateAttrs.name !== "undefined" && ! isListingValidated) {
            updateAttrs.nameURLSafe = ToolsService.getURLStringSafe(updateAttrs.name);
        }

        let exposedListing = await Listing.updateOne(listing.id, updateAttrs);
        exposedListing = await Listing.updateTags(exposedListing, updateAttrs.tags);

        res.json(Listing.expose(exposedListing, access));
    } catch (err) {
        res.sendError(err);
    }



    async function isValidLocations(locationsIds) {
        if (!locationsIds) return true;

        const locations = await Location.find({
            id: _.uniq(locationsIds),
            userId: req.user.id,
        });
        return locations.length === locationsIds.length;
    }

    async function isValidTags(tagsIds) {
        if (!tagsIds) return true;

        const tags = await Tag.find({ id: _.uniq(tagsIds) });
        return tags.length === tagsIds.length;
    }
}

function destroy(req, res) {
    var id = req.param("id");
    var today = moment().format("YYYY-MM-DD");

    return Promise
        .resolve()
        .then(() => {
            return Listing.findOne({
                id: id,
                ownerId: req.user.id
            });
        })
        .then(listing => {
            if (! listing) {
                throw new NotFoundError();
            }

            return [
                listing,
                Listing.getFutureBookings(listing.id, today)
            ];
        })
        .spread((listing, futureBookings) => {
            if (futureBookings.length) {
                var error = new BadRequestError("remaining bookings");
                error.expose = true;
                throw error;
            }

            return [
                listing,
                Bookmark.update({ listingId: id }, { active: false }) // disable bookmarks associated to this listing
            ];
        })
        .spread(listing => {
            // create a snapshot before destroying the listing
            return ModelSnapshot.getSnapshot("listing", listing);
        })
        .then(() => sendEvent(req, res, id))
        .then(() => {
            return Listing.destroy({ id: id });
        })
        .then(() => {
            res.json({ id: id });
        })
        .catch(res.sendError);



    function sendEvent(req, res, listingId) {
        return StelaceEventService.createEvent({
            req: req,
            res: res,
            label: "Listing destroy",
            data: { listingId: listingId }
        });
    }
}

function query(req, res) {
    var query = req.param("q");
    var access = "self";

    if (! TokenService.isRole(req, "admin")) {
        return res.forbidden();
    }

    return Promise.coroutine(function* () {
        query = query.trim();

        if (! query) {
            return res.json([]);
        }

        var listingId = getListingId(query);
        var listings = [];
        var listing;

        if (listingId) {
            listing = yield Listing.findOne({ id: listingId });
            if (listing) {
                listings.push(listing);
            }
        } else {
            if (isEnoughLongToken(query)) {
                listings = yield Listing.find({ name: { contains: query } });
            } else {
                listings = [];
            }
        }

        res.json(Listing.exposeAll(listings, access));
    })()
    .catch(res.sendError);



    function getListingId(str) {
        var parsedStr = parseInt(str, 10);
        return ! isNaN(parsedStr) ? parsedStr : null;
    }

    function isEnoughLongToken(token) {
        return token.length >= 3;
    }
}

function my(req, res) {
    var access = "self";

    return Promise
        .resolve()
        .then(() => {
            return Listing.find({ ownerId: req.user.id });
        })
        .then(listings => {
            return [
                listings,
                Listing.getMedias(listings),
                Listing.getInstructionsMedias(listings),
                Listing.getTags(listings)
            ];
        })
        .spread((listings, hashMedias, hashInstructionsMedias) => {
            listings = Listing.exposeAll(listings, access);

            _.forEach(listings, function (listing) {
                var medias             = hashMedias[listing.id];
                var instructionsMedias = hashInstructionsMedias[listing.id];

                listing.medias             = _.map(medias, media => Media.expose(media, access));
                listing.pricing            = PricingService.getPricing(listing.pricingId);
                listing.instructionsMedias = _.map(instructionsMedias, media => Media.expose(media, access));
            });

            res.json(listings);
        })
        .catch(res.sendError);
}

function updateMedias(req, res) {
    var id = req.param("id");
    var mediasIds = req.param("mediasIds");
    var mediaType = req.param("mediaType");

    if (! mediasIds || ! µ.checkArray(mediasIds, "id")) {
        return res.badRequest();
    }
    if (! _.contains(["listing", "instructions"], mediaType)) {
        return res.badRequest();
    }
    if ((mediaType === "listing" && Media.get("maxNb").listing < mediasIds.length)
        || (mediaType === "instructions" && Media.get("maxNb").listingInstructions < mediasIds.length)
    ) {
        return res.badRequest(new BadRequestError("cannot set too much medias"));
    }

    mediasIds = _.map(mediasIds, function (mediaId) {
        return parseInt(mediaId, 10);
    });

    return Promise
        .resolve()
        .then(() => {
            return [
                Listing.findOne({ id: id }),
                Media.find({ id: mediasIds })
            ];
        })
        .spread((listing, medias) => {
            var isAllOwnMedias = _.reduce(medias, function (memo, media) {
                if (req.user.id !== media.userId) {
                    memo = memo && false;
                }
                return memo;
            }, true);

            if (! listing
                || medias.length !== mediasIds.length
            ) {
                throw new NotFoundError();
            }
            if (req.user.id !== listing.ownerId
                || ! isAllOwnMedias
            ) {
                throw new ForbiddenError();
            }

            var updateAttrs = {};

            if (mediaType === "listing") {
                updateAttrs.mediasIds = mediasIds;
            } else if (mediaType === "instructions") {
                updateAttrs.instructionsMediasIds = mediasIds;
            }

            return Listing.updateOne(listing.id, updateAttrs);
        })
        .then(() => {
            res.ok({ id: id });
        })
        .catch(res.sendError);
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

function getLocations(req, res) {
    var id     = req.param("id");

    var access = "others";

    if (isNaN(id) || id <= 0) {
        return res.badRequest();
    }

    return Promise
        .resolve()
        .then(() => {
            return Listing.findOne({ id: id });
        })
        .then(listing => {
            if (! listing) {
                throw new NotFoundError();
            }

            return Location.find({ id: listing.locations });
        })
        .then(locations => {
            res.json(Location.exposeAll(locations, access));
        })
        .catch(res.sendError);
}

function getPricing(req, res) {
    var pricingId = parseInt(req.param("pricingId"), 10);
    var pricing = PricingService.getPricing(pricingId);

    if (! pricing) {
        return res.notFound();
    }

    return res.json({
        id: pricing.id,
        config: pricing.config,
        ownerFeesPercent: PricingService.get("ownerFeesPercent"),
        takerFeesPercent: PricingService.get("takerFeesPercent"),
        ownerFeesPurchasePercent: PricingService.get("ownerFeesPurchasePercent"),
        takerFeesPurchasePercent: PricingService.get("takerFeesPurchasePercent"),
        maxDiscountPurchasePercent: PricingService.get("maxDiscountPurchasePercent")
    });
}

function pauseListingToggle(req, res) {
    var listingId = req.param("id");
    var pausedUntil = req.param("pausedUntil");
    var pause = req.param("pause");
    var access = "self";

    return Promise.coroutine(function* () {
        var updatedListing = yield ListingService.pauseListingToggle({
            listingId,
            pause,
            pausedUntil,
            req
        });

        res.json(Listing.expose(updatedListing, access));
    })()
    .catch(res.sendError);
}

function getRecommendedPrices(req, res) {
    var query = req.param("query");

    if (typeof query !== "string") {
        throw new BadRequestError("Query string expected");
    }

    return PriceRecommendationService.getRecommendedPrices(query)
        .then(prices => {
            res.json(prices);
        })
        .catch(err => {
            req.logger.info({ err: err }, "Could not recommend a listing price.");
            return res.ok();
        });
}

function getRentingPriceFromSellingPrice(req, res) {
    var sellingPrice = req.param("value");

    if (! _.isFinite(sellingPrice)) {
        throw new BadRequestError("Number expected");
    }

    return PriceRecommendationService.getRentingPriceFromSellingPrice(sellingPrice)
        .then(prices => {
            res.json(prices);
        })
        .catch(res.sendError);
}
