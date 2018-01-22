/* global BootstrapService, ElasticsearchService, LoggerService */

const Sails = require('sails');

const cronTaskName = "syncElasticsearch";

Sails.load({
    models: {
        migrate: "safe"
    },
    hooks: {
        grunt: false,
        sockets: false,
        pubsub: false
    }
}, async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail cron task: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    let logger = LoggerService.getLogger("cron");
    logger = logger.child({ cronTaskName: cronTaskName });

    logger.info("Start cron");

    try {
        await ElasticsearchService.syncListings();
    } catch (err) {
        logger.error({ err });
    } finally {
        logger.info("End cron");
        sails.lowerSafe();
    }

});
