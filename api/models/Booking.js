/* global
    Assessment, Booking, Conversation, TimeService
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
        itemSnapshotId: {
            type: "integer",
            index: true
        },
        itemMode: "string",
        bookingMode: "string",
        parentId: "integer",
        confirmedDate: "string", // booker action, set if paymentDate and depositDate are set
        validatedDate: "string", // owner action, when validate the booking
        automatedValidated: {
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
        startDate: "string",
        endDate: "string",
        nbBookedDays: "integer",
        nbFreeDays: {
            type: "integer",
            defaultsTo: 0
        },
        free: {
            type: "boolean",
            defaultsTo: false
        },
        ownerPrice: "float", // displayed price set by owner
        freeValue: "float",
        discountValue: "float",
        maxDiscountPercent: "float",
        takerPrice: "float", // after rebate and fees
        dayOnePrice: "float",
        pricingId: "integer",
        customPricingConfig: "json",
        deposit: "float",
        ownerFeesPercent: "float",
        takerFeesPercent: "float",
        ownerFees: "float", // set the value in case the formula change
        takerFees: "float", // set the value in case the formula change
        ownerFreeFees: {
            type: "boolean",
            defaultsTo: false
        },
        takerFreeFees: {
            type: "boolean",
            defaultsTo: false
        },
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
        odooBookerInvoiceNumber: "string",
        odooOwnerInvoiceNumber: "string"
    },

    getAccessFields: getAccessFields,
    get: get,

    isValidDates: isValidDates,
    isDatesCompatibleWithExistingBookings: isDatesCompatibleWithExistingBookings,
    getBookingDuration: getBookingDuration,
    getAgreementUserId: getAgreementUserId,
    isValidationTooLate: isValidationTooLate,
    isPurchase: isPurchase,
    getLaunchDate: getLaunchDate,
    getDueDate: getDueDate,
    updateBookingEndState: updateBookingEndState,

    getLast: getLast,
    isComplete: isComplete,
    getAssessments: getAssessments,
    getBookingRef: getBookingRef,
    getPendingBookings: getPendingBookings,
    filterVisibleBookings: filterVisibleBookings,
    getOwnerBookings: getOwnerBookings

};

// booking date constraints is given in days
// if end date deltas are null, they are similar to start date deltas
var params = {
    classic: {
        minDuration: 1,
        maxDuration: 100,
        startDateMinDelta: 1,
        startDateMaxDelta: 90,
        endDateMinDelta: null,
        endDateMaxDelta: null,
        releaseDateAfterEndDate: 7
    },
    purchase: {
        discountPeriod: 31, // 1 month
    }
};

var moment = require('moment');

function getAccessFields(access) {
    var accessFields = {
        self: [
            "id",
            "itemId",
            "itemSnapshotId",
            "itemMode",
            "bookingMode",
            "parentId",
            "confirmedDate",
            "validatedDate",
            "automatedValidated",
            "ownerId",
            "bookerId",
            "startDate",
            "endDate",
            "nbBookedDays",
            "nbFreeDays",
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
            "itemMode",
            "bookingMode",
            "parentId",
            "confirmedDate",
            "validatedDate",
            "automatedValidated",
            "ownerId",
            "bookerId",
            "startDate",
            "endDate",
            "nbBookedDays",
            "nbFreeDays",
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
            "itemMode",
            "bookingMode",
            "parentId",
            "ownerId",
            "bookerId",
            "startDate",
            "endDate",
            "cancellationId"
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

/**
 * is valid dates
 * @param  {object}   args
 * @param  {string}   [args.startDate]
 * @param  {string}   [args.endDate]
 * @param  {string}   args.refDate
 * @param  {object}   config
 * @return {object}   obj
 * @return {boolean}  obj.result
 * @return {object}   obj.errors
 */
