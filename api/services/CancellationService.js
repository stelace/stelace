/* global
    Booking, BookingPaymentService, BookingService, Cancellation, Conversation, Listing, MathService, User
*/

module.exports = {

    cancelBooking: cancelBooking,
    cancelBookingPayment: cancelBookingPayment,
    cancelOtherBookings: cancelOtherBookings,

};

const _ = require('lodash');
const Promise = require('bluebird');
const createError = require('http-errors');

/**
 * cancel booking
 * @param  {object}  booking
 * @param  {object}  transactionManager - can be null if args.cancelPayment is false
 * @param  {object}  args
 * @param  {string}  args.reasonType
 * @param  {string}  args.reason
 * @param  {string}  args.trigger
 * @param  {boolean} [args.updateConversation = true]
 * @param  {boolean} [args.cancelPayment = false] - if false, do not cancel payment or taker fees
 * @param  {boolean} [args.replenishStock = true] - if true, replenish stock
 *
 * the following params can take number or boolean:
 * if true, cancel what booking has taken
 * if false, do not cancel
 * if number, cancel the provided amount
 * @param  {object}          [args.cancel]
 * @param  {boolean}         [args.cancel.payment = true]
 * @param  {boolean}         [args.cancel.takerFees = true]
 * @return {Promise<object>} cancelled booking
 */
function cancelBooking(booking, transactionManager, args) {
    args = args || {};

    var cancel = _.defaults(_.cloneDeep(args.cancel) || {}, {
        payment: true,
        takerFees: true
    });
    var doUpdateConversation = typeof args.updateConversation !== "undefined"
        ? args.updateConversation
        : true;
    var doCancelPayment = typeof args.cancelPayment !== "undefined"
        ? args.cancelPayment
        : false;
    var doReplenishStock = typeof args.replenishStock !== 'undefined'
        ? args.doReplenishStock
        : true;

    return Promise.coroutine(function* () {
        var error;

        if (booking.cancellationId) {
            error = new Error("Booking already cancelled");
            error.bookingId = booking.id;
            throw error;
        }
        if (! _.includes(Cancellation.get("reasonTypes"), args.reasonType)) {
            error = new Error("Bad reason type");
            error.reasonType = args.reasonType;
            throw error;
        }
        if (args.trigger && ! _.includes(Cancellation.get("triggers"), args.trigger)) {
            error = new Error("Bad trigger");
            error.trigger = args.trigger;
            throw error;
        }

        var isValidCancelField = field => _.includes(["boolean", "number"], typeof field);
        if ((args.cancel && ! _.isObject(args.cancel))
         || ! isValidCancelField(cancel.payment)
         || ! isValidCancelField(cancel.takerFees)
        ) {
            error = new Error("Bad cancel config");
            error.cancel = args.cancel;
            throw error;
        }

        // cannot cancel the booking when the input assessment is signed
        var bookingAssessments = yield getBookingAssessments(booking);

        var inputAssessmentSigned = bookingAssessments.inputAssessment
            && bookingAssessments.inputAssessment.signedDate;

        if (inputAssessmentSigned) {
            error = new Error("Too far booking step: cancel it manually");
            error.bookingId = booking.id;
            throw error;
        }

        if (doUpdateConversation) {
            yield updateConversation(booking, args.reasonType, ! inputAssessmentSigned);
        }

        if (doCancelPayment) {
            yield cancelBookingPayment(booking, transactionManager, {
                payment: cancel.payment,
                refundTakerFees: cancel.takerFees
            });
        }

        var createAttrs = {
            listingId: booking.listingId,
            reasonType: args.reasonType,
            reason: args.reason,
            ownerId: booking.ownerId,
            takerId: booking.takerId,
            trigger: args.trigger
        };

        var cancellation = yield Cancellation.create(createAttrs);

        // replenish stock only if the booking is paid
        if (doReplenishStock && booking.paidDate) {
            yield Booking.updateListingQuantity(booking, { actionType: 'add' });
        }

        booking = yield Booking.updateOne(booking.id, {
            cancellationId: cancellation.id
        });
        return booking;
    })();
}

function getBookingAssessments(booking) {
    return Promise.coroutine(function* () {
        if (! booking.paidDate || ! booking.acceptedDate) {
            return {};
        }

        var hashAssessments = yield Booking.getAssessments([booking]);
        return hashAssessments[booking.id];
    })();
}

function updateConversation(booking, reasonType, removeInputAssessment) {
    return Promise.coroutine(function* () {
        var updateAttrs = {};
        var agreementStatus;

        if (removeInputAssessment) {
            updateAttrs.inputAssessmentId = null;
        }

        if (reasonType === "rejected") {
            agreementStatus = "rejected";
        } else if (reasonType === "out-of-stock") {
            agreementStatus = "rejected-by-other";
        } else {
            agreementStatus = "cancelled";
        }

        updateAttrs.agreementStatus = agreementStatus;

        // the conversation can be not existing (e.g. booking before payment without message)
        return yield Conversation.update({ bookingId: booking.id }, updateAttrs);
    })();
}

