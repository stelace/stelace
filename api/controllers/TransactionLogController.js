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

    mangopayWebhook,

};

const createError = require('http-errors');

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

async function mangopayWebhook(req, res) {
    const resourceId = req.param('RessourceId');
    const date       = req.param('Date');
    const eventType  = req.param('EventType');

    let eventDate = new Date(parseInt(date + '000', 10));

    if (! resourceId
     || ! date || isNaN(eventDate.getTime())
     || ! eventType
    ) {
        throw new createError(400);
    }

    try {
        eventDate = eventDate.toISOString();

        const createAttrs = {
            paymentProvider: 'mangopay',
            resourceId: resourceId,
            eventDate: eventDate,
            eventType: eventType
        };

        const transactionLog = await TransactionLog.create(createAttrs);

        // fetch the payout execution date
        if (transactionLog.eventType === 'PAYOUT_NORMAL_SUCCEEDED') {
            const payout = await mangopay.PayOuts.get(transactionLog.resourceId);
            await Transaction.update({ resourceId: payout.Id }, {
                executionDate: TimeService.convertTimestampSecToISO(payout.ExecutionDate),
            });
        }

        res.sendStatus(200);
    } catch (err) {
        req.logger.error({ err }, 'Mangopay webhook, fail creating TransactionLog');
        res.serverError(err);
    }
}
