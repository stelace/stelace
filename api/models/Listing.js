/* global
        Booking, Brand, ElasticsearchService, Listing, ListingCategory, ListingXTag, Media, ModelSnapshot, Tag,
        ToolsService
*/

/**
* Listing.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        name: {
            type: "string",
            maxLength: 255,
            required: true
        },
        nameURLSafe: "string",
        ownerId: {
            type: "integer",
            index: true
        },
        nbViews: {
            type: "integer",
            defaultsTo: 0
        },
        nbContacts: {
            type: "integer",
            defaultsTo: 0
        },
        nbBookings: {
            type: "integer",
            defaultsTo: 0
        },
        description: {
            type: "text",
            maxLength: 3000
        },
        stateComment: {
            type: "text",
            maxLength: 1000
        },
        bookingPreferences: {
            type: "text",
            maxLength: 1000
        },
        brandId: {
            type: "integer",
            index: true
        },
        reference: "string",
        listingCategoryId: {
            type: "integer",
            index: true
        },
        mediasIds: {
            type: "array",
            defaultsTo: []
        },
        instructionsMediasIds: {
            type: "array",
            defaultsTo: []
        },
        validated: {
            type: "boolean",
            defaultsTo: false
        },
        validationPoints: {
            type: "integer",
            defaultsTo: 5
        },
        validation: {
            type: "boolean",
            defaultsTo: false
        },
        validationFields: {
            type: "array"
        },
        ratingScore: {
            type: "integer",
            defaultsTo: 0
        },
        nbRatings: {
            type: "integer",
            defaultsTo: 0
        },
        autoBookingAcceptation: {
            type: 'boolean',
            defaultsTo: false,
        },
        locations: "array",
        broken: {
            type: "boolean",
            defaultsTo: false
        },
        locked: {
            type: "boolean",
            defaultsTo: false
        },
        publishedDate: 'string',
        pausedUntil: "string",
        listingTypesIds: {
            type: 'array',
            defaultsTo: [],
        },
        quantity: {
            type: 'integer',
            defaultsTo: 1,
        },
        sellingPrice: {
            type: "float"
        },
        dayOnePrice: {
            type: "float",
            required: true
        },
        pricingId: {
            type: "integer",
            required: true
        },
        customPricingConfig: "json",
        deposit: {
            type: "float",
            required: true
        },
        acceptFree: {
            type: "boolean",
            defaultsTo: false
        },

    },

    getAccessFields: getAccessFields,
    postBeforeCreate: postBeforeCreate,
    afterCreate: afterCreate,
    afterUpdate: afterUpdate,
    afterDestroy: afterDestroy,
    isBookable: isBookable,
    getBookings: getBookings,
    getFutureBookings: getFutureBookings,
    updateTags: updateTags,
    isValidReferences: isValidReferences,
    getMedias: getMedias,
    getInstructionsMedias: getInstructionsMedias,
    getTags: getTags,
    getListingsOrSnapshots: getListingsOrSnapshots,
    getListingTypesProperties: getListingTypesProperties,
    getMaxQuantity: getMaxQuantity,
};

function getAccessFields(access) {
    var accessFields = {
        self: [
            "id",
            "name",
            "nameURLSafe",
            "nbViews",
            "nbContacts",
            "nbBookings",
            "description",
            "tags",
            "completeTags",
            "stateComment",
            "bookingPreferences",
            "accessories",
            "ownerId",
            "brandId",
            "reference",
            "listingCategoryId",
            "validated",
            "ratingScore",
            "nbRatings",
            "locations",
            "broken",
            "locked",
            "publishedDate",
            "pausedUntil",
            "listingTypesIds",
            "listingTypes", // due to expose transform
            "quantity",
            "dayOnePrice",
            "sellingPrice",
            "pricingId",
            "customPricingConfig",
            "deposit",
            "acceptFree",
            "createdDate",
            "updatedDate",
            "snapshot" // set when getting snapshots
        ],
        others: [
            "id",
            "name",
            "nameURLSafe",
            "description",
            "tags",
            "completeTags",
            "stateComment",
            "bookingPreferences",
            "accessories",
            "ownerId",
            "brandId",
            "reference",
            "listingCategoryId",
            "validated",
            "ratingScore",
            "nbRatings",
            "locations",
            "broken",
            "locked",
            "listingTypesIds",
            "listingTypes", // due to expose transform
            "quantity",
            "dayOnePrice",
            "sellingPrice",
            "pricingId",
            "customPricingConfig",
            "deposit",
            "acceptFree",
            "createdDate",
            "updatedDate",
            "snapshot" // set when getting snapshots
        ]
    };

    return accessFields[access];
}
function postBeforeCreate(values) {
    if (values.name) {
        values.nameURLSafe = ToolsService.getURLStringSafe(values.name);
    }
}

function afterCreate(listing, next) {
    ElasticsearchService.shouldSyncListings([listing.id]);
    next();
}

function afterUpdate(listing, next) {
    ElasticsearchService.shouldSyncListings([listing.id]);
    next();
}

function afterDestroy(listings, next) {
    listings = _.isArray(listings) ? listings : [listings];
    var listingsIds = _.pluck(listings, 'id');
    ElasticsearchService.shouldSyncListings(listingsIds);
    next();
}

function isBookable(listing) {
    if (listing.broken || listing.locked) {
        return false;
    }

    return true;
}

/**
 * get bookings from listings that are paid and accepted
 * @param  {number[]} listingsIds
 * @param  {object} [args]
 * @param  {string} [args.minStartDate] - filter bookings that start after that date included
 * @param  {string} [args.maxStartDate] - filter bookings that start before that date not included
 * @param  {string} [args.minEndDate]   - filter bookings that end after that date included
 * @param  {string} [args.maxEndDate]   - filter bookings that end before that date not included
 * @return {Promise<object[]>} - bookings
 */
