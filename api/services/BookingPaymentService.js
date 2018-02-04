/* global Booking, MathService, PaymentMangopayService, PricingService, TransactionService, User */

module.exports = {

    renewDeposit,
    cancelDeposit,
    cancelPreauthPayment,
    payinPayment,
    cancelPayinPayment,
    transferPayment,
    cancelTransferPayment,
    payoutPayment,

};

const _ = require('lodash');
const Promise = require('bluebird');
const createError = require('http-errors');

var renewDepositDefaultAmount = 49; // 49€, only renew this amount to avoid secure mode

function getRenewDepositAmount(booking, renewDepositDefaultAmount) {
    return Math.min(renewDepositDefaultAmount, booking.deposit);
}

function addTransactionToManager(transactionManager, resultTransaction) {
    transactionManager.addTransaction(
        resultTransaction.transaction,
        resultTransaction.transactionDetails
    );
}

function checkMangopayItems(booking, users) {
    var error = new Error("Users has no mangopay account or wallet");
    error.bookingId = booking.id;
    error.usersIds = [];

    _.forEach(users, user => {
        if (!User.getMangopayUserId(user) || !User.getMangopayWalletId(user)) {
            error.usersIds.push(user.id);
        }
    });

    if (error.usersIds.length) {
        throw error;
    }
}


//////////////////////
// GET TRANSACTIONS //
//////////////////////
function getDeposit(transactionManager) {
    var deposit        = transactionManager.getDeposit();
    var depositPayment = transactionManager.getDepositPayment();

    return deposit || depositPayment;
}

function getPreviousRenewDeposit(transactionManager) {
    var renewDeposits = transactionManager.getNonCancelledRenewDeposits();

    var lastRenewDeposit = _.last(renewDeposits);

    if (! lastRenewDeposit) {
        return;
    }

    return _.last(_.filter(renewDeposits, renewDeposit => {
        return renewDeposit.id !== lastRenewDeposit.id;
    }));
}

function getDepositsToCancel(transactionManager) {
    return transactionManager.getNonCancelledTransactions(transaction => {
        return transaction.action === "preauthorization"
            && _.contains(["deposit", "deposit renew"], transaction.label);
    });
}

function getNonCancelledPreauthPayment(transactionManager) {
    var payment        = transactionManager.getNonCancelledPreauthPayment();
    var depositPayment = transactionManager.getNonCancelledDepositPayment();

    return payment || depositPayment;
}



//////////////////
// STOP PROCESS //
//////////////////
function stopRenewDepositIfFailed(newPreauth, booking) {
    return Promise.coroutine(function* () {
        if (newPreauth.Status !== "FAILED") {
            return;
        }

        var error = new Error("Preauthorization fail");
        error.preauthorization = newPreauth;

        yield Booking.updateOne(booking.id, { stopRenewDeposit: true })
            .then(() => { throw error; })
            .catch(() => { throw error; });
    })();
}



////////////////////
// IMPLEMENTATION //
////////////////////
async function renewDeposit(booking, transactionManager) {
    const skipProcess = booking.cancellationDepositDate
        || booking.stopRenewDeposit
        || booking.deposit === 0;

    if (skipProcess) {
        return booking;
    }

    const renewDepositAmount = getRenewDepositAmount(booking, renewDepositDefaultAmount);

    const deposit = getDeposit(transactionManager);

    if (! deposit) {
        throw createError('Booking has no deposit', {
            bookingId: booking.id,
        });
    }

    const newPreauth = await PaymentMangopayService.copyPreauthorization({
        transaction: deposit,
        amount: renewDepositAmount,
    });
    await stopRenewDepositIfFailed(newPreauth, booking);

    let resultTransaction = await TransactionService.createPreauthorization({
        booking,
        providerData: {
            preauthorization: newPreauth,
        },
        preauthAmount: renewDepositAmount,
        label: 'deposit renew',
    });
    addTransactionToManager(transactionManager, resultTransaction);

    try {
        var previousRenewDeposit = getPreviousRenewDeposit(transactionManager);
        if (previousRenewDeposit
            && ! transactionManager.isTransactionCancelled(previousRenewDeposit)
        ) {
            resultTransaction = await TransactionService.cancelPreauthorization({
                transaction: previousRenewDeposit,
                label: previousRenewDeposit.label,
            });
            addTransactionToManager(transactionManager, resultTransaction);
        }
    } catch (e) { /* do nothing */ }

    return booking;
}

