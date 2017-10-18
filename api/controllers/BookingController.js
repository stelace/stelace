/* global
    Assessment, AssessmentService, Booking, BookingService, BookingGamificationService,
    Cancellation, CancellationService, Card, ContractService, Conversation,
    EmailTemplateService, FileCachingService, FreeDaysService, GeneratorService, Item, Location, Message, mangopay,
    MapService, ModelSnapshot, PaymentError, SmsTemplateService, StelaceEventService, Token, TransactionService, User
*/

/**
 * BookingController
 *
 * @description :: Server-side logic for managing bookings
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

module.exports = {

    find: find,
    findOne: findOne,
    create: create,
    update: update,
    destroy: destroy,

    my: my,
    params: params,
    validate: validate,
    cancel: cancel,

    payment: payment,
    paymentSecure: paymentSecure,

    createContractToken: createContractToken,
    getContract: getContract
};

var moment    = require('moment');
var path      = require('path');
var fs        = require('fs');

// TODO: use this cache to send message server-side during payment
// Rather than relying on client-side booking-confirmation view
var messageCache;

Promise.promisifyAll(fs);

function initMessageCache() {
    return Promise.coroutine(function* () {
        if (messageCache) {
            return;
        }

        messageCache = FileCachingService.getCache({
            filepath: path.join(sails.config.tmpDir, "bookingPaymentMessages.json")
        });

        messageCache.loadFromFile();
    })();
}

function find(req, res) {
    return res.forbidden();
}

function findOne(req, res) {
    var id = req.param("id");
    var access;

    return Promise.coroutine(function* () {
        var booking = yield Booking.findOne({ id: id });
        if (! booking) {
            throw new NotFoundError();
        }

        var result = yield Promise.props({
            itemSnapshot: ModelSnapshot.fetch(booking.itemSnapshotId),
            cancellation: booking.cancellationId ? Cancellation.findOne({ id: booking.cancellationId }) : null
        });

        var itemSnapshot = result.itemSnapshot;
        var cancellation = result.cancellation;

        if (! itemSnapshot
            || (booking.cancellationId && ! cancellation)
        ) {
            throw new NotFoundError();
        }

        if (booking.ownerId === req.user.id) {
            access = "owner";
        } else if (booking.bookerId === req.user.id) {
            access = "self";
        }

        var b = Booking.expose(booking, access);
        b.itemSnapshot = Item.expose(itemSnapshot, "others");
        if (cancellation) {
            b.cancellation = Cancellation.expose(cancellation, "others");
        }

        res.json(b);
    })()
    .catch(res.sendError);
}

async function create(req, res) {
    const attrs = req.allParams();
    const access = 'self';

    attrs.user = req.user;

    if (typeof attrs.itemId !== 'undefined') {
        attrs.itemId = parseInt(attrs.itemId, 10);
    }
    if (typeof attrs.nbTimeUnits !== 'undefined') {
        attrs.nbTimeUnits = parseInt(attrs.nbTimeUnits, 10);
    }
    if (typeof attrs.quantity !== 'undefined') {
        attrs.quantity = parseInt(attrs.quantity, 10);
    }

    try {
        const booking = await BookingService.createBooking(attrs);
        res.json(Booking.expose(booking, access));
    } catch (err) {
        res.sendError(err);
    }
}

function update(req, res) {
    return res.forbidden();
}

function destroy(req, res) {
    return res.forbidden();
}

function my(req, res) {
    var as = req.param("as");
    var asTypes = ["booker", "owner"];
    var access;
    var findAttrs;

    if (! as || ! _.contains(asTypes, as)) {
        return res.badRequest();
    }

    if (as === "booker") {
        access = "self";
        findAttrs = { bookerId: req.user.id };
    } else { // as === "owner"
        access = "owner";
        findAttrs = { ownerId: req.user.id };
    }

    return Promise.coroutine(function* () {
        var bookings = yield Booking.find(findAttrs);
        res.json(Booking.exposeAll(bookings, access));
    })()
    .catch(res.sendError);
}

function params(req, res) {
    return res.json({
        classic: Booking.get("classic"),
        purchase: Booking.get("purchase")
    });
}

/**
 * Validate booking
 * Handle message creation and confirmation email
 * @param {object}  req
 * @param {object}  [params.userMessage]  - validation message (for bookingConfirmiedTaker email)
 * @param {object}  res
 *
 * @return {object} res.json
 */
