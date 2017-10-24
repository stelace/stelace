/* global
    Assessment, Booking, Conversation, Item, TimeService
*/

/**
* Booking.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        itemId: {
            type: "integer",
            index: true
        },
        itemSnapshotId: { // TODO: to rename into 'itemSnapshot'
            type: "integer",
            index: true
        },
        bookingMode: "string", // TODO: to remove
        listingTypeId: 'integer',
        listingType: 'json',
        parentId: "integer", // TODO: to remove

        // rename: 'confirmedDate' -> 'paidDate'
        // rename: 'validatedDate' -> 'acceptedDate'
        confirmedDate: "string", // booker action, set if paymentDate and depositDate are set
        validatedDate: "string", // owner action, when validate the booking
        automatedValidated: { // TODO: to rename into 'autoAcceptation'
            type: "boolean",
            defaultsTo: false
        },
        ownerId: {
            type: "integer",
            index: true
        },
        bookerId: {
            type: "integer",
            index: true
        },
        quantity: {
            type: 'integer',
            defaultsTo: 1,
        },
        startDate: "string",
        endDate: "string",
        nbTimeUnits: 'integer',
        timeUnit: 'string',
        nbBookedDays: "integer", // TODO: to remove (replaced by nbTimeUnits)
        free: { // TODO: to remove
            type: "boolean",
            defaultsTo: false
        },

        ownerPrice: "float", // displayed price set by owner
        takerPrice: "float", // after rebate and fees
        ownerFees: "float", // set the value in case the formula change
        takerFees: "float", // set the value in case the formula change
        prices: {
            type: 'json',
            defaultsTo: {},
        },
        options: {
            type: 'json',
            defaultsTo: {},
        },
        freeValue: "float", // TODO: move to prices
        discountValue: "float", // TODO: move to prices
        maxDiscountPercent: "float", // TODO: to remove
        dayOnePrice: "float", // TODO: move to prices
        pricingId: "integer",
        customPricingConfig: "json",
        deposit: "float",
        ownerFeesPercent: "float", // TODO: to remove
        takerFeesPercent: "float", // TODO: to remove
        ownerFreeFees: { // TODO: move to prices
            type: "boolean",
            defaultsTo: false
        },
        takerFreeFees: { // TODO: move to prices
            type: "boolean",
            defaultsTo: false
        },
        dates: {
            type: 'json',
            defaultsTo: {},
        },
        completedDate: 'string',

        // TODO: to remove 'paymentDate', 'depositDate', 'releaseDepositDate', 'paymentUsedDate', 'paymentTransferDate', 'withdrawalDate'
        // TODO: to remove 'cancellationPaymentDate', 'cancellationDepositDate'

        // TODO: put 'stopRenewDeposit', 'stopTransferPayment', 'stopWithdrawal' into 'paymentOperations'

        paymentDate: "string", // booker action, set when preauth payment is done
        depositDate: "string", // booker action, set when preauth deposit is done
        releaseDepositDate: "string", // renew deposit until this date, after the deposit must be cancelled
        paymentUsedDate: "string", // set when preauth payment is used
        paymentTransferDate: "string", // set when the payment can be withdrawn by the owner
        withdrawalDate: "string", // owner action, set when the withdrawal is done
        cancellationId: {
            type: "integer",
            index: true
        },
        cancellationPaymentDate: "string",
        cancellationDepositDate: "string",
        stopRenewDeposit: {
            type: "boolean",
            defaultsTo: false
        },
        stopTransferPayment: {
            type: "boolean",
            defaultsTo: false
        },
        stopWithdrawal: {
            type: "boolean",
            defaultsTo: false
        },
        contractId: "string",
        odooBookerInvoiceNumber: "string", // TODO: to remove
        odooOwnerInvoiceNumber: "string" // TODO: to remove
    },

    getAccessFields: getAccessFields,

    isValidDates: isValidDates,
    computeEndDate,
    getAgreementUserId: getAgreementUserId,
    isValidationTooLate: isValidationTooLate,
    isNoTime: isNoTime,
    getLaunchDate: getLaunchDate,
    getDueDate: getDueDate,
    updateBookingEndState: updateBookingEndState,
    canItemQuantityEvolve: canItemQuantityEvolve,
    updateItemQuantity: updateItemQuantity,

    getLast: getLast,
    isComplete: isComplete,
    getAssessments: getAssessments,
    getBookingRef: getBookingRef,
    getPendingBookings: getPendingBookings,
    filterVisibleBookings: filterVisibleBookings,

};

var moment = require('moment');

function getAccessFields(access) {
    var accessFields = {
        self: [
            "id",
            "itemId",
            "itemSnapshotId",
            "bookingMode",
            "listingTypeId",
            "listingType",
            "parentId",
            "confirmedDate",
            "validatedDate",
            "automatedValidated",
            "ownerId",
            "bookerId",
            "quantity",
            "startDate",
            "endDate",
            "nbTimeUnits",
            "timeUnit",
            "free",
            "ownerPrice",
            "freeValue",
            "discountValue",
            "maxDiscountPercent",
            "takerPrice",
            "dayOnePrice",
            "deposit",
            "ownerFeesPercent",
            "takerFeesPercent",
            "ownerFees",
            "takerFees",
            "ownerFreeFees",
            "takerFreeFees",
            "paymentDate",
            "depositDate",
            "cancellationId"
        ],
        owner: [
            "id",
            "itemId",
            "itemSnapshotId",
            "bookingMode",
            "listingTypeId",
            "listingType",
            "parentId",
            "confirmedDate",
            "validatedDate",
            "automatedValidated",
            "ownerId",
            "bookerId",
            "quantity",
            "startDate",
            "endDate",
            "nbTimeUnits",
            "timeUnit",
            "free",
            "ownerPrice",
            "freeValue",
            "discountValue",
            "maxDiscountPercent",
            "takerPrice",
            "dayOnePrice",
            "deposit",
            "ownerFeesPercent",
            "takerFeesPercent",
            "ownerFees",
            "takerFees",
            "ownerFreeFees",
            "takerFreeFees",
            "paymentDate",
            "depositDate",
            "paymentTransferDate",
            "withdrawalDate",
            "cancellationId"
        ],
        others: [
            "id",
            "itemId",
            "bookingMode",
            "listingTypeId",
            "listingType",
            "parentId",
            "ownerId",
            "bookerId",
            "startDate",
            "endDate",
            "quantity",
            "nbTimeUnits",
            "timeUnit",
            "cancellationId"
        ]
    };

    return accessFields[access];
}

/**
 * Check if booking dates are valid when calendar needed based on listing type config
 * @param  {String}  startDate
 * @param  {Number}  nbTimeUnits
 * @param  {String}  refDate
 * @param  {Object}  config
 * @return {Boolean}
 */
