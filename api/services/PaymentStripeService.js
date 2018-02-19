/* global BankAccount, Booking, Card, CurrencyService, StelaceConfigService, Transaction, User */

module.exports = {

    getStripeInstance,
    unsetStripeInstance,

    createCustomer,

    fetchAccount,
    createAccount,
    updateAccount,
    isAccountVerificationComplete,

    getBalance,

    createBankAccount,

    fetchCard,
    createCard,
    refreshCard,
    deactivateCard,

    fetchCharge,
    createCharge,
    captureCharge,

    copyChargePreauthorization,
    cancelChargePreauthorization,
    createChargePayin,
    cancelChargePayin,
    createTransfer,
    cancelTransfer,
    createPayout,

};

const _ =  require('lodash');
const createError = require('http-errors');
const Stripe = require('stripe');

let stripeInstance;

async function getStripeInstance() {
    if (stripeInstance) return stripeInstance;

    const secretData = await StelaceConfigService.getSecretData();

    const secretKey = secretData.stripe_secretKey;
    if (!secretKey) {
        throw createError('Missing Stripe secret key', { missingCredentials: true });
    }

    stripeInstance = new Stripe(sails.config.stripe.secretKey);
    return stripeInstance;
}

function unsetStripeInstance() {
    stripeInstance = null;
}

/**
 * @param {Object} user
 */
async function createCustomer(user) {
    // already created
    if (_.get(user, 'paymentData.stripe.customerId')) {
        return user;
    }

    if (!user.email) {
        throw createError(400, 'Missing params');
    }

    const stripe = await getStripeInstance();
    const customer = await stripe.customers.create({ email: user.email });

    const paymentData = User.getMergedPaymentData(user, { stripe: { customerId: customer.id } });
    const updatedUser = await User.updateOne(user.id, { paymentData });
    return updatedUser;
}

async function fetchAccount(user) {
    const accountId = User.getStripeAccountId(user);

    const stripe = await getStripeInstance();

    const account = await stripe.accounts.retrieve(accountId);
    return account;
}

async function isAccountVerificationComplete(user) {
    const account = await fetchAccount(user);
    return !account.verification.fields_needed.length;
}

/**
 * @param {Object} user
 * @param {Object} params
 * @param {String} params.accountToken
 * @param {String} params.country
 */
async function createAccount(user, { accountToken, country }) {
    const stripe = await getStripeInstance();

    const account = await stripe.accounts.create({
        type: 'custom',
        account_token: accountToken,
        email: user.email,
        country,
    });

    const paymentData = User.getMergedPaymentData(user, { stripe: { accountId: account.id } });
    const updatedUser = await User.updateOne(user.id, { paymentData });
    return updatedUser;
}

/**
 * @param {Object} user
 * @param {String} accountToken
 */
async function updateAccount(user, { accountToken }) {
    const stripe = await getStripeInstance();

    const accountId = User.getStripeAccountId(user);

    await stripe.accounts.update(accountId, {
        account_token: accountToken,
    });
}

/**
 * @param {Object} [user] - if not provided, get the platform balance
 */
async function getBalance(user) {
    const stripe = await getStripeInstance();

    let balance;
    if (typeof user === 'undefined') {
        balance = await stripe.balance.retrieve();
    } else {
        const accountId = User.getStripeAccountId(user);
        balance = await stripe.balance.retrieve({ stripe_account: accountId });
    }

    return balance;
}

/**
 * @param {Object} user
 * @param {String} accountToken
 */
async function createBankAccount(user, { accountToken }) {
    const stripe = await getStripeInstance();

    const accountId = User.getStripeAccountId(user);

    const stripeBankAccount = await stripe.accounts.createExternalAccount(accountId, { external_account: accountToken });

    const parsedBankAccount = BankAccount.parseStripeData(stripeBankAccount);
    parsedBankAccount.userId = user.id;
    const bankAccount = await BankAccount.create(parsedBankAccount);
    return bankAccount;
}

/**
 * @param {String} providerCardId
 * @param {String} customerId
 */
async function fetchCard(providerCardId, customerId) {
    const stripe = await getStripeInstance();

    const card = await stripe.customers.retrieveCard(customerId, providerCardId);
    return card;
}

/**
 * @param {Object} user
 * @param {String} sourceId
 * @param {Boolean} forget
 */
async function createCard({ user, sourceId, forget }) {
    const stripe = await getStripeInstance();

    const customerId = User.getStripeCustomerId(user);
    const providerCard = await stripe.customers.createSource(customerId, { source: sourceId });
    const parsedCard = Card.parseStripeData(providerCard);
    parsedCard.userId = user.id;

    if (typeof forget !== 'undefined') {
        parsedCard.forget = forget;
    }

    const card = await Card.create(parsedCard);
    return card;
}

/**
 * @param {Object} card
 */
async function refreshCard(card) {
    const providerCard = await fetchCard(card.resourceId, card.resourceOwnerId);
    const parsedCard = Card.parseStripeData(providerCard);

    const updatedCard = await Card.updateOne(card.id, parsedCard);
    return updatedCard;
}

/**
 * @param {Object} card
 */
async function deactivateCard(card) {
    const stripe = await getStripeInstance();

    await stripe.customers.deleteCard(card.resourceOwnerId, card.resourceId);

    const updatedCard = await Card.updateOne(card.id, { active: false });
    return updatedCard;
}

/**
 * @param {String} chargeId
 */
async function fetchCharge(chargeId) {
    const stripe = await getStripeInstance();

    const charge = await stripe.charges.retrieve(chargeId);
    return charge;
}

/**
 * @param {Object} user
 * @param {Object} card
 * @param {Number} amount
 * @param {String} currency
 * @param {Boolean} [setSecureMode = false]
 * @param {String} [returnUrl]
 */
