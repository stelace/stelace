/* global Booking, MathService, mangopay, PricingService, Transaction, TransactionService */

module.exports = {

    renewDeposit: renewDeposit,
    cancelDeposit: cancelDeposit,
    cancelPreauthPayment: cancelPreauthPayment,
    payinPayment: payinPayment,
    cancelPayinPayment: cancelPayinPayment,
    transferPayment: transferPayment,
    cancelTransferPayment: cancelTransferPayment,
    payoutPayment: payoutPayment

};

var moment = require('moment');

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
        if (! user.mangopayUserId || ! user.walletId) {
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



//////////////////////
// MANGOPAY PROCESS //
//////////////////////
function createMangopayPreauth(preauthorization, renewDepositAmount) {
    return Promise.coroutine(function* () {
        var preauth = yield mangopay.preauthorization
            .fetch({ preauthorizationId: preauthorization.resourceId });

        return yield mangopay.preauthorization
            .create({
                body: {
                    AuthorId: preauth.AuthorId,
                    DebitedFunds: { Amount: Math.round(renewDepositAmount * 100), Currency: "EUR" },
                    SecureMode: "DEFAULT",
                    CardId: preauth.CardId,
                    SecureModeReturnURL: "https://example.com" // use a real url for mangopay
                }
            });
    })();
}

function cancelMangopayPreauth(transaction) {
    return Promise.coroutine(function* () {
        if (Transaction.isPreauthorizationCancellable(transaction)) {
            yield mangopay.preauthorization
                .edit({
                    preauthorizationId: transaction.resourceId,
                    body: {
                        PaymentStatus: "CANCELED"
                    }
                })
                .catch(() => { /* do nothing */ });
        }
    })();
}

function createMangopayPayin(booking, transaction, taker, amount, takerFees) {
    takerFees = takerFees || 0;

    return Promise.coroutine(function* () {
        var payin = yield mangopay.payin.preauthorizedDirect({
            body: {
                AuthorId: taker.mangopayUserId,
                DebitedFunds: { Amount: Math.round(amount * 100), Currency: "EUR" },
                Fees: { Amount: Math.round(takerFees * 100), Currency: "EUR" },
                CreditedWalletId: taker.walletId,
                PreauthorizationId: transaction.resourceId,
                Tag: Booking.getBookingRef(booking.id)
            }
        });

        if (payin.Status === "FAILED") {
            var error = new Error("Payin creation failed");
            error.bookingId = booking.id;
            error.payin = payin;

            throw error;
        }

        return payin;
    })();
}

function cancelMangopayPayin(booking, transaction, taker, amount, refundTakerFees) {
    var refundTotally = (typeof amount === "undefined" && typeof refundTakerFees === "undefined");

    var body = {
        AuthorId: taker.mangopayUserId,
        Tag: Booking.getBookingRef(booking.id)
    };

    if (! refundTotally) {
        amount          = amount || 0;
        refundTakerFees = refundTakerFees || 0;

        body.DebitedFunds = { Amount: Math.round(amount * 100), Currency: "EUR" };
        body.Fees         = { Amount: Math.round(- refundTakerFees * 100), Currency: "EUR" };
    }

    return Promise.coroutine(function* () {
        var refund = yield mangopay.refund.payin({
            payinId: transaction.resourceId,
            body: body
        });

        if (refund.Status === "FAILED") {
            var error = new Error("Refund payin creation failed");
            error.bookingId = booking.id;
            error.refund = refund;

            throw error;
        }

        return refund;
    })();
}

function createMangopayTransfer(booking, taker, owner, amount, fees) {
    return Promise.coroutine(function* () {
        var transfer = yield mangopay.wallet.createTransfer({
            body: {
                AuthorId: taker.mangopayUserId,
                DebitedFunds: { Amount: Math.round(amount * 100), Currency: "EUR" },
                Fees: { Amount: Math.round(fees * 100), Currency: "EUR" },
                DebitedWalletId: taker.walletId,
                CreditedWalletId: owner.walletId,
                Tag: Booking.getBookingRef(booking.id)
            }
        });

        if (transfer.Status === "FAILED") {
            var error = new Error("Transfer creation failed");
            error.bookingId = booking.id;
            error.transfer = transfer;

            throw error;
        }

        return transfer;
    })();
}

function cancelMangopayTransfer(booking, transaction, taker) {
    return Promise.coroutine(function* () {
        var refund = yield mangopay.refund.transfer({
            transferId: transaction.resourceId,
            body: {
                AuthorId: taker.mangopayUserId,
                Tag: Booking.getBookingRef(booking.id)
            }
        });

        if (refund.Status === "FAILED") {
            var error = new Error("Refund transfer creation failed");
            error.bookingId = booking.id;
            error.refund = refund;

            throw error;
        }

        return refund;
    })();
}

function createMangopayPayout(booking, owner, amount) {
    return Promise.coroutine(function* () {
        var bankWireRef = Booking.getBookingRef(booking.id);

        var payout = yield mangopay.payout.create({
            body: {
                AuthorId: owner.mangopayUserId,
                DebitedWalletId: owner.walletId,
                DebitedFunds: { Amount: Math.round(amount * 100), Currency: "EUR" },
                Fees: { Amount: 0, Currency: "EUR" },
                BankAccountId: owner.bankAccountId,
                Tag: Booking.getBookingRef(booking.id),
                BankWireRef: bankWireRef
            }
        });

        if (payout.Status === "FAILED") {
            var error = new Error("Payout creation failed");
            error.bookingId = booking.id;
            error.payout = payout;

            throw error;
        }

        return payout;
    })();
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
function renewDeposit(booking, transactionManager) {
    return Promise.coroutine(function* () {
        var skipProcess = booking.cancellationDepositDate
         || booking.stopRenewDeposit
         || booking.deposit === 0;

        if (skipProcess) {
            return booking;
        }

        var renewDepositAmount = getRenewDepositAmount(booking, renewDepositDefaultAmount);

        var deposit = getDeposit(transactionManager);

        if (! deposit) {
            var error = new Error("Booking has no deposit");
            error.bookingId = booking.id;
            throw error;
        }

        var newPreauth = yield createMangopayPreauth(deposit, renewDepositAmount);
        yield stopRenewDepositIfFailed(newPreauth, booking);

        var resultTransaction;

        resultTransaction = yield TransactionService.createPreauthorization({
            booking: booking,
            preauthorization: newPreauth,
            preauthAmount: renewDepositAmount,
            label: "deposit renew"
        });
        addTransactionToManager(transactionManager, resultTransaction);

        try {
            var previousRenewDeposit = getPreviousRenewDeposit(transactionManager);
            if (previousRenewDeposit
             && ! transactionManager.isTransactionCancelled(previousRenewDeposit)
            ) {
                resultTransaction = yield TransactionService.cancelPreauthorization({
                    transaction: previousRenewDeposit,
                    label: previousRenewDeposit.label
                });
                addTransactionToManager(transactionManager, resultTransaction);
            }
        } catch (e) { /* do nothing */ }

        return booking;
    })();
}

function cancelDeposit(booking, transactionManager) {
    return Promise.coroutine(function* () {
        var skipProcess = booking.cancellationDepositDate;

        if (skipProcess) {
            return booking;
        }

        var transactionsToCancel = getDepositsToCancel(transactionManager);

        yield Promise.each(transactionsToCancel, transaction => {
            return Promise.coroutine(function* () {
                yield cancelMangopayPreauth(transaction);

                var resultTransaction = yield TransactionService.cancelPreauthorization({
                    transaction: transaction,
                    label: transaction.label
                });
                addTransactionToManager(transactionManager, resultTransaction);
            })();
        });

        return yield Booking
            .updateOne(booking.id, { cancellationDepositDate: moment().toISOString() })
            .catch(() => booking);
    })();
}

function cancelPreauthPayment(booking, transactionManager) {
    return Promise.coroutine(function* () {
        var skipProcess = booking.cancellationPaymentDate;

        if (skipProcess) {
            return booking;
        }

        var transaction = getNonCancelledPreauthPayment(transactionManager);
        var skipProcessWithUpdate = ! transaction;

        if (! skipProcessWithUpdate) {
            yield cancelMangopayPreauth(transaction);

            var resultTransaction = yield TransactionService.cancelPreauthorization({
                transaction: transaction,
                label: transaction.label
            });
            addTransactionToManager(transactionManager, resultTransaction);
        }

        return yield Booking
            .updateOne(booking.id, { cancellationPaymentDate: moment().toISOString() })
            .catch(() => booking);
    })();
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
function payinPayment(booking, transactionManager, taker, paymentValues) {
    return Promise.coroutine(function* () {
        var skipProcess = booking.paymentUsedDate;

        if (skipProcess) {
            return booking;
        }

        checkMangopayItems(booking, [taker]);

        var payin = transactionManager.getPayinPayment();

        paymentValues = _.defaults({}, paymentValues, {
            amount: booking.takerPrice
        });

        var amount = paymentValues.amount;

        var skipProcessWithUpdate = ! amount || payin;

        if (! skipProcessWithUpdate) {
            var preauthPayment = getNonCancelledPreauthPayment(transactionManager);

            if (! preauthPayment) {
                var error = new Error("Booking has no preauth payment");
                error.bookingId = booking.id;
                throw error;
            }

            var mangopayPayin = yield createMangopayPayin(booking, preauthPayment, taker, amount);

            var resultTransaction = yield TransactionService.createPayin({
                booking: booking,
                payin: mangopayPayin,
                amount: amount,
                label: "payment"
            });
            addTransactionToManager(transactionManager, resultTransaction);
        }

        return yield Booking
            .updateOne(booking.id, { paymentUsedDate: moment().toISOString() })
            .catch(() => booking);
    })();
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
function cancelPayinPayment(booking, transactionManager, taker, paymentValues) {
    return Promise.coroutine(function* () {
        checkMangopayItems(booking, [taker]);

        var payin = transactionManager.getPayinPayment();

        if (! payin) {
            var error = new Error("Booking has no payin payment");
            error.bookingId = booking.id;
            throw error;
        }

        if (transactionManager.isTransactionCancelled(payin)) {
            return booking;
        }

        paymentValues = _.defaults({}, paymentValues, {
            amount: booking.takerPrice
        });

        var amount = paymentValues.amount;

        var mangopayRefundPayin;

        // do not perform refund if 0 amount
        if (amount) {
            mangopayRefundPayin = yield cancelMangopayPayin(booking, payin, taker, amount);

            var resultTransaction = yield TransactionService.cancelPayin({
                transaction: payin,
                refund: mangopayRefundPayin,
                amount: amount,
                label: "payment"
            });
            addTransactionToManager(transactionManager, resultTransaction);
        }

        return booking;
    })();
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
function transferPayment(booking, transactionManager, taker, owner, paymentValues) {
    return Promise.coroutine(function* () {
        var skipProcess = booking.paymentTransferDate
            || booking.stopTransferPayment;

        if (skipProcess) {
            return booking;
        }

        checkMangopayItems(booking, [taker, owner]);

        var transfer = transactionManager.getTransferPayment();

        var priceResult = PricingService.getPriceAfterRebateAndFees({ booking: booking });

        paymentValues = _.defaults({}, paymentValues, {
            amount: priceResult.ownerNetIncome,
            ownerFees: booking.ownerFees,
            takerFees: booking.takerFees
        });

        var amount     = paymentValues.amount;
        var ownerFees  = paymentValues.ownerFees;
        var takerFees  = paymentValues.takerFees;
        var mgpSumFees = MathService.roundDecimal(ownerFees + takerFees, 2);
        var mgpAmount  = MathService.roundDecimal(amount + mgpSumFees, 2);

        var skipProcessWithUpdate = (! amount && ! ownerFees && ! takerFees)
            || transfer;

        if (! skipProcessWithUpdate) {
            var mangopayTransfer = yield createMangopayTransfer(booking, taker, owner, mgpAmount, mgpSumFees);

            var resultTransaction = yield TransactionService.createTransfer({
                booking: booking,
                transfer: mangopayTransfer,
                amount: amount,
                ownerFees: ownerFees,
                takerFees: takerFees,
                label: "payment"
            });

            addTransactionToManager(transactionManager, resultTransaction);
        }

        return yield Booking
            .updateOne(booking.id, { paymentTransferDate: moment().toISOString() })
            .catch(() => booking);
    })();
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
function cancelTransferPayment(booking, transactionManager, taker, paymentValues) {
    return Promise.coroutine(function* () {
        checkMangopayItems(booking, [taker]);

        var transfer = transactionManager.getTransferPayment();

        if (! transfer) {
            var error = new Error("Booking has no transfer payment");
            error.bookingId = booking.id;
            throw error;
        }

        if (transactionManager.isTransactionCancelled(transfer)) {
            return booking;
        }

        var priceResult = PricingService.getPriceAfterRebateAndFees({ booking: booking });

        paymentValues = _.defaults({}, paymentValues, {
            amount: priceResult.ownerNetIncome,
            refundOwnerFees: booking.ownerFees,
            refundTakerFees: booking.takerFees
        });

        var amount          = paymentValues.amount;
        var refundOwnerFees = paymentValues.refundOwnerFees;
        var refundTakerFees = paymentValues.refundTakerFees;

        var mangopayRefundTransfer = yield cancelMangopayTransfer(booking, transfer, taker);

        var resultTransaction = yield TransactionService.cancelTransfer({
            transaction: transfer,
            refund: mangopayRefundTransfer,
            amount: amount,
            refundOwnerFees: refundOwnerFees,
            refundTakerFees: refundTakerFees,
            label: "payment"
        });
        addTransactionToManager(transactionManager, resultTransaction);

        return booking;
    })();
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
function payoutPayment(booking, transactionManager, owner, paymentValues) {
    return Promise.coroutine(function* () {
        var skipProcess = booking.withdrawalDate
            || booking.stopWithdrawal;

        if (skipProcess) {
            return booking;
        }

        checkMangopayItems(booking, [owner]);

        var priceResult = PricingService.getPriceAfterRebateAndFees({ booking: booking });

        var payout = transactionManager.getPayoutPayment();

        paymentValues = _.defaults({}, paymentValues, {
            amount: priceResult.ownerNetIncome
        });

        var amount = paymentValues.amount;

        var skipProcessWithUpdate = ! amount || payout;

        if (! skipProcessWithUpdate) {
            if (! owner.bankAccountId) {
                var error = new Error("Owner missing bank account");
                error.bookingId = booking.id;
                throw error;
            }

            var mangopayPayout = yield createMangopayPayout(booking, owner, amount);

            var resultTransaction = yield TransactionService.createPayout({
                booking: booking,
                payout: mangopayPayout,
                payoutAmount: amount,
                label: "payment"
            });
            addTransactionToManager(transactionManager, resultTransaction);
        }

        return yield Booking
            .updateOne(booking.id, { withdrawalDate: moment().toISOString() })
            .catch(() => booking);
    })();
}
