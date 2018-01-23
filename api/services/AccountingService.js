/*
    global Booking, Listing, odoo, OdooApiService, OdooService, PricingService,
    Transaction, TransactionService, User
*/

module.exports = {

    syncTransactionsWithOdoo: syncTransactionsWithOdoo

};

var diacritics = require('diacritics');
var moment     = require('moment');
const _ = require('lodash');
const Promise = require('bluebird');

var allowedRoles = ["owner", "taker"];

/**
 * synchronize db transactions with odoo
 * @param  {object}   args
 * @param  {string}   args.startDate  - perform all transactions executed after that date excluded
 * @param  {string}   args.endDate    - perform all transactions executed before that date included
 * @param  {function} args.onProgress - get the last transaction performed
 * @return {Promise<object>} res
 * @return {number}          res.nbInvoices
 * @return {number}          res.nbTransfers
 * @return {number}          res.nbPayouts
 */
function syncTransactionsWithOdoo(args) {
    args = args || {};
    var startDate  = args.startDate;
    var endDate    = args.endDate;
    var onProgress = args.onProgress;

    return Promise.coroutine(function* () {
        if (! OdooApiService.isEnabled()) {
            return;
        }

        var results = yield getTransactionsData(startDate, endDate);

        var transactions        = results.transactions;
        var transactionManagers = results.transactionManagers;
        var bookings            = results.bookings;
        var listings            = results.listings;
        var users               = results.users;

        var indexedBookings = _.indexBy(bookings, "id");
        var indexedUsers    = _.indexBy(users, "id");
        var indexedListings = _.indexBy(listings, "id");

        return yield Promise.each(transactions, transaction => {
            return Promise.coroutine(function* () {
                var transactionManager = transactionManagers[transaction.bookingId];
                var booking            = indexedBookings[transaction.bookingId];

                var error;

                if (! transactionManager) {
                    error = new Error("Missing transaction manager");
                    error.transactionId = transaction.id;
                    error.bookingId     = transaction.bookingId;
                    throw error;
                }
                if (! booking) {
                    error = new Error("Missing booking");
                    error.transactionId = transaction.id;
                    error.bookingId     = transaction.bookingId;
                    throw error;
                }

                var isCompleteBooking = isCompleteBookingPayment(transactionManager);

                if (! isCompleteBooking) {
                    error = new Error("Booking not complete");
                    error.transactionId = transaction.id;
                    error.bookingId     = transaction.bookingId;
                    throw error;
                }

                if (transaction.action === "transfer") {
                    var listing   = indexedListings[booking.listingId];
                    var owner  = indexedUsers[booking.ownerId];
                    var taker  = indexedUsers[booking.takerId];

                    if (! listing) {
                        error = new Error("Missing listing");
                        error.bookingId = booking.id;
                        error.listingId = booking.listingId;
                        throw error;
                    }
                    if (! owner) {
                        error = new Error("Missing owner");
                        error.bookingId = booking.id;
                        error.ownerId   = booking.ownerId;
                        throw error;
                    }
                    if (! taker) {
                        error = new Error("Missing taker");
                        error.bookingId = booking.id;
                        error.takerId  = booking.takerId;
                        throw error;
                    }

                    var takerInvoiceFields = getInvoiceFields(booking, "taker", transactionManager);
                    if (canGenerateInvoice(takerInvoiceFields)) {
                        yield generateInvoiceFromRole({
                            listing: listing,
                            booking: booking,
                            user: taker,
                            invoiceFields: takerInvoiceFields,
                            transactionManager: transactionManager,
                            role: "taker"
                        });
                    }

                    var ownerInvoiceFields = getInvoiceFields(booking, "owner", transactionManager);
                    if (canGenerateInvoice(ownerInvoiceFields)) {
                        yield generateInvoiceFromRole({
                            listing: listing,
                            booking: booking,
                            user: owner,
                            invoiceFields: ownerInvoiceFields,
                            transactionManager: transactionManager,
                            role: "owner"
                        });
                    }
                } else { // transaction.action === "payout"
                    var payout = transactionManager.getPayoutPayment();

                    yield syncPayout(payout);
                }

                if (typeof onProgress === "function") {
                    onProgress(transaction);
                }
            })();
        })
        .catch(err => {
            if (err.message !== "Booking not complete") {
                throw err;
            }
        });
    })();
}

