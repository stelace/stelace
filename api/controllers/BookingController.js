/* global
    Assessment, AssessmentService, Booking, BookingService, BookingGamificationService,
    Cancellation, CancellationService, ContractService, Conversation,
    EmailTemplateService, FileCachingService, GeneratorService, Listing, Location, Message,
    ModelSnapshot, PaymentMangopayService, PaymentService, SmsTemplateService,
    StelaceConfigService, StelaceEventService, Token, TransactionService, User
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
    accept: accept,
    cancel: cancel,

    payment: payment,
    paymentSecure: paymentSecure,

    createContractToken: createContractToken,
    getContract: getContract
};

var moment    = require('moment');
var path      = require('path');
var fs        = require('fs');
const _ = require('lodash');
const Promise = require('bluebird');
const createError = require('http-errors');
const appendQuery = require('append-query');

// TODO: use this cache to send message server-side during payment
// Rather than relying on client-side booking-confirmation view
var messageCache;

Promise.promisifyAll(fs);

function initMessageCache(sails) {
    return Promise.coroutine(function* () {
        if (messageCache) {
            return;
        }

        messageCache = FileCachingService.getCache({
            filepath: path.join(sails.config.tmpDir, "bookingPaymentMessages.json")
        });

        yield messageCache.loadFromFile();
    })();
}

function find(req, res) {
    return res.forbidden();
}

async function findOne(req, res) {
    var id = req.param("id");
    var access;

    var booking = await Booking.findOne({ id: id });
    if (! booking) {
        throw createError(404);
    }

    const config = await StelaceConfigService.getConfig();

    var result = await Promise.props({
        listingSnapshot: ModelSnapshot.fetch(booking.listingSnapshotId),
        cancellation: booking.cancellationId ? Cancellation.findOne({ id: booking.cancellationId }) : null
    });

    var listingSnapshot = result.listingSnapshot;
    var cancellation = result.cancellation;

    if (! listingSnapshot
        || (booking.cancellationId && ! cancellation)
    ) {
        throw createError(404);
    }

    if (booking.ownerId === req.user.id) {
        access = "owner";
    } else if (booking.takerId === req.user.id) {
        access = "self";
    }

    var b = Booking.expose(booking, access);
    b.listingSnapshot = Listing.expose(listingSnapshot, "others", { locale: config.lang, fallbackLocale: config.lang });
    if (cancellation) {
        b.cancellation = Cancellation.expose(cancellation, "others");
    }

    res.json(b);
}

async function create(req, res) {
    const attrs = req.allParams();
    const access = 'self';

    attrs.user = req.user;

    if (typeof attrs.listingId !== 'undefined') {
        attrs.listingId = parseInt(attrs.listingId, 10);
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
    var asTypes = ["taker", "owner"];
    var access;
    var findAttrs;

    if (! as || ! _.contains(asTypes, as)) {
        return res.badRequest();
    }

    if (as === "taker") {
        access = "self";
        findAttrs = { takerId: req.user.id };
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

/**
 * Accept booking
 * Handle message creation and confirmation email
 * @param {object}  req
 * @param {object}  [params.userMessage]  - validation message (for bookingConfirmiedTaker email)
 * @param {object}  res
 *
 * @return {object} res.json
 */
