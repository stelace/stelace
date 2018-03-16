/* global BootstrapService, User */

const Sails = require('sails');
const { getConfig } = require('../sailsrc');

Sails.load(getConfig(), async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail script launch: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    try {
        await User.update({ role: 'admin' }, { roles: ['admin', 'user', 'seller'] });
        await User.update({ role: 'user' }, { roles: ['user', 'seller'] });
    } catch (err) {
        console.log(err);

        if (err.stack) {
            console.log(err.stack);
        }
    } finally {
        sails.lowerSafe();
    }

});
