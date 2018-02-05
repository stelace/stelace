/* global BookingTransactionService, TimeService, Transaction, TransactionDetail */

module.exports = {

    getTransactionsByBooking,
    getBookingTransactionsManagers,

    createPreauthorization,
    cancelPreauthorization,
    createPayin,
    cancelPayin,
    createTransfer,
    cancelTransfer,
    createPayout,

};

const _ = require('lodash');
const moment = require('moment');

async function getTransactionsByBooking(bookingsIds) {
    bookingsIds = _.uniq(bookingsIds);

    const transactions = await Transaction.find({ bookingId: bookingsIds });
    const transactionsIds = _.pluck(transactions, 'id');

    const transactionsDetails = await TransactionDetail.find({ transactionId: transactionsIds });

    const indexedTransactions = _.groupBy(transactions, 'bookingId');
    const indexedTransactionsDetails = _.groupBy(transactionsDetails, 'transactionId');

    return _.reduce(bookingsIds, (memo, bookingId) => {
        const transactions = indexedTransactions[bookingId] || [];

        memo[bookingId] = {
            transactions: transactions,
            transactionsDetails: _.reduce(transactions, (memo2, transaction) => {
                memo2 = memo2.concat(indexedTransactionsDetails[transaction.id] || []);
                return memo2;
            }, [])
        };

        return memo;
    }, {});
}

async function getBookingTransactionsManagers(bookingsIds) {
    const res = await getTransactionsByBooking(bookingsIds);

    return _.reduce(bookingsIds, (memo, bookingId) => {
        memo[bookingId] = BookingTransactionService.getBookingTransactionManager(
            res[bookingId].transactions,
            res[bookingId].transactionsDetails
        );
        return memo;
    }, {});
}

/**
 * Create a preauthorization
 * @param {Object} args
 * @param {Object} args.booking
 * @param {Number} args.preauthAmount
 * @param {String} args.label
 * @param {Object} [args.providerData = {}]
 * @return {Object} res
 * @return {Object} res.transaction
 * @return {Object[]} res.transactionDetails
 */
async function createPreauthorization(args) {
    const {
        booking,
        preauthAmount,
        providerData = {},
        label,
    } = args;

    if (! booking
     || typeof preauthAmount !== 'number' || ! preauthAmount
     || ! providerData
     || ! label
    ) {
        throw new Error('Missing params');
    }

    const config = {
        paymentProvider: booking.paymentProvider,
        currency: booking.currency,
        fromUserId: booking.takerId,
        toUserId: booking.ownerId,
        preauthAmount,
        bookingId: booking.id,
        action: 'preauthorization',
        label,
    };

    if (booking.paymentProvider === 'mangopay') {
        const { preauthorization } = providerData;
        if (!preauthorization) {
            throw new Error('Missing provider data');
        }

        config.resourceType = 'preauthorization';
        config.resourceId = preauthorization.Id;
        config.preauthExpirationDate = new Date(parseInt(preauthorization.ExpirationDate, 10) * 1000).toISOString();
    } else if (booking.paymentProvider === 'stripe') {
        const { charge } = providerData;
        if (!charge) {
            throw new Error('Missing provider data');
        }

        config.resourceType = 'charge';
        config.resourceId = charge.id;
        config.preauthExpirationDate = moment(new Date(charge.created * 1000)).add(7, 'd').toISOString();
    }

    const result = await Transaction.createTransaction(config);
    return result;
}

/**
 * cancel preauthorization
 * @param  {Object} args
 * @param  {Object} args.transaction
 * @param  {string} args.label
 * @return {Object} res
 * @return {Object} res.transaction
 * @return {Object[]} res.transactionDetails
 */
