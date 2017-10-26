/* global BootstrapService, GamificationService, Listing, LoggerService, User */

var Sails = require('sails');

var cronTaskName = "setGamificationPoints";

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

    logger.info("Start cron");

    return Promise
        .resolve()
        .then(() => {
            return [
                User.find(),
                Listing.find({
                    validated: true
                })
            ];
        })
        .spread((users, listings) => {
            var hash = getHash(users, listings);

            return Promise
                .resolve(_.values(hash))
                .map(info => {
                    var user        = info.user;
                    var params      = getCheckActionsParams(info);
                    var actionsIds  = params.actionsIds;
                    var actionsData = params.actionsData;

                    return GamificationService.checkActions(user, actionsIds, actionsData, logger);
                });
        })
        .catch(err => {
            logger.error({ err: err });
        })
        .finally(() => {
            logger.info("End cron");
            sails.lowerSafe();
        });



    function getHash(users, listings) {
        var indexedListings = _.groupBy(listings, "ownerId");

        var hash = _.reduce(users, (memo, user) => {
            var info = {
                user: user,
                listings: indexedListings[user.id] || []
            };

            memo[user.id] = info;
            return memo;
        }, {});

        return hash;
    }

    function getCheckActionsParams(info) {
        var listings = info.listings;

        var actionsIds = [
            "FIRST_VALID_LISTING_AD",
            "VALID_LISTING_AD"
        ];

        var actionsData = {
            FIRST_VALID_LISTING_AD: _.map(listings, listing => ({ listing: listing })),
            VALID_LISTING_AD: _.map(listings, listing => ({ listing: listing }))
        };

        return {
            actionsIds: actionsIds,
            actionsData: actionsData
        };
    }
});
