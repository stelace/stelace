/* global BootstrapService, LoggerService, OdooService */

const Sails = require('sails');
const { getConfig } = require('../sailsrc');

var cronTaskName = "setOdooAccountInvoiceMoveRef";

const _ = require('lodash');
const Promise = require('bluebird');

Sails.load(getConfig(), async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail cron task: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    var info = {
        clientMoves: {
            nb: 0,
            total: 0
        },
        supplierMoves: {
            nb: 0,
            total: 0
        }
    };

    var logger = LoggerService.getLogger("cron");
    logger = logger.child({ cronTaskName: cronTaskName });

    logger.info("Start cron");

    return Promise.coroutine(function* () {
        yield updateClientMoveLines(info);
        yield updateSupplierMoveLines(info);
    })()
    .then(() => {
        logger.info(`Nb moves updated: ${info.clientMoves.nb} / ${info.clientMoves.total}`);
        logger.info(`Nb moves updated: ${info.supplierMoves.nb} / ${info.supplierMoves.total}`);
    })
    .catch(err => {
        logger.error({ err: err });
    })
    .finally(() => {
        logger.info("End cron");
        sails.lowerSafe();
    });



    function updateClientMoveLines(info) {
        return Promise.coroutine(function* () {
            var clientInvoicePrefix = "FC";

            var moveIds = yield OdooService.searchModels("account.move", [
                ["name", "=like", `${clientInvoicePrefix}%`],
                ["ref", "=", null]
            ]);
            var moves = yield OdooService.getModels("account.move", moveIds, ["name"]);

            info.clientMoves.total = moveIds.length;

            yield Promise.map(moves, move => {
                return OdooService.updateModel("account.move", move.id, { ref: move.name })
                    .then(() => ++info.clientMoves.nb)
                    .catch(() => { /* do nothing */ });
            }, { concurrency: 10 });
        })();
    }

    function updateSupplierMoveLines(info) {
        var supplierNameSuffix          = "Facture Fournisseur";
        var supplierInvoicePrefix       = "FRS";
        var supplierInvoiceBankPrefix   = "BQSG";
        var supplierAccountCodePrefixes = [401, 404];

        return Promise.coroutine(function* () {
            // get supplier accounts
            var supplierAccountsIds = yield OdooService.searchModels("account.account", [
                "|",
                ["code", "=like", `${supplierAccountCodePrefixes[0]}%`],
                ["code", "=like", `${supplierAccountCodePrefixes[1]}%`]
            ]);

            // get supplier account move lines with specific fields
            // and has a wrong format for name
            var accountMoveLinesIds = yield OdooService.searchModels("account.move.line", [
                ["account_id", "in", supplierAccountsIds],
                "!", ["name", "=like", `${supplierNameSuffix} ${supplierInvoicePrefix}%`]
            ]);
            var accountMoveLines = yield OdooService.getModels("account.move.line", accountMoveLinesIds, ["name", "move_id"]);

            // copy account move names into their associated account move line names
            yield Promise.map(accountMoveLines, accountMoveLine => {
                // account move lines include account move id as [id, name]
                var accountMoveName = accountMoveLine.move_id[1];
                var supplierRegex   = /^FRS\d+$/;
                var newName;

                // supplier invoice payment
                if (_.startsWith(accountMoveName, supplierInvoiceBankPrefix)
                 && supplierRegex.test(accountMoveLine.name)
                ) {
                    newName = `${supplierNameSuffix} ${accountMoveLine.name} (Règlement)`;
                // supplier invoice
                } else if (_.startsWith(accountMoveName, supplierInvoicePrefix)) {
                    newName = `${supplierNameSuffix} ${accountMoveName}`;
                }

                if (! newName) {
                    return;
                }

                return OdooService.updateModel("account.move.line", accountMoveLine.id, { name: newName })
                    .then(() => ++info.supplierMoves.nb)
                    .catch(() => { /* do nothing */ });
            }, { concurrency: 10 });
        })();
    }

});
