/* global Booking, BookingPaymentService, BootstrapService, LoggerService, TransactionService, User */

var Sails = require('sails');

var cronTaskName = "payinPayment";

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

    var info = {
        nb: 0,
        total: 0
    };

    logger.info("Start cron");

    return Promise.coroutine(function* () {
        // find bookings that are confirmed and validated but not cancelled
        // and the preauth payment isn't done
        var bookings = yield Booking.find({
            paymentUsedDate: null,
            cancellationId: null,
            confirmedDate: { '!': null },
            validatedDate: { '!': null }
        });

        if (! bookings.length) {
            return;
        }

        var bookingsIds = _.pluck(bookings, "id");
        var bookersIds  = _.pluck(bookings, "bookerId");

        var result = yield Promise.props({
            hashTransactionsManagers: TransactionService.getBookingTransactionsManagers(bookingsIds),
            bookers: User.find({ id: bookersIds })
        });

        var hashTransactionsManagers = result.hashTransactionsManagers;
        var bookers                  = result.bookers;

        var indexedBookers = _.indexBy(bookers, "id");

        info.total = bookings.length;

        yield Promise.each(bookings, booking => {
            var transactionManager = hashTransactionsManagers[booking.id];
            var booker             = indexedBookers[booking.bookerId];

            return bookingProcess(booking, transactionManager, booker)
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
        logger.info(`Nb bookings payin payment: ${info.nb} / ${info.total}`);
    })
    .catch(err => {
        logger.error({ err: err });
    })
    .finally(() => {
        logger.info("End cron");
        sails.lowerSafe();
    });



    function bookingProcess(booking, transactionManager, booker) {
        return Promise.coroutine(function* () {
            if (! booker) {
                var error = new Error("Booker not found");
                error.bookerId = booking.bookerId;
                throw error;
            }

            return yield BookingPaymentService.payinPayment(booking, transactionManager, booker);
        })();
    }

});