async function accept(req, res) {
    const id           = req.param("id");
    const giverMessage = req.param("userMessage");
    const access       = "owner";

    const now = moment().toISOString();

    try {
        let booking = await Booking.findOne({ id });
        if (!booking) {
            throw createError(404);
        }
        // the booking cannot be accepted by the current user
        if (Booking.getAgreementUserId(booking) !== req.user.id) {
            throw createError(403);
        }
        // booking cancelled or already accepted
        if (booking.cancellationId || booking.acceptedDate) {
            throw createError(400);
        }
        if (Booking.isValidationTooLate(booking, now)) {
            throw createError(400, 'Validation too late');
        }

        const { ASSESSMENTS } = booking.listingType.properties;

        let assessment;

        if (ASSESSMENTS !== 'NONE') {
            assessment = await AssessmentService.createAssessment({
                booking,
                type: 'start',
            });

            await Conversation.update(
                { bookingId: booking.id },
                { inputAssessmentId: assessment.id },
            );
        }

        // const data = {
        //     booking,
        //     assessment,
        //     giverMessage,
        //     logger: req.logger,
        // };

        // await _sendBookingConfirmedEmailsSms(data); // TODO: rework email (assessment not always created now)

        // cancel other bookings that overlaps this booking that is paid and accepted by owner
        if (booking.paidDate) {
            await CancellationService
                .cancelOtherBookings(booking, req.logger)
                .catch(err => {
                    req.logger.error({
                        err: err,
                        bookingId: booking.id
                    }, "Fail cancelling other bookings");
                });
        }

        if (giverMessage && giverMessage.privateContent && giverMessage.senderId) {
            await Message.createMessage(booking.ownerId, giverMessage, { logger: req.logger });
        }

        const updateAttrs = { acceptedDate: now };

        const futureStateBooking = Object.assign({}, updateAttrs, booking); // get the booking as if it were after update
        if (Booking.isComplete(futureStateBooking)) {
            updateAttrs.completedDate = now;
        }

        booking = await Booking.updateOne(booking.id, updateAttrs);

        await StelaceEventService.createEvent({
            req: req,
            res: res,
            label: 'booking.accepted',
            type: 'core',
            bookingId: booking.id,
            targetUserId: booking.takerId,
            listingId: booking.listingId,
        });

        BookingGamificationService.afterBookingPaidAndAccepted(booking, req.logger, req);

        res.json(Booking.expose(booking, access));
    } catch (err) {
        res.sendError(err);
    }
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
            throw createError(404);
        }
        if (booking.cancellationId) {
            throw createError(400, 'Booking already cancelled');
        }
        if ((req.user.id === booking.ownerId && reasonType !== "rejected")) {
            throw createError(400);
        }

        if (giverMessage && giverMessage.privateContent && giverMessage.senderId) {
            yield Message.createMessage(booking.ownerId, giverMessage, { logger: req.logger });
        }

        var trigger;
        if (req.user.id === booking.takerId) {
            trigger = "taker";
        } else if (req.user.id === booking.ownerId) {
            trigger = "owner";
        }

        booking = yield CancellationService.cancelBooking(booking, null, {
            reasonType: reasonType,
            trigger: trigger,
        });

        yield StelaceEventService.createEvent({
            req: req,
            res: res,
            label: 'booking.rejected',
            type: 'core',
            bookingId: booking.id,
            targetUserId: booking.takerId,
            listingId: booking.listingId,
        });

        if (req.user.id === booking.takerId) {
            access = "self";
        } else if (req.user.id === booking.ownerId) {
            access = "owner";
        }

        res.json(Booking.expose(booking, access));
    })()
    .catch(res.sendError);
}

async function payment(req, res) {
    const id        = req.param('id');
    const cardId    = req.param('cardId');
    const operation = req.param('operation'); // Payment operation type ("payment", "deposit", "deposit-payment")
    const message   = req.param('userMessage'); // Rejection message privateContent (for future email use)

    const access = 'self';

    if (! operation || !_.includes(['payment', 'deposit', 'deposit-payment'], operation)) {
        throw createError(400);
    }

    await initMessageCache(sails);

    const booking = await Booking.findOne({ id });

    if (! booking) {
        throw createError(404);
    }
    if (req.user.id !== booking.takerId) {
        throw createError(403);
    }
    // if booking is already paid or cancelled
    if (booking.paidDate
     || booking.cancellationId
     || Booking.isPaymentDone(booking, operation)
    ) {
        throw createError(400);
    }

    const hashBookingsManagers = await TransactionService.getBookingTransactionsManagers([id]);
    const transactionManager = hashBookingsManagers[booking.id];

    // store booking message for emails sent before message creation in booking-confirmation view
    if (operation !== 'payment') { // payment in booking-confirmation view
        messageCache.set(booking.id, message);
    }

    const skipPayment = Booking.shouldPaymentBeSkipped(booking, operation, transactionManager);

    if (!skipPayment) {
        const result = await PaymentService.createPreauthorization({
            booking,
            cardId,
            operation,
            req,
            logger: req.logger,
        });

        // 3DSecure redirection for example
        if (result.redirectUrl) {
            return res.json({
                redirectURL: result.redirectUrl,
            });
        }

        await PaymentService.afterPreauthorizationReturn({
            booking,
            providerData: result.providerData,
            operation,
            req,
        });
    }

    const updatedBooking = await _afterPaymentSuccess({
        booking,
        operation,
        req,
        res,
        logger: req.logger,
    });

    res.json(Booking.expose(updatedBooking, access));
}

