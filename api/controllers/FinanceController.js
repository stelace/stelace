/* global BankAccount, PaymentMangopayService, PaymentStripeService, StelaceConfigService, User */

/**
 * FinanceController
 *
 * @description :: Server-side logic for managing finances
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {

    find,
    findOne,
    create,
    update,
    destroy,

    createAccount,
    getBankAccounts,
    createBankAccount,

};

const _ = require('lodash');
const createError = require('http-errors');

function find(req, res) {
    return res.forbidden();
}

function findOne(req, res) {
    return res.forbidden();
}

function create(req, res) {
    return res.forbidden();
}

function update(req, res) {
    return res.forbidden();
}

function destroy(req, res) {
    return res.forbidden();
}

async function createAccount(req, res) {
    const access = 'self';
    const {
        accountType,
        accountToken,
        country,
        paymentProvider,
    } = req.allParams();

    const config = await StelaceConfigService.getConfig();
    const currency = config.currency;

    if (!currency) {
        throw new Error('Missing payment configuration');
    }

    let user = req.user;

    if (paymentProvider === 'mangopay') {
        user = await PaymentMangopayService.createUser(user);
        user = await PaymentMangopayService.createWallet(user, { currency });
    } else if (paymentProvider === 'stripe') {
        if (!accountType) {
            throw createError(400, 'Account type missing');
        }

        if (accountType === 'customer') {
            user = await PaymentStripeService.createCustomer(user);
        } else if (accountType === 'account') {
            if (!accountToken) {
                throw createError(400, 'Missing account token');
            }
            user = await PaymentStripeService.createAccount(user, { accountToken, country });
        } else {
            throw createError(400, 'Unknown account type');
        }
    } else {
        throw new Error('Unknown payment provider');
    }

    res.json(User.expose(user, access));
}

async function getBankAccounts(req, res) {
    const access = 'self';

    const bankAccounts = await BankAccount.fetchBankAccounts(req.user);
    res.json(BankAccount.exposeAll(bankAccounts, access));
}

async function createBankAccount(req, res) {
    const attrs = req.allParams();
    const paymentProvider = req.param('paymentProvider');

    const access = 'self';

    let bankAccount;
    if (paymentProvider === 'mangopay') {
        bankAccount = await PaymentMangopayService.createBankAccount(req.user, _.omit(attrs, 'paymentProvider'));
    } else if (paymentProvider === 'stripe') {
        bankAccount = await PaymentStripeService.createBankAccount(req.user, _.omit(attrs, 'paymentProvider'));
    } else {
        throw new Error('Unknown payment provider');
    }

    res.json(BankAccount.expose(bankAccount, access));
}
