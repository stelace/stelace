/* global Transaction, TransactionDetail */

/**
* Transaction.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        fromUserId: {
            type: "integer",
            index: true
        },
        toUserId: {
            type: "integer",
            index: true
        },
        fromWalletId: "string",
        toWalletId: "string",
        bankAccountId: "string",
        credit: {
            type: "float",
            defaultsTo: 0
        },
        debit: {
            type: "float",
            defaultsTo: 0
        },
        payment: {
            type: "float",
            defaultsTo: 0
        },
        cashing: {
            type: "float",
            defaultsTo: 0
        },
        preauthAmount: {
            type: "float",
            defaultsTo: 0
        },
        payoutAmount: {
            type: "float",
            defaultsTo: 0
        },
        bookingId: {
            type: "integer",
            index: true
        },
        resourceType: "string",
        resourceId: "string",
        preauthExpirationDate: "string",
        mgpCreatedDate: "string",
        executionDate: "string",
        cancelTransactionId: { // if set, this transaction cancels entirely or partially another one
            type: "integer",
            index: true
        },
        action: "string",
        label: "string"
    },

    isPreauthorizationCancellable: isPreauthorizationCancellable,

    createTransactionDetails: createTransactionDetails,
    createTransaction: createTransaction

};

var moment = require('moment');
const _ = require('lodash');
const Promise = require('bluebird');

// cannot cancel after "the expiration date - 5 minutes"
function isPreauthorizationCancellable(transaction) {
    var now = moment().toISOString();
    return now < moment(transaction.preauthExpirationDate).subtract(5, "m").toISOString();
}

function isValidTransactionsDetails(details) {
    return _.reduce(details, (memo, detail) => {
        if (! detail.label) {
            memo = memo && false;
        }
        return memo;
    }, true);
}

/**
 * create transaction details
 * @param  {number} transactionId
 * @param  {object} details
 * @param  {string} details.label
 * @param  {number} [details.credit = 0]
 * @param  {number} [details.debit = 0]
 * @param  {number} [details.payment = 0]
 * @param  {number} [details.cashing = 0]
 * @return {Promise<Array[object]>}
 */
function createTransactionDetails(transactionId, details) {
    return Promise.coroutine(function* () {
        if (! isValidTransactionsDetails(details)) {
            throw new Error("Bad details");
        }

        return yield Promise.mapSeries(details, detail => {
            var createAttrs = _.pick(detail, [
                "label",
                "credit",
                "debit",
                "payment",
                "cashing"
            ]);
            createAttrs.transactionId = transactionId;

            return TransactionDetail.create(createAttrs);
        });
    })();
}

/**
 * create transaction
 * @param  {object} args
 * @param  {number} args.fromUserId
 * @param  {number} args.toUserId
 * @param  {number} [args.fromWalletId]
 * @param  {number} [args.toWalletId]
 * @param  {number} [args.bankAccountId]
 * @param  {number} [args.preauthAmount = 0]
 * @param  {number} [args.payoutAmount = 0]
 * @param  {number} args.bookingId
 * @param  {string} args.resourceType
 * @param  {string} args.resourceId
 * @param  {string} [args.preauthExpirationDate]
 * @param  {string} [args.mgpCreatedDate]
 * @param  {string} [args.executionDate]
 * @param  {number} [args.cancelTransactionId]
 * @param  {string} args.action
 * @param  {string} args.label
 * @param  {object[]} [args.details = []]
 * @param  {string} args.details[].label
 * @param  {number} [args.details[].credit = 0]
 * @param  {number} [args.details[].debit = 0]
 * @param  {number} [args.details[].payment = 0]
 * @param  {number} [args.details[].cashing = 0]
 * @return {Promise<object>} res
 * @return {object}          res.transaction
 * @return {object[]}        res.transactionDetails
 */
function createTransaction(args) {
    return Promise.coroutine(function* () {

        if (! args.fromUserId
         || ! args.resourceType
         || ! args.resourceId
         || ! args.action
         || ! args.label
         || (args.details && ! isValidTransactionsDetails(args.details))
        ) {
            throw new Error("Missing params");
        }

        var financeInfo = _.reduce(args.details, (memo, detail) => {
            if (typeof detail.credit === "number") {
                memo.credit += detail.credit;
            }
            if (typeof detail.debit === "number") {
                memo.debit += detail.debit;
            }
            if (typeof detail.payment === "number") {
                memo.payment += detail.payment;
            }
            if (typeof detail.cashing === "number") {
                memo.cashing += detail.cashing;
            }
            return memo;
        }, {
            credit: 0,
            debit: 0,
            payment: 0,
            cashing: 0
        });

        var createAttrs = _.pick(args, [
            "fromUserId",
            "toUserId",
            "fromWalletId",
            "toWalletId",
            "bankAccountId",
            "preauthAmount",
            "payoutAmount",
            "bookingId",
            "resourceType",
            "resourceId",
            "preauthExpirationDate",
            "mgpCreatedDate",
            "executionDate",
            "cancelTransactionId",
            "action",
            "label"
        ]);
        createAttrs = _.assign(createAttrs, financeInfo);

        var transaction = yield Transaction.create(createAttrs);
        var transactionDetails;

        if (args.details) {
            transactionDetails = yield createTransactionDetails(transaction.id, args.details);
        }

        return {
            transaction: transaction,
            transactionDetails: transactionDetails || []
        };
    })();
}
