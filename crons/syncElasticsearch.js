/* global BootstrapService, ElasticsearchService, LoggerService */

const Sails = require('sails');
const { getConfig } = require('../sailsrc');

const cronTaskName = "syncElasticsearch";

Sails.load(getConfig(), async function (err, sails) {
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