async function cancelPreauthorization(args) {
    const {
        transaction,
        label,
    } = args;

    if (! transaction
     || ! label
    ) {
        throw new Error('Missing params');
    }

    const config = {
        paymentProvider: transaction.paymentProvider,
        currency: transaction.currency,
        fromUserId: transaction.fromUserId,
        toUserId: transaction.toUserId,
        preauthAmount: - transaction.preauthAmount,
        bookingId: transaction.bookingId,
        resourceId: transaction.resourceId,
        cancelTransactionId: transaction.id,
        action: 'preauthorization',
        label,
    };

    if (transaction.paymentProvider === 'mangopay') {
        config.resourceType = 'preauthorization';
    } else if (transaction.paymentProvider === 'stripe') {
        config.resourceType = 'charge';
    }

    const result = await Transaction.createTransaction(config);
    return result;
}

/**
 * Create a payin
 * @param  {Object} args
 * @param  {Object} args.booking
 * @param  {Object} [args.providerData = {}]
 * @param  {Number} args.amount
 * @param  {String} args.label
 * @param  {Number} [args.takerFees = 0]
 * @return {Object} res
 * @return {Object} res.transaction
 * @return {Object[]} res.transactionDetails
 */
async function createPayin(args) {
    const {
        booking,
        providerData = {},
        amount,
        label,
        takerFees = 0,
    } = args;

    if (! booking
     || ! providerData
     || ! label
     || typeof amount !== 'number' || !amount
     || typeof takerFees !== 'number'
    ) {
        throw new Error('Missing params');
    }

    const details = [
        {
            payment: amount,
            cashing: 0,
            label: 'main',
        }
    ];

    if (takerFees) {
        details.push({
            credit: takerFees,
            debit: 0,
            payment: takerFees,
            cashing: takerFees,
            label: 'taker fees',
        });
    }

    const config = {
        paymentProvider: booking.paymentProvider,
        currency: booking.currency,
        fromUserId: booking.takerId,
        toUserId: booking.ownerId,
        bookingId: booking.id,
        action: 'payin',
        label,
        details,
    };

    if (booking.paymentProvider === 'mangopay') {
        const { payin } = providerData;
        if (!payin) {
            throw new Error('Missing provider data');
        }

        config.resourceType = 'payin';
        config.resourceId = payin.Id;
        config.providerCreatedDate = TimeService.convertTimestampSecToISO(payin.CreationDate);
        config.executionDate = TimeService.convertTimestampSecToISO(payin.ExecutionDate);
    } else if (booking.paymentProvider === 'stripe') {
        const { charge } = providerData;
        if (!charge) {
            throw new Error('Missing provider data');
        }

        config.resourceType = 'charge';
        config.resourceId = charge.id;
        config.providerCreatedDate = TimeService.convertTimestampSecToISO(charge.created);
        // config.executionDate = TimeService.convertTimestampSecToISO(charge.created);
    }

    const result = await Transaction.createTransaction(config);
    return result;
}

/**
 * Cancel a payin
 * @param  {Object} args
 * @param  {Object} args.transaction
 * @param  {Object} [args.providerData = {}]
 * @param  {Number} args.amount
 * @param  {String} args.label
 * @param  {Number} [args.refundTakerFees = 0] - can be negative if fees are applied for this operation
 * @return {Object} res
 * @return {Object} res.transaction
 * @return {Object[]} res.transactionDetails
 */
