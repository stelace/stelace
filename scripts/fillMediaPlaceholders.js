/* global BootstrapService, Media, MediaService */

const Sails = require('sails');
const { getConfig } = require('../sailsrc');

const Promise = require('bluebird');

Sails.load(getConfig(), async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail script launch: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

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
