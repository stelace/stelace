/* global Booking, MathService, PaymentMangopayService, PaymentStripeService, PricingService, StelaceConfigService, TransactionService, User */

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

function getRenewDepositAmount(booking) {
    if (booking.paymentProvider === 'mangopay') {
        var renewDepositDefaultAmount = 49; // 49€, only renew this amount to avoid secure mode
        return Math.min(renewDepositDefaultAmount, booking.deposit);
    } else {
        const maxDeposit = 500;
        return Math.min(maxDeposit, Math.round(booking.deposit / 2));
    }
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

function checkStripeItems(booking, { owner, taker }) {
    const error = new Error('Users have missing account');
    error.bookingId = booking.id;
    error.users = {};

    if (owner) {
        if (!User.getStripeAccountId(owner)) {
            error.users.owner = owner;
        }
    }
    if (taker) {
        if (!User.getStripeCustomerId(taker)) {
            error.users.taker = taker;
        }
    }

    if (Object.keys(error.users).length) {
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
async function stopMangopayRenewDepositIfFailed(newPreauth, booking) {
    if (newPreauth.Status !== 'FAILED') {
        return;
    }

    const error = createError('Preauthorization fail', {
        preauthorization: newPreauth,
    });

    try {
        await Booking.updateOne(booking.id, { stopRenewDeposit: true });
    } catch (err) {
        throw error;
    }

    throw error;
}

async function stopStripeRenewDepositIfFailed(charge, booking) {
    if (charge.status !== 'FAILED') {
        return;
    }

    const error = createError('Preauth charge fail', {
        charge,
    });

    try {
        await Booking.updateOne(booking.id, { stopRenewDeposit: true });
    } catch (err) {
        throw error;
    }

    throw error;
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

    const config = await StelaceConfigService.getConfig();
    const paymentProvider = config.payment_provider;

    const renewDepositAmount = getRenewDepositAmount(booking);

    const deposit = getDeposit(transactionManager);

    if (! deposit) {
        throw createError('Booking has no deposit', {
            bookingId: booking.id,
        });
    }

    let providerData;

    if (paymentProvider === 'mangopay') {
        const newPreauth = await PaymentMangopayService.copyPreauthorization({
            transaction: deposit,
            amount: renewDepositAmount,
        });
        await stopMangopayRenewDepositIfFailed(newPreauth, booking);

        providerData = {
            preauthorization: newPreauth,
        };
    } else if (paymentProvider === 'stripe') {
        const charge = await PaymentStripeService.copyChargePreauthorization({
            transaction: deposit,
            amount: renewDepositAmount,
        });
        await stopStripeRenewDepositIfFailed(charge, booking);

        providerData = {
            charge,
        };
    }

    let resultTransaction = await TransactionService.createPreauthorization({
        booking,
        providerData,
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

    const config = await StelaceConfigService.getConfig();
    const paymentProvider = config.payment_provider;

    const transactionsToCancel = getDepositsToCancel(transactionManager);

    await Promise.each(transactionsToCancel, async (transaction) => {
        if (paymentProvider === 'mangopay') {
            await PaymentMangopayService.cancelPreauthorization({ transaction }).catch(() => {});
        } else if (paymentProvider === 'stripe') {
            await PaymentStripeService.cancelChargePreauthorization({ transaction }).catch(() => {});
        }

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

    const config = await StelaceConfigService.getConfig();
    const paymentProvider = config.payment_provider;

    const transaction = getNonCancelledPreauthPayment(transactionManager);
    const skipProcessWithUpdate = !transaction;

    if (!skipProcessWithUpdate) {
        if (paymentProvider === 'mangopay') {
            await PaymentMangopayService.cancelPreauthorization({ transaction }).catch(() => {});
        } else if (paymentProvider === 'stripe') {
            await PaymentStripeService.cancelChargePreauthorization({ transaction }).catch(() => {});
        }

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

    const config = await StelaceConfigService.getConfig();
    const paymentProvider = config.payment_provider;

    if (paymentProvider === 'mangopay') {
        checkMangopayItems(booking, [taker]);
    } else if (paymentProvider === 'stripe') {
        checkStripeItems(booking, { taker });
    }

    const payin = transactionManager.getPayinPayment();

    paymentValues = _.defaults({}, paymentValues, {
        amount: booking.takerPrice,
    });

    const amount = paymentValues.amount;

    const skipProcessWithUpdate = !amount || payin;

    let providerData;

    if (!skipProcessWithUpdate) {
        const preauthPayment = getNonCancelledPreauthPayment(transactionManager);

        if (! preauthPayment) {
            throw createError('Booking has no preauth payment', {
                bookingId: booking.id,
            });
        }

        if (paymentProvider === 'mangopay') {
            const mangopayPayin = await PaymentMangopayService.createPayin({
                booking,
                transaction: preauthPayment,
                taker,
                amount,
            });

            providerData = {
                payin: mangopayPayin,
            };
        } else if (paymentProvider === 'stripe') {
            const charge = await PaymentStripeService.createChargePayin({
                booking,
                transaction: preauthPayment,
                amount,
            });

            providerData = {
                charge,
            };
        }

        const resultTransaction = await TransactionService.createPayin({
            booking,
            providerData,
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
    const config = await StelaceConfigService.getConfig();
    const paymentProvider = config.payment_provider;

    if (paymentProvider === 'mangopay') {
        checkMangopayItems(booking, [taker]);
    } else if (paymentProvider === 'stripe') {
        checkStripeItems(booking, { taker });
    }

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
        let providerData;

        if (paymentProvider === 'mangopay') {
            const refund = await PaymentMangopayService.cancelPayin({
                booking,
                transaction: payin,
                taker,
                amount,
            });

            providerData = {
                refund,
            };
        } else if (paymentProvider === 'stripe') {
            const refund = await PaymentStripeService.cancelChargePayin({
                booking,
                transaction: payin,
                amount,
            });

            providerData = {
                refund,
            };
        }

        const resultTransaction = await TransactionService.cancelPayin({
            transaction: payin,
            providerData,
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

    const config = await StelaceConfigService.getConfig();
    const paymentProvider = config.payment_provider;

    if (paymentProvider === 'mangopay') {
        checkMangopayItems(booking, [taker, owner]);
    } else if (paymentProvider === 'stripe') {
        checkStripeItems(booking, { owner, taker });
    }

    const payin = transactionManager.getPayinPayment();
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

    const skipProcessWithUpdate = (! amount && ! ownerFees && ! takerFees)
        || transfer;

    if (!skipProcessWithUpdate) {
        let providerData;

        if (paymentProvider === 'mangopay') {
            const mgpSumFees = MathService.roundDecimal(ownerFees + takerFees, 2);
            const mgpAmount  = MathService.roundDecimal(amount + mgpSumFees, 2);

            const transfer = await PaymentMangopayService.createTransfer({
                booking,
                taker,
                owner,
                amount: mgpAmount,
                fees: mgpSumFees,
            });

            providerData = {
                transfer,
            };
        } else if (paymentProvider === 'stripe') {
            const transfer = await PaymentStripeService.createTransfer({
                booking,
                owner,
                amount,
                chargeId: payin.resourceId,
                // transferGroup,
            });

            providerData = {
                transfer,
            };
        }

        const resultTransaction = await TransactionService.createTransfer({
            booking,
            providerData,
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
    const config = await StelaceConfigService.getConfig();
    const paymentProvider = config.payment_provider;

    if (paymentProvider === 'mangopay') {
        checkMangopayItems(booking, [taker]);
    } else if (paymentProvider === 'stripe') {
        checkStripeItems(booking, { taker });
    }

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

    let providerData;

    if (paymentProvider === 'mangopay') {
        const refund = await PaymentMangopayService.cancelTransfer({
            booking,
            transaction: transfer,
            taker,
        });

        providerData = {
            refund,
        };
    } else if (paymentProvider === 'stripe') {
        const transferReversal = await PaymentStripeService.cancelTransfer({
            booking,
            transaction: transfer,
            taker,
        });

        providerData = {
            transferReversal,
        };
    }

    const resultTransaction = await TransactionService.cancelTransfer({
        transaction: transfer,
        providerData,
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

    const config = await StelaceConfigService.getConfig();
    const paymentProvider = config.payment_provider;

    if (paymentProvider === 'mangopay') {
        checkMangopayItems(booking, [owner]);
    } else if (paymentProvider === 'stripe') {
        checkStripeItems(booking, { owner });
    }

    const priceResult = PricingService.getPriceAfterRebateAndFees({ booking });

    const payout = transactionManager.getPayoutPayment();

    paymentValues = _.defaults({}, paymentValues, {
        amount: priceResult.ownerNetIncome
    });

    const amount = paymentValues.amount;

    const skipProcessWithUpdate = ! amount || payout;

    if (! skipProcessWithUpdate) {
        let providerData;

        if (paymentProvider === 'mangopay') {
            const payout = await PaymentMangopayService.createPayout({
                booking,
                owner,
                amount,
            });

            providerData = {
                payout,
            };
        } else if (paymentProvider === 'stripe') {
            const payout = await PaymentStripeService.createPayout({
                booking,
                owner,
                amount,
            });

            providerData = {
                payout,
            };
        }

        const resultTransaction = await TransactionService.createPayout({
            booking,
            providerData,
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