async function cancelDeposit(booking, transactionManager) {
    const skipProcess = booking.cancellationDepositDate;

    if (skipProcess) {
        return booking;
    }

    const transactionsToCancel = getDepositsToCancel(transactionManager);

    await Promise.each(transactionsToCancel, async (transaction) => {
        await PaymentMangopayService.cancelPreauthorization({ transaction }).catch(() => {});

        const resultTransaction = await TransactionService.cancelPreauthorization({
            transaction: transaction,
            label: transaction.label
        });
        addTransactionToManager(transactionManager, resultTransaction);
    });

    try {
        booking = await Booking.updateOne(booking.id, { cancellationDepositDate: new Date().toISOString() });
    } catch (err) {
        // do nothing
    }

    return booking;
}

async function cancelPreauthPayment(booking, transactionManager) {
    const skipProcess = booking.cancellationPaymentDate;

    if (skipProcess) {
        return booking;
    }

    const transaction = getNonCancelledPreauthPayment(transactionManager);
    const skipProcessWithUpdate = !transaction;

    if (!skipProcessWithUpdate) {
        await PaymentMangopayService.cancelPreauthorization({ transaction }).catch(() => {});

        var resultTransaction = await TransactionService.cancelPreauthorization({
            transaction: transaction,
            label: transaction.label,
        });
        addTransactionToManager(transactionManager, resultTransaction);
    }

    try {
        booking = await Booking.updateOne(booking.id, { cancellationPaymentDate: new Date().toISOString() });
    } catch (err) {
        // do nothing
    }

    return booking;
}

/**
 * payin payment
 * @param  {object} booking
 * @param  {object} transactionManager
 * @param  {object} taker
 * @param  {object} [paymentValues]
 * @param  {number} [paymentValues.amount] - if not provided, take booking payment
 * @return {object} booking
 */
async function payinPayment(booking, transactionManager, taker, paymentValues) {
    const skipProcess = booking.paymentUsedDate;

    if (skipProcess) {
        return booking;
    }

    checkMangopayItems(booking, [taker]);

    const payin = transactionManager.getPayinPayment();

    paymentValues = _.defaults({}, paymentValues, {
        amount: booking.takerPrice,
    });

    const amount = paymentValues.amount;

    const skipProcessWithUpdate = !amount || payin;

    if (!skipProcessWithUpdate) {
        const preauthPayment = getNonCancelledPreauthPayment(transactionManager);

        if (! preauthPayment) {
            throw createError('Booking has no preauth payment', {
                bookingId: booking.id,
            });
        }

        const mangopayPayin = await PaymentMangopayService.createPayin({
            booking,
            transaction: preauthPayment,
            taker,
            amount,
        });

        const resultTransaction = await TransactionService.createPayin({
            booking,
            providerData: {
                payin: mangopayPayin,
            },
            amount,
            label: 'payment',
        });
        addTransactionToManager(transactionManager, resultTransaction);
    }

    try {
        booking = await Booking.updateOne(booking.id, { paymentUsedDate: new Date().toISOString() });
    } catch (err) {
        // do nothing
    }

    return booking;
}

/**
 * cancel payin payment
 * @param  {object} booking
 * @param  {object} transactionManager
 * @param  {object} taker
 * @param  {object} [paymentValues]
 * @param  {number} [paymentValues.amount] - if not provided, cancel booking payment
 * @return {object} booking
 */
async function cancelPayinPayment(booking, transactionManager, taker, paymentValues) {
    checkMangopayItems(booking, [taker]);

    const payin = transactionManager.getPayinPayment();

    if (!payin) {
        throw createError('Booking has no payin payment', {
            bookingId: booking.id,
        });
    }

    if (transactionManager.isTransactionCancelled(payin)) {
        return booking;
    }

    paymentValues = _.defaults({}, paymentValues, {
        amount: booking.takerPrice
    });

    const amount = paymentValues.amount;

    // do not perform refund if 0 amount
    if (amount) {
        const mangopayRefundPayin = await PaymentMangopayService.cancelPayin({
            booking,
            transaction: payin,
            taker,
            amount,
        });

        const resultTransaction = await TransactionService.cancelPayin({
            transaction: payin,
            providerData: {
                refund: mangopayRefundPayin,
            },
            amount,
            label: 'payment',
        });
        addTransactionToManager(transactionManager, resultTransaction);
    }

    return booking;
}

/**
 * transfer payment
 * @param  {object} booking
 * @param  {object} transactionManager
 * @param  {object} taker
 * @param  {object} owner
 * @param  {object} [paymentValues]
 * @param  {number} [paymentValues.amount] - if not provided, take booking payment
 * @param  {number} [paymentValues.ownerFees] - if not provided, take owner fees
 * @param  {number} [paymentValues.takerFees] - if not provided, take taker fees
 * @return {object} booking
 */
