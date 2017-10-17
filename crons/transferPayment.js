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
            stopTransferPayment: false,
            cancellationId: null,
            paymentTransferDate: null,
            paymentUsedDate: { '!': null }
        });

        if (! bookings.length) {
            return;
        }

        var bookingsIds = _.pluck(bookings, "id");
        var ownersIds   = _.pluck(bookings, "ownerId");
        var bookersIds  = _.pluck(bookings, "bookerId");
        var usersIds    = ownersIds.concat(bookersIds);

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
            var booker             = indexedUsers[booking.bookerId];
            var bookingAssessments = hashAssessments[booking.id];
            var inputAssessment    = bookingAssessments.inputAssessment;

            return bookingProcess(booking, transactionManager, owner, booker, inputAssessment, now)
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



    function bookingProcess(booking, transactionManager, owner, booker, inputAssessment, now) {
        return Promise.coroutine(function* () {
            var error;

            if (! owner) {
                error = new Error("Owner not found");
                error.ownerId = booking.ownerId;
                throw error;
            }
            if (! booker) {
                error = new Error("Booker not found");
                error.bookerId = booking.bookerId;
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

            return yield BookingPaymentService.transferPayment(booking, transactionManager, booker, owner);
        })();
    }
});
