/* global BootstrapService, SmsService */

const Sails = require('sails');
const { getConfig } = require('../sailsrc');

const Promise = require('bluebird');

Sails.load(getConfig(), async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail script launch: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    var text   = '';
    var userId = 1;

    Promise
        .resolve()
        .then(() => {
            return SmsService.sendTextSms({
                toUserId: userId,
                text: text
            });
        })
        .catch(err => {
            console.log("Error:" + err);
        })
        .finally(() => {
            sails.lowerSafe();
        });
});