function validate(req, res) {
    var id           = req.param("id");
    var giverMessage = req.param("userMessage");
    var access       = "owner";

    var now = moment().toISOString();

    return Promise.coroutine(function* () {
        var booking = yield Booking.findOne({ id: id });
        if (! booking) {
            throw new NotFoundError();
        }
        // the booking cannot be validated by the current user
        if (Booking.getAgreementUserId(booking) !== req.user.id) {
            throw new ForbiddenError();
        }
        // booking cancelled or already validated
        if (booking.cancellationId || booking.validatedDate) {
            throw new BadRequestError();
        }
        if (Booking.isValidationTooLate(booking, now)) {
            var error = new BadRequestError("Validation too late");
            error.expose = true;
            throw new BadRequestError();
        }

        var assessment = yield AssessmentService.createAssessment({
            booking: booking,
            type: "start"
        });

        // set the created assessment as input assessment for the conversation
        yield Conversation.update(
            { bookingId: booking.id },
            { inputAssessmentId: assessment.id }
        );

        var data = {
            booking: booking,
            assessment: assessment,
            giverMessage: giverMessage,
            logger: req.logger
        };

        yield _sendBookingConfirmedEmailsSms(data);

        // cancel other bookings that overlaps this booking that is paid and validated by owner
        if (booking.confirmedDate) {
            if (Booking.isNoTime(booking)) {
                // item is sold, cancel all bookings
                yield CancellationService
                    .cancelBookingsFromSameItem(booking, req.logger)
                    .catch(err => {
                        req.logger({
                            err: err,
                            bookingId: booking.id
                        }, "Fail cancelling bookings from same item");
                    });
            } else {
                // cancel booking that overlap the dates
                yield CancellationService
                    .cancelIntersectionBookings(booking, req.logger)
                    .catch(err => {
                        req.logger({
                            err: err,
                            bookingId: booking.id
                        }, "Fail cancelling intersection bookings");
                    });
            }
        }

        if (giverMessage && giverMessage.privateContent && giverMessage.senderId) {
            yield Message.createMessage(booking.ownerId, giverMessage, { logger: req.logger });
        }

        if (booking.confirmedDate && Booking.isNoTime(booking)) {
            yield Item.updateOne(booking.itemId, { soldDate: now });
        }

        booking = yield Booking.updateOne(booking.id, { validatedDate: now });

        BookingGamificationService.afterBookingPaidAndValidated(booking, req.logger, req);

        res.json(Booking.expose(booking, access));
    })()
    .catch(res.sendError);
}

/**
 * Reject booking
 * TODO: send rejection email
 * @param {object}  req
 * @param {object}  [params.userMessage] - Rejection message (allows email use)
 * @param {object}  res
 *
 * @return {object} res.json
 */
function cancel(req, res) {
    var id           = req.param("id");
    var reasonType   = req.param("reasonType");
    var giverMessage = req.param("userMessage");
    var access;

    if (! _.contains(Cancellation.get("reasonTypes"), reasonType)) {
        return res.badRequest();
    }

    return Promise.coroutine(function* () {
        var booking = yield Booking.findOne({ id: id });
        if (! booking) {
            throw new NotFoundError();
        }
        if (booking.cancellationId) {
            throw new BadRequestError("booking already cancelled");
        }
        if ((req.user.id === booking.ownerId && reasonType !== "rejected")) {
            throw new BadRequestError();
        }

        if (giverMessage && giverMessage.privateContent && giverMessage.senderId) {
            yield Message.createMessage(booking.ownerId, giverMessage, { logger: req.logger });
        }

        var trigger;
        if (req.user.id === booking.bookerId) {
            trigger = "taker";
        } else if (req.user.id === booking.ownerId) {
            trigger = "owner";
        }

        booking = yield CancellationService.cancelBooking(booking, null, {
            reasonType: reasonType,
            trigger: trigger,
            cancel: {
                freeDays: true
            }
        });

        if (req.user.id === booking.bookerId) {
            access = "self";
        } else if (req.user.id === booking.ownerId) {
            access = "owner";
        }

        res.json(Booking.expose(booking, access));
    })()
    .catch(res.sendError);
}

/**
 * Payment with several options
 * @param {object}  req
 * @param {number}  params.cardId
 * @param {string}  params.operation     - Payement operation type ("payment", "deposit", "deposit-payment")
 * @param {string}  [params.userMessage] - Rejection message privateContent (for future email use)
 * @param {object}  res
 *
 * @return {object} res.json
 */
