/* global AccountingService, BootstrapService */

const Sails = require('sails');
const { getConfig } = require('../sailsrc');
const yargs = require('yargs');

const Promise = require('bluebird');

var argv = yargs
            .usage("Usage: $0 --startDate [string] --endDate [string]")
            .argv;

var startDate = argv.startDate;
var endDate   = argv.endDate;

if (startDate && ! new Date(startDate).getTime) {
    console.log("Incorrect start date");
}
if (endDate && ! new Date(endDate).getTime) {
    console.log("Incorrect end date");
}

Sails.load(getConfig(), async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail script launch: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    var info = {
        nbTransfers: 0,
        nbPayouts: 0
    };

    return Promise.coroutine(function* () {
        yield AccountingService.syncTransactionsWithOdoo({
            startDate: startDate,
            endDate: endDate,
            onProgress: transaction => {
                if (transaction.action === "transfer") {
                    ++info.nbTransfers;
                } else if (transaction.action === "payout") {
                    ++info.nbPayouts;
                }
                console.log(transaction.id);
            }
        });
    })()
    .then(() => {
        console.log(`Nb of transfers: ${info.nbTransfers}`);
        console.log(`Nb of payouts: ${info.nbPayouts}`);
    })
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