async function transferPayment(booking, transactionManager, taker, owner, paymentValues) {
    const skipProcess = booking.paymentTransferDate
        || booking.stopTransferPayment;

    if (skipProcess) {
        return booking;
    }

    checkMangopayItems(booking, [taker, owner]);

    const transfer = transactionManager.getTransferPayment();

    const priceResult = PricingService.getPriceAfterRebateAndFees({ booking });

    paymentValues = _.defaults({}, paymentValues, {
        amount: priceResult.ownerNetIncome,
        ownerFees: booking.ownerFees,
        takerFees: booking.takerFees
    });

    const amount     = paymentValues.amount;
    const ownerFees  = paymentValues.ownerFees;
    const takerFees  = paymentValues.takerFees;
    const mgpSumFees = MathService.roundDecimal(ownerFees + takerFees, 2);
    const mgpAmount  = MathService.roundDecimal(amount + mgpSumFees, 2);

    const skipProcessWithUpdate = (! amount && ! ownerFees && ! takerFees)
        || transfer;

    if (!skipProcessWithUpdate) {
        const mangopayTransfer = await PaymentMangopayService.createTransfer({
            booking,
            taker,
            owner,
            amount: mgpAmount,
            fees: mgpSumFees,
        });

        const resultTransaction = await TransactionService.createTransfer({
            booking,
            providerData: {
                transfer: mangopayTransfer,
            },
            amount,
            ownerFees,
            takerFees,
            label: 'payment',
        });

        addTransactionToManager(transactionManager, resultTransaction);
    }

    try {
        booking = await Booking.updateOne(booking.id, { paymentTransferDate: new Date().toISOString() });
    } catch (err) {
        // do nothing
    }

    return booking;
}

/**
 * cancel transfer payment
 * @param  {object} booking
 * @param  {object} transactionManager
 * @param  {object} taker
 * @param  {object} [paymentValues]
 * @param  {number} [paymentValues.amount] - if not provided, cancel booking payment
 * @param  {number} [paymentValues.refundOwnerFees] - if not provided, cancel owner fees
 * @param  {number} [paymentValues.refundTakerFees] - if not provided, cancel taker fees
 * @return {object} booking
 */
async function cancelTransferPayment(booking, transactionManager, taker, paymentValues) {
    checkMangopayItems(booking, [taker]);

    const transfer = transactionManager.getTransferPayment();

    if (! transfer) {
        throw createError('Booking has no transfer payment', {
            bookingId: booking.id,
        });
    }

    if (transactionManager.isTransactionCancelled(transfer)) {
        return booking;
    }

    const priceResult = PricingService.getPriceAfterRebateAndFees({ booking });

    paymentValues = _.defaults({}, paymentValues, {
        amount: priceResult.ownerNetIncome,
        refundOwnerFees: booking.ownerFees,
        refundTakerFees: booking.takerFees
    });

    const amount          = paymentValues.amount;
    const refundOwnerFees = paymentValues.refundOwnerFees;
    const refundTakerFees = paymentValues.refundTakerFees;

    const mangopayRefundTransfer = await PaymentMangopayService.cancelTransfer({
        booking,
        transaction: transfer,
        taker,
    });

    const resultTransaction = await TransactionService.cancelTransfer({
        transaction: transfer,
        providerData: {
            refund: mangopayRefundTransfer,
        },
        amount,
        refundOwnerFees,
        refundTakerFees,
        label: 'payment',
    });
    addTransactionToManager(transactionManager, resultTransaction);

    return booking;
}

/**
 * payout payment
 * @param  {object} booking
 * @param  {object} transactionManager
 * @param  {object} owner
 * @param  {object} [paymentValues]
 * @param  {number} [paymentValues.amount] - if not provided, take booking payment
 * @return {object} booking
 */
async function payoutPayment(booking, transactionManager, owner, paymentValues) {
    const skipProcess = booking.withdrawalDate
        || booking.stopWithdrawal;

    if (skipProcess) {
        return booking;
    }

    checkMangopayItems(booking, [owner]);

    const priceResult = PricingService.getPriceAfterRebateAndFees({ booking });

    const payout = transactionManager.getPayoutPayment();

    paymentValues = _.defaults({}, paymentValues, {
        amount: priceResult.ownerNetIncome
    });

    const amount = paymentValues.amount;

    const skipProcessWithUpdate = ! amount || payout;

    if (! skipProcessWithUpdate) {
        const mangopayPayout = await PaymentMangopayService.createPayout({
            booking,
            owner,
            amount,
        });

        const resultTransaction = await TransactionService.createPayout({
            booking,
            providerData: {
                payout: mangopayPayout,
            },
            payoutAmount: amount,
            label: 'payment',
        });
        addTransactionToManager(transactionManager, resultTransaction);
    }

    try {
        booking = await Booking.updateOne(booking.id, { withdrawalDate: new Date().toISOString() });
    } catch (err) {
        // do nothing
    }

    return booking;
}
