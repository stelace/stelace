/* global BookingTransactionService, TimeService, Transaction, TransactionDetail */

module.exports = {

    getTransactionsByBooking: getTransactionsByBooking,
    getBookingTransactionsManagers: getBookingTransactionsManagers,

    createPreauthorization: createPreauthorization,
    cancelPreauthorization: cancelPreauthorization,
    createPayin: createPayin,
    cancelPayin: cancelPayin,
    createTransfer: createTransfer,
    cancelTransfer: cancelTransfer,
    createPayout: createPayout

};

var moment = require('moment');
const _ = require('lodash');
const Promise = require('bluebird');

function getTransactionsByBooking(bookingsIds) {
    return Promise.coroutine(function* () {
        bookingsIds = _.uniq(bookingsIds);

        var transactions = yield Transaction.find({ bookingId: bookingsIds });
        var transactionsIds = _.pluck(transactions, "id");

        var transactionsDetails = yield TransactionDetail.find({ transactionId: transactionsIds });

        var indexedTransactions        = _.groupBy(transactions, "bookingId");
        var indexedTransactionsDetails = _.groupBy(transactionsDetails, "transactionId");

        return _.reduce(bookingsIds, (memo, bookingId) => {
            var transactions = indexedTransactions[bookingId] || [];

            memo[bookingId] = {
                transactions: transactions,
                transactionsDetails: _.reduce(transactions, (memo2, transaction) => {
                    memo2 = memo2.concat(indexedTransactionsDetails[transaction.id] || []);
                    return memo2;
                }, [])
            };

            return memo;
        }, {});
    })();
}

function getBookingTransactionsManagers(bookingsIds) {
    return Promise.coroutine(function* () {
        var res = yield getTransactionsByBooking(bookingsIds);

        return _.reduce(bookingsIds, (memo, bookingId) => {
            memo[bookingId] = BookingTransactionService.getBookingTransactionManager(
                res[bookingId].transactions,
                res[bookingId].transactionsDetails
            );
            return memo;
        }, {});
    })();
}

/**
 * create preauthorization
 * @param  {object} args
 * @param  {object} args.booking
 * @param  {object} args.preauthorization
 * @param  {number} args.preauthAmount
 * @param  {string} args.label
 * @return {Promise<object>} res
 * @return {object}          res.transaction
 * @return {object[]}        res.transactionDetails
 */
function createPreauthorization(args) {
    return Promise.coroutine(function* () {
        var booking          = args.booking;
        var preauthorization = args.preauthorization;
        var preauthAmount    = args.preauthAmount;
        var label            = args.label;

        if (! booking
         || ! preauthorization
         || ! preauthAmount
         || ! label
        ) {
            throw new Error("Missing params");
        }

        var config = {
            fromUserId: booking.takerId,
            toUserId: booking.ownerId,
            preauthAmount: preauthAmount,
            bookingId: booking.id,
            resourceType: "preauthorization",
            resourceId: preauthorization.Id,
            preauthExpirationDate: moment(parseInt(preauthorization.ExpirationDate, 10) * 1000).toISOString(),
            action: "preauthorization",
            label: label
        };

        return yield Transaction.createTransaction(config);
    })();
}

/**
 * cancel preauthorization
 * @param  {object} args
 * @param  {object} args.transaction
 * @param  {string} args.label
 * @return {Promise<object>} res
 * @return {object}          res.transaction
 * @return {object[]}        res.transactionDetails
 */
function cancelPreauthorization(args) {
    return Promise.coroutine(function* () {
        var transaction = args.transaction;
        var label       = args.label;

        if (! transaction
         || ! label
        ) {
            throw new Error("Missing params");
        }

        var config = {
            fromUserId: transaction.fromUserId,
            toUserId: transaction.toUserId,
            preauthAmount: - transaction.preauthAmount,
            bookingId: transaction.bookingId,
            resourceType: "preauthorization",
            resourceId: transaction.resourceId,
            cancelTransactionId: transaction.id,
            action: "preauthorization",
            label: label
        };

        return yield Transaction.createTransaction(config);
    })();
}

