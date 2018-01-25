/* global Booking, BookingPaymentService, BootstrapService, LoggerService, MicroService, TransactionService, User */

const Sails = require('sails');
const { getConfig } = require('../sailsrc');

var cronTaskName = "payinPayment";

const _ = require('lodash');
const Promise = require('bluebird');

Sails.load(getConfig(), async function (err, sails) {
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
        // find bookings that are paid and accepted but not cancelled
        // and the preauth payment isn't done
        var bookings = yield Booking.find({
            paymentUsedDate: null,
            cancellationId: null,
            paidDate: { '!=': null },
            acceptedDate: { '!=': null }
        });

        if (! bookings.length) {
            return;
        }

        var bookingsIds = _.pluck(bookings, "id");
        var takersIds   = _.pluck(bookings, "takerId");

        var result = yield Promise.props({
            hashTransactionsManagers: TransactionService.getBookingTransactionsManagers(bookingsIds),
            takers: User.find({ id: MicroService.escapeListForQueries(takersIds) })
        });

        var hashTransactionsManagers = result.hashTransactionsManagers;
        var takers                   = result.takers;

        var indexedTakers = _.indexBy(takers, "id");

        info.total = bookings.length;

        yield Promise.each(bookings, booking => {
            var transactionManager = hashTransactionsManagers[booking.id];
            var taker              = indexedTakers[booking.takerId];

            return bookingProcess(booking, transactionManager, taker)
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



    function bookingProcess(booking, transactionManager, taker) {
        return Promise.coroutine(function* () {
            if (! taker) {
                var error = new Error("Taker not found");
                error.takerId = booking.takerId;
                throw error;
            }

            return yield BookingPaymentService.payinPayment(booking, transactionManager, taker);
        })();
    }

});
