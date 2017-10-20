/* global BootstrapService, StelaceConfig */

const Sails = require('sails');

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
}, async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail script launch: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    try {
        const stelaceConfigs = await StelaceConfig.find().limit(1);

        const attrs = {
            config: {
                siteName: null,
            },
            features: {
                GAMIFICATION: true,
                TAGS: true,
                EVENTS: true,
                SOCIAL_LOGIN: true,
                INCOME_REPORT: true,
                SMS: true,
                MAP: true,
            },
        };

        if (stelaceConfigs.length) {
            await StelaceConfig.updateOne(stelaceConfigs[0].id, attrs);
        } else {
            await StelaceConfig.create(attrs);
        }
    } catch (err) {
        console.log(err);

        if (err.stack) {
            console.log(err.stack);
        }
    } finally {
        sails.lowerSafe();
    }

});
