/* global TimeService, User */

/**
 * FinanceController
 *
 * @description :: Server-side logic for managing finances
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {

    find: find,
    findOne: findOne,
    create: create,
    update: update,
    destroy: destroy,

    createAccount: createAccount,
    createBankAccount: createBankAccount

};

const _ = require('lodash');

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

function createAccount(req, res) {
    var filteredAttrs = [
        "birthday",
        "nationality",
        "countryOfResidence"
    ];
    var createAttrs = _.pick(req.allParams(), filteredAttrs);
    var access = "self";

    if (! createAttrs.birthday || ! TimeService.isDateString(createAttrs.birthday, { onlyDate: true })
     || ! createAttrs.nationality
     || ! createAttrs.countryOfResidence
    ) {
        return res.badRequest();
    }

    return Promise
        .resolve()
        .then(() => {
            return User.createMangopayUser(req.user, createAttrs);
        })
        .then(user => {
            return User.createWallet(user);
        })
        .then(user => {
            res.json(User.expose(user, access));
        })
        .catch(res.sendError);
}

function createBankAccount(req, res) {
    var access = "self";

    return Promise
        .resolve()
        .then(() => {
            return User.createBankAccount(req.user);
        })
        .then(user => {
            res.json(User.expose(user, access));
        })
        .catch(res.sendError);
}
