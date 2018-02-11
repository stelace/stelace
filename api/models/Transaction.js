/* global Transaction, TransactionDetail */

/**
* Transaction.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        id: {
            type: 'number',
            columnType: 'int',
            autoIncrement: true,
        },
        createdDate: {
            type: 'string',
            columnType: 'varchar(255)',
            maxLength: 255,
        },
        updatedDate: {
            type: 'string',
            columnType: 'varchar(255)',
            maxLength: 255,
        },
        paymentProvider: { // 'stripe' or 'mangopay'
            type: 'string',
            columnType: 'varchar(255)',
            required: true,
            maxLength: 255,
        },
        currency: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        fromUserId: {
            type: 'number',
            columnType: 'int',
            // index: true,
        },
        toUserId: {
            type: 'number',
            columnType: 'int',
            // index: true,
        },
        paymentData: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
        credit: {
            type: 'number',
            columnType: 'float',
            allowNull: true,
        },
        debit: {
            type: 'number',
            columnType: 'float',
            allowNull: true,
        },
        payment: {
            type: 'number',
            columnType: 'float',
            allowNull: true,
        },
        cashing: {
            type: 'number',
            columnType: 'float',
            allowNull: true,
        },
        preauthAmount: {
            type: 'number',
            columnType: 'float',
            allowNull: true,
        },
        payoutAmount: {
            type: 'number',
            columnType: 'float',
            allowNull: true,
        },
        bookingId: {
            type: 'number',
            columnType: 'int',
            // index: true,
            required: true,
        },
        resourceType: {
            type: 'string',
            columnType: 'varchar(255)',
            required: true,
            maxLength: 255,
        },
        resourceId: {
            type: 'string',
            columnType: 'varchar(255)',
            required: true,
            maxLength: 255,
        },
        preauthExpirationDate: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        providerCreatedDate: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        mgpCreatedDate: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        executionDate: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        cancelTransactionId: { // if set, this transaction cancels entirely or partially another one
            type: 'number',
            columnType: 'int',
            allowNull: true,
            // index: true,
        },
        action: {
            type: 'string',
            columnType: 'varchar(255)',
            required: true,
            maxLength: 255,
        },
        label: {
            type: 'string',
            columnType: 'varchar(255)',
            required: true,
            maxLength: 255,
        },
    },

    isPreauthorizationCancellable,

    createTransactionDetails,
    createTransaction,

};

const moment = require('moment');
const _ = require('lodash');
const Promise = require('bluebird');

// cannot cancel after "the expiration date - 5 minutes"
function isPreauthorizationCancellable(transaction) {
    var now = moment().toISOString();
    return now < moment(transaction.preauthExpirationDate).subtract(5, 'm').toISOString();
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
async function createTransactionDetails(transactionId, details) {
    if (! isValidTransactionsDetails(details)) {
        throw new Error('Bad details');
    }

    const transactionDetails = await Promise.mapSeries(details, detail => {
        const createAttrs = _.pick(detail, [
            'label',
            'credit',
            'debit',
            'payment',
            'cashing',
        ]);
        createAttrs.transactionId = transactionId;

        return TransactionDetail.create(createAttrs);
    });

    return transactionDetails;
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
async function createTransaction(args) {
    if (! args.fromUserId
     || ! args.resourceType
     || ! args.resourceId
     || ! args.action
     || ! args.label
     || (args.details && ! isValidTransactionsDetails(args.details))
    ) {
        throw new Error('Missing params');
    }

    var financeInfo = _.reduce(args.details, (memo, detail) => {
        if (typeof detail.credit === 'number') {
            memo.credit += detail.credit;
        }
        if (typeof detail.debit === 'number') {
            memo.debit += detail.debit;
        }
        if (typeof detail.payment === 'number') {
            memo.payment += detail.payment;
        }
        if (typeof detail.cashing === 'number') {
            memo.cashing += detail.cashing;
        }
        return memo;
    }, {
        credit: 0,
        debit: 0,
        payment: 0,
        cashing: 0
    });

    let createAttrs = _.pick(args, [
        'fromUserId',
        'toUserId',
        'paymentProvider',
        'currency',
        'paymentData',
        'preauthAmount',
        'payoutAmount',
        'bookingId',
        'resourceType',
        'resourceId',
        'preauthExpirationDate',
        'providerCreatedDate',
        'executionDate',
        'cancelTransactionId',
        'action',
        'label',
    ]);
    createAttrs = _.assign(createAttrs, financeInfo);

    const transaction = await Transaction.create(createAttrs);
    let transactionDetails;

    if (args.details) {
        transactionDetails = await createTransactionDetails(transaction.id, args.details);
    }

    return {
        transaction: transaction,
        transactionDetails: transactionDetails || []
    };
}