async function paymentSecure(req, res) {
    const id = req.param("id");
    const preauthorizationId = req.param("preAuthorizationId");
    const tokenValue = req.param("v");
    const tokenType = req.param("t");
    const userId = req.param("u");

    let redirectUrl = '/booking-confirmation/' + id;

    try {
        const allowedTokenTypes = [
            'depositSecure',
            'paymentSecure',
            'depositPaymentSecure',
        ];

        if (!tokenType
         || !_.includes(allowedTokenTypes, tokenType)
        ) {
            throw createError('Bad token', {
                errorType: 'badRequest',
            });
        }

        const getToken = async () => {
            const [token] = await Token
                .find({
                    value: tokenValue,
                    userId,
                    type: tokenType,
                })
                .limit(1);

            return token;
        };

        const [
            booking,
            token,
            taker,
        ] = await Promise.all([
            Booking.findOne({ id }),
            getToken(),
            User.findOne({ id: userId }),
        ]);

        let operation;

        if (tokenType === 'depositSecure') {
            operation = 'deposit';
        } else if (tokenType === 'paymentSecure') {
            operation = 'payment';
        } else { // tokenType === 'depositPaymentSecure'
            operation = 'deposit-payment';
        }

        if (! booking
         || ! token
         || ! taker
        ) {
            throw createError('Missing objects', {
                errorType: 'badRequest',
            });
        }

        if (booking.cancellationId
         || booking.takerId !== taker.id
         || Booking.isPaymentDone(booking, operation)
        ) {
            throw createError('Booking should not be paid', {
                errorType: 'badRequest',
            });
        }

        if (booking.paymentProvider === 'mangopay') {
            const preauthorization = await PaymentMangopayService.fetchPreauthorization(preauthorizationId);

            await PaymentService.afterPreauthorizationReturn({
                booking,
                providerData: { preauthorization },
                operation,
                req,
            });
        }

        await _afterPaymentSuccess({
            booking,
            operation,
            req,
            res,
            logger: req.logger,
        });

        res.redirect(redirectUrl);
    } catch (err) {
        const queryObj = {};

        if (err.errorType) {
            queryObj.error = err.errorType;
        }
        if (err.resultCode) {
            queryObj.resultCode = err.resultCode;
        }

        if (!Object.keys(queryObj).length) {
            queryObj.error = 'other';
        }

        redirectUrl = appendQuery(redirectUrl, queryObj);
        req.logger.error({ err });

        res.redirect(redirectUrl);
    }
}

async function _afterPaymentSuccess({
    booking,
    operation,
    req,
    res,
    logger,
}) {
    const updatedBooking = await PaymentService.afterPaymentSuccess({
        booking,
        operation,
        req,
        res,
        logger,
    });

    if (updatedBooking.paidDate) {
        try {
            await _sendBookingPendingEmailsSms({
                booking,
                logger: req.logger,
            });
        } catch (err) {
            // do nothing
        }
    }

    return updatedBooking;
}

/**
 * @param data
 * - *booking
 * - *logger
 * - listing
 * - taker
 */