function payment(req, res) {
    var id        = req.param("id");
    var cardId    = req.param("cardId");
    var operation = req.param("operation");
    var message   = req.param("userMessage");

    var access = "self";
    var formatDate = "YYYY-MM-DD";
    var error;

    if (! cardId
        || ! operation || ! _.contains(["payment", "deposit", "deposit-payment"], operation)
        || ! req.user.mangopayUserId
    ) {
        return res.badRequest();
    }

    initMessageCache();

    return Promise
        .resolve()
        .then(() => {
            return [
                Booking.findOne({ id: id }),
                Card.findOne({
                    id: cardId,
                    userId: req.user.id
                }),
                TransactionService.getBookingTransactionsManagers([id])
            ];
        })
        .spread((booking, card, hashBookingsManagers) => {
            return [
                booking,
                card,
                hashBookingsManagers[booking.id],
                FreeDaysService.getFreeDaysUsedForBooking(req.user, booking)
            ];
        })
        .spread((booking, card, transactionManager, freeDaysLog) => {
            if (! booking) {
                throw new NotFoundError();
            }
            if (req.user.id !== booking.bookerId) {
                throw new ForbiddenError();
            }
            // if booking is already paid or cancelled
            if (booking.confirmedDate
                || booking.cancellationId
                || (booking.paymentDate && operation === "payment")
                || (booking.depositDate && operation === "deposit")
                || (booking.paymentDate && booking.depositDate && operation === "deposit-payment")
            ) {
                throw new BadRequestError();
            }
            // if the user doesn't have enough free days and free days aren't already used
            if (booking.nbFreeDays
                && req.user.nbFreeDays < booking.nbFreeDays
                && ! freeDaysLog
            ) {
                error = new BadRequestError("not enough free days");
                error.expose = true;
                throw error;
            }

            // store booking message for emails sent before message creation in booking-confirmation view
            if (operation !== "payment") { // payment in booking-confirmation view
                messageCache.set(booking.id, message);
            }

            var skipPayment = isPaymentSkipped(operation, booking, transactionManager);

            if (skipPayment) {
                var data = {
                    booking: booking,
                    operation: operation,
                    logger: req.logger,
                    req: req
                };

                return _paymentEndProcess(data)
                    .then(() => {
                        res.json(Booking.expose(booking, access));
                    });
            } else {
                return doPayment(booking, req.user, card, operation, req.logger);
            }
        })
        .catch(res.sendError);



    function isPaymentSkipped(operation, booking, transactionManager) {
        var depositPayment = transactionManager.getDepositPayment();
        var deposit        = transactionManager.getDeposit();

        if (operation === "payment") {
            // if free, no need to do the whole payment process
            if (booking.takerPrice === 0) {
                return true;
            }

            // if one of the different type of deposits payment is already done, skip the payment
            return !! (depositPayment || deposit);
        } else if (operation === "deposit") {
            // if free, no need to do the whole payment process
            if (booking.deposit === 0) {
                return true;
            }

            // if the deposit is already done, but something failed
            return !! deposit;
        } else if (operation === "deposit-payment") {
            // if free, no need to do the whole payment process
            if (booking.deposit === 0 && booking.takerPrice === 0) {
                return true;
            }

            // if the deposit payment is already done, but something failed
            return !! depositPayment;
        }

        return false;
    }

    function doPayment(booking, booker, card, operation, logger) {
        var error;

        return Promise
            .resolve()
            .then(() => {
                if (! card) {
                    throw new NotFoundError();
                }
                if (card.validity === "INVALID") {
                    throw new BadRequestError("invalid card");
                }
                if (! card.active) {
                    throw new BadRequestError("inactive card");
                }

                var limitDate;
                if (Booking.isNoTime(booking)) {
                    limitDate = moment().format(formatDate);
                } else {
                    limitDate = booking.endDate;
                }

                if (card.isExpiredAt(moment(limitDate).add(30, "d").format(formatDate))) {
                    error = new BadRequestError("expiration date too short");
                    error.expose = true;
                    throw error;
                }

                return [
                    User.findOne({ id: booking.ownerId }),
                    GeneratorService.getRandomString(20)
                ];
            })
            .spread((owner, randomString) => {
                if (! owner) {
                    throw new NotFoundError();
                }

                var type;

                if (operation === "deposit") {
                    type = "depositSecure";
                } else if (operation === "payment") {
                    type = "paymentSecure";
                } else { // operation === "deposit-payment"
                    type = "depositPaymentSecure";
                }

                var createAttrs = {
                    type: type,
                    value: randomString,
                    userId: booker.id,
                    expirationDate: moment().add(1, "d").toISOString()
                };

                return [
                    owner,
                    Token.create(createAttrs)
                ];
            })
            .spread((owner, token) => {
                var setSecureMode = _.contains(["deposit", "deposit-payment"], operation);

                var host;

                if (sails.config.environment === "development") {
                    // we cannot know if the device comes from the same machine as the server
                    // or another device of the network
                    host = "http://" + µ.getPrivateIp() + ":3000";
                } else {
                    host = sails.config.stelace.url;
                }

                var returnURL = host
                                    + "/api/booking/" + id
                                    + "/payment-secure?u=" + booker.id
                                    + "&v=" + token.value
                                    + "&t=" + token.type;

                var price;

                if (operation === "deposit") {
                    price = booking.deposit;
                } else if (operation === "payment") {
                    price = booking.takerPrice;
                } else { // operation === "deposit-payment"
                    price = booking.takerPrice || booking.deposit;
                }

                return mangopay.preauthorization.create({
                    body: {
                        AuthorId: booker.mangopayUserId,
                        DebitedFunds: {
                            Amount: Math.round(price * 100),
                            Currency: "EUR"
                        },
                        SecureMode: setSecureMode ? "FORCE" : "DEFAULT",
                        CardId: card.mangopayId,
                        SecureModeReturnURL: returnURL
                    }
                });
            })
            .then(preauthorization => {
                var preauthError;

                if (preauthorization.Status === "FAILED") {
                    PaymentError.createError({
                        req,
                        preauthorization,
                        userId: req.user.id,
                        bookingId: booking.id,
                        cardId: card.id,
                    }).catch(() => { /* do nothing */ });

                    error = new Error("Preauthorization fail");
                    error.preauthorization = preauthorization;
                    req.logger.error({ err: error });

                    preauthError = new BadRequestError("preauthorization fail");
                    preauthError.resultCode = preauthorization.ResultCode;
                    preauthError.expose = true;
                    throw preauthError;
                }

                if (preauthorization.SecureModeNeeded) {
                    // redirection to secure mode managed in client side
                    res.ok({ redirectURL: preauthorization.SecureModeRedirectURL });
                } else {
                    var data = {
                        booking: booking,
                        booker: booker,
                        operation: operation,
                        preauthorization: preauthorization,
                        logger: logger,
                        req: req
                    };

                    return _paymentProcessAfterPreauth(data)
                        .then(() => {
                            res.json(Booking.expose(booking, access));
                        })
                        .catch(err => {
                            if (err.errorType === "fail") {
                                req.logger.error({ err: err.error });

                                preauthError = new BadRequestError("preauthorization fail");
                                preauthError.resultCode = err.ResultCode;
                                preauthError.expose = true;
                                throw preauthError;
                            } else {
                                throw err;
                            }
                        });
                }
            });
    }
}