/**
 * get transactions data
 * @param  {string} startDate
 * @param  {string} endDate
 * @return {object}   res
 * @return {object[]} res.transactions
 * @return {object[]} res.bookings
 * @return {object[]} res.users
 * @return {object[]} res.listings
 * @return {object[]} res.transactionManagers
 */
function getTransactionsData(startDate, endDate) {
    return Promise.coroutine(function* () {
        var findAttrs = {
            action: ["transfer", "payout"],
            label: "payment" // other labels are handled out of this process (like dispute or listing damage)
        };

        var periodAttrs = {};
        if (startDate) {
            periodAttrs[">"] = startDate;
        }
        if (endDate) {
            periodAttrs["<="] = endDate;
        }
        if (! _.isEmpty(periodAttrs)) {
            findAttrs.mgpCreatedDate = periodAttrs;
        }

        var transactions = yield Transaction
            .find(findAttrs)
            .sort('mgpCreatedDate ASC');

        var bookingsIds = _.pluck(transactions, "bookingId");
        var bookings    = yield Booking.find({ id: bookingsIds });

        var listingsIds = _.pluck(bookings, "listingId");
        var usersIds = _.reduce(bookings, (memo, booking) => {
            memo = memo.concat([booking.ownerId, booking.takerId]);
            return memo;
        }, []);
        usersIds = _.uniq(usersIds);

        var results = yield Promise.props({
            users: User.find({ id: usersIds }),
            listings: Listing.getListingsOrSnapshots(listingsIds),
            transactionManagers: TransactionService.getBookingTransactionsManagers(bookingsIds)
        });

        return {
            transactions: transactions,
            bookings: bookings,
            users: results.users,
            listings: results.listings,
            transactionManagers: results.transactionManagers
        };
    })();
}




function isCompleteBookingPayment(transactionManager) {
    var payin    = transactionManager.getPayinPayment();
    var transfer = transactionManager.getTransferPayment();
    var payout   = transactionManager.getPayoutPayment();

    var isPayinComplete    = !! (payin && payin.mgpCreatedDate && payin.executionDate);
    var isTransferComplete = !! (transfer && transfer.mgpCreatedDate && transfer.executionDate);
    var isPayoutComplete   = !! (payout && payout.mgpCreatedDate && payout.executionDate);

    if (! isPayinComplete || ! isTransferComplete) {
        return false;
    }

    var transferDetails = transactionManager.getTransactionDetails(transfer);

    if (! transferDetails.length) {
        throw Error("The number of lines from transfer details must be greater than 0");
    }

    var payment = _.find(transferDetails, { label: "main" });

    // if there is a payment to owner, then there must be a complete payout
    if (payment && ! isPayoutComplete) {
        return false;
    }

    return true;
}

function getInvoiceFields(booking, role, transactionManager) {
    if (! _.includes(allowedRoles, role)) {
        throw new Error("Bad role");
    }

    var invoiceFields = {};

    var transfer        = transactionManager.getTransferPayment();
    var transferDetails = transactionManager.getTransactionDetails(transfer);
    var takerFees       = _.find(transferDetails, { label: "taker fees" });
    var ownerFees       = _.find(transferDetails, { label: "owner fees" });

    if (role === "taker") {
        if (takerFees && takerFees.cashing) {
            invoiceFields.takerFees = takerFees.cashing;
        }
    } else { // role === "owner"
        if (ownerFees && ownerFees.cashing) {
            invoiceFields.ownerFees = ownerFees.cashing;
        }
    }

    return invoiceFields;
}

function canGenerateInvoice(invoiceFields) {
    return !! _.reduce(invoiceFields, (memo, value) => {
        return memo || value;
    }, false);
}

//////////////////////////
// ODOO OPERATIONS NAME //
//////////////////////////
function getTakerInvoiceName(bookingId) {
    return `BKG_${bookingId}`;
}

function getOwnerInvoiceName(bookingId) {
    return `BKG_${bookingId} OWN`;
}

function getTransferCommunication(mangopayTransferId) {
    return `MGP_${mangopayTransferId}`;
}

function getPayoutCommunication(mangopayPayoutId) {
    return `MGP_${mangopayPayoutId}`;
}