function isValidDates(args, config) {
    var formatDate = "YYYY-MM-DD";
    var startDate = args.startDate;
    var endDate   = args.endDate;
    var refDate   = args.refDate;

    var errors          = {};
    var badParamsErrors = {};

    if (startDate && ! TimeService.isDateString(startDate, true)) {
        badParamsErrors.BAD_FORMAT_START_DATE = true;
    }
    if (endDate && ! TimeService.isDateString(endDate, true)) {
        badParamsErrors.BAD_FORMAT_END_DATE = true;
    }
    if (! TimeService.isDateString(refDate, true)) {
        badParamsErrors.MISSING_REF_DATE = true;
    }
    if (! startDate && ! endDate) {
        badParamsErrors.MISSING_DATES = true;
    }
    if (startDate && endDate && endDate < startDate) {
        badParamsErrors.END_DATE_BEFORE_START_DATE = true;
    }
    if (! _.isEmpty(badParamsErrors)) {
        errors.BAD_PARAMS = badParamsErrors;
        return exposeResult(errors);
    }

    var durationDays;
    var startDateMinLimit;
    var startDateMaxLimit;
    var endDateMinLimit;
    var endDateMaxLimit;

    if (startDate && endDate) {
        durationDays = moment(endDate).diff(moment(startDate), "d") + 1;
    }
    if (config.startDateMinDelta) {
        startDateMinLimit = moment(refDate).add(config.startDateMinDelta, "d").format(formatDate);
    }
    if (config.startDateMaxDelta) {
        startDateMaxLimit = moment(refDate).add(config.startDateMaxDelta, "d").format(formatDate);
    }
    if (config.endDateMinDelta) {
        endDateMinLimit = moment(refDate).add(config.endDateMinDelta, "d").format(formatDate);
    } else if (config.startDateMinDelta) {
        if (config.minDuration) {
            endDateMinLimit = moment(startDateMinLimit).add(config.minDuration - 1, "d").format(formatDate);
        } else {
            endDateMinLimit = startDateMinLimit;
        }
    }
    if (config.endDateMaxDelta) {
        endDateMaxLimit = moment(refDate).add(config.endDateMaxDelta, "d").format(formatDate);
    } else if (config.startDateMaxDelta) {
        if (config.maxDuration) {
            endDateMaxLimit = moment(startDateMaxLimit).add(config.maxDuration - 1, "d").format(formatDate);
        } else {
            endDateMaxLimit = startDateMaxLimit;
        }
    }

    var durationErrors  = {};
    var startDateErrors = {};
    var endDateErrors   = {};

    if (durationDays && config.minDuration && durationDays < config.minDuration) {
        durationErrors.BELOW_MIN = true;
    }
    if (durationDays && config.maxDuration && config.maxDuration < durationDays) {
        durationErrors.ABOVE_MAX = true;
    }
    if (startDate && startDateMinLimit && startDate < startDateMinLimit) {
        startDateErrors.BEFORE_MIN = true;
    }
    if (startDate && startDateMaxLimit && startDateMaxLimit < startDate) {
        startDateErrors.AFTER_MAX = true;
    }
    if (endDate && endDateMinLimit && endDate < endDateMinLimit) {
        endDateErrors.BEFORE_MIN = true;
    }
    if (endDate && endDateMaxLimit && endDateMaxLimit < endDate) {
        endDateErrors.AFTER_MAX = true;
    }

    if (! _.isEmpty(durationErrors)) {
        errors.DURATION = durationErrors;
    }
    if (! _.isEmpty(startDateErrors)) {
        errors.START_DATE = startDateErrors;
    }
    if (! _.isEmpty(endDateErrors)) {
        errors.END_DATE = endDateErrors;
    }

    return exposeResult(errors);



    function exposeResult(errors) {
        return {
            result: ! _.keys(errors).length,
            errors: errors
        };
    }
}

/**
 * is dates compatible withs existing bookings
 * @param  {object}    args
 * @param  {string}    args.startDate
 * @param  {string}    [args.endDate]
 * @param  {string}    [args.refDate]
 * @param  {object}    args.item
 * @param  {object[]}  args.futureBookings
 * @return {object}    obj
 * @return {boolean}   obj.result
 * @return {object}    obj.errors
 */
