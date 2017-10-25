/* global
        Booking, Brand, ElasticsearchService, Item, ListingCategory, ListingXTag, Location, Media, ModelSnapshot, Tag,
        ToolsService
*/

/**
* Item.js
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
        accessories: "array",
        bookingStartDate: "string", // TODO: to remove
        bookingEndDate: "string", // TODO: to remove
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
        automatedBookingValidation: { // TODO: to remove
            type: "boolean",
            defaultsTo: false
        },
        companyItem: { // TODO: to remove
            type: "boolean",
            defaultsTo: false
        },
        locations: "array",
        perimeterDurationMinutes: "integer", // TODO: to remove
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
        ownerRecallDate: "string", // TODO: to remove
        listingTypesIds: {
            type: 'array',
            defaultsTo: [],
        },
        rentable: { // TODO: to remove
            type: "boolean",
            defaultsTo: true
        },
        sellable: { // TODO: to remove
            type: "boolean",
            defaultsTo: false
        },
        quantity: {
            type: 'integer',
            defaultsTo: 1,
        },
        soldDate: "string",
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
    get: get,
    beforeValidate: beforeValidate,
    postBeforeCreate: postBeforeCreate,
    postBeforeUpdate: postBeforeUpdate,
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
    getItemsOrSnapshots: getItemsOrSnapshots,
    getListingTypesProperties: getListingTypesProperties,
    getMaxQuantity: getMaxQuantity,
};

var params = {
    maxNbAccessories: 10,
    maxLengthAccessoryName: 255
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
            "soldDate",
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
            "soldDate",
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

function get(prop) {
    if (prop) {
        return params[prop];
    } else {
        return params;
    }
}

function beforeValidate(values, next) {
    if (! values.accessories) {
        next();
        return;
    }

    if (µ.checkArray(values.accessories, "string", { maxLength: Item.get("maxLengthAccessoryName") })
        && values.accessories.length <= Item.get("maxNbAccessories")
    ) {
        next();
    } else {
        next(new BadRequestError("item accessories bad format"));
    }
}

function postBeforeCreate(values) {
    if (values.name) {
        values.nameURLSafe = ToolsService.getURLStringSafe(values.name);
    }

    if (_.isArray(values.accessories) && ! values.accessories.length) {
        values.accessories = null;
    }
}

function postBeforeUpdate(values) {
    if (_.isArray(values.accessories) && ! values.accessories.length) {
        values.accessories = null;
    }
}

function afterCreate(item, next) {
    ElasticsearchService.shouldSyncItems([item.id]);
    next();
}

function afterUpdate(item, next) {
    ElasticsearchService.shouldSyncItems([item.id]);
    next();
}

function afterDestroy(items, next) {
    items = _.isArray(items) ? items : [items];
    var itemsIds = _.pluck(items, 'id');
    ElasticsearchService.shouldSyncItems(itemsIds);
    next();
}

function isBookable(item) {
    if (item.broken || item.locked) {
        return false;
    }

    return true;
}

/**
 * get bookings from items that are paid and accepted
 * @param  {number[]} itemsIds
 * @param  {object} [args]
 * @param  {string} [args.minStartDate] - filter bookings that start after that date included
 * @param  {string} [args.maxStartDate] - filter bookings that start before that date not included
 * @param  {string} [args.minEndDate]   - filter bookings that end after that date included
 * @param  {string} [args.maxEndDate]   - filter bookings that end before that date not included
 * @return {Promise<object[]>} - bookings
 */
function getBookings(itemsIds, args) {
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

        findAttrs.itemId         = itemsIds;
        findAttrs.cancellationId = null;
        findAttrs.paidDate       = { '!': null };
        findAttrs.acceptedDate   = { '!': null };

        return yield Booking
            .find(findAttrs)
            .sort({ startDate: 1 });
    })();
}

function getFutureBookings(itemIdOrIds, refDate) {
    return Promise.coroutine(function* () {
        var onlyOne;
        var itemsIds;

        if (_.isArray(itemIdOrIds)) {
            itemsIds = _.uniq(itemIdOrIds);
            onlyOne = false;
        } else {
            itemsIds = [itemIdOrIds];
            onlyOne = true;
        }

        // get bookings that end after the ref date
        var bookings = yield getBookings(itemsIds, { minEndDate: refDate });

        var hashBookings = _.groupBy(bookings, "itemId");

        hashBookings = _.reduce(itemsIds, function (memo, itemId) {
            memo[itemId] = hashBookings[itemId] || [];
            return memo;
        }, {});

        if (onlyOne) {
            return hashBookings[itemIdOrIds];
        } else {
            return hashBookings;
        }
    })();
}

