/*
    global Booking, ContractService, Listing, ListingAvailability, ListingTypeService, ModelSnapshot, PricingService,
    StelaceConfigService, TimeService, User
 */

module.exports = {

    createBooking,

    getAvailabilityPeriodGraph,
    getAvailabilityDateGraph,

    getAvailabilityPeriodInfo,
    getAvailabilityDateInfo,

};

var moment = require('moment');
const _ = require('lodash');
const createError = require('http-errors');

/**
 * Create booking based on user input
 * @param  {Object} user
 * @param  {Number} listingId
 * @param  {String} [startDate]
 * @param  {Number} [nbTimeUnits]
 * @param  {Number} listingTypeId
 * @param  {Number} [quantity = 1]
 * @return {Object}
 */
async function createBooking({
    user,
    listingId,
    startDate,
    nbTimeUnits,
    listingTypeId,
    quantity = 1,
}) {
    if (! listingId
        || !listingTypeId
    ) {
        throw createError(400);
    }

    const now = moment().toISOString();

    const [
        listing,
        listingTypes,
    ] = await Promise.all([
        Listing.findOne({ id: listingId }),
        ListingTypeService.getListingTypes(),
    ]);

    if (! listing) {
        throw createError(404);
    }

    checkBasic({
        listing,
        user,
        listingTypeId,
    });

    const listingType = _.find(listingTypes, type => type.id === listingTypeId);
    if (!listingType) {
        throw createError(404);
    }

    const config = await StelaceConfigService.getConfig();
    const paymentProvider = config.paymentProvider;
    const currency = config.currency;

    if (!paymentProvider || !currency) {
        throw createError(500, 'Missing payment configuration', { expose: true });
    }

    let bookingAttrs = {
        listingId: listing.id,
        ownerId: listing.ownerId,
        takerId: user.id,
        autoAcceptance: listing.autoBookingAcceptance,
        contractId: ContractService.getContractId(),
        listingTypeId: listingType.id,
        listingType: listingType,
        paymentProvider,
        currency,
    };

    bookingAttrs = await setBookingTimePeriods({
        bookingAttrs,
        listing,
        listingType,
        startDate,
        nbTimeUnits,
    });

    bookingAttrs = await setBookingAvailability({
        bookingAttrs,
        listing,
        listingType,
        startDate,
        endDate: bookingAttrs.endDate,
        quantity,
        now,
    });

    bookingAttrs = await setBookingPrices({
        bookingAttrs,
        listing,
        listingType,
        user,
        nbTimeUnits,
        quantity: bookingAttrs.quantity,
        now,
    });

    const listingSnapshot = await ModelSnapshot.getSnapshot('listing', listing);
    bookingAttrs.listingSnapshotId = listingSnapshot.id;

    if (bookingAttrs.autoAcceptance) {
        bookingAttrs.acceptedDate = now;
    }

    const booking = await Booking.create(bookingAttrs);
    return booking;
}

function checkBasic({
    listing,
    user,
    listingTypeId,
}) {
    if (listing.ownerId === user.id) {
        throw createError(403, 'Owner cannot book its own listing');
    }
    if (!listing.listingTypesIds.length) {
        throw new Error('Listing has no listing types');
    }
    if (!listingTypeId || !_.includes(listing.listingTypesIds, listingTypeId)) {
        throw new Error('Incorrect listing type');
    }
    if (!listing.quantity) {
        throw new Error('Not enough quantity');
    }
    if (!listing.validated) { // admin validation needed
        throw createError(400, 'Not validated');
    }

    const bookable = Listing.isBookable(listing);
    if (! bookable) {
        throw createError(400, 'Listing not bookable');
    }
}