async function createCharge({
    user,
    card,
    amount,
    currency,
    capture = true,
    transferGroup,
    // setSecureMode = false,
    // returnUrl,
}) {
    const stripe = await getStripeInstance();

    const customerId = User.getStripeCustomerId(user);

    const charge = await stripe.charges.create({
        amount: CurrencyService.getISOAmount(amount, currency),
        currency,
        customer: customerId,
        source: card.resourceId,
        capture,
        transfer_group: transferGroup,
    });

    return charge;
}

/**
 * @param {String} chargeId
 * @param {Object} params
 * @param {Number} params.amount
 * @param {String} params.currency
 */
async function captureCharge(chargeId, { amount, currency }) {
    const stripe = await getStripeInstance();

    let charge;
    if (typeof amount === 'undefined') {
        charge = await stripe.charges.capture(chargeId);
    } else {
        charge = await stripe.charges.capture(chargeId, {
            amount: CurrencyService.getISOAmount(amount, currency),
        });
    }

    return charge;
}

/**
 * @param {Object} transaction
 * @param {Number} amount
 */
async function copyChargePreauthorization({ transaction, amount }) {
    const stripe = await getStripeInstance();

    const charge = await fetchCharge(transaction.resourceId);

    const currency = charge.currency;

    const newCharge = await stripe.charges.create({
        amount: CurrencyService.getISOAmount(amount, currency),
        currency,
        customer: charge.customer,
        source: charge.source.id,
        capture: false,
    });

    return newCharge;
}

/**
 * @param {Object} transaction
 */
async function cancelChargePreauthorization({ transaction }) {
    if (Transaction.isPreauthorizationCancellable(transaction)) {
        const stripe = await getStripeInstance();

        await stripe.refunds.create({ charge: transaction.resourceId });
    }
}

/**
 * @param {Object} booking
 * @param {Object} transaction
 * @param {Number} amount
 * @param {Number} takerFees
 */
async function createChargePayin({
    booking,
    transaction,
    amount,
    takerFees = 0,
}) {
    const stripe = await getStripeInstance();

    const charge = await stripe.charges.capture({
        charge: transaction.resourceId,
        amount: CurrencyService.getISOAmount(amount, transaction.currency),
        application_fee: CurrencyService.getISOAmount(takerFees, transaction.currency),
        metadata: {
            tag: Booking.getBookingRef(booking.id),
        },
    });

    if (charge.status === 'failed') {
        throw createError('Charge payin creation failed', {
            bookingId: booking.id,
            charge,
        });
    }

    return charge;
}

/**
 * @param {Object} booking
 * @param {Object} transaction
 * @param {Object} taker
 * @param {Number} amount
 * @param {Boolean} [refundTakerFees = true]
 */
async function cancelChargePayin({
    booking,
    transaction,
    amount,
    refundTakerFees = true,
}) {
    const refundTotally = (typeof amount === 'undefined' && refundTakerFees);

    const stripe = await getStripeInstance();

    let params;
    if (refundTotally) {
        params = {
            charge: transaction.resourceId,
            reverse_transfer: false,
        };
    } else {
        params = {
            charge: transaction.resourceId,
            reverse_transfer: false,
            amount: CurrencyService.getISOAmount(amount, booking.currency),
            refund_application_fee: refundTakerFees,
        };
    }

    const refund = await stripe.refunds.create(params);
    if (refund.status === 'failed') {
        throw createError('Refund charge payin failed', {
            bookingId: booking.id,
            refund,
        });
    }

    return refund;
}

/**
 * @param {Object} booking
 * @param {Object} taker
 * @param {Object} owner
 * @param {Number} amount
 * @param {String} [chargeId] - charge which comes before the transfer
 * @param {String} [transferGroup]
 */
async function createTransfer({
    booking,
    owner,
    amount,
    chargeId,
    transferGroup,
}) {
    const stripe = await getStripeInstance();

    const accountId = User.getStripeAccountId(owner);

    const transfer = await stripe.transfers.create({
        amount: CurrencyService.getISOAmount(amount, booking.currency),
        currency: booking.currency,
        destination: accountId,
        source_transaction: chargeId,
        transfer_group: transferGroup,
        metadata: {
            tag: Booking.getBookingRef(booking.id),
        },
    });

    return transfer;
}

async function cancelTransfer({
    booking,
    transaction,
}) {
    const stripe = await getStripeInstance();

    const transferReversal = await stripe.transfers.createReversal(transaction.resourceId, {
        refund_application_fee: true,
        metadata: {
            tag: Booking.getBookingRef(booking.id),
        },
    });

    return transferReversal;
}

async function createPayout({
    booking,
    owner,
    amount,
}) {
    const stripe = await getStripeInstance();

    const bankWireRef = Booking.getBookingRef(booking.id);

    const accountId = User.getStripeAccountId(owner);

    const bankAccount = await BankAccount.findOne({
        resourceOwnerId: accountId,
        paymentProvider: 'stripe',
        active: true,
    });
    if (!bankAccount) {
        throw new Error('Bank account not found');
    }

    const payout = await stripe.payouts.create({
        amount: CurrencyService.getISOAmount(amount, booking.currency),
        currency: booking.currency,
        destination: bankAccount.resourceId,
        statement_descriptor: bankWireRef,
        metadata: {
            tag: Booking.getBookingRef(booking.id),
        },
    }, {
        stripe_account: accountId,
    });

    if (payout.status === 'failed' || payout.status === 'canceled') {
        throw createError('Payout creation failed', {
            bookingId: booking.id,
            payout,
        });
    }

    return payout;
}