function isDatesCompatibleWithExistingBookings(args) {
    var startDate      = args.startDate;
    var endDate        = args.endDate;
    var refDate        = args.refDate;
    var item           = args.item;
    var futureBookings = args.futureBookings;

    var errors          = {};
    var badParamsErrors = {};

    if (! TimeService.isDateString(startDate, true)) {
        badParamsErrors.BAD_FORMAT_START_DATE = true;
    }
    if (endDate && ! TimeService.isDateString(endDate, true)) {
        badParamsErrors.BAD_FORMAT_END_DATE = true;
    }
    if (refDate && ! TimeService.isDateString(refDate, true)) {
        badParamsErrors.BAD_FORMAT_REF_DATE = true;
    }
    if (item.mode === "classic" && ! endDate) {
        badParamsErrors.CLASSIC_MISSING_END_DATE = true;
    }
    if (startDate && endDate && endDate < startDate) {
        badParamsErrors.END_DATE_BEFORE_START_DATE = true;
    }
    if (! item) {
        badParamsErrors.MISSING_ITEM = true;
    }
    if (! futureBookings) {
        badParamsErrors.MISSING_FUTURE_BOOKINGS = true;
    }

    if (! _.isEmpty(badParamsErrors)) {
        errors.BAD_PARAMS = badParamsErrors;
        return exposeResult(errors);
    }

    var intersection = TimeService.isIntersection(futureBookings, {
        startDate: startDate,
        endDate: endDate
    });

    // no overlap between booking dates
    if (intersection) {
        errors.BOOKINGS_INTERSECTION = true;
        return exposeResult(errors);
    }

    return exposeResult(errors);



    function exposeResult(errors) {
        return {
            result: ! _.keys(errors).length,
            errors: errors
        };
    }
}

function getBookingDuration(startDate, endDate) {
    return moment(endDate).diff(startDate, "d") + 1;
}

function getAgreementUserId(booking) {
    return booking.ownerId;
}

function isValidationTooLate(booking, refDate) {
    // booking can't be validated if confirmed and "7 days - 1 hour" after the confirmation date
    return booking.confirmedDate && moment(refDate).diff(booking.confirmedDate, "h") > 167;
}

function isPurchase(booking) {
    return _.includes(["rental-purchase", "purchase"], booking.bookingMode);
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

    if (isPurchase(booking)) {
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

        var nbDaysReleaseDeposit = Booking.get(booking.itemMode).releaseDateAfterEndDate;

        // the deposit expires N days after the return date of the booking
        var updateAttrs = {
            releaseDepositDate: moment(now).add(nbDaysReleaseDeposit, "d").toISOString()
        };

        return yield Booking.updateOne(booking.id, updateAttrs);
    })();
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
    if (! Booking.isPurchase(booking)) {
        result = result && (outputAssessment && outputAssessment.signedDate);
    }

    return !! result;
}

function getAssessments(bookings) {
    return Promise.coroutine(function* () {
        var bookingsIds = _.pluck(bookings, "id");

        var assessments = yield Assessment.find({
            or: [
                { startBookingId: bookingsIds },
                { endBookingId: bookingsIds }
            ]
        });

        var resultAssessments = yield Assessment.filterConversationAssessments(assessments);

        assessments         = resultAssessments.assessments;
        var hashAssessments = resultAssessments.hashAssessments;

        var indexedStart = _.indexBy(assessments, "startBookingId");
        var indexedEnd   = _.indexBy(assessments, "endBookingId");

        return _.reduce(bookings, (memo, booking) => {
            var inputAssessment              = indexedStart[booking.id];
            var outputAssessment             = indexedEnd[booking.id];
            var inputAssessmentConversation  = inputAssessment && hashAssessments[inputAssessment.id].conversation;
            var outputAssessmentConversation = outputAssessment && hashAssessments[outputAssessment.id].conversation;

            memo[booking.id] = {
                inputAssessment: inputAssessment || null,
                inputAssessmentConversation: inputAssessmentConversation || null,
                outputAssessment: outputAssessment || null,
                outputAssessmentConversation: outputAssessmentConversation || null
            };

            return memo;
        }, {});
    })();
}

function getBookingRef(bookingId) {
    return `BKG_${bookingId}`;
}

/**
 * get pending bookings
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

            // there is no period for a purchase booking
            if (intersection && ! Booking.isPurchase(refBooking)) {
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

function getOwnerBookings(userId) {
    return Promise.coroutine(function* () {
        return yield Booking.find({
            ownerId: userId,
            cancellationId: null,
            confirmedDate: { '!': null },
            validatedDate: { '!': null }
        });
    })();
}