////////////////////
// BOOKING FIELDS //
////////////////////
function getInvoiceName(bookingId, role) {
    if (! _.includes(allowedRoles, role)) {
        throw new Error("Bad role");
    }

    if (role === "owner") {
        return getOwnerInvoiceName(bookingId);
    } else { // role === "taker"
        return getTakerInvoiceName(bookingId);
    }
}

function getFeesProductId(booking, type) {
    if (! _.includes(["booking", "payment"], type)) {
        throw new Error("Bad type");
    }

    var field;

    if (type === "booking") {
        if (Booking.isNotTime(booking)) {
            field = "purchaseBookingFees";
        } else {
            field = "bookingFees";
        }
    } else { // type === "payment"
        if (Booking.isNotTime(booking)) {
            field = "purchasePaymentFees";
        } else {
            field = "paymentFees";
        }
    }

    return sails.config.odoo.ids.products[field];
}



////////////////////////
// INVOICE LINE NAMES //
////////////////////////
function escapeString(str) {
    return str.replace(/[^\u0000-\u00FF]/g, c => {
        var newChar = diacritics.remove(c);
        return (newChar === c ? "" : newChar);
    });
}

function getOwnerFeesInvoiceLineName(listing) {
    var escapedListingName = escapeString(listing.name);

    var name = `Frais de paiement - ${escapedListingName}`;
    return name;
}

function getTakerFeesInvoiceLineName(listing) {
    var escapedListingName = escapeString(listing.name);

    var name = `Frais de réservation - ${escapedListingName}`;
    return name;
}


///////////////////////////////
// FETCH EXISTING OPERATIONS //
///////////////////////////////
function fetchInvoiceId(bookingId, role) {
    if (role === "owner") {
        return fetchOwnerInvoiceId(bookingId);
    } else { // role === "taker"
        return fetchTakerInvoiceId(bookingId);
    }
}

function fetchTakerInvoiceId(bookingId) {
    var params = {
        domain: [
            ["name", "=", getTakerInvoiceName(bookingId)],
        ]
    };

    return odoo.search("account.invoice", params)
        .then(res => res[0]);
}

function fetchOwnerInvoiceId(bookingId) {
    var params = {
        domain: [
            ["name", "=", getOwnerInvoiceName(bookingId)]
        ]
    };

    return odoo.search("account.invoice", params)
        .then(res => res[0]);
}

function fetchOdooPayoutId(mangopayPayoutId) {
    var params = {
        domain: [
            ["communication", "=", getPayoutCommunication(mangopayPayoutId)],
            ["payment_type", "=", "transfer"]
        ]
    };

    return odoo.search("account.payment", params)
        .then(res => res[0]);
}


/////////////////////
// CREATE PAYMENTS //
/////////////////////
function createTransfer(amount, userOdooId, transfer, invoiceId) {
    return Promise.coroutine(function* () {
        var paymentAttrs = {
            amount: amount,
            partnerId: userOdooId,
            paymentDate: transfer.mgpCreatedDate,
            communication: getTransferCommunication(transfer.resourceId),
            invoiceId: invoiceId
        };

        var paymentId = yield OdooService.createPayment(paymentAttrs);
        return yield OdooService.postPayment(paymentId);
    })();
}

function createPayout(payout) {
    var odooConfig = sails.config.odoo;

    return Promise.coroutine(function* () {
        var params = {
            amount: payout.payoutAmount,
            partnerId: odooConfig.ids.partners.stelace,
            paymentDate: payout.mgpCreatedDate,
            communication: getPayoutCommunication(payout.resourceId)
        };

        var paymentId = yield OdooService.createInternalPayment(params);
        return yield OdooService.postPayment(paymentId);
    })();
}


////////////////////
// CREATE INVOICE //
////////////////////
/**
 * generate invoice from role
 * @param  {object} args
 * @param  {object} args.listing
 * @param  {object} args.booking
 * @param  {object} args.user
 * @param  {object} args.invoiceFields
 * @param  {object} args.transactionManager
 * @param  {string} args.role
 * @return {object} booking
 */
