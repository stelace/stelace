/*
    global Booking, ContractService, Item, ItemJourneyService,
    ModelSnapshot, PricingService, User
 */

module.exports = {

    createBooking: createBooking,
    getParentBookings: getParentBookings

};

var moment = require('moment');

/**
 * create booking if all conditions are passed
 * @param  {object}  args
 * @param  {object}  args.user - the booker
 * @param  {number}  args.itemId
 * @param  {string}  args.itemMode - used to make sure server and client are sync
 * @param  {string}  [args.startDate]
 * @param  {string}  [args.endDate]
 * @param  {boolean} [args.purchase = false]
 * @return {Promise<object>} created booking
 */
function createBooking(args) {
    var user       = args.user;
    var itemId     = args.itemId;
    var itemMode   = args.itemMode;
    var startDate  = args.startDate;
    var endDate    = args.endDate;
    var purchase   = args.purchase || false;

    if (! itemId
     || ! itemMode || ! _.contains(Item.get("modes"), itemMode)
    ) {
        throw new BadRequestError();
    }

    var now = moment().toISOString();

    var state = {
        user: user,
        itemId: itemId,
        itemMode: itemMode,
        startDate: startDate,
        endDate: endDate,
        purchase: purchase,
        now: now,
        today: moment(now).format("YYYY-MM-DD")
    };

    return Promise.coroutine(function* () {
        yield basicCheckNewBooking(state);

        var item = state.item;
        var hashItemJourneys = yield ItemJourneyService.getItemsJourneys([item.id]);
        state.itemJourney = hashItemJourneys[item.id];

        if (state.itemJourney.isItemSold()) {
            throw new BadRequestError("item is sold");
        }

        if (purchase) {
            yield runPurchaseProcess(state);
        } else {
            yield runRentalProcess(state);
        }

        // TODO: check item.bookingStartDate && item.bookingEndDate for period availability

        var bookingAttrs = yield getNewBookingAttrs(state);

        return yield Booking.create(bookingAttrs);
    })();
}

/**
 * check the basic condition to create booking
 * @param  {object}  state
 * @param  {number}  state.itemId
 * @param  {object}  state.user
 * @param  {boolean} state.purchase
 * @param  {string}  state.itemMode
 */
function basicCheckNewBooking(state) {
    var itemId   = state.itemId;
    var user     = state.user;
    var purchase = state.purchase;
    var itemMode = state.itemMode;

    return Promise.coroutine(function* () {
        var result = yield Promise.props({
            item: Item.findOne({ id: itemId }),
            bookerLocations: Location.find({ userId: user.id })
        });

        var item            = result.item;
        var bookerLocations = result.bookerLocations;

        if (! item) {
            throw new NotFoundError();
        }
        if (item.ownerId === user.id) {
            throw new ForbiddenError("owner cannot book its own item");
        }
        if (item.soldDate) {
            throw new BadRequestError("item is already sold");
        }
        // used to prevent bad synchronization between server and client
        if (itemMode !== item.mode) {
            throw new BadRequestError("item mode conflict");
        }
        if (purchase && itemMode !== "classic") {
            throw new BadRequestError("purchase option is only available for classic booking");
        }

        state.item            = item;
        state.bookerLocations = bookerLocations;
    })();
}

function runRentalProcess(state) {
    var item        = state.item;
    var startDate   = state.startDate;
    var endDate     = state.endDate;
    var today       = state.today;
    var nbFreeDays  = state.nbFreeDays;
    var itemJourney = state.itemJourney;
    var user        = state.user;

    return Promise.coroutine(function* () {
        if (! item.rentable) {
            throw new ForbiddenError("item isn't rentable");
        }

        var bookingConfig = Booking.get(item.mode);
        var isValidDates = Booking.isValidDates({
            startDate: startDate,
            endDate: endDate,
            refDate: today
        }, bookingConfig);

        if (! isValidDates.result) {
            throw new BadRequestError("not valid booking days");
        }

        var bookable = Item.isBookable(item);

        if (! bookable) {
            var error = new BadRequestError("item not bookable");
            error.expose = true;
            throw error;
        }

        var futureBookings = itemJourney.getFutureBookings(today);

        var compatible = Booking.isDatesCompatibleWithExistingBookings({
            startDate: startDate,
            endDate: endDate,
            refDate: today,
            item: item,
            futureBookings: futureBookings
        });

        if (! compatible.result) {
            throw new BadRequestError("the provided dates aren't compatible with existing bookings");
        }

        var nbBookedDays = Booking.getBookingDuration(startDate, endDate);
        checkEnoughFreeDays(user, nbBookedDays, nbFreeDays);

        state.nbBookedDays = nbBookedDays;
        state.bookingMode  = "renting";
    })();
}

/**
 * run purchase booking process
 * @param  {object} state
 * @param  {object} state.item
 * @param  {object} state.itemJourney
 * @param  {string} state.today
 * @param  {object} state.user
 * @param  {number} state.nbFreeDays
 */
function runPurchaseProcess(state) {
    var item        = state.item;
    var itemJourney = state.itemJourney;
    var today       = state.today;
    var user        = state.user;
    var nbFreeDays  = state.nbFreeDays;

    return Promise.coroutine(function* () {
        if (! item.sellable) {
            throw new ForbiddenError("item isn't sellable");
        }

        var bookingMode = itemJourney.getPurchaseMode(user, today);

        if (! bookingMode) {
            throw new BadRequestError("item cannot be sold because not available now");
        }

        checkEnoughFreeDays(user, 0, nbFreeDays);

        state.bookingMode = bookingMode;
    })();
}

