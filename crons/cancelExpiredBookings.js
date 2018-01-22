/* global Booking, BootstrapService, CancellationService, LoggerService */

var Sails  = require('sails');
var moment = require('moment');

var cronTaskName = "cancelExpiredBookings";

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

    var rentingNbDaysAfterStartDate    = 3;
    var purchaseNbDaysAfterCreatedDate = 7;

    return Promise.coroutine(function* () {
        var bookings = yield Booking.find({
            cancellationId: null,
            or: [
                { acceptedDate: null },
                { paidDate: null }
            ]
        });

        var rentingStartDateLimit    = moment().add(- rentingNbDaysAfterStartDate, "d").format("YYYY-MM-DD");
        var purchaseCreatedDateLimit = moment().add(- purchaseNbDaysAfterCreatedDate, "d").format("YYYY-MM-DD");

        bookings = _.filter(bookings, booking => {
            if (Booking.isNoTime(booking)) {
                return booking.createdDate < purchaseCreatedDateLimit;
            } else {
                return booking.startDate < rentingStartDateLimit;
            }
        }, []);

        if (! bookings.length) {
            return;
        }

        info.total = bookings.length;

        yield Promise.each(bookings, booking => {
            return cancelBooking(booking)
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
        logger.info(`Nb bookings expired: ${info.nb} / ${info.total}`);
    })
    .catch(err => {
        logger.error({ err: err });
    })
    .finally(() => {
        logger.info("End cron");
        sails.lowerSafe();
    });



    function cancelBooking(booking) {
        var reasonType;
        if (! booking.acceptedDate && ! booking.paidDate) {
            reasonType = "no-action";
        } else if (! booking.acceptedDate) {
            reasonType = "no-validation";
        } else if (! booking.paidDate) {
            reasonType = "no-payment";
        }

        // do not cancel payment (another script takes care of it)
        return CancellationService.cancelBooking(booking, null, {
            reasonType: reasonType,
        });
    }

});