function paymentSecure(req, res) {
    var id = req.param("id");
    var preauthorizationId = req.param("preAuthorizationId");
    var tokenValue         = req.param("v");
    var tokenType          = req.param("t");
    var userId             = req.param("u");

    var redirectURL = "/booking-confirmation/" + id;
    var error;

    var allowedTokenTypes = [
        "depositSecure",
        "paymentSecure",
        "depositPaymentSecure"
    ];

    return Promise
        .resolve()
        .then(() => {
            if (! tokenType || ! _.contains(allowedTokenTypes, tokenType)) {
                error = new Error();
                error.errorType = "badRequest";
                throw error;
            }

            return [
                Booking.findOne({ id: id }),
                Token.findOne({
                    value: tokenValue,
                    userId: userId,
                    type: tokenType
                }),
                User.findOne({ id: userId })
            ];
        })
        .spread((booking, token, booker) => {
            var operation;

            if (tokenType === "depositSecure") {
                operation = "deposit";
            } else if (tokenType === "paymentSecure") {
                operation = "payment";
            } else { // tokenType === "depositPaymentSecure"
                operation = "deposit-payment";
            }

            if (! booking
                || ! token
                || ! booker
            ) {
                error = new Error();
                error.errorType = "badRequest";
                throw error;
            }
            if (booking.cancellationId
                || booking.bookerId !== booker.id
                || (booking.depositDate && operation === "deposit")
                || (booking.paymentDate && operation === "payment")
                || (booking.paymentDate && booking.depositDate && operation === "deposit-payment")
            ) {
                error = new Error();
                error.errorType = "badRequest";
                throw error;
            }

            return mangopay.preauthorization
                .fetch({
                    preauthorizationId: preauthorizationId
                })
                .then(preauthorization => {
                    var data = {
                        booking: booking,
                        booker: booker,
                        operation: operation,
                        preauthorization: preauthorization,
                        logger: req.logger,
                        req: req
                    };

                    return _paymentProcessAfterPreauth(data);
                });
        })
        .then(() => {
            res.redirect(redirectURL);
        })
        .catch(err => {
            redirectURL += "?error=";

            if (err.errorType) {
                redirectURL += err.errorType;

                if (err.errorType === "fail") {
                    redirectURL += "&resultCode=" + err.resultCode;

                    req.logger.error({ err: err });
                }
            } else {
                redirectURL += "other";
            }

            res.redirect(redirectURL);
        });
}

/**
 * @param data
 * - *booking
 * - *preauthorization
 * - *operation
 * - *logger
 - - item
    * - booker
    * - req
    */
// preauthorization can be performed by two ways (secure mode or not)
function _paymentProcessAfterPreauth(data) {
    var booking          = data.booking;
    var preauthorization = data.preauthorization;
    var operation        = data.operation;
    var logger           = data.logger;
    var req              = data.req;
    var card;

    return Promise
        .resolve()
        .then(() => {
            return Card
                .findOne({ mangopayId: preauthorization.CardId })
                .then(c => {
                    card = c;
                    if (! card) {
                        throw new NotFoundError();
                    }

                    if (card.validity === "UNKNOWN") {
                        return card.synchronize();
                    } else {
                        return;
                    }
                })
                .catch(() => { return; });
        })
        .then(() => {
            if (preauthorization.Status === "FAILED") {
                PaymentError.createError({
                    req,
                    preauthorization,
                    userId: booking.bookerId,
                    bookingId: booking.id,
                    cardId: card.id,
                }).catch(() => { /* do nothing */ });

                var error = new Error("Preauthorization fail");
                error.preauthorization = preauthorization;
                error.errorType = "fail";
                error.resultCode = preauthorization.ResultCode;
                throw error;
            }

            var preauthAmount;
            var label;

            if (operation === "deposit") {
                preauthAmount = booking.deposit;
                label         = "deposit";
            } else if (operation === "payment") {
                preauthAmount = booking.takerPrice;
                label         = "payment";
            } else { // operation === "deposit-payment"
                preauthAmount = booking.takerPrice || booking.deposit;
                label         = "deposit-payment";
            }

            var config = {
                booking: booking,
                preauthorization: preauthorization,
                preauthAmount: preauthAmount,
                label: label
            };

            return TransactionService.createPreauthorization(config);
        })
        .then(() => {
            return _paymentEndProcess({
                booking: booking,
                preauthorization: preauthorization,
                operation: operation,
                logger: logger,
                req: req
            });
        });
}

