/* global Transaction, TransactionAccounting */

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

    createTransactionAccountings,
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

function isValidTransactionsAccountings(accountings) {
    return _.reduce(accountings, (memo, accounting) => {
        if (! accounting.label) {
            memo = memo && false;
        }
        return memo;
    }, true);
}

/**
 * create transaction accountings
 * @param  {number} transactionId
 * @param  {object} accountings
 * @param  {string} accountings.label
 * @param  {number} [accountings.credit = 0]
 * @param  {number} [accountings.debit = 0]
 * @param  {number} [accountings.payment = 0]
 * @param  {number} [accountings.cashing = 0]
 * @return {Promise<Array[object]>}
 */
async function createTransactionAccountings(transactionId, accountings) {
    if (! isValidTransactionsAccountings(accountings)) {
        throw new Error('Bad accountings');
    }

    const transactionAccountings = await Promise.mapSeries(accountings, accounting => {
        const createAttrs = _.pick(accounting, [
            'label',
            'credit',
            'debit',
            'payment',
            'cashing',
        ]);
        createAttrs.transactionId = transactionId;

        return TransactionAccounting.create(createAttrs);
    });

    return transactionAccountings;
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
 * @param  {string} [args.providerCreatedDate]
 * @param  {string} [args.executionDate]
 * @param  {number} [args.cancelTransactionId]
 * @param  {string} args.action
 * @param  {string} args.label
 * @param  {object[]} [args.accountings = []]
 * @param  {string} args.accountings[].label
 * @param  {number} [args.accountings[].credit = 0]
 * @param  {number} [args.accountings[].debit = 0]
 * @param  {number} [args.accountings[].payment = 0]
 * @param  {number} [args.accountings[].cashing = 0]
 * @return {Promise<object>} res
 * @return {object}          res.transaction
 * @return {object[]}        res.transactionAccountings
 */
async function createTransaction(args) {
    if (! args.fromUserId
     || ! args.resourceType
     || ! args.resourceId
     || ! args.action
     || ! args.label
     || (args.accountings && ! isValidTransactionsAccountings(args.accountings))
    ) {
        throw new Error('Missing params');
    }

    var financeInfo = _.reduce(args.accountings, (memo, accounting) => {
        if (typeof accounting.credit === 'number') {
            memo.credit += accounting.credit;
        }
        if (typeof accounting.debit === 'number') {
            memo.debit += accounting.debit;
        }
        if (typeof accounting.payment === 'number') {
            memo.payment += accounting.payment;
        }
        if (typeof accounting.cashing === 'number') {
            memo.cashing += accounting.cashing;
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
    let transactionAccountings;

    if (args.accountings) {
        transactionAccountings = await createTransactionAccountings(transaction.id, args.accountings);
    }

    return {
        transaction: transaction,
        transactionAccountings: transactionAccountings || []
    };
}
