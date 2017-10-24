/* global
    Assessment, Booking, BootstrapService, Conversation, EmailHelperService, EmailTemplateService, Item, LoggerService, Media,
    MonitoringService, Rating, SmsService, TimeService, ToolsService, User
*/

var Sails = require('sails');

var cronTaskName = "sendReminderEmails";

global._       = require('lodash');
global.Promise = require('bluebird');

var moment = require('moment');

Sails.load({
    models: {
        migrate: "safe"
    },
    hooks: {
        grunt: false,
        sockets: false,
        pubsub: false
    }
}, function (err, sails) {
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
            return getBookingsToValidate(now)
                .then(result => {
                    return Promise
                        .resolve(result)
                        .map(obj => {
                            var sendEmail = () => {
                                return Promise
                                    .resolve()
                                    .then(() => sendEmailBookingsToValidate(obj))
                                    .then(() => ++nbEmails)
                                    .catch(err => {
                                        logger.error({
                                            err: err,
                                            bookingId: obj.booking.id
                                        }, "Fail sending email: bookings to validate");
                                    });
                            };

                            var sendSms = () => {
                                return Promise
                                    .resolve()
                                    .then(() => sendSmsBookingsToValidate(obj))
                                    .then(() => ++nbSms)
                                    .catch(err => {
                                        logger.error({
                                            err: err,
                                            bookingId: obj.booking.id
                                        }, "Fail sending sms: bookings to validate");
                                    });
                            };

                            return Promise.all([
                                sendEmail(),
                                sendSms()
                            ]);
                        })
                        .then(() => {
                            logger.info(`Email bookings to validate: ${nbEmails} / ${result.length}`);
                        })
                        .catch(err => {
                            logger.error({ err: err }, "Fail getting bookings to validate");
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

    // optimal duration after the booking confirmation date -> 18h
    function getBookingsToValidate(now) {
        return Promise
            .resolve()
            .then(() => {
                var fromDate = moment(now).subtract({ h: 36 }).toISOString();

                return [
                    MonitoringService.getPaidBookings({
                        fromDate: fromDate,
                        validated: false
                    }),
                    MonitoringService.getPreBookingsToValidate({ fromDate: fromDate })
                ];
            })
            .spread((bookings, prebookings) => {
                bookings = bookings.concat(prebookings);

                bookings = _.filter(bookings, booking => {
                    var refDate = booking.confirmedDate || booking.createdDate;

                    var minDate = moment(refDate).add(12, "h").toISOString();
                    var maxDate = moment(refDate).add(24, "h").toISOString();

                    return minDate <= now && now < maxDate;
                });

                var takersIds = _.map(bookings, booking => getTakerId(booking));
                var ownerIds  = _.map(bookings, booking => booking.ownerId);
                var itemsIds  = _.pluck(bookings, "itemId");

                return [
                    bookings,
                    User.find({ id: takersIds }),
                    User.find({ id: ownerIds }),
                    Item.find({ id: itemsIds }),
                    Conversation.find({ bookingId: _.pluck(bookings, "id") }),
                ];
            })
            .spread((bookings, takers, owners, items, conversations) => {
                var indexedTakers        = _.indexBy(takers, "id");
                var indexedOwners        = _.indexBy(owners, "id");
                var indexedItems         = _.indexBy(items, "id");
                var indexedConversations = _.indexBy(conversations, "bookingId");

                var result = _.reduce(bookings, (memo, booking) => {
                    var taker        = indexedTakers[getTakerId(booking)];
                    var owner        = indexedOwners[booking.ownerId];
                    var item         = indexedItems[booking.itemId];
                    var conversation = indexedConversations[booking.id];

                    var error;
                    if (! taker) {
                        error = new NotFoundError("Taker not found");
                        error.bookingId = booking.id;
                        error.takerId   = getTakerId(booking);
                        logger.error({ err: error });
                    }
                    if (! owner) {
                        error = new NotFoundError("Giver not found");
                        error.bookingId = booking.id;
                        error.ownerId   = booking.ownerId;
                        logger.error({ err: error });
                    }
                    if (! item) {
                        error = new NotFoundError("Item not found");
                        error.bookingId = booking.id;
                        error.itemId    = booking.itemId;
                        logger.error({ err: error });
                    }
                    if (! conversation) {
                        error = new NotFoundError("Conversation not found");
                        error.bookingId = booking.id;
                        logger.error({ err: error });
                    }

                    if (! error) {
                        var obj = {
                            booking,
                            item,
                            taker,
                            owner,
                            conversation,
                            mediaId: item.mediasIds[0]
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



        function getTakerId(booking) {
            return booking.bookerId;
        }
    }

    function getOwnersWithoutBankAccount(now) {
        var lastCronDate = moment(now).subtract(1, "d").toISOString();

        return Promise
            .resolve()
            .then(() => {
                return Booking.find({
                    takerPrice: { '!': 0 },
                    or: [
                        { confirmedDate: { '>': lastCronDate } },
                        { validatedDate: { '>': lastCronDate } }
                    ],
                    confirmedDate: { '!': null },
                    validatedDate: { '!': null }
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
                    var error;

                    if (! owner) {
                        error = new NotFoundError("Owner not found");
                        error.bookingId = booking.id;
                        error.ownerId   = booking.ownerId;
                        logger.error({ err: error });
                    }

                    if (! error && ! owner.bankAccountId) {
                        var obj = {
                            booking: booking,
                            owner: owner,
                            bookingId: booking.id,
                            itemId: booking.itemId
                        };

                        memo.push(obj);
                    }

                    return memo;
                }, []);

                return [
                    result,
                    Item.find({ id: _.pluck(result, "itemId") }),
                    Conversation.find({ bookingId: _.pluck(result, "bookingId") })
                ];
            })
            .spread((result, items, conversations) => {
                var indexedItems         = _.indexBy(items, "id");
                var indexedConversations = _.indexBy(conversations, "bookingId");

                result = _.reduce(result, (memo, obj) => {
                    var item         = indexedItems[obj.booking.itemId];
                    var conversation = indexedConversations[obj.booking.id];

                    var error;
                    if (! item) {
                        error = new NotFoundError("Item not found");
                        error.bookingId = obj.booking.id;
                        error.itemId    = obj.booking.itemId;
                        logger.error({ err: error });
                    }
                    if (! conversation) {
                        error = new NotFoundError("Conversation not found");
                        error.bookingId = obj.booking.id;
                        logger.error({ err: error });
                    }

                    if (! error) {
                        obj.item         = item;
                        obj.conversation = conversation;
                        obj.mediaId      = item.mediasIds[0];

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
                        itemId: assessment.itemId
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
                    Item.find({ id: _.pluck(result, "itemId") })
                ];
            })
            .spread((result, takers, givers, items) => {
                var indexedTakers = _.indexBy(takers, "id");
                var indexedGivers = _.indexBy(givers, "id");
                var indexedItems  = _.indexBy(items, "id");

                result = _.reduce(result, (memo, obj) => {
                    var taker = indexedTakers[obj.takerId];
                    var giver = indexedGivers[obj.giverId];
                    var item  = indexedItems[obj.itemId];

                    var error;
                    if (! taker) {
                        error = new NotFoundError("Taker not found");
                        error.assessmentId = obj.assessment.id;
                        error.takerId      = obj.takerId;
                        logger.error({ err: error });
                    }
                    if (! giver) {
                        error = new NotFoundError("Giver not found");
                        error.assessmentId = obj.assessment.id;
                        error.giverId      = obj.giverId;
                        logger.error({ err: error });
                    }
                    if (! item) {
                        error = new NotFoundError("Item not found");
                        error.assessmentId = obj.assessment.id;
                        error.itemId       = obj.itemId;
                        logger.error({ err: error });
                    }

                    if (! error) {
                        obj.taker   = taker;
                        obj.giver   = giver;
                        obj.item    = item;
                        obj.mediaId = item.mediasIds[0];

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
                        itemId: assessment.itemId
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
                    User.find({ id: _.pluck(result, "takerId") }),
                    User.find({ id: _.pluck(result, "giverId") }),
                    Item.find({ id: _.pluck(result, "itemId") })
                ];
            })
            .spread((result, takers, givers, items) => {
                var indexedTakers = _.indexBy(takers, "id");
                var indexedGivers = _.indexBy(givers, "id");
                var indexedItems  = _.indexBy(items, "id");

                result = _.reduce(result, (memo, obj) => {
                    var taker = indexedTakers[obj.takerId];
                    var giver = indexedGivers[obj.giverId];
                    var item  = indexedItems[obj.itemId];

                    var error;
                    if (! taker) {
                        error = new NotFoundError("Taker not found");
                        error.assessmentId = obj.assessment.id;
                        error.takerId      = obj.takerId;
                        logger.error({ err: error });
                    }
                    if (! giver) {
                        error = new NotFoundError("Giver not found");
                        error.assessmentId = obj.assessment.id;
                        error.giverId      = obj.giverId;
                        logger.error({ err: error });
                    }
                    if (! item) {
                        error = new NotFoundError("Item not found");
                        error.assessmentId = obj.assessment.id;
                        error.itemId       = obj.itemId;
                        logger.error({ err: error });
                    }

                    if (! error) {
                        obj.taker   = taker;
                        obj.giver   = giver;
                        obj.item    = item;
                        obj.mediaId = item.mediasIds[0];

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
                            var error          = new NotFoundError("Booking not found");
                            error.assessmentId = assessment.id;
                            error.bookingId    = assessment.startBookingId;
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
                    Rating.find({ id: _.pluck(assessments, "id") }),
                    Item.find({ id: _.pluck(assessments, "itemId") })
                ];
            })
            .spread((result, ratings, items) => {
                var indexedRatings = _.groupBy(ratings, "assessmentId");
                var indexedItems   = _.indexBy(items, "id");

                result = _.reduce(result, (memo, obj) => {
                    var assessment = obj.assessment;
                    var item       = indexedItems[assessment.itemId];
                    var ratings    = indexedRatings[assessment.id] || [];

                    var error;
                    if (! item) {
                        error = new NotFoundError("Item not found");
                        error.assessmentId = assessment.id;
                        error.itemId       = assessment.itemId;
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

                            newObj.item     = item;
                            newObj.userId   = userId;
                            newObj.targetId = _.find(mustRatersId, id => id !== userId);
                            newObj.mediaId  = item.mediasIds[0];

                            memo.push(newObj);
                        });
                    }

                    return memo;
                }, []);

                return [
                    result,
                    User.find({ id: _.pluck(result, "userId") }),
                    User.find({ id: _.pluck(result, "targetId") }),
                    Media.find({ id: _.pluck(result, "mediaId") })
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

                    var error;
                    if (! user) {
                        error = new NotFoundError("User not found");
                        error.assessmentId = obj.assessment.id;
                        error.userId       = obj.userId;
                        logger.error({ err: error });
                    }
                    if (! target) {
                        error = new NotFoundError("Target not found");
                        error.assessmentId = obj.assessment.id;
                        error.targetId     = obj.targetId;
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
     * send email bookings to validate
     * @param {object} args
     * @param {object} args.booking
     * @param {object} args.item
     * @param {object} args.taker
     * @param {object} args.owner
     * @param {object} args.conversation
     * @param {object} [args.media]
     */
    function sendEmailBookingsToValidate(args) {
        var booking      = args.booking;
        var item         = args.item;
        var taker        = args.taker;
        var owner        = args.owner;
        var conversation = args.conversation;
        var media        = args.media;

        return EmailTemplateService.sendEmailTemplate('booking-to-validate-owner', {
            user: owner,
            item: item,
            itemMedias: [media],
            taker: taker,
            booking: booking,
            conversation: conversation
        });
    }

    /**
     * send sms bookings to validate
     * @param {object} args
     * @param {object} args.booking
     * @param {object} args.item
     * @param {object} args.taker
     * @param {object} args.giver
     * @param {object} args.conversation
     * @param {object} [args.media]
     */
    function sendSmsBookingsToValidate(args) {
        var booking      = args.booking;
        var item         = args.item;
        var giver        = args.giver;
        var conversation = args.conversation;

        if (! giver.phoneCheck) {
            return;
        }

        var conversationUrl = `${appDomain}/inbox/${conversation.id}`;
        var itemShortName   = ToolsService.shrinkString(item.name, 32, 4);
        var priceResult     = EmailHelperService.getPriceAfterRebateAndFees(booking);
        var ownerNetIncome  = _.get(priceResult, "ownerNetIncome", 0);

        var isOwner = (booking.ownerId === giver.id);

        var text = `Sharinplace: plus que quelques heures pour accepter la réservation de "${itemShortName}"`;
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
     * @param {object} args.item
     * @param {object} args.conversation
     * @param {object} [args.media]
     */
    function sendEmailOwnersWithoutBankAccount(args) {
        var booking      = args.booking;
        var owner        = args.owner;
        var item         = args.item;
        var conversation = args.conversation;
        var media        = args.media;

        return EmailTemplateService.sendEmailTemplate('missing-bank-account-owner', {
            user: owner,
            item: item,
            itemMedias: [media],
            booking: booking,
            conversation: conversation
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
     * @param {object} args.item
     * @param {object} [args.media]
     */
    function sendEmailUpcomingAssessmentsGiver(args) {
        var conversation = args.conversation;
        var taker        = args.taker;
        var giver        = args.giver;
        var item         = args.item;
        var dueDate      = args.dueDate;
        var media        = args.media;

        return EmailTemplateService.sendEmailTemplate('upcoming-assessment-giver', {
            user: giver,
            item: item,
            itemMedias: [media],
            taker: taker,
            conversation: conversation,
            dueDate: dueDate
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
     * @param {object} args.item
     * @param {object} [args.media]
     */
    function sendEmailUpcomingAssessmentsTaker(args) {
        var conversation = args.conversation;
        var assessment   = args.assessment;
        var taker        = args.taker;
        var giver        = args.giver;
        var item         = args.item;
        var dueDate      = args.dueDate;
        var media        = args.media;

        return EmailTemplateService.sendEmailTemplate('upcoming-assessment-taker', {
            user: taker,
            item: item,
            itemMedias: [media],
            giver: giver,
            conversation: conversation,
            assessment: assessment,
            dueDate: dueDate
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
     * @param {object} args.item
     * @param {object} args.dueDate
     * @param {object} [args.media]
     */
    function sendEmailLateUnsignedAssessments(args) {
        var conversation = args.conversation;
        var booking      = args.booking;
        var taker        = args.taker;
        var giver        = args.giver;
        var item         = args.item;
        var dueDate      = args.dueDate;
        var media        = args.media;

        return EmailTemplateService.sendEmailTemplate('late-unsigned-assessment-giver', {
            user: giver,
            item: item,
            itemMedias: [media],
            taker: taker,
            booking: booking,
            conversation: conversation,
            dueDate: dueDate
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
     * @param {object} args.item
     * @param {object} args.dueDate
     * @param {object} [args.media]
     */
    function sendSmsLateUnsignedAssessments(args) {
        var conversation = args.conversation;
        var assessment   = args.assessment;
        var booking      = args.booking;
        var giver        = args.giver;
        var item         = args.item;

        // not signing end assessment is not critical
        if (assessment.endBookingId) {
            return;
        }

        if (! giver.phoneCheck) {
            return;
        }

        var isOwner = (booking.ownerId === giver.id);

        var conversationUrl = `${appDomain}/inbox/${conversation.id}`;
        var itemShortName   = ToolsService.shrinkString(item.name, 32, 4);
        var priceResult     = EmailHelperService.getPriceAfterRebateAndFees(booking);
        var ownerNetIncome  = _.get(priceResult, "ownerNetIncome", 0);

        var text = `Sharinplace: état des lieux en attente de votre signature "${itemShortName}"`;
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
     * @param {object} args.item
     * @param {object} args.user
     * @param {object} args.target
     * @param {object} [args.media]
     */
    function sendEmailNoRatings(args) {
        var conversation = args.conversation;
        var item         = args.item;
        var user         = args.user;
        var target       = args.target;
        var media        = args.media;

        return EmailTemplateService.sendEmailTemplate('missing-rating', {
            user: user,
            item: item,
            itemMedias: [media],
            targetUser: target,
            conversation: conversation
        });
    }
});