/**
 * create payin
 * @param  {object} args
 * @param  {object} args.booking
 * @param  {object} args.payin
 * @param  {number} args.amount
 * @param  {string} args.label
 * @param  {number} [args.takerFees]
 * @return {Promise<object>} res
 * @return {object}          res.transaction
 * @return {object[]}        res.transactionDetails
 */
function createPayin(args) {
    return Promise.coroutine(function* () {
        var booking   = args.booking;
        var payin     = args.payin;
        var amount    = args.amount;
        var label     = args.label;
        var takerFees = args.takerFees || 0;

        if (! booking
         || ! payin
         || ! amount
         || ! label
        ) {
            throw new Error("Missing params");
        }

        var details = [];

        if (amount) {
            details.push({
                payment: amount,
                cashing: 0,
                label: "main"
            });
        }
        if (takerFees) {
            details.push({
                credit: takerFees,
                debit: 0,
                payment: takerFees,
                cashing: takerFees,
                label: "taker fees"
            });
        }

        var config = {
            fromUserId: booking.takerId,
            toUserId: booking.ownerId,
            fromWalletId: payin.CreditedWalletId,
            bookingId: booking.id,
            resourceType: "payin",
            resourceId: payin.Id,
            mgpCreatedDate: TimeService.convertTimestampSecToISO(payin.CreationDate),
            executionDate: TimeService.convertTimestampSecToISO(payin.ExecutionDate),
            action: "payin",
            label: label,
            details: details
        };

        return yield Transaction.createTransaction(config);
    })();
}

/**
 * cancel payin
 * @param  {object} args
 * @param  {object} args.transaction
 * @param  {object} args.refund
 * @param  {number} args.amount
 * @param  {string} args.label
 * @param  {number} [args.refundTakerFees] - can be negative if fees are applied for this operation
 * @return {Promise<object>} res
 * @return {object}          res.transaction
 * @return {object[]}        res.transactionDetails
 */
function cancelPayin(args) {
    return Promise.coroutine(function* () {
        var transaction     = args.transaction;
        var refund          = args.refund;
        var amount          = args.amount;
        var label           = args.label;
        var refundTakerFees = args.refundTakerFees || 0;

        if (! transaction
         || ! refund
         || typeof amount === "undefined"
         || ! label
        ) {
            throw new Error("Missing params");
        }

        var details = [];

        if (amount) {
            details.push({
                payment: - amount,
                cashing: 0,
                label: "main"
            });
        }
        if (refundTakerFees) {
            details.push({
                credit: - refundTakerFees,
                debit: 0,
                payment: - refundTakerFees,
                cashing: - refundTakerFees,
                label: "taker fees"
            });
        }

        var config = {
            fromUserId: transaction.fromUserId,
            toUserId: transaction.toUserId,
            fromWalletId: refund.DebitedWalletId,
            bookingId: transaction.bookingId,
            resourceType: "refund",
            resourceId: refund.Id,
            mgpCreatedDate: TimeService.convertTimestampSecToISO(refund.CreationDate),
            executionDate: TimeService.convertTimestampSecToISO(refund.ExecutionDate),
            cancelTransactionId: transaction.id,
            action: "refund payin",
            label: label,
            details: details
        };

        return yield Transaction.createTransaction(config);
    })();
}

/**
 * create transfer
 * @param  {object} args
 * @param  {object} args.booking
 * @param  {object} args.tranfer
 * @param  {number} args.amount
 * @param  {string} args.label
 * @param  {number} [args.ownerFees]
 * @param  {number} [args.takerFees]
 * @return {Promise<object>} res
 * @return {object}          res.transaction
 * @return {object[]}        res.transactionDetails
 */
