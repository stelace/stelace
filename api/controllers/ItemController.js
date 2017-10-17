/* global
    Booking, Bookmark, Item, ItemService, Location, Media, ModelSnapshot,
    PriceRecommendationService, PricingService, SearchEvent, SearchService, StelaceEventService, Tag, TokenService, ToolsService, User
*/

/**
 * ItemController
 *
 * @description :: Server-side logic for managing items
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
    pauseItemToggle: pauseItemToggle

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

    // var itemIds = [12, 35, 26];
    // var itemIds = [85, 75, 50];
    // var itemIds = [10, 165, 146];
    // var itemIds = [207, 141, 167];
    // var itemIds = [253, 296, 278];
    // var itemIds = [391, 337, 494];
    var formatDate = "YYYY-MM-DD";
    var landingPastLimit = moment().subtract(60, "d").format(formatDate);
    var landingItems = landingCache.get("candidates");

    return Promise
        .resolve()
        .then(() => {
            if (landing) {
                return landingItems || Item.find({
                    validated: true,
                    locked: false,
                    updatedDate: {
                        ">=": landingPastLimit
                    }
                });
            } else if (ownerId) {
                return Item.find({ ownerId: ownerId });
            }
        })
        .then(items => {
            if (landing && ! landingItems) {
                landingCache.set("candidates", items);
            }
            if (landing) {
                items = _(items)
                    .filter(item => item.mediasIds.length)
                    .uniq("ownerId")
                    .sample(12)
                    .value();
            }

            var locationsIds = _.reduce(items, function (memo, item) {
                memo = memo.concat(item.locations);
                return memo;
            }, []);
            locationsIds = _.uniq(locationsIds);

            return [
                items,
                User.find({ id: _.pluck(items, "ownerId") }),
                Location.find({ id: locationsIds })
            ];
        })
        .spread((items, owners, locations) => {
            return [
                items,
                owners,
                locations,
                Item.getMedias(items),
                User.getMedia(owners)
            ];
        })
        .spread((items, owners, locations, itemMedias, ownerMedias) => {
            var indexedOwners = _.indexBy(owners, "id");

            items = _.map(items, function (item) {
                item            = Item.expose(item, access);
                item.medias     = Media.exposeAll(itemMedias[item.id], access);
                item.owner      = User.expose(indexedOwners[item.ownerId], access);
                item.ownerMedia = Media.expose(ownerMedias[item.ownerId], access);
                item.locations  = _.filter(locations, function (location) {
                    return _.contains(item.locations, location.id);
                });
                item.locations  = Location.exposeAll(item.locations, access);

                return item;
            });

            res.json(items);
        })
        .catch(res.sendError);
}

function findOne(req, res) {
    var id = req.param("id");
    var snapshotAllowed = (req.param("snapshot") === "true");
    var access;

    var formatDate = "YYYY-MM-DD";
    var today = moment().format(formatDate);

    return Promise
        .resolve()
        .then(() => {
            if (snapshotAllowed) {
                return Item.getItemsOrSnapshots(id);
            } else {
                return Item.findOne({ id: id });
            }
        })
        .then(item => {
            if (! item) {
                throw new NotFoundError();
            }

            return getData(item);
        })
        .then(data => {
            var item                   = data.item;
            var owner                  = data.owner;
            var ownerMedia             = data.ownerMedia;
            var itemMedias             = data.itemMedias;
            var itemInstructionsMedias = data.itemInstructionsMedias;
            var futureBookings         = data.futureBookings;
            var lastBooker             = data.lastBooker;
            var lastBookerMedia        = data.lastBookerMedia;
            var lastBookerLocations    = data.lastBookerLocations;

            if (req.user && item.ownerId === req.user.id) {
                access = "self";
            } else {
                access = "others";
            }

            item = Item.expose(item, access);

            if (! item.tags) {
                item.tags         = [];
                item.completeTags = [];
            }

            item.owner              = User.expose(owner, access);
            item.ownerMedia         = Media.expose(ownerMedia, access);
            item.pricing            = PricingService.getPricing(item.pricingId);
            item.medias             = Media.exposeAll(itemMedias, access);
            item.instructionsMedias = Media.exposeAll(itemInstructionsMedias, access);
            item.futureBookings     = Booking.exposeAll(futureBookings, access);

            if (lastBooker) {
                item.lastBooker          = User.expose(lastBooker, "others");
                item.lastBookerMedia     = Media.expose(lastBookerMedia, "others");
                item.lastBookerLocations = Location.exposeAll(lastBookerLocations, "others");
            }

            res.json(item);
        })
        .catch(res.sendError);



    function getData(item) {
        var data = {};
        data.item = item;

        return Promise
            .resolve()
            .then(() => {
                return [
                    User.findOne({ id: item.ownerId }),
                    ! item.snapshot ? Item.getFutureBookings(item.id, today) : [],
                    ! item.snapshot ? Item.getTags(item, true) : null
                ];
            })
            .spread((owner, futureBookings) => {
                data.owner          = owner;
                data.futureBookings = futureBookings;

                return [
                    Item.getMedias([item]).then(itemMedias => itemMedias[item.id]),
                    User.getMedia([owner]).then(ownerMedias => ownerMedias[owner.id]),
                    Item.getInstructionsMedias([item]).then(itemInstructionsMedias => itemInstructionsMedias[item.id])
                ];
            })
            .spread((itemMedias, ownerMedia, itemInstructionsMedias) => {
                data.itemMedias             = itemMedias;
                data.ownerMedia             = ownerMedia;
                data.itemInstructionsMedias = itemInstructionsMedias;

                return data;
            });
    }
}

function create(req, res) {
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
        "itemCategoryId",
        "validation",
        "validationFields",
        "locations",
        "mode",
        "rentable",
        "sellable",
        "dayOnePrice",
        "sellingPrice",
        "customPricingConfig",
        "deposit",
        "acceptFree",
    ];
    var createAttrs = _.pick(req.allParams(), filteredAttrs);
    createAttrs.ownerId = req.user.id;
    var access = "self";

    createAttrs.rentable = (typeof createAttrs.rentable === "boolean" ? createAttrs.rentable : true);
    createAttrs.sellable = (typeof createAttrs.sellable === "boolean" ? createAttrs.sellable : true);

    if (! createAttrs.name
     || (createAttrs.tags && ! µ.checkArray(createAttrs.tags, "id"))
     || (createAttrs.locations && ! µ.checkArray(createAttrs.locations, "id"))
     || ! createAttrs.mode || ! _.contains(Item.get("modes"), createAttrs.mode)
     || typeof createAttrs.sellingPrice !== "number" || createAttrs.sellingPrice < 0
     || typeof createAttrs.dayOnePrice !== "number" || createAttrs.dayOnePrice < 0
     || ! PricingService.getPricing(createAttrs.pricingId)
     || typeof createAttrs.deposit !== "number" || createAttrs.deposit < 0
     || (! createAttrs.rentable && ! createAttrs.sellable)
     || (createAttrs.customPricingConfig && ! PricingService.isValidCustomConfig(createAttrs.customPricingConfig))
    ) {
        return res.badRequest();
    }

    createAttrs.sellingPrice = PricingService.roundPrice(createAttrs.sellingPrice);
    createAttrs.dayOnePrice  = PricingService.roundPrice(createAttrs.dayOnePrice);
    createAttrs.deposit      = PricingService.roundPrice(createAttrs.deposit);

    var pricing = PricingService.getPricing();
    createAttrs.pricingId = pricing.id;

    // only classic mode item can be created by non-admin users
    if (createAttrs.mode !== "classic" && ! TokenService.isRole(req, "admin")) {
        return res.badRequest();
    }

    return Promise
        .resolve()
        .then(() => {
            return [
                Location.find({ userId: req.user.id }),
                Item.isValidReferences({
                    brandId: createAttrs.brandId,
                    itemCategoryId: createAttrs.itemCategoryId
                }),
                isValidTags()
            ];
        })
        .spread((myLocations, validReferences, validTags) => {
            if (! validReferences || ! validTags) {
                throw new BadRequestError();
            }

            var hashLocations = _.indexBy(myLocations, "id");

            if (createAttrs.locations) {
                var isValidLocations = _.reduce(createAttrs.locations, function (memo, locationId) {
                    if (! hashLocations[locationId]) {
                        memo = memo && false;
                    }
                    return memo;
                }, true);
                if (! isValidLocations) {
                    throw new BadRequestError();
                }
            } else {
                createAttrs.locations = _.pluck(myLocations, "id");
            }

            return Item.create(createAttrs);
        })
        .then(item => {
            return Item.updateTags(item, createAttrs.tags);
        })
        .then(item => {
            res.json(Item.expose(item, access));
        })
        .catch(res.sendError);



    function isValidTags() {
        if (! createAttrs.tags) {
            return true;
        }

        createAttrs.tags = _.uniq(createAttrs.tags);

        return Tag
            .find({ id: createAttrs.tags })
            .then(tags => {
                return tags.length === createAttrs.tags.length;
            });
    }
}

function update(req, res) {
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
        "itemCategoryId",
        "locations",
        // "mode",
        "rentable",
        "sellable",
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
     || (updateAttrs.mode && ! _.contains(Item.get("modes"), updateAttrs.mode))
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

    return Promise
        .resolve()
        .then(() => {
            return [
                Item.findOne({ id: id }),
                Item.isValidReferences({
                    brandId: updateAttrs.brandId,
                    itemCategoryId: updateAttrs.itemCategoryId
                }),
                isValidLocations(),
                isValidTags()
            ];
        })
        .spread((item, validReferences, validLocations, validTags) => {
            if (! item) {
                throw new NotFoundError();
            }
            if (item.ownerId !== req.user.id) {
                throw new ForbiddenError();
            }
            if (! validReferences
             || ! validLocations
             || ! validTags
             || item.soldDate
            ) {
                throw new BadRequestError();
            }

            var isItemValidated = (! item.validation || (item.validation && item.validated));
            if (typeof updateAttrs.name !== "undefined" && ! isItemValidated) {
                updateAttrs.nameURLSafe = ToolsService.getURLStringSafe(updateAttrs.name);
            }

            return Item.updateOne(item.id, updateAttrs);
        })
        .then(item => {
            return Item.updateTags(item, updateAttrs.tags);
        })
        .then(item => {
            res.json(Item.expose(item, access));
        })
        .catch(res.sendError);



    function isValidLocations() {
        if (! updateAttrs.locations) {
            return true;
        }

        updateAttrs.locations = _.uniq(updateAttrs.locations);

        return Location
            .find({
                id: updateAttrs.locations,
                userId: req.user.id
            })
            .then(locations => {
                return locations.length === updateAttrs.locations.length;
            });
    }

    function isValidTags() {
        if (! updateAttrs.tags) {
            return true;
        }

        updateAttrs.tags = _.uniq(updateAttrs.tags);

        return Tag
            .find({ id: updateAttrs.tags })
            .then(tags => {
                return tags.length === updateAttrs.tags.length;
            });
    }
}

function destroy(req, res) {
    var id = req.param("id");
    var today = moment().format("YYYY-MM-DD");

    return Promise
        .resolve()
        .then(() => {
            return Item.findOne({
                id: id,
                ownerId: req.user.id
            });
        })
        .then(item => {
            if (! item) {
                throw new NotFoundError();
            }

            return [
                item,
                Item.getFutureBookings(item.id, today)
            ];
        })
        .spread((item, futureBookings) => {
            if (futureBookings.length) {
                var error = new BadRequestError("remaining bookings");
                error.expose = true;
                throw error;
            }

            return [
                item,
                Bookmark.update({ itemId: id }, { active: false }) // disable bookmarks associated to this item
            ];
        })
        .spread(item => {
            // create a snapshot before destroying the item
            return ModelSnapshot.getSnapshot("item", item);
        })
        .then(() => sendEvent(req, res, id))
        .then(() => {
            return Item.destroy({ id: id });
        })
        .then(() => {
            res.json({ id: id });
        })
        .catch(res.sendError);



    function sendEvent(req, res, itemId) {
        return StelaceEventService.createEvent({
            req: req,
            res: res,
            label: "Item destroy",
            data: { itemId: itemId }
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

        var itemId = getItemId(query);
        var items = [];
        var item;

        if (itemId) {
            item = yield Item.findOne({ id: itemId });
            if (item) {
                items.push(item);
            }
        } else {
            if (isEnoughLongToken(query)) {
                items = yield Item.find({ name: { contains: query } });
            } else {
                items = [];
            }
        }

        res.json(Item.exposeAll(items, access));
    })()
    .catch(res.sendError);



    function getItemId(str) {
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
            return Item.find({ ownerId: req.user.id });
        })
        .then(items => {
            return [
                items,
                Item.getMedias(items),
                Item.getInstructionsMedias(items),
                Item.getTags(items)
            ];
        })
        .spread((items, hashMedias, hashInstructionsMedias) => {
            items = Item.exposeAll(items, access);

            _.forEach(items, function (item) {
                var medias             = hashMedias[item.id];
                var instructionsMedias = hashInstructionsMedias[item.id];

                item.medias             = _.map(medias, media => Media.expose(media, access));
                item.pricing            = PricingService.getPricing(item.pricingId);
                item.instructionsMedias = _.map(instructionsMedias, media => Media.expose(media, access));
            });

            res.json(items);
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
    if (! _.contains(["item", "instructions"], mediaType)) {
        return res.badRequest();
    }
    if ((mediaType === "item" && Media.get("maxNb").item < mediasIds.length)
     || (mediaType === "instructions" && Media.get("maxNb").itemInstructions < mediasIds.length)
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
                Item.findOne({ id: id }),
                Media.find({ id: mediasIds })
            ];
        })
        .spread((item, medias) => {
            var isAllOwnMedias = _.reduce(medias, function (memo, media) {
                if (req.user.id !== media.userId) {
                    memo = memo && false;
                }
                return memo;
            }, true);

            if (! item
             || medias.length !== mediasIds.length
            ) {
                throw new NotFoundError();
            }
            if (req.user.id !== item.ownerId
             || ! isAllOwnMedias
            ) {
                throw new ForbiddenError();
            }

            var updateAttrs = {};

            if (mediaType === "item") {
                updateAttrs.mediasIds = mediasIds;
            } else if (mediaType === "instructions") {
                updateAttrs.instructionsMediasIds = mediasIds;
            }

            return Item.updateOne(item.id, updateAttrs);
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
        let items = SearchService.getItemsFromCache(cacheKey);

        // results not in cache, so compute the search
        if (! items) {
            items = await SearchService.getItemsFromQuery(searchQuery, type);
            SearchService.setItemsToCache(cacheKey, items); // set results in cache
        }

        let { page, limit, timestamp } = searchQuery;

        if (SearchService.isWrongPageParams(items, page, limit)) {
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
            count: items.length,
            items: SearchService.getItemsByPagination(items, page, limit), // return only items based on pagination params
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
            return Item.findOne({ id: id });
        })
        .then(item => {
            if (! item) {
                throw new NotFoundError();
            }

            return Location.find({ id: item.locations });
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

function pauseItemToggle(req, res) {
    var itemId = req.param("id");
    var pausedUntil = req.param("pausedUntil");
    var pause = req.param("pause");
    var access = "self";

    return Promise.coroutine(function* () {
        var updatedItem = yield ItemService.pauseItemToggle({
            itemId,
            pause,
            pausedUntil,
            req
        });

        res.json(Item.expose(updatedItem, access));
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