/**
 * @param data
 * - *booking
 * - *operation
 * - *logger
 - - item
    * - booker
    * - req
    */
// set booking payment state when all previous steps go well
function _paymentEndProcess(data) {
    var booking   = data.booking;
    var operation = data.operation;
    var logger    = data.logger;
    var item      = data.item;
    var booker    = data.booker;
    var req       = data.req;

    var updateAttrs = {};
    var now = moment().toISOString();

    initMessageCache();

    return Promise
        .resolve()
        .then(() => {
            if (operation === "deposit" || operation === "deposit-payment") {
                updateAttrs.depositDate = now;
                booking.depositDate     = now;
            } else if (operation === "payment") {
                updateAttrs.paymentDate = now;
                booking.paymentDate     = now;
            }

            if (booking.paymentDate && booking.depositDate) {
                updateAttrs.confirmedDate = now;
                booking.confirmedDate     = now;
            }

            if (updateAttrs.confirmedDate) {
                var data2 = {
                    booking: booking,
                    logger: logger,
                    item: item,
                    booker: booker
                };

                // if email fails, do not save booking dates in order the process to be done again
                return _sendBookingPendingEmailsSms(data2)
                    .then(() => {
                        if (booking.nbFreeDays) {
                            return useFreeDays(booker, booking, logger);
                        } else {
                            return;
                        }
                    })
                    .then(() => {
                        return Booking.updateOne(booking.id, updateAttrs);
                    });
            } else {
                return Booking.updateOne(booking.id, updateAttrs);
            }
        })
        .then(b => {
            booking = b;

            BookingGamificationService.afterBookingPaidAndValidated(booking, logger, req);

            return Conversation
                .update({ bookingId: booking.id }, { bookingStatus: "booking" })
                .catch(err => {
                    logger.error({
                        err: err,
                        bookingId: booking.id
                    }, "Conversation update fail");
                });
        })
        .then(() => {
            if (booking.confirmedDate && booking.validatedDate) {
                // cancel other bookings that overlaps this booking that is paid and validated by owner
                return CancellationService
                    .cancelIntersectionBookings(booking, logger)
                    .catch(err => {
                        logger.error({
                            err: err,
                            bookingId: booking.id
                        }, "Booking cancel intersection booking");
                    });
            } else {
                return;
            }
        })
        .then(() => booking);



    function useFreeDays(booker, booking, logger) {
        return Promise
            .resolve()
            .then(() => {
                if (booker) {
                    return;
                }

                return User
                    .findOne({ id: booking.bookerId })
                    .then(b => {
                        if (! b) {
                            throw new Error("Booker not found");
                        }

                        booker = b;
                    });
            })
            .then(() => {
                return FreeDaysService.getFreeDaysUsedForBooking(booker, booking);
            })
            .then(freeDaysLog => {
                if (freeDaysLog) {
                    return;
                } else {
                    return FreeDaysService.useFreeDaysForBooking(booker, booking);
                }
            })
            .catch(err => {
                logger.error({
                    err: err,
                    bookingId: booking.id,
                    userId: booking.bookerId
                }, "Fail to use free days");
            });
    }
}

/**
 * @param data
 * - *booking
 * - *logger
 * - item
 * - booker
 */
