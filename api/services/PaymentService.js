/* global
    Booking, BookingGamificationService, CancellationService, Card, Conversation, GeneratorService,
    PaymentError, PaymentMangopayService, PaymentStripeService, StelaceEventService, Token, TransactionService, User
*/

module.exports = {

    createPreauthorization,
    afterPreauthorizationReturn,

    afterPaymentSuccess,

};

const moment = require('moment');
const createError = require('http-errors');
const _ = require('lodash');

/**
 *
 * @param {Object} booking
 * @param {Number} cardId
 * @param {String} operation
 * @param {Object} req
 * @param {Object} logger
 * @return {Object} res
 * @return {String} res.redirectUrl
 * @return {Object} res.providerData
 */
async function createPreauthorization({ booking, cardId, operation, req, logger }) {
    const taker = await User.findOne({ id: booking.takerId });
    if (!taker) {
        throw new Error('Taker not found');
    }

    const card = await Card.findOne({ id: cardId });
    if (!card) {
        throw new Error('Card not found');
    }
    if (card.userId !== taker.id) {
        throw createError(403);
    }
    if (Card.isInvalid(card)) {
        throw createError(400, 'Card invalid');
    }
    if (!card.active) {
        throw createError(400, 'Card inactive');
    }

    const enoughExpiration = _isCardExpirationEnough(booking, card);
    if (!enoughExpiration) {
        throw createError(400, 'Expiration date too short');
    }

    const setSecureMode = _.includes(['deposit', 'deposit-payment'], operation);

    let secureReturnUrl;
    if (setSecureMode) {
        secureReturnUrl = await _get3DSecureReturnUrl(booking, operation);
    }

    const amount = _getAmount(booking, operation);

    const result = {
        redirectUrl: null,
        providerData: {}, // warning: used in the after preauthorization return, provide the correct parameters
    };

    if (booking.paymentProvider === 'mangopay') {
        const preauthorization = await PaymentMangopayService.createPreauthorization({
            user: taker,
            card,
            amount,
            currency: booking.currency,
            setSecureMode,
            returnUrl: setSecureMode ? secureReturnUrl : null,
        });

        if (preauthorization.Status === "FAILED") {
            PaymentError.createMangopayError({
                req,
                preauthorization,
                userId: booking.takerId,
                bookingId: booking.id,
                cardId: card.id,
            }).catch(() => { /* do nothing */ });

            const error = createError('Preauthorization fail', {
                preauthorization,
            });
            logger.error({ err: error });

            throw createError(400, 'preauthorization fail', {
                resultCode: preauthorization.ResultCode,
            });
        }

        if (preauthorization.SecureModeNeeded) {
            result.redirectUrl = preauthorization.SecureModeRedirectURL;
        }
        result.providerData = {
            preauthorization,
        };
    } else if (booking.paymentProvider === 'stripe') {
        const charge = await PaymentStripeService.createCharge({
            user: taker,
            card,
            amount,
            currency: booking.currency,
            capture: false,
        });

        result.providerData = {
            charge,
        };
    } else {
        throw new Error('Unknown payment provider');
    }

    return result;
}

/**
 * Preauthorization can be in two parts (those from 3DSecure)
 * @param {Object} booking
 * @param {Object} providerData - comes from create preauthorization function
 * @param {String} operation
 * @param {Object} req
 */
async function afterPreauthorizationReturn({
    booking,
    providerData,
    operation,
    req,
}) {
    let transactionProviderData;

    if (booking.paymentProvider === 'mangopay') {
        const { preauthorization } = providerData;

        const card = await Card.findOne({ resourceId: preauthorization.CardId });
        if (!card) {
            throw createError(404);
        }
        if (Card.hasUnknownStatus(card)) {
            await Card.synchronize(card);
        }

        if (preauthorization.Status === 'FAILED') {
            PaymentError.createMangopayError({
                req,
                preauthorization,
                userId: booking.takerId,
                bookingId: booking.id,
                cardId: card.id,
            }).catch(() => { /* do nothing */ });

            throw createError('Preauthorization fail', {
                preauthorization,
                errorType: 'fail',
                resultCode: preauthorization.ResultCode,
            });
        }

        transactionProviderData = { preauthorization };
    } else if (booking.paymentProvider === 'stripe') {
        const { charge } = providerData;

        if (charge.status === 'failed') {
            PaymentError.createStripeError({
                req,
                charge,
                userId: booking.takerId,
                bookingId: booking.id,
            }).catch(() => { /* do nothing */ });

            throw createError('Preauthorization fail', {
                charge,
                errorType: 'fail',
                resultCode: charge.outcome.type,
                outcome: charge.outcome,
            });
        }

        transactionProviderData = { charge };
    }

    const preauthAmount = _getAmount(booking, operation);
    await TransactionService.createPreauthorization({
        booking,
        providerData: transactionProviderData,
        preauthAmount,
        label: operation,
    });
}