function updateTags(item, tagIds) {
    return Promise.coroutine(function* () {
        if (! µ.checkArray(tagIds, "id")) {
            throw new BadRequestError();
        }

        var listingXTags = yield ListingXTag.find({ listingId: item.id });

        var oldTagIds     = _.pluck(listingXTags, "tagId");
        var addedTagIds   = _.difference(tagIds, oldTagIds);
        var removedTagIds = _.difference(oldTagIds, tagIds);

        if (addedTagIds.length) {
            yield Promise.each(addedTagIds, tagId => {
                return ListingXTag.create({
                    listingId: item.id,
                    tagId: tagId
                });
            });
        }
        if (removedTagIds.length) {
            yield ListingXTag.destroy({
                listingId: item.id,
                tagId: removedTagIds
            });
        }

        ElasticsearchService.shouldSyncItems([item.id]);

        return item;
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
 * get medias from items
 * @param  {object[]} items
 * @return {object}   hashMedias
 * @return {object[]} hashMedias[itemId] - item medias
 */
function getMedias(items) {
    return Promise.coroutine(function* () {
        var mediasIds = _.reduce(items, function (memo, item) {
            memo = memo.concat(item.mediasIds || []);
            return memo;
        }, []);
        mediasIds = _.uniq(mediasIds);

        var medias = yield Media.find({ id: mediasIds });
        var indexedMedias = _.indexBy(medias, "id");

        return _.reduce(items, function (memo, item) {
            if (! memo[item.id]) { // in case there are duplicate items in items array
                memo[item.id] = _.reduce(item.mediasIds || [], function (memo2, mediaId) {
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
 * get instructions medias from items
 * @param  {object[]} items
 * @return {object}   hashMedias
 * @return {object[]} hashMedias[itemId] - item instructions medias
 */
function getInstructionsMedias(items) {
    return Promise.coroutine(function* () {
        var mediasIds = _.reduce(items, function (memo, item) {
            memo = memo.concat(item.instructionsMediasIds || []);
            return memo;
        }, []);
        mediasIds = _.uniq(mediasIds);

        var medias = yield Media.find({ id: mediasIds });
        var indexedMedias = _.indexBy(medias, "id");

        return _.reduce(items, function (memo, item) {
            if (! memo[item.id]) {
                memo[item.id] = _.reduce(item.instructionsMediasIds || [], function (memo2, mediaId) {
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

function getTags(itemOrItems, completeObj) {
    var items;

    if (_.isArray(itemOrItems)) {
        items = itemOrItems;
    } else {
        items = [itemOrItems];
    }

    return Promise
        .resolve()
        .then(() => {
            return ListingXTag.find({ listingId: _.pluck(items, "id") });
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

            var hashListingXTags = _.reduce(listingXTags, function (memo, itemXTag) {
                if (memo[itemXTag.listingId]) {
                    memo[itemXTag.listingId].push(itemXTag.tagId);
                } else {
                    memo[itemXTag.listingId] = [itemXTag.tagId];
                }
                return memo;
            }, {});


            _.forEach(items, function (item) {
                if (hashListingXTags[item.id]) {
                    item.tags = hashListingXTags[item.id];
                } else {
                    item.tags = [];
                }

                if (completeObj) {
                    item.completeTags = _.map(item.tags, function (tagId) {
                        return hashTags[tagId];
                    });
                }
            });

            return itemOrItems;
        });
}

function getItemsOrSnapshots(itemIdOritemsIds) {
    var itemsIds;
    var onlyOne;

    if (_.isArray(itemIdOritemsIds)) {
        itemsIds = _.uniq(itemIdOritemsIds);
        onlyOne  = false;
    } else {
        itemsIds = [itemIdOritemsIds];
        onlyOne  = true;
    }

    itemsIds = _.map(itemsIds, function (itemId) {
        return parseInt(itemId, 10);
    });

    return Promise.coroutine(function* () {
        var items = yield Item.find({ id: itemsIds });

        var foundItemsIds    = _.pluck(items, "id");
        var notFoundItemsIds = _.difference(itemsIds, foundItemsIds);

        // no need to get snapshots if all items are found
        if (itemsIds.length === foundItemsIds.length) {
            if (onlyOne) {
                return items[0];
            } else {
                return items;
            }
        }

        var itemsSnapshots = yield getSnapshots(notFoundItemsIds);
        items = items.concat(itemsSnapshots);

        if (onlyOne) {
            return items[0];
        } else {
            return items;
        }
    })();
}

function getSnapshots(itemsIds) {
    return Promise.coroutine(function* () {
        var snapshots = yield ModelSnapshot
            .find({
                targetType: "item",
                targetId: itemsIds
            })
            .sort({ createdDate: -1 });

        snapshots = _.map(snapshots, snapshot => {
            return ModelSnapshot.exposeSnapshot(snapshot, true);
        });

        var groupSnapshots = _.groupBy(snapshots, "id");

        return _.reduce(itemsIds, (memo, itemId) => {
            var snapshots = groupSnapshots[itemId];

            // only keep the most recent snapshot
            if (snapshots && snapshots.length) {
                memo.push(snapshots[0]);
            }

            return memo;
        }, []);
    })();
}

function getListingTypesProperties(item, listingTypes) {
    return _.reduce(item.listingTypesIds, (memo, listingTypeId) => {
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

function getMaxQuantity(item, listingType) {
    const { AVAILABILITY } = listingType.properties;

    let maxQuantity;

    if (AVAILABILITY === 'STOCK') {
        maxQuantity = item.quantity;
    } else if (AVAILABILITY === 'UNIQUE') {
        maxQuantity = 1;
    } else { // AVAILABILITY === 'NONE'
        maxQuantity = Infinity;
    }

    return maxQuantity;
}