function _sendBookingPendingEmailsSms(data) {
    var booking = data.booking;
    var logger  = data.logger;
    var item    = data.item;
    var booker  = data.booker;
    var message = messageCache.get(booking.id);

    var error;

    return Promise
        .resolve()
        .then(() => {
            if (! booking) {
                throw new Error("missing args");
            }

            return getData(booking, item, booker, logger);
        })
        .then(data => {
            return getConversation(booking, message, logger)
                .then(conversation => {
                    data.conversation = conversation;
                    return data;
                });
        })
        .then(sendEmails);



    function getData(booking, item, booker, logger) {
        var data         = {};

        return Promise
            .resolve()
            .then(() => {

                return [
                    ! item ? Item.findOne({ id: booking.itemId }) : item,
                    User.findOne({ id: booking.ownerId }),
                    ! booker ? User.findOne({ id: booking.bookerId }) : booker
                ];
            })
            .spread((item, owner, booker) => {
                if (! item
                    || ! booker
                    || ! owner
                ) {
                    error = new Error("Booking confirm missing references");
                    if (! item) {
                        error.itemId = booking.itemId;
                    }
                    if (! owner) {
                        error.ownerId = booking.ownerId;
                    }
                    throw error;
                }

                data.booking      = booking;
                data.item         = item;
                data.owner        = owner;
                data.booker       = booker;
                data.logger       = logger;

                return Item
                    .getMedias([item])
                    .then(hashMedias => hashMedias[item.id])
                    .catch(err => {
                        logger.error({ err: err }); // not critical
                        return [];
                    });
            })
            .then(itemMedias => {
                data.itemMedias = itemMedias;
                return data;
            });
    }

    /**
     * Find or create appropriate conversation
     * @param {object}  booking
     * @param {object}  [message]                 - pending message
     * @param {string}  [message.privateContent]
     * @param {string}  [message.publicContent]
     * @param {object}  [logger]
     *
     * @return {object} conversation              - created or matched conversation
     */
    function getConversation(booking, message, logger) {
        var messageAttrs  = {
            itemId: booking.itemId,
            itemMode: booking.itemMode,
            bookingId: booking.id,
            senderId: booking.bookerId,
            receiverId: booking.ownerId,
            startDate: booking.startDate,
            endDate: booking.endDate,
            bookingStatus: "booking",
            agreementStatus: booking.validatedDate ? "agreed" : "pending", // "agreed" possible if pre-booking
            privateContent: message.privateContent,
            publicContent: message.publicContent
        };
        var messageParams = {
            skipEmailAndSms: true,
            allowEmptyConversation: true,
            emptyConversationMeta: message,
            logger: logger
        };
        return Message.createMessage(booking.bookerId, messageAttrs, messageParams)
            .then((message) => {
                messageCache.unset(booking.id);

                return Conversation
                    .findOne({ id: message.conversationId });
            });
    }

    function sendEmails(data) {
        var booking      = data.booking;
        var item         = data.item;
        var owner        = data.owner;
        var booker       = data.booker;
        var itemMedias   = data.itemMedias;
        var conversation = data.conversation;
        var logger       = data.logger;

        return Promise
            .resolve()
            .then(() => {
                // Only send pending emails to both owner and taker and SMS to owner if owner has not validated yet (payment -i.e. confirmation- first)
                if (! booking.validatedDate) {
                    return Promise.all([
                        sendEmailClassicBookingPendingToTaker(),
                        sendEmailClassicBookingPendingToOwner(),
                        sendSmsClassicBookingPendingToOwner()
                    ]);
                } else { // Booking was pre-accepted (validated) by owner so that payment concludes transaction
                    return sendEmailAndSmsBookingConfirmed();
                }
            });



        function sendEmailClassicBookingPendingToTaker() {
            return EmailTemplateService
                .sendEmailTemplate('booking-pending-taker', {
                    user: booker,
                    item: item,
                    booking: booking,
                    itemMedias: itemMedias,
                    owner: owner,
                    conversation: conversation
                })
                .catch(err => {
                    // not critical
                    logger.error({ err: err }, "send email pending booking to taker");
                });
        }

        function sendEmailClassicBookingPendingToOwner() {
            return EmailTemplateService
                .sendEmailTemplate('booking-pending-owner', {
                    user: owner,
                    item: item,
                    booking: booking,
                    itemMedias: itemMedias,
                    booker: booker,
                    conversation: conversation
                })
                .catch(err => {
                    // critical but not enough to prevent booking...
                    logger.error({ err: err }, "WARNING : send email pending booking to owner");
                });
        }

        function sendSmsClassicBookingPendingToOwner() {
            if (owner.phoneCheck) { // owner.phone is not automatically checked
                return SmsTemplateService
                    .sendSmsTemplate('booking-pending-owner', {
                        user: owner,
                        item,
                        booking,
                    })
                    .catch(err => {
                        // not critical since email must be sent anyway and owner can have no phone
                        logger.error({ err: err }, "send sms pending booking to owner");
                    });
            } else {
                return;
            }
        }

        function sendEmailAndSmsBookingConfirmed() {
            var findAssessmentAttrs = {
                itemId: booking.itemId,
                startBookingId: booking.id, // only startBooking is relevant for (taker's) signToken
                takerId: booking.bookerId,
                ownerId: booking.ownerId
            };


            return Assessment
                .findOne(findAssessmentAttrs)
                .then(assessment => {
                    if (! assessment
                        && booking.bookingMode !== "rental-purchase" // there is no new assessment for rental-purchase booking
                    ) {
                        throw new NotFoundError("Fail to get assessment for booking confirm emails");
                    }

                    return _sendBookingConfirmedEmailsSms({
                        booking: booking,
                        assessment: assessment,
                        logger: logger
                    });
                });
        }
    }
}

/**
 * @param data
 * - *booking
 * - assessment            - not available for rental-purchase booking
 * - giverMessage          - To populate bookingConfirmedTaker email with giver's validation message
 * - *logger
 */
