/* global
    Booking, BookingPaymentService, Cancellation, Conversation, Item, MathService, User
*/

module.exports = {

    cancelBooking: cancelBooking,
    cancelIntersectionBookings: cancelIntersectionBookings,
    cancelBookingsFromSameItem: cancelBookingsFromSameItem,
    cancelBookingPayment: cancelBookingPayment

};

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
            itemId: booking.itemId,
            reasonType: args.reasonType,
            reason: args.reason,
            ownerId: booking.ownerId,
            takerId: booking.bookerId,
            trigger: args.trigger
        };

        var cancellation = yield Cancellation.create(createAttrs);

        if (Booking.isPurchase(booking)) {
            yield Item.updateOne(booking.itemId, { soldDate: null });
        }

        booking = yield Booking.updateOne(booking.id, {
            cancellationId: cancellation.id
        });
        return booking;
    })();
}

function getBookingAssessments(booking) {
    return Promise.coroutine(function* () {
        if (! booking.confirmedDate || ! booking.validatedDate) {
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
        } else if (reasonType === "other-booking-first") {
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
        var booker = yield User.findOne({ id: booking.bookerId });
        if (! booker) {
            error = new Error("Booker not found");
            error.bookerId = booking.bookerId;
            throw error;
        }

        var transfer = transactionManager.getTransferPayment();
        if (transfer) {
            error = new Error("Cancelling booking when transfer is done: cancel it manually");
            error.bookingId = booking.id;
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
            return yield BookingPaymentService.cancelPayinPayment(booking, transactionManager, booker);
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
                .cancelPayinPayment(booking, transactionManager, booker, {
                    amount: MathService.roundDecimal(booking.takerPrice - booking.takerFees, 2)
                });

            booking = yield BookingPaymentService
                .transferPayment(booking, transactionManager, booker, owner, {
                    amount: 0,
                    ownerFees: 0,
                    takerFees: booking.takerFees
                });

            return booking;
        }

        // reimburse nothing
        if (! payment && ! refundTakerFees) {
            booking = yield BookingPaymentService
                .transferPayment(booking, transactionManager, booker, owner);

            if (owner.bankAccountId) {
                booking = yield BookingPaymentService
                    .payoutPayment(booking, transactionManager, owner);
            }

            return booking;
        }
    })();
}

function cancelIntersectionBookings(booking, logger) {
    return Promise.coroutine(function* () {
        var otherBookings = yield Booking.getPendingBookings(booking.itemId, {
            refBooking: booking,
            intersection: true
        });

        return yield cancelBookingsByPriority(booking, otherBookings, "other-booking-first", logger);
    })();
}

function cancelBookingsFromSameItem(booking, logger) {
    return Promise.coroutine(function* () {
        var otherBookings = yield Booking.getPendingBookings(booking.itemId, {
            refBooking: booking
        });

        return yield cancelBookingsByPriority(booking, otherBookings, "item-sold", logger);
    })();
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