async function cancelPayin(args) {
    const {
        transaction,
        providerData = {},
        amount,
        label,
        refundTakerFees = 0,
    } = args;

    if (! transaction
     || ! providerData
     || ! label
     || typeof amount !== 'number' || !amount
     || typeof refundTakerFees !== 'number'
    ) {
        throw new Error('Missing params');
    }

    const details = [
        {
            payment: - amount,
            cashing: 0,
            label: 'main',
        },
    ];

    if (refundTakerFees) {
        details.push({
            credit: - refundTakerFees,
            debit: 0,
            payment: - refundTakerFees,
            cashing: - refundTakerFees,
            label: 'taker fees',
        });
    }

    const config = {
        paymentProvider: transaction.paymentProvider,
        currency: transaction.currency,
        fromUserId: transaction.fromUserId,
        toUserId: transaction.toUserId,
        bookingId: transaction.bookingId,
        cancelTransactionId: transaction.id,
        action: 'refund payin',
        label,
        details,
    };

    if (transaction.paymentProvider === 'mangopay') {
        const { refund } = providerData;
        if (!refund) {
            throw new Error('Missing provider data');
        }

        config.resourceType = 'refund';
        config.resourceId = refund.Id;
        config.providerCreatedDate = TimeService.convertTimestampSecToISO(refund.CreationDate);
        config.executionDate = TimeService.convertTimestampSecToISO(refund.ExecutionDate);
    } else if (transaction.paymentProvider === 'stripe') {
        const { refund } = providerData;

        config.resourceType = 'refund';
        config.resourceId = refund.id;
        config.providerCreatedDate = TimeService.convertTimestampSecToISO(refund.created);
        // config.executionDate = TimeService.convertTimestampSecToISO(refund.created);
    }

    const result = await Transaction.createTransaction(config);
    return result;
}

/**
 * Create a transfer
 * @param  {Object} args
 * @param  {Object} args.booking
 * @param  {Object} [args.providerData = {}]
 * @param  {Number} args.amount
 * @param  {String} args.label
 * @param  {Number} [args.ownerFees = 0]
 * @param  {Number} [args.takerFees = 0]
 * @return {Object} res
 * @return {Object} res.transaction
 * @return {Object[]} res.transactionDetails
 */
async function createTransfer(args) {
    const {
        booking,
        providerData = {},
        amount,
        label,
        ownerFees = 0,
        takerFees = 0,
    } = args;


    if (! booking
     || ! providerData
     || typeof amount !== 'number' || !amount
     || ! label
    ) {
        throw new Error('Missing params');
    }

    const details = [
        {
            payment: 0,
            cashing: amount,
            label: 'main',
        },
    ];

    if (ownerFees) {
        details.push({
            credit: ownerFees,
            debit: 0,
            payment: 0,
            cashing: ownerFees,
            label: 'owner fees',
        });
    }
    if (takerFees) {
        details.push({
            credit: takerFees,
            debit: 0,
            payment: 0,
            cashing: takerFees,
            label: 'taker fees',
        });
    }

    const config = {
        paymentProvider: booking.paymentProvider,
        currency: booking.currency,
        fromUserId: booking.takerId,
        toUserId: booking.ownerId,
        bookingId: booking.id,
        action: 'transfer',
        label,
        details,
    };

    if (booking.paymentProvider === 'mangopay') {
        const { transfer } = providerData;
        if (!transfer) {
            throw new Error('Missing provider data');
        }

        config.resourceType = 'transfer';
        config.resourceId = transfer.Id;
        config.providerCreatedDate = TimeService.convertTimestampSecToISO(transfer.CreationDate);
        config.executionDate = TimeService.convertTimestampSecToISO(transfer.ExecutionDate);
    } else if (booking.paymentProvider === 'stripe') {
        const { transfer } = providerData;
        if (!transfer) {
            throw new Error('Missing provider data');
        }

        config.resourceType = 'transfer';
        config.resourceId = transfer.id;
        config.providerCreatedDate = TimeService.convertTimestampSecToISO(transfer.created);
        // config.executionDate = TimeService.convertTimestampSecToISO(transfer.created);
    }

    const result = await Transaction.createTransaction(config);
    return result;
}

/**
 * Cancel a transfer
 * @param  {Object} args
 * @param  {Object} args.transaction
 * @param  {Object} [args.providerData = {}]
 * @param  {Number} args.amount
 * @param  {String} args.label
 * @param  {Number} [args.refundOwnerFees = 0]
 * @param  {Number} [args.refundTakerFees = 0]
 * @return {Object} res
 * @return {Object} res.transaction
 * @return {Object[]} res.transactionDetails
 */