function getBookings(listingsIds, args) {
    args = args || {};

    return Promise.coroutine(function* () {
        var findAttrs = {};

        var startPeriod = ToolsService.getPeriodAttrs(args.minStartDate, args.maxStartDate);
        var endPeriod   = ToolsService.getPeriodAttrs(args.minEndDate, args.maxEndDate);

        if (startPeriod) {
            findAttrs.startDate = startPeriod;
        }
        if (endPeriod) {
            findAttrs.endDate = endPeriod;
        }

        findAttrs.listingId         = listingsIds;
        findAttrs.cancellationId = null;
        findAttrs.paidDate       = { '!': null };
        findAttrs.acceptedDate   = { '!': null };

        return yield Booking
            .find(findAttrs)
            .sort({ startDate: 1 });
    })();
}

function getFutureBookings(listingIdOrIds, refDate) {
    return Promise.coroutine(function* () {
        var onlyOne;
        var listingsIds;

        if (_.isArray(listingIdOrIds)) {
            listingsIds = _.uniq(listingIdOrIds);
            onlyOne = false;
        } else {
            listingsIds = [listingIdOrIds];
            onlyOne = true;
        }

        // get bookings that end after the ref date
        var bookings = yield getBookings(listingsIds, { minEndDate: refDate });

        var hashBookings = _.groupBy(bookings, "listingId");

        hashBookings = _.reduce(listingsIds, function (memo, listingId) {
            memo[listingId] = hashBookings[listingId] || [];
            return memo;
        }, {});

        if (onlyOne) {
            return hashBookings[listingIdOrIds];
        } else {
            return hashBookings;
        }
    })();
}

function updateTags(listing, tagIds) {
    return Promise.coroutine(function* () {
        if (! µ.checkArray(tagIds, "id")) {
            throw new BadRequestError();
        }

        var listingXTags = yield ListingXTag.find({ listingId: listing.id });

        var oldTagIds     = _.pluck(listingXTags, "tagId");
        var addedTagIds   = _.difference(tagIds, oldTagIds);
        var removedTagIds = _.difference(oldTagIds, tagIds);

        if (addedTagIds.length) {
            yield Promise.each(addedTagIds, tagId => {
                return ListingXTag.create({
                    listingId: listing.id,
                    tagId: tagId
                });
            });
        }
        if (removedTagIds.length) {
            yield ListingXTag.destroy({
                listingId: listing.id,
                tagId: removedTagIds
            });
        }

        ElasticsearchService.shouldSyncListings([listing.id]);

        return listing;
    })();
}

/**
 * @param args
 * - brandId
 * - listingCategoryId
 */
function isValidReferences(args) {
    var brandId        = args.brandId;
    var listingCategoryId = args.listingCategoryId;

    return Promise
        .props({
            existsBrand: brandId ? Brand.findOne({ id: brandId }) : true,
            existsListingCategory: listingCategoryId ? ListingCategory.findOne({ id: listingCategoryId }) : true
        })
        .then(results => {
            return !! results.existsBrand && !! results.existsListingCategory;
        });
}

/**
 * get medias from listings
 * @param  {object[]} listings
 * @return {object}   hashMedias
 * @return {object[]} hashMedias[listingId] - listing medias
 */
function getMedias(listings) {
    return Promise.coroutine(function* () {
        var mediasIds = _.reduce(listings, function (memo, listing) {
            memo = memo.concat(listing.mediasIds || []);
            return memo;
        }, []);
        mediasIds = _.uniq(mediasIds);

        var medias = yield Media.find({ id: mediasIds });
        var indexedMedias = _.indexBy(medias, "id");

        return _.reduce(listings, function (memo, listing) {
            if (! memo[listing.id]) { // in case there are duplicate listings in listings array
                memo[listing.id] = _.reduce(listing.mediasIds || [], function (memo2, mediaId) {
                    var media = indexedMedias[mediaId];
                    if (media) {
                        memo2.push(media);
                    }
                    return memo2;
                }, []);
            }

            return memo;
        }, {});
    })();
}

/**
 * get instructions medias from listings
 * @param  {object[]} listings
 * @return {object}   hashMedias
 * @return {object[]} hashMedias[listingId] - listing instructions medias
 */
