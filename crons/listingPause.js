/* global BootstrapService, Listing, LoggerService, ListingService */

const Sails  = require('sails');
const moment = require('moment');

const cronTaskName = "listingPause";

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

    let logger = LoggerService.getLogger("cron");
    logger = logger.child({ cronTaskName: cronTaskName });

    const startTime = moment();

    let info = {
        listingsPausedBefore: 0,
        listingsActivated: 0
    };

    logger.info("Start cron");

    return Promise.coroutine(function* () {
        const pausedListings = yield Listing.find({
            locked: true,
            pausedUntil: { "!": null },
            // listing locked without pauseUntil date is not paused but locked
        });
        let listingsToActivate = [];

        _.forEach(pausedListings, listing => {
            if (! (moment(listing.pausedUntil).isValid() && moment().isAfter(listing.pausedUntil, "day"))) {
                return;
            }

            listingsToActivate.push(ListingService.pauseListingToggle({
                listingId: listing.id,
                pause: false,
                req: {
                    logger,
                    user: { id: listing.ownerId }
                }
            }));
        });

        info.listingsPausedBefore = pausedListings.length;
        info.listingsActivated = listingsToActivate.length;

        return Promise.all(listingsToActivate);
    })()
    .catch(err => {
        logger.error({ err: err });
    })
    .finally(() => {
        const duration = moment().diff(startTime);
        logger.info(`End cron: Reactivate ${info.listingsActivated} listings out of ${info.listingsPausedBefore} in ${duration}ms.`);
        sails.lowerSafe();
    });

});