function isValidDates({
    startDate,
    nbTimeUnits,
    refDate,
    config,
}) {
    const errors          = {};
    const badParamsErrors = {};

    if (!TimeService.isDateString(startDate)) {
        badParamsErrors.BAD_FORMAT_START_DATE = true;
    }
    if (!TimeService.isDateString(refDate)) {
        badParamsErrors.MISSING_REF_DATE = true;
    }
    if (! _.isEmpty(badParamsErrors)) {
        errors.BAD_PARAMS = badParamsErrors;
        return exposeResult(errors);
    }

    let startDateMinLimit;
    let startDateMaxLimit;

    if (config.startDateMinDelta) {
        startDateMinLimit = moment(refDate).add(config.startDateMinDelta).toISOString();
    }
    if (config.startDateMaxDelta) {
        startDateMaxLimit = moment(refDate).add(config.startDateMaxDelta).toISOString();
    }

    let durationErrors  = {};
    let startDateErrors = {};

    if (nbTimeUnits <= 0) {
        durationErrors.INVALID = true;
    } else {
        if (nbTimeUnits && config.minDuration && nbTimeUnits < config.minDuration) {
            durationErrors.BELOW_MIN = true;
        }
        if (nbTimeUnits && config.maxDuration && config.maxDuration < nbTimeUnits) {
            durationErrors.ABOVE_MAX = true;
        }
    }
    if (startDateMinLimit && startDate < startDateMinLimit) {
        startDateErrors.BEFORE_MIN = true;
    }
    if (startDateMaxLimit && startDateMaxLimit < startDate) {
        startDateErrors.AFTER_MAX = true;
    }

    if (! _.isEmpty(durationErrors)) {
        errors.DURATION = durationErrors;
    }
    if (! _.isEmpty(startDateErrors)) {
        errors.START_DATE = startDateErrors;
    }

    return exposeResult(errors);



    function exposeResult(errors) {
        return {
            result: ! _.keys(errors).length,
            errors: errors
        };
    }
}