function generateInvoiceFromRole(args) {
    var listing               = args.listing;
    var booking            = args.booking;
    var user               = args.user;
    var invoiceFields      = args.invoiceFields;
    var transactionManager = args.transactionManager;
    var role               = args.role;

    return Promise.coroutine(function* () {
        if (! _.includes(allowedRoles, role)) {
            throw new Error("Bad role");
        }

        // invoice already generated
        var invoiceId = yield fetchInvoiceId(booking.id, role);
        if (invoiceId) {
            return booking;
        }

        var payin    = transactionManager.getPayinPayment();
        var transfer = transactionManager.getTransferPayment();

        var comment = "Paiement par carte bancaire le " + moment(payin.mgpCreatedDate).format("DD/MM/YYYY");

        user = yield User.syncOdooUser(user, { updateLocation: true });
        invoiceId = yield createInvoice(booking, user.odooId, role, {
            listing: listing,
            invoiceDate: transfer.mgpCreatedDate,
            invoiceFields: invoiceFields,
            comment: comment
        });

        var amount = _.reduce(_.values(invoiceFields), (memo, price) => {
            return memo + price;
        }, 0);

        yield createTransfer(amount, user.odooId, transfer, invoiceId);
        return booking;
    })();
}

/**
 * create invoice
 * @param  {object} booking
 * @param  {number} userOdooId
 * @param  {string} role - must be "owner" or "taker"
 * @param  {object} args
 * @param  {object} args.listing
 * @param  {string} args.invoiceDate
 * @param  {object} args.invoiceFields
 * @param  {string} [args.comment]
 * @return {Promise<number>} invoice id
 */
function createInvoice(booking, userOdooId, role, args) {
    args = args || {};
    var listing          = args.listing;
    var invoiceDate   = args.invoiceDate;
    var invoiceFields = args.invoiceFields;
    var comment       = args.comment;

    var odooConfig = sails.config.odoo;

    return Promise.coroutine(function* () {
        if (! invoiceDate
         || ! invoiceFields
         || ! _.includes(allowedRoles, role)
        ) {
            throw new Error("Missing params");
        }

        var taxSum = 0;
        if (invoiceFields.ownerFees) {
            taxSum += invoiceFields.ownerFees;
        }
        if (invoiceFields.takerFees) {
            taxSum += invoiceFields.takerFees;
        }

        var taxResult = PricingService.getDutyFreePrice(taxSum, 20);

        var invoiceLines = [];

        var invoiceName = getInvoiceName(booking.id, role);

        if (invoiceFields.ownerFees) {
            invoiceLines.push({
                accountId: odooConfig.ids.accounts.serviceProvision,
                discount: 0,
                name: invoiceName,
                customDescription: getOwnerFeesInvoiceLineName(listing),
                productId: getFeesProductId(booking, "payment"),
                productPrice: invoiceFields.ownerFees,
                taxIds: [odooConfig.ids.accountTaxes.collectedSaleVAT20]
            });
        }
        if (invoiceFields.takerFees) {
            invoiceLines.push({
                accountId: odooConfig.ids.accounts.serviceProvision,
                discount: 0,
                name: invoiceName,
                customDescription: getTakerFeesInvoiceLineName(listing),
                productId: getFeesProductId(booking, "booking"),
                productPrice: invoiceFields.takerFees,
                taxIds: [odooConfig.ids.accountTaxes.collectedSaleVAT20]
            });
        }

        var taxLines = [
            {
                accountId: odooConfig.ids.accounts.collectedVTA_normalRate,
                amount: taxResult.taxValue,
                name: odooConfig.labels.fr.accountTaxes.collectedSaleVAT20,
                taxId: odooConfig.ids.accountTaxes.collectedSaleVAT20
            }
        ];

        var invoiceAttrs = {
            accountId: odooConfig.ids.accounts.customer_goodsSalesAndServiceProvision,
            comment: comment,
            dueDate: invoiceDate,
            invoiceDate: invoiceDate,
            journalId: odooConfig.ids.journals.customerInvoices,
            invoiceLines: invoiceLines,
            name: invoiceName,
            partnerId: userOdooId,
            taxLines: taxLines
        };

        var invoiceId = yield OdooService.createInvoice(invoiceAttrs);
        yield OdooService.openInvoice(invoiceId);

        return invoiceId;
    })();
}




///////////////////
// CREATE PAYOUT //
///////////////////
function syncPayout(payout) {
    return Promise.coroutine(function* () {
        var paymentId = yield fetchOdooPayoutId(payout.resourceId);

        // if not already done
        if (! paymentId) {
            yield createPayout(payout);
        }
    })();
}
