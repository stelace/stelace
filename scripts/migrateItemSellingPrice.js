/* global BootstrapService, Item */

var Sails = require('sails');

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
        console.log("\n!!! Fail script launch: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    Item.beforeUpdateCustom = function () {};

    var dayOnePriceRatio = 25;

    return Promise.coroutine(function* () {
        var items = yield Item.find();

        yield Promise.each(items, item => {
            return Item.updateOne(item.id, {
                sellingPrice: item.dayOnePrice * dayOnePriceRatio
            });
        });
    })()
    .catch(err => {
        console.log(err);

        if (err.stack) {
            console.log(err.stack);
        }
    })
    .finally(() => {
        sails.lowerSafe();
    });

});