function computeEndDate({ startDate, nbTimeUnits, timeUnit }) {
    const duration = { [timeUnit]: nbTimeUnits };
    return moment(startDate).add(duration).toISOString();
}

function getAgreementUserId(booking) {
    return booking.ownerId;
}

function isValidationTooLate(booking, refDate) {
    // booking can't be validated if confirmed and "7 days - 1 hour" after the confirmation date
    return booking.confirmedDate && moment(refDate).diff(booking.confirmedDate, "h") > 167;
}

function isNoTime(booking) {
    return booking.listingType.properties.TIME === 'NONE';
}

function getLaunchDate(booking) {
    if (booking.confirmedDate < booking.validatedDate) {
        return booking.validatedDate;
    } else {
        return booking.confirmedDate;
    }
}

/**
 * get due date
 * @param  {object} booking
 * @param  {string} type - one value of ["start", "end"]
 * @return {string} due date
 */
function getDueDate(booking, type) {
    var dueDate;

    if (! _.includes(["start", "end"], type)) {
        throw new Error("Bad type");
    }

    if (isNoTime(booking)) {
        dueDate = getLaunchDate(booking);
        dueDate = moment(dueDate).add(2, "d").format("YYYY-MM-DD");
    } else {
        if (type === "start") {
            dueDate = booking.startDate;
        } else { // type === "end"
            dueDate = booking.endDate;
        }
    }

    return dueDate;
}

function updateBookingEndState(booking, now) {
    return Promise.coroutine(function* () {
        // if already done
        if (booking.releaseDepositDate) {
            return booking;
        }

        const releaseDuration = booking.listingType.config.bookingTime.releaseDateAfterEndDate;

        // the deposit expires N days after the return date of the booking
        var updateAttrs = {
            releaseDepositDate: moment(now).add(releaseDuration).toISOString()
        };

        return yield Booking.updateOne(booking.id, updateAttrs);
    })();
}

function canItemQuantityEvolve(booking) {
    const { TIME, AVAILABILITY } = booking.listingType.properties;
    // item quantity change if there is no time but there is a stock
    return TIME === 'NONE' && AVAILABILITY !== 'NONE';
}

/**
 * After some booking operations, item quantity can evolve
 * like decrease stock after payment
 * or increase stock after booking rejection
 * @param {Object} booking
 * @param {String} actionType - possible values: ['add', 'remove']
 */
async function updateItemQuantity(booking, { actionType }) {
    if (!_.includes(['add', 'remove'], actionType)) {
        throw new Error('Incorrect action type');
    }

    if (!canItemQuantityEvolve(booking)) return;

    const item = await Item.findOne({ id: booking.itemId });
    if (!item) {
        throw new NotFoundError();
    }

    const updateAttrs = {};
    if (actionType === 'add') {
        updateAttrs.quantity = item.quantity + booking.quantity;
    } else if (actionType === 'remove') {
        updateAttrs.quantity = Math.max(item.quantity - booking.quantity, 0);
    }

    await Item.updateOne({ id: booking.itemId }, updateAttrs);
}

function getLast(itemIdOrIds) {
    var onlyOne;
    var itemIds;

    if (_.isArray(itemIdOrIds)) {
        itemIds = _.uniq(itemIdOrIds);
        onlyOne = false;
    } else {
        itemIds = itemIdOrIds;
        onlyOne = true;
    }

    return Promise.coroutine(function* () {
        var findAttrs = {
            itemId: itemIds,
            cancellationId: null,
            confirmedDate: { '!': null },
            validatedDate: { '!': null }
        };

        if (onlyOne) {
            return yield Booking
                .findOne(findAttrs)
                .sort({ startDate: -1 });
        } else {
            var bookings = yield Booking
                .find(findAttrs)
                .sort({ startDate: -1 });

            var hashItems = _.reduce(itemIds, function (memo, itemId) {
                memo[itemId] = null;
                return memo;
            }, {});

            _.forEach(bookings, function (booking) {
                if (! hashItems[booking.itemId]) {
                    hashItems[booking.itemId] = booking;
                }
            });

            return hashItems;
        }
    })();
}