function _sendBookingConfirmedEmailsSms(data) {
    var booking      = data.booking;
    var assessment   = data.assessment;
    var giverMessage = data.giverMessage;
    var logger       = data.logger;

    return Promise
        .resolve()
        .then(() => {
            if (! booking
                || ! assessment
                || ! logger
            ) {
                throw new Error("missing args");
            }

            return getData(booking, assessment, logger);
        })
        .then(data => {
            return sendEmails(data);
        });



    function getData(booking, assessment, logger) {
        var data = {};

        var error;

        return Promise
            .resolve()
            .then(() => {
                return [
                    User.findOne({ id: booking.bookerId }),
                    Item.findOne({ id: booking.itemId }),
                    User.findOne({ id: booking.ownerId }),
                    Conversation.findOne({ bookingId: booking.id })
                ];
            })
            .spread((booker, item, owner, conversation) => {
                if (! booker
                    || ! item
                    || ! owner
                    || ! conversation
                ) {
                    error = new Error("Booking validate missing references");
                    if (! item) {
                        error.itemId = booking.itemId;
                    }
                    if (! booker) {
                        error.bookerId = booking.bookerId;
                    }
                    if (! owner) {
                        error.ownerId = booking.ownerId;
                    }
                    if (! conversation) {
                        error.bookingId = booking.id;
                    }
                    throw error;
                }

                data.booking      = booking;
                data.assessment   = assessment;
                data.logger       = logger;
                data.booker       = booker;
                data.item         = item;
                data.owner        = owner;
                data.conversation = conversation;

                return [
                    data,
                    Item.getMedias([item]).then(itemMedias => itemMedias[item.id]).catch(() => []),
                    Location.find({ userId: owner.id }).catch(() => []),
                    Location.find({ userId: booker.id }).catch(() => [])
                ];
            })
            .spread((data, itemMedias, ownerLocations, bookerLocations) => {
                data.itemMedias      = itemMedias;
                data.ownerLocations  = ownerLocations;
                data.bookerLocations = bookerLocations;

                if ((! ownerLocations.length && booking.itemMode === "classic")
                    || ! bookerLocations.length
                ) {
                    return data;
                } else {
                    return MapService.getOsrmJourneys(bookerLocations, ownerLocations)
                        .then(journeys => {
                            journeys = MapService.sortUniqueOsrmJourneys(journeys, "from", "minDuration");

                            data.journeys = journeys;
                            return data;
                        })
                        .catch(() => data);
                }
            });
    }

    function sendEmails(data) {
        var booking         = data.booking;
        var assessment      = data.assessment;
        var logger          = data.logger;
        var booker          = data.booker;
        var item            = data.item;
        var owner           = data.owner;
        var conversation    = data.conversation;
        var itemMedias      = data.itemMedias;
        var ownerLocations  = data.ownerLocations;
        var bookerLocations = data.bookerLocations;
        var journeys        = data.journeys;

        return Promise
            .resolve()
            .then(() => {
                if (booking.confirmedDate) { // payment done
                    return Promise.all([
                        sendEmailClassicBookingConfirmedToTaker(),
                        sendSmsClassicBookingConfirmedToTaker(),
                        sendEmailClassicBookingConfirmedToOwner() // No SMS to owner here since she has just validated
                    ]);
                } else { // booker has not paid yet
                    return Promise.all([
                        sendEmailClassicPrebookingPendingToTaker(),
                        sendSmsClassicPrebookingPendingToTaker(),
                        sendEmailClassicPrebookingConfirmedToOwner()
                    ]);
                }
            });



        function sendEmailClassicBookingConfirmedToTaker() {
            return EmailTemplateService
                .sendEmailTemplate('booking-confirmed-taker', {
                    user: booker,
                    item: item,
                    booking: booking,
                    conversation: conversation,
                    itemMedias: itemMedias,
                    owner: owner,
                    assessment: assessment,
                    ownerLocations: ownerLocations,
                    takerLocations: bookerLocations,
                    journeys: journeys
                })
                .catch(err => {
                    // not critical
                    logger.error({ err: err }, "send email booking confirmed to booker");
                });
        }

        function sendSmsClassicBookingConfirmedToTaker() {
            return SmsTemplateService.sendSmsTemplate('booking-confirmed-taker', {
                user: booker,
                item,
                booking,
            })
            .catch(err => {
                // This SMS is critical but not enough to prevent booking...
                logger.error({ err: err }, "WARNING : send sms booking confirmed to booker");
            });
        }

        function sendEmailClassicBookingConfirmedToOwner() {
            // (full info since booking is paid)
            return EmailTemplateService
                .sendEmailTemplate('booking-confirmed-owner', {
                    user: owner,
                    item: item,
                    booking: booking,
                    itemMedias: itemMedias,
                    booker: booker,
                    ownerLocations: ownerLocations,
                    journeys: journeys,
                    conversation: conversation
                })
                .catch(err => {
                    // not critical
                    logger.error({ err: err }, "send email booking confirmed to owner");
                });
        }

        function sendEmailClassicPrebookingPendingToTaker() {
            // Taker ('booker') call to action
            return EmailTemplateService
                .sendEmailTemplate('prebooking-pending-taker', {
                    user: booker,
                    item: item,
                    booking: booking,
                    conversation: conversation,
                    itemMedias: itemMedias,
                    giver: owner,
                    giverMessage: giverMessage
                })
                .catch(err => {
                    // not critical
                    logger.error({ err: err }, "send email prebooking pending to booker");
                });
        }

        function sendSmsClassicPrebookingPendingToTaker() {
            return SmsTemplateService
                .sendSmsTemplate('prebooking-pending-taker', {
                    user: booker,
                    item,
                    booking,
                })
                .catch(err => {
                    // not critical enough to prevent validation
                    logger.error({ err: err }, "WARNING : send sms prebooking pending to owner");
                });
        }

        function sendEmailClassicPrebookingConfirmedToOwner() {
            return EmailTemplateService
                .sendEmailTemplate('prebooking-confirmed-owner', {
                    user: owner,
                    item: item,
                    booking: booking,
                    conversation: conversation,
                    itemMedias: itemMedias,
                    booker: booker
                })
                .catch(err => {
                    // not critical
                    logger.error({ err: err }, "send email prebooking confirmed to owner");
                });
        }
    }
}

