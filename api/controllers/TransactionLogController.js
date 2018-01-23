/* global mangopay, TimeService, Transaction, TransactionLog */

/**
 * TransactionLogController
 *
 * @description :: Server-side logic for managing transactionlogs
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {

    find: find,
    findOne: findOne,
    create: create,
    update: update,
    destroy: destroy,

    webhook: webhook

};

const Promise = require('bluebird');

function find(req, res) {
    return res.forbidden();
}

function findOne(req, res) {
    return res.forbidden();
}

function create(req, res) {
    return res.forbidden();
}

function update(req, res) {
    return res.forbidden();
}

function destroy(req, res) {
    return res.forbidden();
}

function webhook(req, res) {
    var resourceId = req.param("RessourceId");
    var date       = req.param("Date");
    var eventType  = req.param("EventType");

    var eventDate = new Date(parseInt(date + "000", 10));

    if (! resourceId
     || ! date || isNaN(eventDate.getTime())
     || ! eventType
    ) {
        return res.badRequest();
    }

    eventDate = eventDate.toISOString();

    var createAttrs = {
        resourceId: resourceId,
        eventDate: eventDate,
        eventType: eventType
    };

    return Promise.coroutine(function* () {
        var transactionLog = yield TransactionLog.create(createAttrs);

        if (transactionLog.eventType === "PAYOUT_NORMAL_SUCCEEDED") {
            var payout = yield mangopay.payout.fetch({ payoutId: transactionLog.resourceId });
            yield Transaction.update({ resourceId: payout.Id }, {
                executionDate: TimeService.convertTimestampSecToISO(payout.ExecutionDate)
            });
        }
    })()
    .then(() => res.sendStatus(200))
    .catch(err => {
        req.logger.error({ err: err }, "Mangopay webhook, fail creating TransactionLog");
        res.serverError(err);
    });
}
