/* global OdooApiService */

module.exports = {

    init: init,

};

const _ = require('lodash');
const Promise = require('bluebird');
var moment                  = require('moment');
var areIntlLocalesSupported = require('intl-locales-supported');
var IntlPolyfill            = require('intl');
const Mangopay = require('mangopay2-nodejs-sdk');
const Stripe = require('stripe');

function init(initFields, args) {
    var defaultFields = [
        "uncaughtException",
        "waterlineRawQuery",
        "mangopay",
        "stripe",
        "utilities",
        "odoo",
        "lowerSafe",
        "intl"
    ];
    args = args || {};
    initFields = initFields || defaultFields;

    _.forEach(initFields, function (field) {
        switch (field) {
            case "uncaughtException":
                process.on("uncaughtException", function (err) {
                    console.log(new Date(), err);
                    console.log(err.stack);
                });
                break;

            case "waterlineRawQuery":
                _.forEach(sails.models, model => {
                    if (model.query) {
                        model.query = Promise.promisify(model.query);
                    }
                });
                break;

            case "mangopay":
                var mangopayConfig    = sails.config.mangopay;
                var mangopayWorkspace = mangopayConfig[mangopayConfig.workspace];
                global.mangopay = new Mangopay({
                    clientId: mangopayWorkspace.clientId,
                    clientPassword: mangopayWorkspace.passphrase,
                    baseUrl: mangopayConfig.workspace === 'production' ? 'https://api.mangopay.com' : 'https://api.sandbox.mangopay.com',
                    apiVersion: 'v2.01',
                });
                break;

            case "stripe":
                global.stripe = new Stripe(sails.config.stripe.secretKey);
                break;

            case "utilities":
                moment.locale("fr");
                break;

            case "intl":
                // Node supports only english locale by default
                var localesToSupport        = [
                    "fr-FR"
                ];

                if (global.Intl) {
                    // Determine if the built-in `Intl` has the locale data needed
                    if (! areIntlLocalesSupported(localesToSupport)) {
                        // Intl exists, but it doesn't have the data we need, so load the
                        // polyfill and patch the constructors we need with the polyfill's.
                        Intl.NumberFormat   = IntlPolyfill.NumberFormat;
                        Intl.DateTimeFormat = IntlPolyfill.DateTimeFormat;
                    }
                } else {
                    // No Intl, so use and load the polyfill.
                    global.Intl = IntlPolyfill;
                }
                break;

            case "odoo":
                var odooConnection = sails.config.odoo.connection;
                global.odoo = OdooApiService.getInstance({
                    protocol: odooConnection.protocol,
                    host: odooConnection.host,
                    port: odooConnection.port,
                    database: odooConnection.database,
                    username: odooConnection.username,
                    password: odooConnection.password
                });
                break;

            case "lowerSafe":
                // hack because process isn't killed (node 0.10.36 / sails 0.11.0)
                args.sails.lowerSafe = function (cb) {
                    args.sails.lower(function () {
                        if (cb) {
                            cb();
                        }
                        setTimeout(function () {
                            process.exit();
                        }, 1000);
                    });
                };
                break;
        }
    });
}