function createContractToken(req, res) {
    var id = req.param("id");

    var now = moment().toISOString();

    Promise
        .resolve()
        .then(() => {
            return [
                Booking.findOne({ id: id }),
                GeneratorService.getRandomString(20),
                Token
                    .findOne({
                        type: "bookingContract",
                        userId: req.user.id,
                        targetType: "booking",
                        targetId: id,
                    })
                    .sort({ createdDate: -1 })
            ];
        })
        .spread((booking, randomString, token) => {
            if (! booking) {
                throw new NotFoundError();
            }

            if (token && now < moment(token.createdDate).add(1, "h").toISOString()) {
                return token;
            }

            var allowedPeople = [
                booking.ownerId,
                booking.bookerId
            ];

            if (! _.contains(allowedPeople, req.user.id)) {
                throw new ForbiddenError();
            }

            var createAttrs = {
                type: "bookingContract",
                value: randomString,
                userId: req.user.id,
                targetType: "booking",
                targetId: booking.id,
                expirationDate: moment().add(1, "d").toISOString()
            };

            return Token.create(createAttrs);
        })
        .then(token => {
            res.json({
                value: token.value,
                expirationDate: token.expirationDate
            });
        })
        .catch(res.sendError);
}

function getContract(req, res) {
    var id = req.param("id");
    var tokenValue = req.param("t");
    var conversation;

    if (! tokenValue) {
        return sendErrorView(new ForbiddenError());
    }

    Promise
        .resolve()
        .then(() => {
            return [
                Booking.findOne({ id: id }),
                Token.findOne({
                    type: "bookingContract",
                    targetType: "booking",
                    targetId: id,
                    value: tokenValue
                }),
                Conversation.findOne({ bookingId: id })
            ];
        })
        .spread((booking, token, conv) => {
            conversation = conv;

            if (! booking) {
                throw new NotFoundError();
            }
            if (! token) {
                throw new ForbiddenError();
            }
            if (token.expirationDate < moment().toISOString()) {
                throw new ForbiddenError("token expired");
            }

            return [
                ContractService.getContractFilepath(booking, token.userId),
                ContractService.getContractName() + ".pdf",
                token
            ];
        })
        .spread((filepath, filename, token) => {
            return sendStelaceEvent(req, res, token.userId, id)
                .then(() => [filepath, filename]);
        })
        .spread((filepath, filename) => {
            var escapedFilename = encodeURIComponent(filename);

            var headers = {
                "Content-Disposition": `inline; filename="${escapedFilename}"`,
                "X-Robots-Tag": "noindex"
            };

            res
                .set(headers)
                .sendfile(filepath, null, function () {
                    fs
                        .unlinkAsync(filepath)
                        .catch(() => { return; });
                });
        })
        .catch(err => sendErrorView(err));



    function sendStelaceEvent(req, res, userId, bookingId) {
        var config = {
            req: req,
            res: res,
            label: "Contract view",
            defaultUserId: userId,
            data: { bookingId: bookingId }
        };

        return StelaceEventService.createEvent(config);
    }

    function sendErrorView(err) {
        var body = "";

        if (err.message === "token expired") {
            var conversationId = (conversation && conversation.id) || "";
            var conversationUrl = "/inbox" + (conversationId ? "/" + conversationId : "");

            body += "L'URL du contrat a expiré. Vous allez être redirigé dans quelques instants...";
            body += getRedirectURLScript(conversationUrl);

            res.ok(getHtml(body));
        } else if (err instanceof ForbiddenError) {
            body += "L'URL du contrat est incorrecte. Vous allez être redirigé dans quelques instants...";
            body += getRedirectURLScript("/");

            res.send(403, getHtml(body));
        } else {
            req.logger.error({
                err: err,
                bookingId: id
            }, "Booking contract fail");

            body += "Une erreur est survenue. Veuillez réessayer plus tard.<br>";
            body += "Vous allez être redirigé dans quelques instants...";
            body += getRedirectURLScript("/");

            res.send(505, getHtml(body));
        }
    }

    function getHtml(body) {
        return `
            <!DOCTYPE html>
            <html lang="fr">
                <head>
                    <title>Contrat</title>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                    <meta name="robots" content="noindex">
                </head>

                <body>
                    ${body}
                </body>
            </html>
        `;
    }

    function getRedirectURLScript(url, timeout) {
        timeout = timeout || 5000;

        return `
            <script>
                setTimeout(function () { window.location.replace("${url}") }, ${timeout});
            </script>
        `;
    }
}
