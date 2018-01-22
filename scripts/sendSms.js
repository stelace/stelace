/* global BootstrapService, SmsService */

var Sails = require('sails');

const Promise = require('bluebird');

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
