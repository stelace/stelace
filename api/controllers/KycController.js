/* global Kyc */

/**
 * KycController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

module.exports = {

    find,
    findOne,
    create,
    update,
    destroy,

    my,

};

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

async function update(req, res) {
    const id = req.param('id');
    const { data } = req.allParams();

    if (!data) {
        throw createError(400);
    }

    const kyc = await Kyc.findOne({ id });
    if (!kyc) {
        throw createError(404);
    }
    if (kyc.userId !== req.user.id) {
        throw createError(403);
    }

    const isValidData = Kyc.validateData(data);
    if (!isValidData) {
        throw createError(400);
    }

    const newData = Kyc.getMergedData(kyc, data);
    const updatedKyc = await Kyc.updateOne(kyc.id, { data: newData });

    res.json(updatedKyc);
}

function destroy(req, res) {
    return res.forbidden();
}

async function my(req, res) {
    let kyc = await Kyc.findOne({ userId: req.user.id });
    if (!kyc) {
        kyc = await Kyc.create({ userId: req.user.id });
    }

    res.json(kyc);
}
