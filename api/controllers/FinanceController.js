/* global BankAccount, PaymentMangopayService, User */

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

    let user = await PaymentMangopayService.createUser(req.user);
    user = await PaymentMangopayService.createWallet(user); // TODO: take website currency

    res.json(User.expose(user, access));
}

async function getBankAccounts(req, res) {
    const access = 'self';

    const bankAccounts = await BankAccount.fetchBankAccounts(req.user);
    res.json(BankAccount.exposeAll(bankAccounts, access));
}

async function createBankAccount(req, res) {
    const attrs = req.allParams();

    const access = 'self';

    const bankAccount = await PaymentMangopayService.createBankAccount(req.user, attrs);
    res.json(BankAccount.expose(bankAccount, access));
}