/**
 * @param {Object} booking
 * @param {String} operation
 * @param {Object} req
 * @param {Object} res
 * @param {Object} logger
 * @return {Object} booking
 */
async function afterPaymentSuccess({
    booking,
    operation,
    req,
    res,
    logger,
}) {
    const now = new Date().toISOString();
    const updateAttrs = {};

    if (operation === 'deposit-payment') {
        updateAttrs.depositDate = now;
        updateAttrs.paymentDate = now;
        booking.depositDate = now;
        booking.paymentDate = now;
    } else if (operation === "deposit") {
        updateAttrs.depositDate = now;
        booking.depositDate = now;
    } else if (operation === "payment") {
        updateAttrs.paymentDate = now;
        booking.paymentDate = now;
    }

    if (booking.paymentDate && booking.depositDate) {
        updateAttrs.paidDate = now;
        booking.paidDate = now;
    }

    // for bookings that don't depend on assessment
    if (Booking.isComplete(booking)) {
        updateAttrs.completedDate = now;
    }

    booking = await Booking.updateOne(booking.id, Object.assign({}, updateAttrs));

    await StelaceEventService.createEvent({
        req,
        res,
        label: 'booking.paid',
        type: 'core',
        bookingId: booking.id,
        targetUserId: booking.ownerId,
        listingId: booking.listingId,
    });

    await BookingGamificationService.afterBookingPaidAndAccepted(booking, logger, req);

    try {
        await Conversation.update({ bookingId: booking.id }, { bookingStatus: "booking" })
    } catch (err) {
        logger.error({
            err,
            bookingId: booking.id,
        }, 'Conversation update fail');
    }

    // update quantity before cancelling other bookings
    await Booking.updateListingQuantity(booking, { actionType: 'remove' });

    if (booking.paidDate && booking.acceptedDate) {
        // cancel other bookings if this one is paid
        try {
            await CancellationService.cancelOtherBookings(booking, logger);
        } catch (err) {
            logger.error({
                err,
                bookingId: booking.id
            }, 'Booking cancelling other bookings');
        }
    }

    return booking;
}

function _isCardExpirationEnough(booking, card) {
    const formatDate = 'YYYY-MM-DD';

    let cardMinLimitDate;
    if (Booking.isNoTime(booking)) {
        cardMinLimitDate = moment().format(formatDate);
    } else {
        cardMinLimitDate = booking.endDate;
    }

    return !Card.isExpiredAt(card, moment(cardMinLimitDate).add(30, "d").format(formatDate));
}

async function _create3DSecureToken(takerId, operation) {
    let type;

    if (operation === 'deposit') {
        type = 'depositSecure';
    } else if (operation === 'payment') {
        type = 'paymentSecure';
    } else { // operation === 'deposit-payment'
        type = 'depositPaymentSecure';
    }

    const randomString = await GeneratorService.getRandomString(20);

    var createAttrs = {
        type,
        value: randomString,
        userId: takerId,
        expirationDate: moment().add(1, 'd').toISOString(),
    };

    const token = await Token.create(createAttrs);
    return token;
}

async function _get3DSecureReturnUrl(booking, operation) {
    const host = sails.config.stelace.url;

    const token = await _create3DSecureToken(booking.takerId, operation);

    const returnUrl = host
        + '/api/booking/' + booking.id
        + '/payment-secure?u=' + booking.takerId
        + '&v=' + token.value
        + '&t=' + token.type;

    return returnUrl;
}

function _getAmount(booking, operation) {
    if (operation === 'deposit') {
        return booking.deposit;
    } else if (operation === 'payment') {
        return booking.takerPrice;
    } else { // operation === 'deposit-payment'
        return booking.takerPrice || booking.deposit;
    }
}
