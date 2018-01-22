module.exports = {

    getBookingTransactionManager: getBookingTransactionManager

};

const _ = require('lodash');

var transactionTypes = {
    deposit: {
        action: "preauthorization",
        label: "deposit"
    },
    depositPayment: {
        action: "preauthorization",
        label: "deposit-payment"
    },
    renewDeposit: {
        action: "preauthorization",
        label: "deposit renew"
    },
    preauthPayment: {
        action: "preauthorization",
        label: "payment"
    },
    payinPayment: {
        action: "payin",
        label: "payment"
    },
    transferPayment: {
        action: "transfer",
        label: "payment"
    },
    payoutPayment: {
        action: "payout",
        label: "payment"
    }
};

function getBookingTransactionManager(transactions, transactionsDetails) {
    return new BookingTransactionManager(transactions, transactionsDetails);
}

function BookingTransactionManager(transactions, transactionsDetails) {
    this.rawTransactions        = _.cloneDeep(transactions);
    this.rawTransactionsDetails = _.cloneDeep(transactionsDetails);
    this.hashCancelledBy = {};

    _.forEach(this.rawTransactions, transaction => {
        this._addToHashCancelledBy(transaction);
    });
}

BookingTransactionManager.prototype._addToHashCancelledBy = function (transaction) {
    if (this.isCancelTransaction(transaction)) {
        this.hashCancelledBy[transaction.cancelTransactionId] = transaction.id;
    }
};


//////////////////////
// RAW TRANSACTIONS //
//////////////////////
BookingTransactionManager.prototype.getRawTransactions = function () {
    return _.cloneDeep(this.rawTransactions);
};

BookingTransactionManager.prototype.getRawTransactionsDetails = function () {
    return _.cloneDeep(this.rawTransactionsDetails);
};


////////////////////////
// FETCH TRANSACTIONS //
////////////////////////
BookingTransactionManager.prototype.isCancelTransaction = function (transaction) {
    return !! transaction.cancelTransactionId;
};

BookingTransactionManager.prototype.isTransactionCancelled = function (transaction) {
    return !! this.hashCancelledBy[transaction.id];
};

BookingTransactionManager.prototype.getCancelTransaction = function (transaction) {
    return _.find(this.rawTransactions, t => {
        return t.id === this.hashCancelledBy[transaction.id];
    });
};

BookingTransactionManager.prototype.getTransactionDetails = function (transaction, filter) {
    var indexedTransactionsDetails = _.groupBy(this.rawTransactionsDetails, "transactionId");
    return _.filter(indexedTransactionsDetails[transaction.id] || [], filter);
};


BookingTransactionManager.prototype.getTransactions = function (filter) {
    var transactions = _.filter(this.rawTransactions, transaction => {
        return ! this.isCancelTransaction(transaction);
    });

    return _.filter(transactions, filter);
};

BookingTransactionManager.prototype.getNonCancelledTransactions = function (filter) {
    return _.filter(this.getTransactions(filter), transaction => {
        return ! this.isTransactionCancelled(transaction);
    });
};

BookingTransactionManager.prototype.getCancelTransactions = function (filter) {
    var transactions = _.filter(this.rawTransactions, transaction => {
        return this.isCancelTransaction(transaction);
    });

    return _.filter(transactions, filter);
};

BookingTransactionManager.prototype.getTransactionsPairs = function (filter) {
    var indexedTransactions = _.indexBy(this.rawTransactions, "id");
    var transactions = this.getTransactions(filter);

    transactions = _.map(transactions, transaction => {
        return {
            transaction: transaction,
            cancelTransaction: indexedTransactions[this.hashCancelledBy[transaction.id]]
        };
    });

    return transactions;
};


//////////////////////////////
// GET TRANSACTIONS BY TYPE //
//////////////////////////////
BookingTransactionManager.prototype._getTransactionFromType = function (type) {
    return _.first(this.getTransactions(type));
};


BookingTransactionManager.prototype.getDeposit = function () {
    return this._getTransactionFromType(transactionTypes.deposit);
};

BookingTransactionManager.prototype.getDepositPayment = function () {
    return this._getTransactionFromType(transactionTypes.depositPayment);
};

BookingTransactionManager.prototype.getRenewDeposits = function () {
    return this.getTransactions(transactionTypes.renewDeposit);
};

BookingTransactionManager.prototype.getPreauthPayment = function () {
    return this._getTransactionFromType(transactionTypes.preauthPayment);
};

BookingTransactionManager.prototype.getPayinPayment = function () {
    return this._getTransactionFromType(transactionTypes.payinPayment);
};

BookingTransactionManager.prototype.getTransferPayment = function () {
    return this._getTransactionFromType(transactionTypes.transferPayment);
};

BookingTransactionManager.prototype.getPayoutPayment = function () {
    return this._getTransactionFromType(transactionTypes.payoutPayment);
};


////////////////////////////////////////////
// GET NON CANCELLED TRANSACTIONS BY TYPE //
////////////////////////////////////////////
BookingTransactionManager.prototype._getNonCancelledTransactionFromType = function (type) {
    return _.first(this.getNonCancelledTransactions(type));
};


BookingTransactionManager.prototype.getNonCancelledDeposit = function () {
    return this._getNonCancelledTransactionFromType(transactionTypes.deposit);
};

BookingTransactionManager.prototype.getNonCancelledDepositPayment = function () {
    return this._getNonCancelledTransactionFromType(transactionTypes.depositPayment);
};

BookingTransactionManager.prototype.getNonCancelledRenewDeposits = function () {
    return this.getNonCancelledTransactions(transactionTypes.renewDeposit);
};

BookingTransactionManager.prototype.getNonCancelledPreauthPayment = function () {
    return this._getNonCancelledTransactionFromType(transactionTypes.preauthPayment);
};

BookingTransactionManager.prototype.getNonCancelledPayinPayment = function () {
    return this._getNonCancelledTransactionFromType(transactionTypes.payinPayment);
};

BookingTransactionManager.prototype.getNonCancelledTransferPayment = function () {
    return this._getNonCancelledTransactionFromType(transactionTypes.transferPayment);
};

BookingTransactionManager.prototype.getNonCancelledPayoutPayment = function () {
    return this._getNonCancelledTransactionFromType(transactionTypes.payoutPayment);
};


/////////////////////
// ADD TRANSACTION //
/////////////////////
BookingTransactionManager.prototype.addTransaction = function (transaction, transactionDetails) {
    var tmpTransaction = _.cloneDeep(transaction);
    var tmpTransactionsDetails = _.cloneDeep(transactionDetails) || [];

    this.rawTransactions.push(tmpTransaction);
    this.rawTransactionsDetails = this.rawTransactionsDetails.concat(tmpTransactionsDetails);

    this._addToHashCancelledBy(tmpTransaction);
};