function createTransfer(args) {
    return Promise.coroutine(function* () {
        var booking   = args.booking;
        var transfer  = args.transfer;
        var amount    = args.amount;
        var label     = args.label;
        var ownerFees = args.ownerFees || 0;
        var takerFees = args.takerFees || 0;

        if (! booking
         || ! transfer
         || typeof amount === "undefined"
         || ! label
        ) {
            throw new Error("Missing params");
        }

        var details = [];

        if (amount) {
            details.push({
                payment: 0,
                cashing: amount,
                label: "main"
            });
        }
        if (ownerFees) {
            details.push({
                credit: ownerFees,
                debit: 0,
                payment: 0,
                cashing: ownerFees,
                label: "owner fees"
            });
        }
        if (takerFees) {
            details.push({
                credit: takerFees,
                debit: 0,
                payment: 0,
                cashing: takerFees,
                label: "taker fees"
            });
        }

        var config = {
            fromUserId: booking.takerId,
            toUserId: booking.ownerId,
            fromWalletId: transfer.DebitedWalletId,
            toWalletId: transfer.CreditedWalletId,
            bookingId: booking.id,
            resourceType: "transfer",
            resourceId: transfer.Id,
            mgpCreatedDate: TimeService.convertTimestampSecToISO(transfer.CreationDate),
            executionDate: TimeService.convertTimestampSecToISO(transfer.ExecutionDate),
            action: "transfer",
            label: label,
            details: details
        };

        return yield Transaction.createTransaction(config);
    })();
}

/**
 * cancel transfer
 * @param  {object} args
 * @param  {object} args.transaction
 * @param  {object} args.refund
 * @param  {number} args.amount
 * @param  {string} args.label
 * @param  {number} [args.refundOwnerFees]
 * @param  {number} [args.refundTakerFees]
 * @return {Promise<object>} res
 * @return {object}          res.transaction
 * @return {object[]}        res.transactionDetails
 */
function cancelTransfer(args) {
    return Promise.coroutine(function* () {
        var transaction     = args.transaction;
        var refund          = args.refund;
        var amount          = args.amount;
        var label           = args.label;
        var refundOwnerFees = args.refundOwnerFees;
        var refundTakerFees = args.refundTakerFees;

        if (! transaction
         || ! refund
         || ! amount
         || ! label
        ) {
            throw new Error("Missing params");
        }

        var details = [];

        if (amount) {
            details.push({
                payment: 0,
                cashing: - amount,
                label: "main"
            });
        }
        if (refundOwnerFees) {
            details.push({
                credit: - refundOwnerFees,
                debit: 0,
                payment: 0,
                cashing: - refundOwnerFees,
                label: "owner fees"
            });
        }
        if (refundTakerFees) {
            details.push({
                credit: - refundTakerFees,
                debit: 0,
                payment: 0,
                cashing: - refundTakerFees,
                label: "taker fees"
            });
        }

        var config = {
            fromUserId: transaction.fromUserId,
            toUserId: transaction.toUserId,
            fromWalletId: refund.CreditedWalletId,
            toWalletId: refund.DebitedWalletId,
            bookingId: transaction.bookingId,
            resourceType: "refund",
            resourceId: refund.Id,
            mgpCreatedDate: TimeService.convertTimestampSecToISO(refund.CreationDate),
            executionDate: TimeService.convertTimestampSecToISO(refund.ExecutionDate),
            cancelTransactionId: transaction.id,
            action: "refund transfer",
            label: label,
            details: details
        };

        return yield Transaction.createTransaction(config);
    })();
}

/**
 * create payout
 * @param  {object} args
 * @param  {object} args.booking
 * @param  {object} args.payout
 * @param  {number} args.payoutAmount
 * @param  {string} args.label
 * @return {Promise<object>} res
 * @return {object}          res.transaction
 * @return {object[]}        res.transactionDetails
 */
function createPayout(args) {
    return Promise.coroutine(function* () {
        var booking      = args.booking;
        var payout       = args.payout;
        var payoutAmount = args.payoutAmount;
        var label        = args.label;

        if (! booking
         || ! payout
         || ! payoutAmount
         || ! label
        ) {
            throw new Error("Missing params");
        }

        var config = {
            fromUserId: booking.takerId,
            toUserId: booking.ownerId,
            toWalletId: payout.DebitedWalletId,
            bankAccountId: payout.BankAccountId,
            payoutAmount: payoutAmount,
            bookingId: booking.id,
            resourceType: "payout",
            resourceId: payout.Id,
            mgpCreatedDate: TimeService.convertTimestampSecToISO(payout.CreationDate),
            executionDate: payout.ExecutionDate ? TimeService.convertTimestampSecToISO(payout.ExecutionDate) : null,
            action: "payout",
            label: label
        };

        return yield Transaction.createTransaction(config);
    })();
}