async function setBookingTimePeriods({
    bookingAttrs,
    listing,
    listingType,
    startDate,
    nbTimeUnits,
}) {
    const { TIME } = listingType.properties;

    if (TIME === 'TIME_FLEXIBLE') {
        if (!startDate || !nbTimeUnits) {
            throw createError(400);
        }

        const timeUnit = listingType.config.bookingTime.timeUnit;

        const validDates = Booking.isValidDates({
            startDate,
            nbTimeUnits,
            refDate: moment().format('YYYY-MM-DD') + 'T00:00:00.000Z',
            config: listingType.config.bookingTime,
            canOmitDuration: false,
        });

        if (!validDates.result) {
            throw createError(400, 'Invalid dates');
        }

        const endDate = Booking.computeEndDate({
            startDate,
            nbTimeUnits,
            timeUnit,
        });

        _.assign(bookingAttrs, {
            startDate,
            endDate,
            nbTimeUnits,
            timeUnit,
            deposit: listing.deposit,
            timeUnitPrice: listing.timeUnitPrice,
            pricingId: listing.pricingId,
            customPricingConfig: listing.customPricingConfig,
        });
    } else if (TIME === 'TIME_PREDEFINED') {
        if (!startDate) {
            throw createError(400);
        }

        const timeUnit = listingType.config.bookingTime.timeUnit;

        const validDates = Booking.isValidDates({
            startDate,
            refDate: moment().format('YYYY-MM-DD') + 'T00:00:00.000Z',
            config: listingType.config.bookingTime,
            canOmitDuration: true,
        });

        if (!validDates.result) {
            throw createError(400, 'Invalid date');
        }

        let validPredefinedDate = true;
        let isDateInRecurringList = false;

        const listingAvailability = await ListingAvailability.findOne({
            listingId: listing.id,
            startDate,
            type: 'date',
        });

        if (listing.recurringDatesPattern) {
            const timeUnit = listingType.config.bookingTime.timeUnit;

            const recurringDates = TimeService.computeRecurringDates(listing.recurringDatesPattern, {
                startDate: moment(startDate).add({ d: -1 }).toISOString(),
                endDate: moment(startDate).add({ d: 1 }).toISOString(),
                onlyPureDate: timeUnit === 'd' || timeUnit === 'M',
            });

            isDateInRecurringList = _.includes(recurringDates, startDate);
        }

        validPredefinedDate = !!listingAvailability || isDateInRecurringList;

        if (!validPredefinedDate) {
            throw createError(400, 'The booking date is not in the predefined list');
        }

        _.assign(bookingAttrs, {
            startDate,
            timeUnit,
        });
    }

    return bookingAttrs;
}

async function setBookingAvailability({
    bookingAttrs,
    listing,
    listingType,
    startDate,
    endDate,
    quantity,
    now,
}) {
    const { TIME, AVAILABILITY } = listingType.properties;

    if (AVAILABILITY === 'NONE') {
        bookingAttrs.quantity = 1;
    } else {
        const maxQuantity = Listing.getMaxQuantity(listing, listingType);

        const today = TimeService.getPureDate(now);

        if (TIME === 'TIME_FLEXIBLE') {
            const futureBookings = await Listing.getFutureBookings(listing.id, now);

            const listingAvailabilities = await ListingAvailability.find({
                listingId: listing.id,
                type: 'period',
                endDate: { '>=': today },
            });

            const availabilityGraph = getAvailabilityPeriodGraph({ futureBookings, listingAvailabilities, maxQuantity });
            const availabilityResult = getAvailabilityPeriodInfo(availabilityGraph, {
                startDate,
                endDate,
                quantity,
            });

            if (!availabilityResult.isAvailable) {
                throw createError(400, 'Not available');
            }

        } else if (TIME === 'TIME_PREDEFINED') {
            const futureBookings = await Listing.getFutureBookings(listing.id, now);

            const listingAvailabilities = await ListingAvailability.find({
                listingId: listing.id,
                type: 'date',
                startDate: { '>=': today },
            });

            const availabilityGraph = getAvailabilityDateGraph({ futureBookings, listingAvailabilities, maxQuantity });
            const availabilityResult = getAvailabilityDateInfo(availabilityGraph, {
                startDate,
                quantity,
            });

            if (!availabilityResult.isAvailable) {
                throw createError(400, 'Not available');
            }
        } else if (TIME === 'NONE') {
            if (maxQuantity < quantity) {
                throw createError(400, 'Do not have enough quantity');
            }
        }

        bookingAttrs.quantity = quantity;
    }

    return bookingAttrs;
}

async function setBookingPrices({
    bookingAttrs,
    listing,
    listingType,
    user,
    nbTimeUnits,
    quantity,
    now,
}) {
    const owner = await User.findOne({ id: listing.ownerId });
    if (!owner) {
        throw createError('Owner not found');
    }

    const {
        ownerFeesPercent,
        takerFeesPercent,
        ownerFreeFees,
        takerFreeFees,
    } = await getFeesValues({
        owner,
        taker: user,
        pricing: listingType.config.pricing,
        now,
    });
    const maxDiscountPercent = listingType.config.pricing.maxDiscountPercent;

    const {
        ownerPriceUnit,
        ownerPrice,
        freeValue,
        discountValue,
    } = await getOwnerPriceValue({
        listingType,
        listing,
        nbTimeUnits,
        quantity,
    });

    var priceResult = PricingService.getPriceAfterRebateAndFees({
        ownerPrice: ownerPrice,
        freeValue: freeValue,
        ownerFeesPercent: ownerFeesPercent,
        takerFeesPercent: takerFeesPercent,
        discountValue: discountValue,
        maxDiscountPercent: maxDiscountPercent
    });

    bookingAttrs.priceData = {
        freeValue,
        discountValue,
        ownerFreeFees,
        takerFreeFees,
    };

    bookingAttrs.ownerFees      = priceResult.ownerFees;
    bookingAttrs.takerFees      = priceResult.takerFees;
    bookingAttrs.ownerPriceUnit = ownerPriceUnit;
    bookingAttrs.ownerPrice     = ownerPrice;
    bookingAttrs.takerPrice     = priceResult.takerPrice;

    return bookingAttrs;
}

