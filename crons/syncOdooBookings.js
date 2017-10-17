/* global AccountingService, BootstrapService, LoggerService */

var Sails = require('sails');
var path  = require('path');
var fs    = require('fs');

var cronTaskName = "syncOdooBookings";

global._       = require('lodash');
global.Promise = require('bluebird');

Promise.promisifyAll(fs);

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

    var info = {
        nbTransfers: 0,
        nbPayouts: 0
    };

    var configPath = path.join(__dirname, "env", "syncOdooBookingsConfig.json");
    var newConfig = {};

    var logger = LoggerService.getLogger("cron");
    logger = logger.child({ cronTaskName: cronTaskName });

    logger.info("Start cron");

    return Promise.coroutine(function* () {
        var config = yield getConfig();

        var startDate = config.startDate;
        var endDate   = config.endDate;

        yield AccountingService.syncTransactionsWithOdoo({
            startDate: startDate,
            endDate: endDate,
            onProgress: transaction => {
                if (transaction.action === "transfer") {
                    ++info.nbTransfers;
                } else if (transaction.action === "payout") {
                    ++info.nbPayouts;
                }
                newConfig.startDate = transaction.executionDate;
            }
        });
    })()
    .then(() => {
        logger.info(`Nb of transfers: ${info.nbTransfers}`);
        logger.info(`Nb of payouts: ${info.nbPayouts}`);
    })
    .catch(err => {
        logger.error({ err: err });
    })
    .finally(() => {
        setConfig(newConfig)
            .then(() => {
                logger.info("End cron");
                sails.lowerSafe();
            });
    });



    function getConfig() {
        return Promise.coroutine(function* () {
            var config = {};

            if (µ.existsSync(configPath)) {
                var content = yield fs.readFileAsync(configPath, "utf8");

                if (content) {
                    config = JSON.parse(content);
                }
            }

            return config;
        })();
    }

    function setConfig(config) {
        return Promise.coroutine(function* () {
            yield fs.writeFileAsync(configPath, JSON.stringify(config, null, 2))
                .catch(() => { return; });
        })();
    }

});
