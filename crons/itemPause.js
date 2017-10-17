/* global BootstrapService, Item, LoggerService, ItemService */

const Sails  = require('sails');
const moment = require('moment');

const cronTaskName = "itemPause";

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
        itemsPausedBefore: 0,
        itemsActivated: 0
    };

    logger.info("Start cron");

    return Promise.coroutine(function* () {
        const pausedItems = yield Item.find({
            locked: true,
            pausedUntil: { "!": null },
            // item locked without pauseUntil date is not paused but locked
        });
        let itemsToActivate = [];

        _.forEach(pausedItems, item => {
            if (! (moment(item.pausedUntil).isValid() && moment().isAfter(item.pausedUntil, "day"))) {
                return;
            }

            itemsToActivate.push(ItemService.pauseItemToggle({
                itemId: item.id,
                pause: false,
                req: {
                    logger,
                    user: { id: item.ownerId }
                }
            }));
        });

        info.itemsPausedBefore = pausedItems.length;
        info.itemsActivated = itemsToActivate.length;

        return Promise.all(itemsToActivate);
    })()
    .catch(err => {
        logger.error({ err: err });
    })
    .finally(() => {
        const duration = moment().diff(startTime);
        logger.info(`End cron: Reactivate ${info.itemsActivated} items out of ${info.itemsPausedBefore} in ${duration}ms.`);
        sails.lowerSafe();
    });

});
