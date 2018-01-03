/*
    global Booking, ContractService, Listing, ListingAvailability, ListingTypeService, ModelSnapshot, PricingService, User
 */

module.exports = {

    createBooking,
    getAvailabilityPeriods,

};

var moment = require('moment');

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
        throw new BadRequestError();
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
        throw new NotFoundError();
    }

    checkBasic({
        listing,
        user,
        listingTypeId,
    });

    const listingType = _.find(listingTypes, type => type.id === listingTypeId);
    if (!listingType) {
        throw new NotFoundError();
    }

    let bookingAttrs = {
        listingId: listing.id,
        ownerId: listing.ownerId,
        takerId: user.id,
        autoAcceptance: listing.autoBookingAcceptance,
        contractId: ContractService.getContractId(),
        listingTypeId: listingType.id,
        listingType: listingType,
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

    const booking = await Booking.create(bookingAttrs);
    return booking;
}

function checkBasic({
    listing,
    user,
    listingTypeId,
}) {
    if (listing.ownerId === user.id) {
        throw new ForbiddenError("owner cannot book its own listing");
    }
    if (!listing.listingTypesIds.length) {
        throw new Error('listing has no listing types');
    }
    if (!listingTypeId || !_.includes(listing.listingTypesIds, listingTypeId)) {
        throw new BadRequestError('incorrect listing type');
    }
    if (!listing.quantity) {
        throw new BadRequestError('not enough quantity');
    }
    if (!listing.validated) { // admin validation needed
        throw new BadRequestError();
    }

    const bookable = Listing.isBookable(listing);
    if (! bookable) {
        throw new BadRequestError("listing not bookable");
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
            throw new BadRequestError();
        }

        const timeUnit = listingType.config.bookingTime.timeUnit;

        const validDates = Booking.isValidDates({
            startDate,
            nbTimeUnits,
            refDate: moment().format('YYYY-MM-DD') + 'T00:00:00.000Z',
            config: listingType.config.bookingTime,
        });

        if (!validDates.result) {
            throw new BadRequestError('Invalid dates');
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
            timeUnitPrice: listing.dayOnePrice,
            currency: 'EUR', // TODO: allow to set other currencies
            pricingId: listing.pricingId,
            customPricingConfig: listing.customPricingConfig,
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
    const { timeAvailability } = listingType.config;

    const maxQuantity = Listing.getMaxQuantity(listing, listingType);

    if (AVAILABILITY === 'NONE') {
        bookingAttrs.quantity = 1;
    } else {
        if (maxQuantity < quantity) {
            throw new BadRequestError('Do not have enough quantity');
        }

        if (TIME === 'TIME_FLEXIBLE') {
            const futureBookings = await Listing.getFutureBookings(listing.id, now);

            let listingAvailabilities;
            if (timeAvailability === 'AVAILABLE' || timeAvailability === 'UNAVAILABLE') {
                listingAvailabilities = await ListingAvailability.find({ listingId: listing.id });
            }

            const availability = getAvailabilityPeriods({
                futureBookings,
                listingAvailabilities,
                newBooking: {
                    startDate,
                    endDate,
                    quantity,
                },
                maxQuantity,
            });

            if (!availability.isAvailable) {
                throw new BadRequestError('Not available');
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
        throw new NotFoundError('Owner not found');
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

    bookingAttrs.ownerFees  = priceResult.ownerFees;
    bookingAttrs.takerFees  = priceResult.takerFees;
    bookingAttrs.ownerPrice = ownerPrice;
    bookingAttrs.takerPrice = priceResult.takerPrice;

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
        const prices = PricingService.getPrice({
            config: listing.customPricingConfig || PricingService.getPricing(listing.pricingId).config,
            dayOne: listing.dayOnePrice,
            nbDays: nbTimeUnits,
            custom: !! listing.customPricingConfig,
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
        ownerPrice: ownerPrice * quantity,
        freeValue,
        discountValue,
    };
}

/**
 * Check if the listing is available compared to future bookings and stock availability
 * @param  {Object[]} futureBookings
 * @param  {Object} futureBookings[i].startDate
 * @param  {Object} futureBookings[i].endDate
 * @param  {Object} futureBookings[i].quantity
 * @param  {Object[]} listingAvailabilities
 * @param  {Object} listingAvailabilities[i].startDate
 * @param  {Object} listingAvailabilities[i].endDate
 * @param  {Object} listingAvailabilities[i].quantity
 * @param  {Object[]} newBooking
 * @param  {String} newBooking.startDate
 * @param  {String} newBooking.endDate
 * @param  {Number} newBooking.quantity
 * @param  {Number} [maxQuantity] - if not defined, treat it as no limit
 *
 * @return {Object} res
 * @return {Boolean} res.isAvailable
 * @return {Object[]} res.availablePeriods
 * @return {String} res.availablePeriods[i].date
 * @return {Number} res.availablePeriods[i].quantity
 * @return {String} [res.availablePeriods[i].newPeriod]
 */
function getAvailabilityPeriods({ futureBookings = [], listingAvailabilities = [], newBooking, maxQuantity } = {}) {
    if (!futureBookings.length && !listingAvailabilities.length) {
        return {
            isAvailable: true,
            availablePeriods: [],
        };
    }

    const dateSteps = [];

    _.forEach(futureBookings, booking => {
        dateSteps.push({
            date: booking.startDate,
            delta: booking.quantity,
        });

        dateSteps.push({
            date: booking.endDate,
            delta: -booking.quantity,
        });
    });

    _.forEach(listingAvailabilities, listingAvailability => {
        const startSign = listingAvailability.available ? -1 : 1; // if available, one extra place so -1
        const endSign = -1 * startSign;

        dateSteps.push({
            date: listingAvailability.startDate,
            delta: startSign * listingAvailability.quantity,
        });

        dateSteps.push({
            date: listingAvailability.endDate,
            delta: endSign * listingAvailability.quantity,
        });
    });

    if (newBooking) {
        dateSteps.push({
            date: newBooking.startDate,
            delta: newBooking.quantity,
            newPeriod: 'start',
        });

        dateSteps.push({
            date: newBooking.endDate,
            delta: -newBooking.quantity,
            newPeriod: 'end',
        });
    }

    const sortedSteps = _.sortBy(dateSteps, step => step.date);

    const availablePeriods = [];
    let quantity = 0;
    let oldStep;
    let currStep;
    let isAvailable = true;

    _.forEach(sortedSteps, step => {
        quantity += step.delta;

        currStep = {
            date: step.date,
            quantity,
        };

        if (isAvailable && newBooking && typeof maxQuantity === 'number' && currStep.quantity > maxQuantity) {
            isAvailable = false;
        }

        if (step.newPeriod) {
            currStep.newPeriod = step.newPeriod;
        }

        if (oldStep && currStep.date === oldStep.date) {
            oldStep.quantity = quantity;
        } else {
            availablePeriods.push(currStep);
            oldStep = currStep;
        }
    });

    if (availablePeriods.length) {
        const firstStep = availablePeriods[0];
        availablePeriods.unshift({
            date: moment(firstStep.date).subtract({ d: 1 }).toISOString(),
            quantity: 0,
        });
    }

    return {
        isAvailable,
        availablePeriods,
    };
}