function _sendBookingPendingEmailsSms(data) {
    var booking = data.booking;
    var logger  = data.logger;
    var listing = data.listing;
    var taker   = data.taker;
    var message = messageCache.get(booking.id);

    var error;

    return Promise
        .resolve()
        .then(() => {
            if (! booking) {
                throw new Error("missing args");
            }

            return getData(booking, listing, taker, logger);
        })
        .then(data => {
            return getConversation(booking, message, logger)
                .then(conversation => {
                    data.conversation = conversation;
                    return data;
                });
        })
        .then(sendEmails);



    function getData(booking, listing, taker, logger) {
        var data         = {};

        return Promise
            .resolve()
            .then(() => {

                return [
                    ! listing ? Listing.findOne({ id: booking.listingId }) : listing,
                    User.findOne({ id: booking.ownerId }),
                    ! taker ? User.findOne({ id: booking.takerId }) : taker
                ];
            })
            .spread((listing, owner, taker) => {
                if (! listing
                    || ! taker
                    || ! owner
                ) {
                    error = new Error("Booking confirm missing references");
                    if (! listing) {
                        error.listingId = booking.listingId;
                    }
                    if (! owner) {
                        error.ownerId = booking.ownerId;
                    }
                    throw error;
                }

                data.booking      = booking;
                data.listing      = listing;
                data.owner        = owner;
                data.taker        = taker;
                data.logger       = logger;

                return Listing
                    .getMedias([listing])
                    .then(hashMedias => hashMedias[listing.id])
                    .catch(err => {
                        logger.error({ err: err }); // not critical
                        return [];
                    });
            })
            .then(listingMedias => {
                data.listingMedias = listingMedias;
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
            listingId: booking.listingId,
            listingTypeId: booking.listingTypeId,
            bookingId: booking.id,
            senderId: booking.takerId,
            receiverId: booking.ownerId,
            startDate: booking.startDate,
            endDate: booking.endDate,
            bookingStatus: "booking",
            agreementStatus: booking.acceptedDate ? "agreed" : "pending", // "agreed" possible if pre-booking
            privateContent: message.privateContent,
            publicContent: message.publicContent
        };
        var messageParams = {
            skipEmailAndSms: true,
            allowEmptyConversation: true,
            emptyConversationMeta: message,
            logger: logger
        };
        return Message.createMessage(booking.takerId, messageAttrs, messageParams)
            .then((message) => {
                messageCache.unset(booking.id);

                return Conversation
                    .findOne({ id: message.conversationId });
            });
    }

    function sendEmails(data) {
        var booking      = data.booking;
        var listing      = data.listing;
        var owner        = data.owner;
        var taker        = data.taker;
        var listingMedias = data.listingMedias;
        var conversation = data.conversation;
        var logger       = data.logger;

        return Promise
            .resolve()
            .then(() => {
                // Only send pending emails to both owner and taker and SMS to owner if owner has not accepted yet (payment -i.e. confirmation- first)
                if (! booking.acceptedDate) {
                    return Promise.all([
                        sendEmailBookingPendingToTaker(),
                        sendEmailBookingPendingToOwner(),
                        sendSmsBookingPendingToOwner()
                    ]);
                } else { // Booking was pre-accepted by owner so that payment concludes transaction
                    return sendEmailAndSmsBookingConfirmed();
                }
            });



        function sendEmailBookingPendingToTaker() {
            return EmailTemplateService
                .sendEmailTemplate('booking-pending-taker', {
                    user: taker,
                    listing: listing,
                    booking: booking,
                    listingMedias: listingMedias,
                    owner: owner,
                    conversation: conversation
                })
                .catch(err => {
                    // not critical
                    logger.error({ err: err }, "send email pending booking to taker");
                });
        }

        function sendEmailBookingPendingToOwner() {
            return EmailTemplateService
                .sendEmailTemplate('booking-pending-owner', {
                    user: owner,
                    listing: listing,
                    booking: booking,
                    listingMedias: listingMedias,
                    taker: taker,
                    conversation: conversation
                })
                .catch(err => {
                    // critical but not enough to prevent booking...
                    logger.error({ err: err }, "WARNING : send email pending booking to owner");
                });
        }

        function sendSmsBookingPendingToOwner() {
            if (owner.phoneCheck) { // owner.phone is not automatically checked
                return SmsTemplateService
                    .sendSmsTemplate('booking-pending-owner', {
                        user: owner,
                        listing,
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

        async function sendEmailAndSmsBookingConfirmed() {
            var findAssessmentAttrs = {
                listingId: booking.listingId,
                startBookingId: booking.id, // only startBooking is relevant for (taker's) signToken
                takerId: booking.takerId,
                ownerId: booking.ownerId
            };

            const [assessment] = await Assessment
                .find(findAssessmentAttrs)
                .limit(1);

            if (!assessment) {
                throw new Error('Fail to get assessment for booking confirm emails');
            }

            const res = await _sendBookingConfirmedEmailsSms({
                booking: booking,
                assessment: assessment,
                logger: logger
            });

            return res;
        }
    }
}

/**
 * @param data
 * - *booking
 * - assessment            - not always available (ASSESSMENTS === 'NONE')
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
                    User.findOne({ id: booking.takerId }),
                    Listing.findOne({ id: booking.listingId }),
                    User.findOne({ id: booking.ownerId }),
                    Conversation.findOne({ bookingId: booking.id })
                ];
            })
            .spread((taker, listing, owner, conversation) => {
                if (! taker
                    || ! listing
                    || ! owner
                    || ! conversation
                ) {
                    error = new Error("Booking validate missing references");
                    if (! listing) {
                        error.listingId = booking.listingId;
                    }
                    if (! taker) {
                        error.takerId = booking.takerId;
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
                data.taker        = taker;
                data.listing      = listing;
                data.owner        = owner;
                data.conversation = conversation;

                return [
                    data,
                    Listing.getMedias([listing]).then(listingMedias => listingMedias[listing.id]).catch(() => []),
                    Location.find({ userId: owner.id }).catch(() => []),
                    Location.find({ userId: taker.id }).catch(() => [])
                ];
            })
            .spread((data, listingMedias, ownerLocations, takerLocations) => {
                data.listingMedias   = listingMedias;
                data.ownerLocations  = ownerLocations;
                data.takerLocations  = takerLocations;

                return data;
            });
    }

    function sendEmails(data) {
        var booking         = data.booking;
        var assessment      = data.assessment;
        var logger          = data.logger;
        var taker           = data.taker;
        var listing         = data.listing;
        var owner           = data.owner;
        var conversation    = data.conversation;
        var listingMedias   = data.listingMedias;
        var ownerLocations  = data.ownerLocations;
        var takerLocations  = data.takerLocations;

        return Promise
            .resolve()
            .then(() => {
                if (booking.paidDate) { // payment done
                    return Promise.all([
                        sendEmailBookingConfirmedToTaker(),
                        sendSmsBookingConfirmedToTaker(),
                        sendEmailBookingConfirmedToOwner() // No SMS to owner here since she has just validated
                    ]);
                } else { // taker has not paid yet
                    return Promise.all([
                        sendEmailPrebookingPendingToTaker(),
                        sendSmsPrebookingPendingToTaker(),
                        sendEmailPrebookingConfirmedToOwner()
                    ]);
                }
            });



        function sendEmailBookingConfirmedToTaker() {
            return EmailTemplateService
                .sendEmailTemplate('booking-confirmed-taker', {
                    user: taker,
                    listing: listing,
                    booking: booking,
                    conversation: conversation,
                    listingMedias: listingMedias,
                    owner: owner,
                    assessment: assessment,
                    ownerLocations: ownerLocations,
                    takerLocations: takerLocations,
                })
                .catch(err => {
                    // not critical
                    logger.error({ err: err }, "send email booking confirmed to taker");
                });
        }

        function sendSmsBookingConfirmedToTaker() {
            return SmsTemplateService.sendSmsTemplate('booking-confirmed-taker', {
                user: taker,
                listing,
                booking,
            })
            .catch(err => {
                // This SMS is critical but not enough to prevent booking...
                logger.error({ err: err }, "WARNING : send sms booking confirmed to taker");
            });
        }

        function sendEmailBookingConfirmedToOwner() {
            // (full info since booking is paid)
            return EmailTemplateService
                .sendEmailTemplate('booking-confirmed-owner', {
                    user: owner,
                    listing: listing,
                    booking: booking,
                    listingMedias: listingMedias,
                    taker: taker,
                    ownerLocations: ownerLocations,
                    conversation: conversation
                })
                .catch(err => {
                    // not critical
                    logger.error({ err: err }, "send email booking confirmed to owner");
                });
        }

        function sendEmailPrebookingPendingToTaker() {
            // Taker call to action
            return EmailTemplateService
                .sendEmailTemplate('prebooking-pending-taker', {
                    user: taker,
                    listing: listing,
                    booking: booking,
                    conversation: conversation,
                    listingMedias: listingMedias,
                    giver: owner,
                    giverMessage: giverMessage
                })
                .catch(err => {
                    // not critical
                    logger.error({ err: err }, "send email prebooking pending to taker");
                });
        }

        function sendSmsPrebookingPendingToTaker() {
            return SmsTemplateService
                .sendSmsTemplate('prebooking-pending-taker', {
                    user: taker,
                    listing,
                    booking,
                })
                .catch(err => {
                    // not critical enough to prevent validation
                    logger.error({ err: err }, "WARNING : send sms prebooking pending to owner");
                });
        }

        function sendEmailPrebookingConfirmedToOwner() {
            return EmailTemplateService
                .sendEmailTemplate('prebooking-confirmed-owner', {
                    user: owner,
                    listing: listing,
                    booking: booking,
                    conversation: conversation,
                    listingMedias: listingMedias,
                    taker: taker
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
            const getToken = async () => {
                const [token] = await Token
                    .find({
                        type: 'bookingContract',
                        userId: req.user.id,
                        targetType: 'booking',
                        targetId: id,
                    })
                    .sort('createdDate DESC')
                    .limit(1);

                return token;
            };

            return [
                Booking.findOne({ id: id }),
                GeneratorService.getRandomString(20),
                getToken(),
            ];
        })
        .spread((booking, randomString, token) => {
            if (! booking) {
                throw createError(404);
            }

            if (token && now < moment(token.createdDate).add(1, "h").toISOString()) {
                return token;
            }

            var allowedPeople = [
                booking.ownerId,
                booking.takerId
            ];

            if (! _.contains(allowedPeople, req.user.id)) {
                throw createError(403);
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

// TODO: enable booking contract with the listing type
function getContract(req, res) {
    var id = req.param("id");
    var tokenValue = req.param("t");
    var conversation;

    if (! tokenValue) {
        return sendErrorView(createError(403));
    }

    Promise
        .resolve()
        .then(() => {
            const getToken = async () => {
                const [token] = await Token
                    .find({
                        type: 'bookingContract',
                        targetType: 'booking',
                        targetId: id,
                        value: tokenValue,
                    })
                    .limit(1);

                return token;
            };

            return [
                Booking.findOne({ id: id }),
                getToken(),
                Conversation.findOne({ bookingId: id })
            ];
        })
        .spread((booking, token, conv) => {
            conversation = conv;

            if (! booking) {
                throw createError(404);
            }
            if (! token) {
                throw createError(403);
            }
            if (token.expirationDate < moment().toISOString()) {
                throw createError(403, 'Token expired');
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
                .sendFile(filepath, null, function () {
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

            res.send(200, getHtml(body));
        } else if (err.status === 403) {
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