/**
 * cancel booking payment
 * @param  {object} booking
 * @param  {object} transactionManager
 * @param  {object} args
 *
 * the following params are boolean:
 * if true, cancel what booking has taken
 * if false, do not cancel
 *
 * @param  {boolean} [args.payment]
 * @param  {boolean} [args.refundTakerFees]
 * @return {Promise}
 */
function cancelBookingPayment(booking, transactionManager, args) {
    args = args || {};
    var payment         = args.payment;
    var refundTakerFees = args.refundTakerFees;

    var error;

    return Promise.coroutine(function* () {
        var taker = yield User.findOne({ id: booking.takerId });
        if (! taker) {
            error = new Error("Taker not found");
            error.takerId = booking.takerId;
            throw error;
        }

        var transfer = transactionManager.getTransferPayment();
        if (transfer) {
            error = new Error("Cancelling booking when transfer is done: cancel it manually");
            error.bookingId = booking.id;
            error.notCancellable = true;
            throw error;
        }

        var payin = transactionManager.getPayinPayment();

        // cannot take payment or taker fees because payin isn't done
        if (! payin) {
            return yield BookingPaymentService.cancelPreauthPayment(booking, transactionManager);
        }

        // if payin is already cancelled, can do nothing
        if (transactionManager.isTransactionCancelled(payin)) {
            return booking;
        }

        // reimburse payment and taker fees
        if (payment && refundTakerFees) {
            return yield BookingPaymentService.cancelPayinPayment(booking, transactionManager, taker);
        }

        // reimburse taker fees only
        if (! payment && refundTakerFees) {
            error = new Error("Cannot cancel taker fees but not payment");
            error.bookingId = booking.id;
            throw error;
        }

        var owner = yield User.findOne({ id: booking.ownerId });
        if (! owner) {
            error = new Error("Owner not found");
            error.ownerId = booking.ownerId;
            throw error;
        }

        // reimburse payment only
        if (payment && ! refundTakerFees) {
            booking = yield BookingPaymentService
                .cancelPayinPayment(booking, transactionManager, taker, {
                    amount: MathService.roundDecimal(booking.takerPrice - booking.takerFees, 2)
                });

            booking = yield BookingPaymentService
                .transferPayment(booking, transactionManager, taker, owner, {
                    amount: 0,
                    ownerFees: 0,
                    takerFees: booking.takerFees
                });

            return booking;
        }

        // reimburse nothing
        if (! payment && ! refundTakerFees) {
            booking = yield BookingPaymentService
                .transferPayment(booking, transactionManager, taker, owner);

            if (owner.bankAccountId) {
                booking = yield BookingPaymentService
                    .payoutPayment(booking, transactionManager, owner);
            }

            return booking;
        }
    })();
}

/**
 * After a booking is paid and accepted, cancel other bookings that cannot be performed anymore
 * due to listing type constraints
 * @param {Object} booking
 * @param {Object} logger
 */
async function cancelOtherBookings(booking, logger) {
    const { TIME, AVAILABILITY } = booking.listingType.properties;

    // do not cancel any bookings if there is no availability issues
    if (AVAILABILITY === 'NONE') return;

    const listing = await Listing.findOne({ id: booking.listingId });
    if (!listing) {
        throw createError(404);
    }

    let otherBookings = [];

    // time does not matter (like selling)
    // cancel not paid bookings whose quantity is greater than remaining quantity
    if (TIME === 'NONE') {
        otherBookings = await Booking.find({
            listingId: booking.listingId,
            quantity: { '>': listing.quantity },
            id: { '!=': booking.id },
            paidDate: null,
            cancellationId: null,
        });
    // time does matter (like renting)
    // cancel pending bookings whose quantity exceeds the max quantity during the booking period
    } else if (TIME === 'TIME_FLEXIBLE') {
        const pendingBookings = await Booking.getPendingBookings(booking.listingId, {
            refBooking: booking,
            intersection: true,
        });

        const refDate = booking.startDate;
        const futureBookings = await Listing.getFutureBookings(booking.listingId, refDate);

        // for each pending bookings, compute if it exceeds the stock limit during the period
        _.forEach(pendingBookings, pendingBooking => {
            const availableResult = BookingService.getAvailabilityPeriods({
                futureBookings,
                newBooking: pendingBooking,
                maxQuantity: listing.quantity,
            });

            if (!availableResult.isAvailable) {
                otherBookings.push(pendingBooking);
            }
        });
    }

    await cancelBookingsByPriority(booking, otherBookings, 'out-of-stock', logger);
}

function cancelBookingsByPriority(booking, otherBookings, reasonType, logger) {
    return Promise.each(otherBookings, otherBooking => {
        return cancelBooking(otherBooking, null, {
            reasonType: reasonType
        })
        .catch(err => {
            logger.error({
                err: err,
                bookingId: booking.id,
                cancelledBookingId: otherBooking.id
            });
        });
    });
}