function isComplete(booking, inputAssessment, outputAssessment) {
    var result;

    result = booking.validatedDate
        && booking.confirmedDate
        && ! booking.cancellationId
        && inputAssessment && inputAssessment.signedDate;

    // renting booking: input and output assessments signed
    // purchase booking: only input assessment signed
    if (! Booking.isNoTime(booking)) {
        result = result && (outputAssessment && outputAssessment.signedDate);
    }

    return !! result;
}

/**
 * Get visible assessments associated with bookings
 * @param  {Object} bookings
 * @return {Object} hashBookings
 * @return {Object} [hashBookings[bookingId].inputAssessment] - can be null
 * @return {Object} [hashBookings[bookingId].outputAssessment] - can be null
 */
async function getAssessments(bookings) {
    const bookingsIds = _.pluck(bookings, 'id');

    let assessments = await Assessment.find({
        or: [
            { startBookingId: bookingsIds },
            { endBookingId: bookingsIds },
        ],
    });

    const resultAssessments = await Assessment.filterConversationAssessments(assessments);
    assessments = resultAssessments.assessments;

    const indexedStart = _.indexBy(assessments, "startBookingId");
    const indexedEnd   = _.indexBy(assessments, "endBookingId");

    return _.reduce(bookings, (memo, booking) => {
        const inputAssessment              = indexedStart[booking.id];
        const outputAssessment             = indexedEnd[booking.id];

        memo[booking.id] = {
            inputAssessment: inputAssessment || null,
            outputAssessment: outputAssessment || null,
        };

        return memo;
    }, {});
}

function getBookingRef(bookingId) {
    return `BKG_${bookingId}`;
}

/**
 * Get bookings that are not paid or not validated
 * @param  {number}  itemId
 * @param  {object}  [args]
 * @param  {object}  [args.refBooking] - if provided, get pending bookings except this one
 * @param  {boolean} [args.intersection = false] - if true (refBooking needed), get only bookings that overlap the refBooking period
 * @return {object[]} bookings
 */
function getPendingBookings(itemId, args) {
    var refBooking   = args.refBooking;
    var intersection = args.intersection || false;

    return Promise.coroutine(function* () {
        var findAttrs = {
            itemId: itemId
        };

        if (refBooking) {
            _.assign(findAttrs, {
                id: { '!': refBooking.id }
            });

            // there is no period for a no-time booking
            if (intersection && ! Booking.isNoTime(refBooking)) {
                _.assign(findAttrs, {
                    startDate: { '<=': refBooking.endDate },
                    endDate: { '>=': refBooking.startDate },
                });
            }
        }

        _.assign(findAttrs, {
            or: [
                { confirmedDate: null },
                { validatedDate: null }
            ],
            cancellationId: null
        });

        return yield Booking.find(findAttrs);
    })();
}

/**
 * filter visible bookings
 * visible bookings means:
 * - bookings that are in a conversation
 * - bookings that users can interact with (there can be multiples bookings in same conversation
 *     but only the most recent one is displayed)
 *
 * @param  {object[]} bookings
 *
 * @return {object}   res
 * @return {object[]} res.bookings
 * @return {object}   res.hashBookings
 * @return {object}   res.hashBookings[bookingId] - conversation
 */
function filterVisibleBookings(bookings) {
    return Promise.coroutine(function* () {
        var bookingsIds = _.pluck(bookings, "id");

        var conversations = yield Conversation.find({ bookingId: bookingsIds });

        var indexedConversations = _.indexBy(conversations, "bookingId");

        return _.reduce(bookings, (memo, booking) => {
            var conversation = indexedConversations[booking.id];
            if (conversation) {
                memo.bookings.push(booking);
                memo.hashBookings[booking.id] = conversation;
            }
            return memo;
        }, {
            bookings: [],
            hashBookings: {}
        });
    });
}

