/* global Booking, BookingPaymentService, BootstrapService, LoggerService, TransactionService, User */

var Sails  = require('sails');
var moment = require('moment');

var cronTaskName = "transferPayment";

global._       = require('lodash');
global.Promise = require('bluebird');

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

    var now = moment().toISOString();
    var info = {
        nb: 0,
        total: 0
    };

    // the input assessment must be signed at least from few days before transfer can be performed
    var nbDaysAfterInputAssessmentSigned = 2;

    logger.info("Start cron");

    return Promise.coroutine(function* () {
        // find bookings whose preauth payment is used but not cancelled
        // and the transfer payment isn't done
        var bookings = yield Booking.find({
            cancellationId: null,
            paymentTransferDate: null,
            paymentUsedDate: { '!': null }
        });

        if (! bookings.length) {
            return;
        }

        var bookingsIds = _.pluck(bookings, "id");
        var ownersIds   = _.pluck(bookings, "ownerId");
        var takersIds   = _.pluck(bookings, "takerId");
        var usersIds    = ownersIds.concat(takersIds);

        var result = yield Promise.props({
            hashTransactionsManagers: TransactionService.getBookingTransactionsManagers(bookingsIds),
            hashAssessments: Booking.getAssessments(bookings),
            users: User.find({ id: usersIds })
        });

        var hashTransactionsManagers = result.hashTransactionsManagers;
        var hashAssessments          = result.hashAssessments;
        var users                    = result.users;

        var indexedUsers = _.indexBy(users, "id");

        info.total = bookings.length;

        yield Promise.each(bookings, booking => {
            var transactionManager = hashTransactionsManagers[booking.id];
            var owner              = indexedUsers[booking.ownerId];
            var taker              = indexedUsers[booking.takerId];
            var bookingAssessments = hashAssessments[booking.id];
            var inputAssessment    = bookingAssessments.inputAssessment;

            return bookingProcess(booking, transactionManager, owner, taker, inputAssessment, now)
                .then(() => ++info.nb)
                .catch(err => {
                    logger.error({
                        err: err,
                        bookingId: booking.id
                    });
                });
        });
    })()
    .then(() => {
        logger.info(`Nb bookings transfer payment: ${info.nb} / ${info.total}`);
    })
    .catch(err => {
        logger.error({ err: err });
    })
    .finally(() => {
        logger.info("End cron");
        sails.lowerSafe();
    });



    function bookingProcess(booking, transactionManager, owner, taker, inputAssessment, now) {
        return Promise.coroutine(function* () {
            var error;

            if (! owner) {
                error = new Error("Owner not found");
                error.ownerId = booking.ownerId;
                throw error;
            }
            if (! taker) {
                error = new Error("Taker not found");
                error.takerId = booking.takerId;
                throw error;
            }
            if (! inputAssessment) {
                error = new Error("Input assessment not found");
                throw error;
            }

            // the owner has no mangopay account
            if (! owner.mangopayUserId || ! owner.walletId) {
                return;
            }

            if (! inputAssessment.signedDate
             || now < moment(inputAssessment.signedDate).add(nbDaysAfterInputAssessmentSigned, "d").toISOString()
            ) {
                return;
            }

            return yield BookingPaymentService.transferPayment(booking, transactionManager, taker, owner);
        })();
    }
});