function getNewBookingAttrs(state) {
    var now             = state.now;
    var today           = state.today;
    var item            = state.item;
    var itemMode        = state.itemMode;
    var bookingMode     = state.bookingMode;
    var user            = state.user;
    var startDate       = state.startDate;
    var endDate         = state.endDate;
    var nbBookedDays    = state.nbBookedDays;
    var nbFreeDays      = state.nbFreeDays;
    var purchase        = state.purchase;
    var itemJourney     = state.itemJourney;

    var bookingAttrs = {
        itemId: item.id,
        ownerId: item.ownerId,
        bookerId: user.id,
        itemMode: itemMode,
        bookingMode: bookingMode,
        nbFreeDays: nbFreeDays,
        automatedValidated: item.automatedBookingValidation,
        contractId: ContractService.getContractId()
    };

    return Promise.coroutine(function* () {
        var result = yield Promise.props({
            owner: User.findOne({ id: item.ownerId }),
            itemSnapshot: ModelSnapshot.getSnapshot("item", item)
        });

        var owner          = result.owner;
        var itemSnapshot   = result.itemSnapshot;

        if (! owner) {
            throw NotFoundError("Owner not found");
        }

        var ownerFreeFees = User.isFreeFees(owner, now);
        var takerFreeFees = User.isFreeFees(user, now);

        var ownerFeesPercent = ! ownerFreeFees
            ? PricingService.get(purchase ? "ownerFeesPurchasePercent" : "ownerFeesPercent")
            : 0;
        var takerFeesPercent = ! takerFreeFees
            ? PricingService.get(purchase ? "takerFeesPurchasePercent" : "takerFeesPercent")
            : 0;

        var ownerPrice;
        var freeValue;
        var discountValue;
        var maxDiscountPercent;

        if (purchase) {
            var purchaseConfig = Booking.get("purchase");

            var parentBookings = itemJourney.getParentBookings(item, user.id, {
                refDate: today,
                discountPeriodInDays: purchaseConfig.discountPeriod
            });

            var parentBooking = parentBookings.purchase;

            if (parentBooking) {
                var parentPriceResult = PricingService.getPriceAfterRebateAndFees({ booking: parentBooking });
                discountValue = parentPriceResult.ownerPriceAfterRebate;

                bookingAttrs.parentId = parentBooking.id;
            } else {
                discountValue = 0;
            }

            maxDiscountPercent = PricingService.get("maxDiscountPurchasePercent");
            ownerPrice = item.sellingPrice;
            freeValue  = 0;

            bookingAttrs.deposit = 0;
        } else {
            var prices = PricingService.getPrice({
                config: item.customPricingConfig || PricingService.getPricing(item.pricingId).config,
                dayOne: item.dayOnePrice,
                nbDays: nbBookedDays,
                custom: !! item.customPricingConfig,
                array: true
            });

            ownerPrice = prices[nbBookedDays - 1];
            freeValue  = (nbFreeDays ? prices[nbFreeDays - 1] : 0);

            bookingAttrs.startDate           = startDate;
            bookingAttrs.endDate             = endDate;
            bookingAttrs.nbBookedDays        = nbBookedDays;
            bookingAttrs.deposit             = item.deposit;
            bookingAttrs.dayOnePrice         = item.dayOnePrice;
            bookingAttrs.pricingId           = item.pricingId;
            bookingAttrs.customPricingConfig = item.customPricingConfig;

            discountValue      = 0;
            maxDiscountPercent = 0;
        }

        var priceResult = PricingService.getPriceAfterRebateAndFees({
            ownerPrice: ownerPrice,
            freeValue: freeValue,
            ownerFeesPercent: ownerFeesPercent,
            takerFeesPercent: takerFeesPercent,
            discountValue: discountValue,
            maxDiscountPercent: maxDiscountPercent
        });

        bookingAttrs.itemSnapshotId     = itemSnapshot.id;
        bookingAttrs.ownerFeesPercent   = priceResult.ownerFeesPercent;
        bookingAttrs.ownerFees          = priceResult.ownerFees;
        bookingAttrs.ownerFreeFees      = ownerFreeFees;
        bookingAttrs.takerFeesPercent   = priceResult.takerFeesPercent;
        bookingAttrs.takerFees          = priceResult.takerFees;
        bookingAttrs.takerFreeFees      = takerFreeFees;
        bookingAttrs.free               = (priceResult.takerPrice === 0);
        bookingAttrs.freeValue          = freeValue;
        bookingAttrs.ownerPrice         = ownerPrice;
        bookingAttrs.takerPrice         = priceResult.takerPrice;
        bookingAttrs.discountValue      = discountValue;
        bookingAttrs.maxDiscountPercent = maxDiscountPercent;

        return bookingAttrs;
    })();
}

function checkEnoughFreeDays(user, nbBookedDays, nbFreeDays) {
    if (nbBookedDays !== 0 // special case for purchase bookings
     && nbBookedDays < nbFreeDays) {
        throw new BadRequestError("nb free days must be inferior to nb booked days");
    }
    if (user.nbFreeDays < nbFreeDays) {
        var error = new BadRequestError("not enough free days");
        error.expose = true;
        throw error;
    }
}

function getParentBookings(itemId, user) {
    var today = moment().toISOString().format("YYYY-MM-DD");

    return Promise.coroutine(function* () {
        var item = yield Item.findOne({ id: itemId });
        if (! item) {
            throw new NotFoundError();
        }

        // no parent booking
        if (item.soldDate
         || (! item.rentable && ! item.sellable)
        ) {
            return {};
        }

        var itemsJourneys = yield ItemJourneyService.getItemsJourneys([item.id]);
        var itemJourney   = itemsJourneys[item.id];

        return itemJourney.getParentBookings(item, user.id, {
            refDate: today,
            discountPeriodInDays: Booking.get("purchase").discountPeriod
        });
    });
}
