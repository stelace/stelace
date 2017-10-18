/* global BootstrapService, Item, ListingType */

const Sails = require('sails');

global._       = require('lodash');
global.Promise = require('bluebird');

Sails.load({
    models: {
        migrate: "safe"
    },
    hooks: {
        grunt: false,
        sockets: false,
        pubsub: false
    }
}, async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail script launch: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    try {
        const indexedListingTypes = {};

        try {
            const listingTypes = [
                {
                    name: 'RENTING',
                    properties: {
                        TIME: 'TIME_FLEXIBLE',
                        ASSESSMENTS: 'TWO_STEPS',
                        AVAILABILITY: 'UNIQUE',
                        DYNAMIC_PRICING: 'NONE',
                    },
                    config: {
                        pricing: {
                            ownerFeesPercent: 5,
                            takerFeesPercent: 15,
                            maxDiscountPercent: 80,
                        },
                        bookingTime: {
                            timeUnit: 'd',
                            minDuration: 1,
                            maxDuration: 100,
                            startDateMinDelta: { d: 1 },
                            startDateMaxDelta: { d: 90 },
                            releaseDateAfterEndDate: { d: 7 },
                        },
                        rating: {
                            remainingTimeToRateAfterBookingCompletion: { d: 60 },
                            remainingTimeToUpdateAfterAllRatings: { d: 1 },
                        },
                    },
                    active: true,
                },
                {
                    name: 'SELLING',
                    properties: {
                        TIME: 'NONE',
                        ASSESSMENTS: 'ONE_STEP',
                        AVAILABILITY: 'UNIQUE',
                        DYNAMIC_PRICING: 'NONE',
                    },
                    config: {
                        pricing: {
                            ownerFeesPercent: 7,
                            takerFeesPercent: 0,
                            maxDiscountPercent: 80,
                        },
                        rating: {
                            remainingTimeToRateAfterBookingCompletion: { d: 60 },
                            remainingTimeToUpdateAfterAllRatings: { d: 1 },
                        },
                    },
                    active: true,
                },
            ];

            await Promise.each(listingTypes, async (attrs) => {
                const listingType = await ListingType.findOne({ name: attrs.name });
                if (listingType) {
                    const l = await ListingType.updateOne(listingType.id, attrs);
                    indexedListingTypes[l.name] = l;
                } else {
                    const l = await ListingType.create(attrs);
                    indexedListingTypes[l.name] = l;
                }
            });
        } catch (e) {
            // do nothing
        }

        const items = await Item.find({ listingTypesIds: null });
        await Promise.map(items, item => {
            const updateAttrs = {
                listingTypesIds: [],
            };
            if (item.rentable) {
                updateAttrs.listingTypesIds.push(indexedListingTypes['RENTING'].id);
            }
            if (item.sellable) {
                updateAttrs.listingTypesIds.push(indexedListingTypes['SELLING'].id);
            }
            return Item.updateOne(item.id, updateAttrs);
        });
    } catch (err) {
        console.log(err);

        if (err.stack) {
            console.log(err.stack);
        }
    } finally {
        sails.lowerSafe();
    }

});
