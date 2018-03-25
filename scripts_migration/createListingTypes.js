/* global BootstrapService, ListingType */

const Sails = require('sails');
const { getConfig } = require('../sailsrc');

const Promise = require('bluebird');

Sails.load(getConfig(), async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail script launch: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    try {
        // edit the listing types config
        const listingTypes = [
            {
                name: 'Renting',
                namesI18n: {
                    en: 'Renting',
                    fr: 'Location',
                },
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
                name: 'Selling',
                namesI18n: {
                    en: 'Selling',
                    fr: 'Vente',
                },
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
        ];

        await Promise.each(listingTypes, async (attrs) => {
            const listingType = await ListingType.findOne({ name: attrs.name });
            if (listingType) {
                await ListingType.updateOne(listingType.id, attrs);
            } else {
                await ListingType.create(attrs);
            }
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
