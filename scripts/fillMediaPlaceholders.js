/* global BootstrapService, Media, MediaService */

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

    Media.beforeUpdateCustom = () => {}; // do not update "updatedDate"

    try {
        const medias = await Media.find({
            type: 'img',
            or: [
                { color: null },
                { placeholder: null },
            ],
        });

        await Promise.map(medias, media => {
            return MediaService.setImagePlaceholders(media)
                .catch(() => null);
        }, { concurrency: 100 });
    } catch (err) {
        console.log(err);

        if (err.stack) {
            console.log(err.stack);
        }
    } finally {
        sails.lowerSafe();
    }

});
