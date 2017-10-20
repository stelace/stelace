/* global StelaceConfigService, TokenService */

/**
 * StelaceConfigController
 *
 * @description :: Server-side logic for managing stelaceconfigs
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {

    find,
    findOne,
    create,
    update,
    destroy,

};

function find(req, res) {
    res.forbidden();
}

function findOne(req, res) {
    res.forbidden();
}

function create(req, res) {
    res.forbidden();
}

async function update(req, res) {
    if (!TokenService.isRole(req, "admin")) {
        return res.forbidden();
    }

    const { config, features } = req.allParams();

    try {
        const result = {};

        if (typeof config === 'object') {
            result.config = await StelaceConfigService.updateConfig(config);
        }
        if (typeof features === 'object') {
            result.features = await StelaceConfigService.updateFeatures(features);
        }

        res.json(result);
    } catch (err) {
        res.sendError(err);
    }
}

function destroy(req, res) {
    res.forbidden();
}
