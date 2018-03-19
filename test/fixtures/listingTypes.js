const { escapeFixture } = require('../database');

const now = new Date().toISOString();

const listingTypes = [
    {
        id: 1,
        createdDate: escapeFixture(now),
        updatedDate: escapeFixture(now),
        name: 'Renting',
        namesI18n: escapeFixture({
            en: 'Renting',
            fr: 'Location',
        }),
        properties: escapeFixture({
            TIME: 'TIME_FLEXIBLE',
            ASSESSMENTS: 'TWO_STEPS',
            AVAILABILITY: 'UNIQUE',
            DYNAMIC_PRICING: 'NONE',
        }),
        config: escapeFixture({
            timeAvailability: 'AVAILABLE',
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
        }),
        customFields: escapeFixture([]),
        active: true,
    },
    {
        id: 2,
        createdDate: escapeFixture(now),
        updatedDate: escapeFixture(now),
        name: 'Selling',
        namesI18n: escapeFixture({
            en: 'Selling',
            fr: 'Vente',
        }),
        properties: escapeFixture({
            TIME: 'NONE',
            ASSESSMENTS: 'ONE_STEP',
            AVAILABILITY: 'UNIQUE',
            DYNAMIC_PRICING: 'NONE',
        }),
        config: escapeFixture({
            timeAvailability: 'NONE',
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
        }),
        customFields: escapeFixture([]),
        active: true,
    },
    {
        id: 3,
        createdDate: escapeFixture(now),
        updatedDate: escapeFixture(now),
        name: 'Creating',
        namesI18n: escapeFixture({
            en: 'Creating',
            fr: 'En création',
        }),
        properties: escapeFixture({
            TIME: 'TIME_FLEXIBLE',
            ASSESSMENTS: 'TWO_STEPS',
            AVAILABILITY: 'UNIQUE',
            DYNAMIC_PRICING: 'NONE',
        }),
        config: escapeFixture({
            timeAvailability: 'AVAILABLE',
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
        }),
        customFields: escapeFixture([]),
        active: false,
    },
];

module.exports = {
    listingTypes,
};