async function cancelTransfer(args) {
    const {
        transaction,
        providerData = {},
        amount,
        label,
        refundOwnerFees = 0,
        refundTakerFees = 0,
    } = args;

    if (! transaction
     || ! providerData
     || typeof amount !== 'number' || !amount
     || ! label
    ) {
        throw new Error('Missing params');
    }

    const details = [
        {
            payment: 0,
            cashing: - amount,
            label: 'main',
        },
    ];

    if (refundOwnerFees) {
        details.push({
            credit: - refundOwnerFees,
            debit: 0,
            payment: 0,
            cashing: - refundOwnerFees,
            label: 'owner fees',
        });
    }
    if (refundTakerFees) {
        details.push({
            credit: - refundTakerFees,
            debit: 0,
            payment: 0,
            cashing: - refundTakerFees,
            label: 'taker fees',
        });
    }

    const config = {
        paymentProvider: transaction.paymentProvider,
        currency: transaction.currency,
        fromUserId: transaction.fromUserId,
        toUserId: transaction.toUserId,
        bookingId: transaction.bookingId,
        cancelTransactionId: transaction.id,
        action: 'refund transfer',
        label,
        details,
    };

    if (transaction.paymentProvider === 'mangopay') {
        const { refund } = providerData;
        if (!refund) {
            throw new Error('Missing provider data');
        }

        config.resourceType = 'refund';
        config.resourceId = refund.Id;
        config.providerCreatedDate = TimeService.convertTimestampSecToISO(refund.CreationDate);
        config.executionDate = TimeService.convertTimestampSecToISO(refund.ExecutionDate);
    } else if (transaction.paymentProvider === 'stripe') {
        const { transferReversal } = providerData;
        if (!transferReversal) {
            throw new Error('Missing provider data');
        }

        config.resourceType = 'transferReversal';
        config.resourceId = transferReversal.id;
        config.providerCreatedDate = TimeService.convertTimestampSecToISO(transferReversal.created);
        // config.executionDate = TimeService.convertTimestampSecToISO(transferReversal.created);
    }

    const result = await Transaction.createTransaction(config);
    return result;
}

/**
 * Create a payout
 * @param  {Object} args
 * @param  {Object} args.booking
 * @param  {Object} [args.providerData = {}]
 * @param  {Number} args.payoutAmount
 * @param  {String} args.label
 * @return {Object} res
 * @return {Object} res.transaction
 * @return {Object[]} res.transactionDetails
 */
async function createPayout(args) {
    const {
        booking,
        providerData = {},
        payoutAmount,
        label,
    } = args;

    if (!booking
     || !providerData
     || typeof payoutAmount !== 'number' || !payoutAmount
     || !label
    ) {
        throw new Error('Missing params');
    }

    const config = {
        paymentProvider: booking.paymentProvider,
        currency: booking.currency,
        fromUserId: booking.takerId,
        toUserId: booking.ownerId,
        payoutAmount,
        bookingId: booking.id,
        action: 'payout',
        label,
    };

    if (booking.paymentProvider === 'mangopay') {
        const { payout } = providerData;
        if (!payout) {
            throw new Error('Missing provider data');
        }

        config.resourceType = 'payout';
        config.resourceId = payout.Id;
        config.providerCreatedDate = TimeService.convertTimestampSecToISO(payout.CreationDate);
        config.executionDate = payout.ExecutionDate ? TimeService.convertTimestampSecToISO(payout.ExecutionDate) : null;
    } else if (booking.paymentProvider === 'stripe') {
        const { payout } = providerData;
        if (!payout) {
            throw new Error('Missing provider data');
        }

        config.resourceType = 'payout';
        config.resourceId = payout.id;
        config.providerCreatedDate = TimeService.convertTimestampSecToISO(payout.created);
        // config.executionDate = payout.ExecutionDate ? TimeService.convertTimestampSecToISO(payout.created) : null;
    }

    const result = await Transaction.createTransaction(config);
    return result;
}