async function getFeesValues({ owner, taker, pricing, now }) {
    const ownerFreeFees = User.isFreeFees(owner, now);
    const takerFreeFees = User.isFreeFees(taker, now);

    const ownerFeesPercent = ! ownerFreeFees ? pricing.ownerFeesPercent : 0;
    const takerFeesPercent = ! takerFreeFees ? pricing.takerFeesPercent : 0;

    return {
        ownerFreeFees,
        takerFreeFees,
        ownerFeesPercent,
        takerFeesPercent,
    };
}

async function getOwnerPriceValue({ listingType, listing, nbTimeUnits, quantity = 1 }) {
    let ownerPrice;
    let discountValue;
    let freeValue;

    if (listingType.properties.TIME === 'TIME_FLEXIBLE') {
        const prices = PricingService.getDurationPrice({
            customConfig: listing.customPricingConfig,
            timeUnitPrice: listing.timeUnitPrice,
            nbTimeUnits,
            array: true
        });
        ownerPrice    = prices[nbTimeUnits - 1];
        discountValue = 0;
        freeValue     = 0;
    } else {
        ownerPrice    = listing.sellingPrice;
        freeValue     = 0;
        discountValue = 0;
    }

    return {
        ownerPriceUnit: ownerPrice,
        ownerPrice: ownerPrice * quantity,
        freeValue,
        discountValue,
    };
}

/**
 * Get the graph that shows availability by period
 * @param {Object[]} futureBookings
 * @param {String} futureBookings[i].startDate
 * @param {String} futureBookings[i].endDate
 * @param {Number} futureBookings[i].quantity
 * @param {Number} maxQuantity
 * @param  {Object[]} [listingAvailabilities]
 * @param  {String} listingAvailabilities[i].startDate
 * @param  {String} listingAvailabilities[i].endDate
 * @param  {Boolean} listingAvailabilities[i].available
 * @param  {Number} listingAvailabilities[i].quantity
 */
function getAvailabilityPeriodGraph({ futureBookings, maxQuantity, listingAvailabilities = [] } = {}) {
    const indexedFutureBookingsByStartDate = _.groupBy(futureBookings, 'startDate');
    const indexedFutureBookingsByEndDate = _.groupBy(futureBookings, 'endDate');
    const indexedListingAvailabilitiesByStartDate = _.indexBy(listingAvailabilities, 'startDate');
    const indexedListingAvailabilitiesByEndDate = _.indexBy(listingAvailabilities, 'endDate');

    let dates = [];
    futureBookings.forEach(booking => {
        dates.push(booking.startDate);
        dates.push(booking.endDate);
    });

    listingAvailabilities.forEach(listingAvailability => {
        dates.push(listingAvailability.startDate);
        dates.push(listingAvailability.endDate);
    });

    dates = _.sortBy(_.uniq(dates));

    const defaultMaxQuantity = maxQuantity;

    let prevMaxQuantity = defaultMaxQuantity;
    let prevUsedQuantity = 0;

    const graphDates = [];

    dates.forEach(date => {
        const addUsedQuantity = _.reduce(indexedFutureBookingsByStartDate[date] || [], (memo, booking) => {
            memo += booking.quantity;
            return memo;
        }, 0);
        const removeUsedQuantity = _.reduce(indexedFutureBookingsByEndDate[date] || [], (memo, booking) => {
            memo += booking.quantity;
            return memo;
        }, 0);

        const currUsedQuantity = prevUsedQuantity + addUsedQuantity - removeUsedQuantity;
        let currMaxQuantity;

        const startAvail = indexedListingAvailabilitiesByStartDate[date];
        const endAvail = indexedListingAvailabilitiesByEndDate[date];

        if (startAvail) {
            currMaxQuantity = startAvail.quantity;
        } else if (endAvail) {
            currMaxQuantity = defaultMaxQuantity;
        } else {
            currMaxQuantity = prevMaxQuantity;
        }

        const graphDate = {
            date,
            usedQuantity: currUsedQuantity,
            maxQuantity: currMaxQuantity,
        };

        prevUsedQuantity = currUsedQuantity;
        prevMaxQuantity = currMaxQuantity;

        graphDates.push(graphDate);
    });

    return {
        graphDates,
        defaultMaxQuantity,
    };
}

