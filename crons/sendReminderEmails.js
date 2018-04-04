/* global
    Assessment, Booking, BootstrapService, Conversation, EmailHelperService, EmailTemplateService, Listing, LoggerService, Media, MicroService
    MonitoringService, Rating, SmsService, TimeService, ToolsService, User
*/

const Sails = require('sails');
const { getConfig } = require('../sailsrc');

var cronTaskName = "sendReminderEmails";

const _ = require('lodash');
const Promise = require('bluebird');
const createError = require('http-errors');

var moment = require('moment');

Sails.load(getConfig(), async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail cron task: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    var logger = LoggerService.getLogger("cron");
    logger = logger.child({ cronTaskName: cronTaskName });

    logger.info("Start cron");

    var now       = moment().toISOString();
    var appDomain = sails.config.stelace.domain;

    return Promise
        .resolve()
        .then(() => {
            var nbEmails = 0;
            var nbSms    = 0;

            // reminder twice a day to have more precision about the email sending moment
            return getBookingsToAccept(now)
                .then(result => {
                    return Promise
                        .resolve(result)
                        .map(obj => {
                            var sendEmail = () => {
                                return Promise
                                    .resolve()
                                    .then(() => sendEmailBookingsToAccept(obj))
                                    .then(() => ++nbEmails)
                                    .catch(err => {
                                        logger.error({
                                            err: err,
                                            bookingId: obj.booking.id
                                        }, "Fail sending email: bookings to accept");
                                    });
                            };

                            var sendSms = () => {
                                return Promise
                                    .resolve()
                                    .then(() => sendSmsBookingsToAccept(obj))
                                    .then(() => ++nbSms)
                                    .catch(err => {
                                        logger.error({
                                            err: err,
                                            bookingId: obj.booking.id
                                        }, "Fail sending sms: bookings to accept");
                                    });
                            };

                            return Promise.all([
                                sendEmail(),
                                sendSms()
                            ]);
                        })
                        .then(() => {
                            logger.info(`Email bookings to accept: ${nbEmails} / ${result.length}`);
                        })
                        .catch(err => {
                            logger.error({ err: err }, "Fail getting bookings to accept");
                        });
                });
        })
        .then(() => {
            if (! isFirstCronOfTheDay(now)) {
                return;
            }

            var nbEmails = 0;

            return getOwnersWithoutBankAccount(now)
                .then(result => {
                    return Promise
                        .resolve(result)
                        .map(obj => {
                            return Promise
                                .resolve()
                                .then(() => sendEmailOwnersWithoutBankAccount(obj))
                                .then(() => ++nbEmails)
                                .catch(err => {
                                    logger.error({
                                        err: err,
                                        bookingId: obj.booking.id,
                                        ownerId: obj.owner.id
                                    }, "Fail sending email: owners without bank account");
                                });
                        })
                        .then(() => {
                            logger.info(`Email owners without bank account: ${nbEmails} / ${result.length}`);
                        })
                        .catch(err => {
                            logger.error({ err: err }, "Fail getting owners without bank account");
                        });
                });
        })
        .then(() => {
            if (! isFirstCronOfTheDay(now)) {
                return;
            }

            var nbEmails = 0;

            return getUpcomingAssessments(now)
                .then(result => {
                    return Promise
                        .resolve(result)
                        .map(obj => {
                            var sendGiver = () => {
                                return Promise
                                    .resolve()
                                    .then(() => sendEmailUpcomingAssessmentsGiver(obj))
                                    .then(() => ++nbEmails)
                                    .catch(err => {
                                        logger.error({
                                            err: err,
                                            assessmentId: obj.assessment.id
                                        }, "Fail sending email: upcoming assessments giver");
                                    });
                            };

                            var sendTaker = () => {
                                return Promise
                                    .resolve()
                                    .then(() => sendEmailUpcomingAssessmentsTaker(obj))
                                    .then(() => ++nbEmails)
                                    .catch(err => {
                                        logger.error({
                                            err: err,
                                            assessmentId: obj.assessment.id
                                        }, "Fail sending email: upcoming assessments taker");
                                    });
                            };

                            return Promise.all([
                                sendGiver(),
                                sendTaker()
                            ]);
                        })
                        .then(() => {
                            logger.info(`Email upcoming assessments: ${nbEmails} / ${result.length * 2}`);
                        })
                        .catch(err => {
                            logger.error({ err: err }, "Fail getting upcoming assessments");
                        });
                });
        })
        .then(() => {
            if (! isFirstCronOfTheDay(now)) {
                return;
            }

            var nbEmails = 0;
            var nbSms    = 0;

            return getLateUnsignedAssessments(now)
                .then(result => {
                    return Promise
                        .resolve(result)
                        .map(obj => {
                            var sendEmail = () => {
                                return Promise
                                    .resolve()
                                    .then(() => sendEmailLateUnsignedAssessments(obj))
                                    .then(() => ++nbEmails)
                                    .catch(err => {
                                        logger.error({
                                            err: err,
                                            assessmentId: obj.assessment.id
                                        }, "Fail sending email: late unsigned assessments");
                                    });
                            };

                            var sendSms = () => {
                                return Promise
                                    .resolve()
                                    .then(() => sendSmsLateUnsignedAssessments(obj))
                                    .then(() => ++nbSms)
                                    .catch(err => {
                                        logger.error({
                                            err: err,
                                            assessmentId: obj.assessment.id
                                        }, "Fail sending sms: late unsigned assessments");
                                    });
                            };

                            return Promise.all([
                                sendEmail(),
                                sendSms()
                            ]);
                        })
                        .then(() => {
                            logger.info(`Email late unsigned assessments: ${nbEmails} / ${result.length}`);
                        })
                        .catch(err => {
                            logger.error({ err: err }, "Fail getting late unsigned assessments");
                        });
                });
        })
        .then(() => {
            if (! isFirstCronOfTheDay(now)) {
                return;
            }

            var nbEmails = 0;

            return getNoRatings(now)
                .then(result => {
                    return Promise
                        .resolve(result)
                        .map(obj => {
                            return Promise
                                .resolve()
                                .then(() => sendEmailNoRatings(obj))
                                .then(() => ++nbEmails)
                                .catch(err => {
                                    logger.error({
                                        err: err,
                                        assessmentId: obj.assessment.id
                                    }, "Fail sending email: no ratings");
                                });
                        })
                        .then(() => {
                            logger.info(`Email no ratings: ${nbEmails} / ${result.length}`);
                        })
                        .catch(err => {
                            logger.error({ err: err }, "Fail getting no ratings");
                        });
                });
        })
        .catch(err => {
            logger.error({ err: err });
        })
        .finally(() => {
            logger.info("End cron");
            sails.lowerSafe();
        });



    function isFirstCronOfTheDay(now) {
        var hour = moment(now).hours();
        return 6 <= hour && hour <= 11;
    }

    // optimal duration after the booking paid date -> 18h
    function getBookingsToAccept(now) {
        return Promise
            .resolve()
            .then(() => {
                var fromDate = moment(now).subtract({ h: 36 }).toISOString();

                return [
                    MonitoringService.getPaidBookings({
                        fromDate: fromDate,
                        accepted: false
                    }),
                    MonitoringService.getPreBookingsToAccept({ fromDate: fromDate })
                ];
            })
            .spread((bookings, prebookings) => {
                bookings = bookings.concat(prebookings);

                bookings = _.filter(bookings, booking => {
                    var refDate = booking.paidDate || booking.createdDate;

                    var minDate = moment(refDate).add(12, "h").toISOString();
                    var maxDate = moment(refDate).add(24, "h").toISOString();

                    return minDate <= now && now < maxDate;
                });

                var takersIds = _.map(bookings, booking => booking.takerId);
                var ownerIds  = _.map(bookings, booking => booking.ownerId);
                var listingsIds  = _.pluck(bookings, "listingId");

                return [
                    bookings,
                    User.find({ id: MicroService.escapeListForQueries(takersIds) }),
                    User.find({ id: MicroService.escapeListForQueries(ownerIds) }),
                    Listing.find({ id: MicroService.escapeListForQueries(listingsIds) }),
                    Conversation.find({ bookingId: _.pluck(bookings, "id") }),
                ];
            })
            .spread((bookings, takers, owners, listings, conversations) => {
                var indexedTakers        = _.indexBy(takers, "id");
                var indexedOwners        = _.indexBy(owners, "id");
                var indexedListings      = _.indexBy(listings, "id");
                var indexedConversations = _.indexBy(conversations, "bookingId");

                var result = _.reduce(bookings, (memo, booking) => {
                    var taker        = indexedTakers[booking.takerId];
                    var owner        = indexedOwners[booking.ownerId];
                    var listing         = indexedListings[booking.listingId];
                    var conversation = indexedConversations[booking.id];

                    let error;

                    if (! taker) {
                        error = createError('Taker not found', {
                            bookingId: booking.id,
                            takerId: booking.takerId,
                        });
                        logger.error({ err: error });
                    }
                    if (! owner) {
                        error = createError('Giver not found', {
                            bookingId: booking.id,
                            ownerId: booking.ownerId,
                        });
                        logger.error({ err: error });
                    }
                    if (! listing) {
                        error = createError('Listing not found', {
                            bookingId: booking.id,
                            listingId: booking.listingId,
                        });
                        logger.error({ err: error });
                    }
                    if (! conversation) {
                        error = createError('Conversation not found', {
                            bookingId: booking.id,
                        });
                        logger.error({ err: error });
                    }

                    if (! error) {
                        var obj = {
                            booking,
                            listing,
                            taker,
                            owner,
                            conversation,
                            mediaId: listing.mediasIds[0]
                        };

                        memo.push(obj);
                    }

                    return memo;
                }, []);

                return [
                    result,
                    Media.find({ id: _.compact(_.pluck(result, "mediaId")) })
                ];
            })
            .spread((result, medias) => {
                var indexedMedias = _.indexBy(medias, "id");

                return _.map(result, obj => {
                    obj.media = indexedMedias[obj.mediaId];
                    return obj;
                });
            });
    }

    function getOwnersWithoutBankAccount(now) {
        var lastCronDate = moment(now).subtract(1, "d").toISOString();

        return Promise
            .resolve()
            .then(() => {
                return Booking.find({
                    takerPrice: { '!=': 0 },
                    or: [
                        { paidDate: { '>': lastCronDate } },
                        { acceptedDate: { '>': lastCronDate } }
                    ],
                    paidDate: { '!=': null },
                    acceptedDate: { '!=': null }
                });
            })
            .then(bookings => {
                return [
                    bookings,
                    User.find({ id: _.pluck(bookings, "ownerId") })
                ];
            })
            .spread((bookings, owners) => {
                var indexedOwners = _.indexBy(owners, "id");

                var result = _.reduce(bookings, (memo, booking) => {
                    var owner = indexedOwners[booking.ownerId];

                    let error;

                    if (! owner) {
                        error = createError('Owner not found', {
                            bookingId: booking.id,
                            ownerId: booking.ownerId,
                        });
                        logger.error({ err: error });
                    }

                    if (! error && ! owner.bankAccountId) {
                        var obj = {
                            booking: booking,
                            owner: owner,
                            bookingId: booking.id,
                            listingId: booking.listingId
                        };

                        memo.push(obj);
                    }

                    return memo;
                }, []);

                return [
                    result,
                    Listing.find({ id: MicroService.escapeListForQueries(_.pluck(result, "listingId")) }),
                    Conversation.find({ bookingId: MicroService.escapeListForQueries(_.pluck(result, "bookingId")) })
                ];
            })
            .spread((result, listings, conversations) => {
                var indexedListings         = _.indexBy(listings, "id");
                var indexedConversations = _.indexBy(conversations, "bookingId");

                result = _.reduce(result, (memo, obj) => {
                    var listing         = indexedListings[obj.booking.listingId];
                    var conversation = indexedConversations[obj.booking.id];

                    let error;

                    if (! listing) {
                        error = createError('Listing not found', {
                            bookingId: obj.booking.id,
                            listingId: obj.booking.listingId,
                        });
                        logger.error({ err: error });
                    }
                    if (! conversation) {
                        error = createError('Conversation not found', {
                            bookingId: obj.booking.id,
                        });
                        logger.error({ err: error });
                    }

                    if (! error) {
                        obj.listing         = listing;
                        obj.conversation = conversation;
                        obj.mediaId      = listing.mediasIds[0];

                        memo.push(obj);
                    }

                    return memo;
                }, []);

                return [
                    result,
                    Media.find({ id: _.compact(_.pluck(result, "mediaId")) })
                ];
            })
            .spread((result, medias) => {
                var indexedMedias = _.indexBy(medias, "id");

                return _.map(result, obj => {
                    obj.media = indexedMedias[obj.mediaId];
                    return obj;
                });
            });
    }

    function getUpcomingAssessments(now) {
        var tomorrow = moment(now).add(1, "d").format("YYYY-MM-DD");

        return Promise
            .resolve()
            .then(() => {
                return MonitoringService.getUnsignedAssessments();
            })
            .then(resultAssessments => {
                var assessments     = resultAssessments.assessments;
                var hashAssessments = resultAssessments.hashAssessments;

                var result = _.map(assessments, assessment => {
                    return {
                        assessment: assessment,
                        conversation: hashAssessments[assessment.id].conversation,
                        takerId: Assessment.getRealTakerId(assessment),
                        giverId: Assessment.getRealGiverId(assessment),
                        listingId: assessment.listingId
                    };
                }, []);

                return [
                    result,
                    MonitoringService.getAssessmentsDueDates(assessments, logger)
                ];
            })
            .spread((result, hashAssessmentsDueDate) => {
                result = _.reduce(result, (memo, obj) => {
                    var dueDate = hashAssessmentsDueDate[obj.assessment.id].dueDate;
                    if (dueDate === tomorrow) {
                        obj.booking = hashAssessmentsDueDate[obj.assessment.id].booking;
                        obj.dueDate = dueDate;
                        memo.push(obj);
                    }
                    return memo;
                }, []);

                return [
                    result,
                    User.find({ id: _.pluck(result, "takerId") }),
                    User.find({ id: _.pluck(result, "giverId") }),
                    Listing.find({ id: _.pluck(result, "listingId") })
                ];
            })
            .spread((result, takers, givers, listings) => {
                var indexedTakers = _.indexBy(takers, "id");
                var indexedGivers = _.indexBy(givers, "id");
                var indexedListings  = _.indexBy(listings, "id");

                result = _.reduce(result, (memo, obj) => {
                    var taker = indexedTakers[obj.takerId];
                    var giver = indexedGivers[obj.giverId];
                    var listing  = indexedListings[obj.listingId];

                    let error;

                    if (! taker) {
                        error = createError('Taker not found', {
                            assessmentId: obj.assessment.id,
                            takerId: obj.takerId,
                        });
                        logger.error({ err: error });
                    }
                    if (! giver) {
                        error = createError('Giver not found', {
                            assessmentId: obj.assessment.id,
                            giverId: obj.giverId,
                        });
                        logger.error({ err: error });
                    }
                    if (! listing) {
                        error = createError('Listing not found', {
                            assessmentId: obj.assessment.id,
                            listingId: obj.listingId,
                        });
                        logger.error({ err: error });
                    }

                    if (! error) {
                        obj.taker   = taker;
                        obj.giver   = giver;
                        obj.listing    = listing;
                        obj.mediaId = listing.mediasIds[0];

                        memo.push(obj);
                    }

                    return memo;
                }, []);

                return [
                    result,
                    Media.find({ id: MicroService.escapeListForQueries(_.pluck(result, "mediaId")) })
                ];
            })
            .spread((result, medias) => {
                var indexedMedias = _.indexBy(medias, "id");

                return _.map(result, obj => {
                    obj.media = indexedMedias[obj.mediaId];
                    return obj;
                });
            });
    }

    function getLateUnsignedAssessments(now) {
        var yesterday = moment(now).subtract(1, "d").format("YYYY-MM-DD");

        return Promise
            .resolve()
            .then(() => {
                return MonitoringService.getUnsignedAssessments();
            })
            .then(resultAssessments => {
                var assessments     = resultAssessments.assessments;
                var hashAssessments = resultAssessments.hashAssessments;

                var result = _.map(assessments, assessment => {
                    return {
                        assessment: assessment,
                        conversation: hashAssessments[assessment.id].conversation,
                        takerId: Assessment.getRealTakerId(assessment),
                        giverId: Assessment.getRealGiverId(assessment),
                        listingId: assessment.listingId
                    };
                }, []);

                return [
                    result,
                    MonitoringService.getAssessmentsDueDates(assessments, logger)
                ];
            })
            .spread((result, hashAssessmentsDueDate) => {
                result = _.reduce(result, (memo, obj) => {
                    var dueDate = hashAssessmentsDueDate[obj.assessment.id].dueDate;
                    if (dueDate === yesterday) {
                        obj.booking = hashAssessmentsDueDate[obj.assessment.id].booking;
                        obj.dueDate = dueDate;
                        memo.push(obj);
                    }
                    return memo;
                }, []);

                return [
                    result,
                    User.find({ id: MicroService.escapeListForQueries(_.pluck(result, "takerId")) }),
                    User.find({ id: MicroService.escapeListForQueries(_.pluck(result, "giverId")) }),
                    Listing.find({ id: MicroService.escapeListForQueries(_.pluck(result, "listingId")) })
                ];
            })
            .spread((result, takers, givers, listings) => {
                var indexedTakers = _.indexBy(takers, "id");
                var indexedGivers = _.indexBy(givers, "id");
                var indexedListings  = _.indexBy(listings, "id");

                result = _.reduce(result, (memo, obj) => {
                    var taker = indexedTakers[obj.takerId];
                    var giver = indexedGivers[obj.giverId];
                    var listing  = indexedListings[obj.listingId];

                    let error;

                    if (! taker) {
                        error = createError('Taker not found', {
                            assessmentId: obj.assessment.id,
                            takerId: obj.takerId,
                        });
                        logger.error({ err: error });
                    }
                    if (! giver) {
                        error = createError('Giver not found', {
                            assessmentId: obj.assessment.id,
                            giverId: obj.giverId,
                        });
                        logger.error({ err: error });
                    }
                    if (! listing) {
                        error = createError('Listing not found', {
                            assessmentId: obj.assessment.id,
                            listingId: obj.listingId,
                        });
                        logger.error({ err: error });
                    }

                    if (! error) {
                        obj.taker   = taker;
                        obj.giver   = giver;
                        obj.listing    = listing;
                        obj.mediaId = listing.mediasIds[0];

                        memo.push(obj);
                    }

                    return memo;
                }, []);

                return [
                    result,
                    Media.find({ id: MicroService.escapeListForQueries(_.pluck(result, "mediaId")) })
                ];
            })
            .spread((result, medias) => {
                var indexedMedias = _.indexBy(medias, "id");

                return _.map(result, obj => {
                    obj.media = indexedMedias[obj.mediaId];
                    return obj;
                });
            });
    }

    function getNoRatings(now) {
        var maxDate      = moment(now).subtract(12, "h").toISOString();
        var periodLimits = TimeService.getPeriodLimits(maxDate, { d: 1 }, "before");

        return Promise
            .resolve()
            .then(() => {
                return Assessment.find({
                    cancellationId: null,
                    signedDate: {
                        '<': periodLimits.max,
                        '>=': periodLimits.min
                    }
                });
            })
            .then(assessments => {
                return Assessment.filterConversationAssessments(assessments);
            })
            .then(resultAssessments => {
                var assessments     = resultAssessments.assessments;
                var hashAssessments = resultAssessments.hashAssessments;

                // get start bookings
                var startBookingsIds = _.reduce(assessments, (memo, assessment) => {
                    if (assessment.startBookingId) {
                        memo.push(assessment.startBookingId);
                    }
                    return memo;
                }, []);

                return [
                    assessments,
                    hashAssessments,
                    Booking.find({ id: startBookingsIds })
                ];
            })
            .spread((assessments, hashAssessments, startBookings) => {
                var indexedBookings = _.indexBy(startBookings, "id");

                assessments = _.filter(assessments, assessment => {
                    var booking;

                    if (assessment.startBookingId) {
                        booking = indexedBookings[assessment.startBookingId];
                        if (! booking) {
                            const error = createError('Booking not found', {
                                assessmentId: assessment.id,
                                bookingId: assessment.startBookingId,
                            });
                            logger.error({ err: error });
                        }

                        // input assessments can be rated for no time bookings
                        if (Booking.isNoTime(booking)) {
                            return true;
                        } else {
                            // only output renting assessments can be rated
                            return hashAssessments[assessment.id].output;
                        }
                    } else {
                        // only output renting assessments can be rated
                        return hashAssessments[assessment.id].output;
                    }
                });

                var result = _.map(assessments, assessment => {
                    return {
                        assessment: assessment,
                        conversation: hashAssessments[assessment.id].conversation
                    };
                });

                return [
                    result,
                    assessments
                ];
            })
            .spread((result, assessments) => {
                return [
                    result,
                    Rating.find({ id: MicroService.escapeListForQueries(_.pluck(assessments, "id")) }),
                    Listing.find({ id: MicroService.escapeListForQueries(_.pluck(assessments, "listingId")) })
                ];
            })
            .spread((result, ratings, listings) => {
                var indexedRatings = _.groupBy(ratings, "assessmentId");
                var indexedListings   = _.indexBy(listings, "id");

                result = _.reduce(result, (memo, obj) => {
                    var assessment = obj.assessment;
                    var listing       = indexedListings[assessment.listingId];
                    var ratings    = indexedRatings[assessment.id] || [];

                    let error;

                    if (! listing) {
                        error = createError('Listing not found', {
                            assessmentId: assessment.id,
                            listingId: assessment.listingId,
                        });
                        logger.error({ err: error });
                    }

                    if (! error) {
                        var mustRatersId = Rating.getRatersIds(assessment); // users that must rate
                        var realRatersId = []; // users that actually rated

                        realRatersId = _.reduce(ratings, (memo2, rating) => {
                            if (_.contains(mustRatersId, rating.userId)
                             && _.contains(mustRatersId, rating.targetId)
                             && Rating.isCompleteRating(rating)
                            ) {
                                memo2.push(rating.userId);
                            }
                            return memo2;
                        }, []);

                        var noRatersIds = _.difference(mustRatersId, realRatersId);

                        _.forEach(noRatersIds, userId => {
                            var newObj = _.clone(obj);

                            newObj.listing     = listing;
                            newObj.userId   = userId;
                            newObj.targetId = _.find(mustRatersId, id => id !== userId);
                            newObj.mediaId  = listing.mediasIds[0];

                            memo.push(newObj);
                        });
                    }

                    return memo;
                }, []);

                return [
                    result,
                    User.find({ id: MicroService.escapeListForQueries(_.pluck(result, "userId")) }),
                    User.find({ id: MicroService.escapeListForQueries(_.pluck(result, "targetId")) }),
                    Media.find({ id: MicroService.escapeListForQueries(_.pluck(result, "mediaId")) })
                ];
            })
            .spread((result, users, targets, medias) => {
                var indexedUsers   = _.indexBy(users, "id");
                var indexedTargets = _.indexBy(targets, "id");
                var indexedMedias  = _.indexBy(medias, "id");

                result = _.reduce(result, (memo, obj) => {
                    var user   = indexedUsers[obj.userId];
                    var target = indexedTargets[obj.targetId];
                    var media  = indexedMedias[obj.mediaId];

                    let error;

                    if (! user) {
                        error = createError('User not found', {
                            assessmentId: obj.assessment.id,
                            userId: obj.userId,
                        });
                        logger.error({ err: error });
                    }
                    if (! target) {
                        error = createError('Target not found', {
                            assessmentId: obj.assessment.id,
                            targetId: obj.targetId,
                        });
                        logger.error({ err: error });
                    }

                    if (! error) {
                        obj.user   = user;
                        obj.target = target;
                        obj.media  = media;

                        memo.push(obj);
                    }

                    return memo;
                }, []);

                return result;
            });
    }

    ////////////////////
    // EMAILS AND SMS //
    ////////////////////
    /**
     * send email bookings to accept
     * @param {object} args
     * @param {object} args.booking
     * @param {object} args.listing
     * @param {object} args.taker
     * @param {object} args.owner
     * @param {object} args.conversation
     * @param {object} [args.media]
     */
    function sendEmailBookingsToAccept(args) {
        var booking      = args.booking;
        var listing         = args.listing;
        var taker        = args.taker;
        var owner        = args.owner;
        var conversation = args.conversation;
        var media        = args.media;

        return EmailTemplateService.sendEmailTemplate('booking_to_accept_owner', {
            user: owner,
            data: {
                owner,
                listing,
                listingMedias: [media],
                taker,
                booking,
                conversation,
            },
        });
    }

    /**
     * send sms bookings to accept
     * @param {object} args
     * @param {object} args.booking
     * @param {object} args.listing
     * @param {object} args.taker
     * @param {object} args.giver
     * @param {object} args.conversation
     * @param {object} [args.media]
     */
    function sendSmsBookingsToAccept(args) {
        var booking      = args.booking;
        var listing         = args.listing;
        var giver        = args.giver;
        var conversation = args.conversation;

        if (! giver.phoneCheck) {
            return;
        }

        var conversationUrl = `${appDomain}/inbox/${conversation.id}`;
        var listingShortName   = ToolsService.shrinkString(listing.name, 32, 4);
        var priceResult     = EmailHelperService.getPriceAfterRebateAndFees(booking);
        var ownerNetIncome  = _.get(priceResult, "ownerNetIncome", 0);

        var isOwner = (booking.ownerId === giver.id);

        var text = `Sharinplace: plus que quelques heures pour accepter la réservation de "${listingShortName}"`;
        if (isOwner && ownerNetIncome) {
            text += ` en échange de ${priceResult.ownerNetIncomeStr}`;

            if (isOwner) {
                text += `, ou pour refuser`;
            }
        }
        text += ` ${conversationUrl}`;

        return SmsService
            .sendTextSms({
                toUserId: giver.id,
                text: text
            });
    }

    /**
     * send email owners without bank account
     * @param {object} args
     * @param {object} args.booking
     * @param {object} args.owner
     * @param {object} args.listing
     * @param {object} args.conversation
     * @param {object} [args.media]
     */
    function sendEmailOwnersWithoutBankAccount(args) {
        var booking      = args.booking;
        var owner        = args.owner;
        var listing         = args.listing;
        var conversation = args.conversation;
        var media        = args.media;

        return EmailTemplateService.sendEmailTemplate('missing_bank_account_owner', {
            user: owner,
            data: {
                owner,
                listing,
                listingMedias: [media],
                booking,
                conversation,
            },
        });
    }

    /**
     * send email upcoming assessments giver
     * @param {object} args
     * @param {object} args.assessment
     * @param {object} args.conversation
     * @param {object} args.booking
     * @param {object} args.dueDate
     * @param {object} args.taker
     * @param {object} args.giver
     * @param {object} args.listing
     * @param {object} [args.media]
     */
    function sendEmailUpcomingAssessmentsGiver(args) {
        var conversation = args.conversation;
        var taker        = args.taker;
        var giver        = args.giver;
        var listing         = args.listing;
        var dueDate      = args.dueDate;
        var media        = args.media;

        return EmailTemplateService.sendEmailTemplate('upcoming_transaction_owner', {
            user: giver,
            data: {
                owner: giver,
                listing,
                listingMedias: [media],
                taker,
                conversation,
                dueDate,
            },
        });
    }

    /**
     * send email upcoming assessments taker
     * @param {object} args
     * @param {object} args.assessment
     * @param {object} args.conversation
     * @param {object} args.booking
     * @param {object} args.dueDate
     * @param {object} args.taker
     * @param {object} args.giver
     * @param {object} args.listing
     * @param {object} [args.media]
     */
    function sendEmailUpcomingAssessmentsTaker(args) {
        var conversation = args.conversation;
        var assessment   = args.assessment;
        var taker        = args.taker;
        var giver        = args.giver;
        var listing         = args.listing;
        var dueDate      = args.dueDate;
        var media        = args.media;

        return EmailTemplateService.sendEmailTemplate('upcoming_transaction_taker', {
            user: taker,
            data: {
                taker,
                listing,
                listingMedias: [media],
                owner: giver,
                conversation,
                assessment,
                dueDate,
            },
        });
    }

    /**
     * send email late unsigned assessments
     * owner signs input assessment and taker signs output one
     * @param {object} args
     * @param {object} args.assessment
     * @param {object} args.booking
     * @param {object} args.conversation
     * @param {object} args.taker
     * @param {object} args.giver
     * @param {object} args.listing
     * @param {object} args.dueDate
     * @param {object} [args.media]
     */
    function sendEmailLateUnsignedAssessments(args) {
        var conversation = args.conversation;
        var booking      = args.booking;
        var taker        = args.taker;
        var giver        = args.giver;
        var listing         = args.listing;
        var dueDate      = args.dueDate;
        var media        = args.media;

        return EmailTemplateService.sendEmailTemplate('late_unsigned_assessment_giver', {
            user: giver,
            data: {
                owner: giver,
                listing,
                listingMedias: [media],
                taker,
                booking,
                conversation,
                dueDate,
            },
        });
    }

    /**
     * send sms late unsigned assessments
     * @param {object} args
     * @param {object} args.assessment
     * @param {object} args.booking
     * @param {object} args.conversation
     * @param {object} args.taker
     * @param {object} args.giver
     * @param {object} args.listing
     * @param {object} args.dueDate
     * @param {object} [args.media]
     */
    function sendSmsLateUnsignedAssessments(args) {
        var conversation = args.conversation;
        var assessment   = args.assessment;
        var booking      = args.booking;
        var giver        = args.giver;
        var listing         = args.listing;

        // not signing end assessment is not critical
        if (assessment.endBookingId) {
            return;
        }

        if (! giver.phoneCheck) {
            return;
        }

        var isOwner = (booking.ownerId === giver.id);

        var conversationUrl = `${appDomain}/inbox/${conversation.id}`;
        var listingShortName   = ToolsService.shrinkString(listing.name, 32, 4);
        var priceResult     = EmailHelperService.getPriceAfterRebateAndFees(booking);
        var ownerNetIncome  = _.get(priceResult, "ownerNetIncome", 0);

        var text = `Sharinplace: état des lieux en attente de votre signature "${listingShortName}"`;
        if (isOwner && ownerNetIncome) {
            text += ` pour recevoir vos ${priceResult.ownerNetIncomeStr}`;
        }
        text += ` ${conversationUrl}`;

        return SmsService
            .sendTextSms({
                toUserId: giver.id,
                text: text
            });
    }

    /**
     * send email no ratings
     * @param {object} args
     * @param {object} args.assessment
     * @param {object} args.conversation
     * @param {object} args.listing
     * @param {object} args.user
     * @param {object} args.target
     * @param {object} [args.media]
     */
    function sendEmailNoRatings(args) {
        var conversation = args.conversation;
        var listing         = args.listing;
        var user         = args.user;
        var target       = args.target;
        var media        = args.media;

        return EmailTemplateService.sendEmailTemplate('missing_rating', {
            user,
            data: {
                listing,
                listingMedias: [media],
                interlocutor: target,
                conversation,
            },
        });
    }
});
