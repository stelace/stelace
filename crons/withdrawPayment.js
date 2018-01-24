/* global Booking, BookingPaymentService, BootstrapService, LoggerService, TransactionService, User */

const Sails = require('sails');
const { getConfig } = require('../sailsrc');

var cronTaskName = "withdrawPayment";

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
        // find bookings whose transfer payment is done but not cancelled
        // and the withdraw payment isn't done
        var bookings = yield Booking.find({
            cancellationId: null,
            withdrawalDate: null,
            paymentTransferDate: { '!=': null }
        });

        if (! bookings.length) {
            return;
        }

        var bookingsIds = _.pluck(bookings, "id");
        var ownersIds   = _.pluck(bookings, "ownerId");

        var result = yield Promise.props({
            hashTransactionsManagers: TransactionService.getBookingTransactionsManagers(bookingsIds),
            owners: User.find({ id: ownersIds })
        });

        var hashTransactionsManagers = result.hashTransactionsManagers;
        var owners                   = result.owners;

        var indexedOwners = _.indexBy(owners, "id");

        info.total = bookings.length;

        yield Promise.each(bookings, booking => {
            var transactionManager = hashTransactionsManagers[booking.id];
            var owner              = indexedOwners[booking.ownerId];

            return bookingProcess(booking, transactionManager, owner)
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
        logger.info(`Nb bookings withdraw payment: ${info.nb} / ${info.total}`);
    })
    .catch(err => {
        logger.error({ err: err });
    })
    .finally(() => {
        logger.info("End cron");
        sails.lowerSafe();
    });



    function bookingProcess(booking, transactionManager, owner) {
        return Promise.coroutine(function* () {
            if (! owner) {
                var error = new Error("Owner not found");
                error.ownerId = booking.ownerId;
                throw error;
            }

            // the owner has no mangopay account or bank account
            if (! owner.mangopayUserId
             || ! owner.walletId
             || ! owner.bankAccountId
            ) {
                return;
            }

            booking = yield BookingPaymentService.payoutPayment(booking, transactionManager, owner);

            return booking;
        })();
    }

});