/**
 * @param {Object} availabilityGraph
 * @param {Object} newBooking
 * @param {String} newBooking.startDate
 * @param {String} [newBooking.endDate] - if not provided, compute remaining quantity only on start date
 * @param {Number} newBooking.quantity
 * @return {Object} info
 * @return {Boolean} info.isAvailable
 * @return {Number} info.maxRemainingQuantity
 */
function getAvailabilityPeriodInfo(availabilityGraph, newBooking) {
    const { defaultMaxQuantity, graphDates } = availabilityGraph;

    let maxRemainingQuantity;

    const beforeStartGraphDate = _.last(graphDates.filter(graphDate => graphDate.date <= newBooking.startDate));

    // compute the remaining quantity at the start date only
    if (!newBooking.endDate) {
        if (beforeStartGraphDate) {
            maxRemainingQuantity = Math.abs(beforeStartGraphDate.maxQuantity - beforeStartGraphDate.usedQuantity);
        } else {
            maxRemainingQuantity = defaultMaxQuantity;
        }
    } else {
        const overlapGraphDates = graphDates.filter(graphDate => {
            const startDate = beforeStartGraphDate ? beforeStartGraphDate.date : newBooking.startDate;
            return startDate <= graphDate.date && graphDate.date < newBooking.endDate;
        });

        if (!overlapGraphDates.length) {
            maxRemainingQuantity = defaultMaxQuantity;
        } else {
            maxRemainingQuantity = Math.abs(overlapGraphDates[0].maxQuantity - overlapGraphDates[0].usedQuantity);

            overlapGraphDates.forEach(graphDate => {
                maxRemainingQuantity = Math.min(maxRemainingQuantity, Math.abs(graphDate.maxQuantity - graphDate.usedQuantity));
            });
        }
    }

    return {
        isAvailable: newBooking.quantity <= maxRemainingQuantity && maxRemainingQuantity > 0,
        maxRemainingQuantity,
    };
}

/**
 * Get the graph that shows availability by date
 * @param {Object[]} futureBookings
 * @param {String} futureBookings[i].startDate
 * @param {Number} futureBookings[i].quantity
 * @param {Number} maxQuantity
 * @param  {Object[]} [listingAvailabilities]
 * @param  {String} listingAvailabilities[i].startDate
 * @param  {Number} listingAvailabilities[i].quantity
 * @param  {Boolean} listingAvailabilities[i].custom - if true, it means that owner customizes the quantity
 */
function getAvailabilityDateGraph({ futureBookings, maxQuantity, listingAvailabilities = [] } = {}) {
    const indexedFutureBookingsByStartDate = _.groupBy(futureBookings, 'startDate');
    const indexedListingAvailabilitiesByStartDate = _.indexBy(listingAvailabilities, 'startDate');

    let dates = [];
    futureBookings.forEach(booking => {
        dates.push(booking.startDate);
    });

    listingAvailabilities.forEach(listingAvailability => {
        dates.push(listingAvailability.startDate);
    });

    dates = _.sortBy(_.uniq(dates));

    const defaultMaxQuantity = maxQuantity;

    const graphDates = [];

    dates.forEach(date => {
        const currUsedQuantity = _.reduce(indexedFutureBookingsByStartDate[date] || [], (memo, booking) => {
            memo += booking.quantity;
            return memo;
        }, 0);

        const startAvail = indexedListingAvailabilitiesByStartDate[date];
        const currMaxQuantity = startAvail ? startAvail.quantity : defaultMaxQuantity;

        const graphDate = {
            date,
            usedQuantity: currUsedQuantity,
            maxQuantity: currMaxQuantity,
            custom: !!startAvail,
        };

        graphDates.push(graphDate);
    });

    return {
        graphDates,
        defaultMaxQuantity,
    };
}

/**
 * @param {Object} availabilityGraph
 * @param {Object} newBooking
 * @param {String} newBooking.startDate
 * @param {Number} newBooking.quantity
 * @return {Object} info
 * @return {Boolean} info.isAvailable
 * @return {Number} info.maxRemainingQuantity
 */
function getAvailabilityDateInfo(availabilityGraph, newBooking) {
    const { defaultMaxQuantity, graphDates } = availabilityGraph;

    let maxRemainingQuantity;

    let graphDate;

    graphDate = graphDates.find(date => {
        return date.date === newBooking.startDate;
    });

    if (!graphDate) {
        maxRemainingQuantity = defaultMaxQuantity;
    } else {
        maxRemainingQuantity = Math.abs(graphDate.maxQuantity - graphDate.usedQuantity);
    }

    return {
        isAvailable: newBooking.quantity <= maxRemainingQuantity && maxRemainingQuantity > 0,
        maxRemainingQuantity,
    };
}
