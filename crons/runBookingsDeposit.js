/* global Booking, BookingPaymentService, BootstrapService, Cancellation, LoggerService, MicroService, TransactionService */

const Sails  = require('sails');
const { getConfig } = require('../sailsrc');
const moment = require('moment');

var cronTaskName = "runBookingsDeposit";

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

    logger.info("Start cron");

    var info = {
        renew: {
            nb: 0,
            total: 0
        },
        cancel: {
            nb: 0,
            total: 0
        }
    };

    var now                     = moment().toISOString();
    var expirationLimitDate     = moment().add({ days: 1, hours: 2 }).toISOString();
    var releaseDepositLimitDate = moment().add(-1, "m").toISOString();

    return Promise.coroutine(function* () {
        var bookings = yield Booking.find({
            cancellationDepositDate: null,
            depositDate: { '!=': null }
        });

        if (! bookings.length) {
            return;
        }

        var bookingsIds      = _.pluck(bookings, "id");
        var cancellationsIds = _.pluck(bookings, "cancellationId");

        var result = yield Promise.props({
            transactionsManagers: TransactionService.getBookingTransactionsManagers(bookingsIds),
            hashAssessments: Booking.getAssessments(bookings),
            cancellations: Cancellation.find({ id: MicroService.escapeListForQueries(cancellationsIds) })
        });

        var transactionsManagers = result.transactionsManagers;
        var hashAssessments      = result.hashAssessments;
        var cancellations        = result.cancellations;

        var indexedCancellations = _.indexBy(cancellations, "id");

        yield Promise.each(bookings, booking => {
            return Promise.coroutine(function* () {
                var transactionManager = transactionsManagers[booking.id];
                var bookingAssessments = hashAssessments[booking.id];
                var cancellation       = indexedCancellations[booking.cancellationId];

                if (isReleaseDepositPassed(booking, now)) {
                    ++info.cancel.total;

                    yield BookingPaymentService.cancelDeposit(booking, transactionManager)
                        .then(() => ++info.cancel.nb);
                } else if (releaseBookingDeposit(booking, bookingAssessments, releaseDepositLimitDate)
                 || releaseCancelledBooking(booking, cancellation, releaseDepositLimitDate)
                ) {
                    ++info.cancel.total;

                    yield Booking.updateOne(booking.id, { releaseDepositDate: now })
                        .then(() => {
                            return BookingPaymentService.cancelDeposit(booking, transactionManager);
                        })
                        .then(() => ++info.cancel.nb);
                } else if (isRenewDeposit(booking, transactionManager, expirationLimitDate)) {
                    ++info.renew.total;

                    yield BookingPaymentService.renewDeposit(booking, transactionManager)
                        .then(() => ++info.renew.nb);
                }
            })()
            .catch(err => {
                logger.error({
                    err: err,
                    bookingId: booking.id
                });
            });
        });
    })()
    .then(() => {
        logger.info(`Nb bookings renew deposit: ${info.renew.nb} / ${info.renew.total}`);
        logger.info(`Nb bookings cancel deposit: ${info.cancel.nb} / ${info.cancel.total}`);
    })
    .catch(err => {
        logger.error({ err: err });
    })
    .finally(() => {
        logger.info("End cron");
        sails.lowerSafe();
    });



    function isReleaseDepositPassed(booking, now) {
        return booking.releaseDepositDate && booking.releaseDepositDate < now;
    }

    function releaseCancelledBooking(booking, cancellation, releaseDepositLimitDate) {
        if (! booking.cancellationId) {
            return false;
        }

        if (! cancellation) {
            var error = new Error("Cancellation not found");
            error.cancellationId = booking.cancellationId;
            throw error;
        }

        var reasonTypes = Cancellation.get("cancelPaymentReasonTypes");
        reasonTypes.push("taker-cancellation");

        var releaseDeposit;
        if (_.includes(reasonTypes, cancellation.reasonType)) {
            releaseDeposit = true;
        } else {
            releaseDeposit = (cancellation.createdDate < releaseDepositLimitDate);
        }

        return ! booking.releaseDepositDate
            && releaseDeposit;
    }

    function releaseBookingDeposit(booking, bookingAssessments, releaseDepositLimitDate) {
        // if booking has no release deposit date
        // and end date is theoretically long time ago
        // and the input assessment was signed
        // and the output assessment hasn't been signed
        return ! Booking.isNoTime(booking)
         && ! booking.releaseDepositDate
         && booking.endDate < releaseDepositLimitDate
         && bookingAssessments.inputAssessment
         && bookingAssessments.inputAssessment.signedDate
         && bookingAssessments.outputAssessment
         && ! bookingAssessments.outputAssessment.signedDate;
    }

    function isRenewDeposit(booking, transactionManager, expirationLimitDate) {
        var mainDeposit      = transactionManager.getDeposit() || transactionManager.getDepositPayment();
        var renewDeposits    = transactionManager.getNonCancelledRenewDeposits();
        var lastRenewDeposit = _.last(renewDeposits);

        if (! booking.deposit
         || booking.stopRenewDeposit
         || ! mainDeposit
        ) {
            return false;
        }

        if (mainDeposit.preauthExpirationDate < expirationLimitDate
         && (! lastRenewDeposit || lastRenewDeposit.preauthExpirationDate < expirationLimitDate)
        ) {
            return true;
        }

        return false;
    }
});
