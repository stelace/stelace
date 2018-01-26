/* global BootstrapService */

const Sails = require('sails');
const { mergeConfig } = require('../sailsrc');
const database = require('./database');

const newConfig = mergeConfig({
    models: {
        migrate: 'safe', // uncomment this line if you're testing a feature without changing database structure
        // migrate: 'alter',
    },
    datastores: {
        MySQLServer: {
            database: 'stelace-test',
        },
    },
});

before((done) => {
    Sails.lift(newConfig, async (err, sails) => {
        if (err) return done(err);

        BootstrapService.init(null, { sails });
        database.init({ sails });

        done();
    });
});

after(function(done) {

    sails.lowerSafe(done);

});