function getInstructionsMedias(listings) {
    return Promise.coroutine(function* () {
        var mediasIds = _.reduce(listings, function (memo, listing) {
            memo = memo.concat(listing.instructionsMediasIds || []);
            return memo;
        }, []);
        mediasIds = _.uniq(mediasIds);

        var medias = yield Media.find({ id: mediasIds });
        var indexedMedias = _.indexBy(medias, "id");

        return _.reduce(listings, function (memo, listing) {
            if (! memo[listing.id]) {
                memo[listing.id] = _.reduce(listing.instructionsMediasIds || [], function (memo2, mediaId) {
                    var media = indexedMedias[mediaId];
                    if (media) {
                        memo2.push(media);
                    }
                    return memo2;
                }, []);
            }

            return memo;
        }, {});
    })();
}

function getTags(listingOrListings, completeObj) {
    var listings;

    if (_.isArray(listingOrListings)) {
        listings = listingOrListings;
    } else {
        listings = [listingOrListings];
    }

    return Promise
        .resolve()
        .then(() => {
            return ListingXTag.find({ listingId: _.pluck(listings, "id") });
        })
        .then(listingXTags => {
            var getTags = () => {
                if (! completeObj || ! listingXTags.length) {
                    return [];
                }

                var tagIds = _.uniq(_.pluck(listingXTags, "tagId"));

                return Tag.find({ id: tagIds });
            };

            return [
                listingXTags,
                getTags()
            ];
        })
        .spread((listingXTags, tags) => {
            var hashTags = _.indexBy(tags, "id");

            var hashListingXTags = _.reduce(listingXTags, function (memo, listingXTag) {
                if (memo[listingXTag.listingId]) {
                    memo[listingXTag.listingId].push(listingXTag.tagId);
                } else {
                    memo[listingXTag.listingId] = [listingXTag.tagId];
                }
                return memo;
            }, {});


            _.forEach(listings, function (listing) {
                if (hashListingXTags[listing.id]) {
                    listing.tags = hashListingXTags[listing.id];
                } else {
                    listing.tags = [];
                }

                if (completeObj) {
                    listing.completeTags = _.map(listing.tags, function (tagId) {
                        return hashTags[tagId];
                    });
                }
            });

            return listingOrListings;
        });
}

function getListingsOrSnapshots(listingIdOrListingsIds) {
    var listingsIds;
    var onlyOne;

    if (_.isArray(listingIdOrListingsIds)) {
        listingsIds = _.uniq(listingIdOrListingsIds);
        onlyOne  = false;
    } else {
        listingsIds = [listingIdOrListingsIds];
        onlyOne  = true;
    }

    listingsIds = _.map(listingsIds, function (listingId) {
        return parseInt(listingId, 10);
    });

    return Promise.coroutine(function* () {
        var listings = yield Listing.find({ id: listingsIds });

        var foundListingsIds    = _.pluck(listings, "id");
        var notFoundListingsIds = _.difference(listingsIds, foundListingsIds);

        // no need to get snapshots if all listings are found
        if (listingsIds.length === foundListingsIds.length) {
            if (onlyOne) {
                return listings[0];
            } else {
                return listings;
            }
        }

        var listingsSnapshots = yield getSnapshots(notFoundListingsIds);
        listings = listings.concat(listingsSnapshots);

        if (onlyOne) {
            return listings[0];
        } else {
            return listings;
        }
    })();
}

function getSnapshots(listingsIds) {
    return Promise.coroutine(function* () {
        var snapshots = yield ModelSnapshot
            .find({
                targetType: "listing",
                targetId: listingsIds
            })
            .sort({ createdDate: -1 });

        snapshots = _.map(snapshots, snapshot => {
            return ModelSnapshot.exposeSnapshot(snapshot, true);
        });

        var groupSnapshots = _.groupBy(snapshots, "id");

        return _.reduce(listingsIds, (memo, listingId) => {
            var snapshots = groupSnapshots[listingId];

            // only keep the most recent snapshot
            if (snapshots && snapshots.length) {
                memo.push(snapshots[0]);
            }

            return memo;
        }, []);
    })();
}

function getListingTypesProperties(listing, listingTypes) {
    return _.reduce(listing.listingTypesIds, (memo, listingTypeId) => {
        const listingType = _.find(listingTypes, l => l.id === listingTypeId);
        if (listingType) {
            _.forEach(listingType.properties, (property, key) => {
                memo[key] = memo[key] || {};
                memo[key][property] = true;
            });
        }
        return memo;
    }, {});
}

function getMaxQuantity(listing, listingType) {
    const { AVAILABILITY } = listingType.properties;

    let maxQuantity;

    if (AVAILABILITY === 'STOCK') {
        maxQuantity = listing.quantity;
    } else if (AVAILABILITY === 'UNIQUE') {
        maxQuantity = 1;
    } else { // AVAILABILITY === 'NONE'
        maxQuantity = Infinity;
    }

    return maxQuantity;
}
