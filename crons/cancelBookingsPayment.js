/* global Booking, BootstrapService, Cancellation, CancellationService, LoggerService, TransactionService */

var Sails = require('sails');

var cronTaskName = "cancelBookingsPayment";

const _ = require('lodash');
const Promise = require('bluebird');

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

    var info = {
        nb: 0,
        total: 0
    };

    return Promise.coroutine(function* () {
        var bookings = yield Booking.find({
            cancellationPaymentDate: null,
            paymentDate: { '!=': null },
            cancellationId: { '!=': null }
        });

        if (! bookings.length) {
            return;
        }

        var bookingsIds      = _.pluck(bookings, "id");
        var cancellationsIds = _.pluck(bookings, "cancellationId");

        var result = yield Promise.props({
            transactionsManagers: TransactionService.getBookingTransactionsManagers(bookingsIds),
            cancellations: Cancellation.find({ id: cancellationsIds })
        });

        var transactionsManagers = result.transactionsManagers;
        var cancellations        = result.cancellations;

        var indexedCancellations = _.indexBy(cancellations, "id");

        var cancellableBookings = _.reduce(bookings, (memo, booking) => {
            var cancellation = indexedCancellations[booking.cancellationId];

            if (! cancellation) {
                var error = new Error("Cancellation not found");
                error.cancellationId = booking.cancellationId;
                logger.error({
                    err: err,
                    bookingId: booking.id
                });
            } else {
                if (_.includes(Cancellation.get("cancelPaymentReasonTypes"), cancellation.reasonType)) {
                    memo.push(booking);
                }
            }

            return memo;
        }, []);

        info.total = cancellableBookings.length;

        yield Promise.each(cancellableBookings, booking => {
            var transactionManager = transactionsManagers[booking.id];

            return CancellationService
                .cancelBookingPayment(booking, transactionManager)
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
        logger.info(`Nb bookings payment cancelled: ${info.nb} / ${info.total}`);
    })
    .catch(err => {
        logger.error({ err: err });
    })
    .finally(() => {
        logger.info("End cron");
        sails.lowerSafe();
    });

});
