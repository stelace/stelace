/* global BootstrapService, GamificationService, Item, LoggerService, User */

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
                Item.find({
                    validated: true
                })
            ];
        })
        .spread((users, items) => {
            var hash = getHash(users, items);

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



    function getHash(users, items) {
        var indexedItems = _.groupBy(items, "ownerId");

        var hash = _.reduce(users, (memo, user) => {
            var info = {
                user: user,
                items: indexedItems[user.id] || []
            };

            memo[user.id] = info;
            return memo;
        }, {});

        return hash;
    }

    function getCheckActionsParams(info) {
        var items = info.items;

        var actionsIds = [
            "FIRST_VALID_ITEM_AD",
            "VALID_ITEM_AD"
        ];

        var actionsData = {
            FIRST_VALID_ITEM_AD: _.map(items, item => ({ item: item })),
            VALID_ITEM_AD: _.map(items, item => ({ item: item }))
        };

        return {
            actionsIds: actionsIds,
            actionsData: actionsData
        };
    }
});
