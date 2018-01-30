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

    installStatus,
    install,

};

const createError = require('http-errors');

function find(req, res) {
    res.forbidden();
}

async function findOne(req, res) {
    const hasConfig = await StelaceConfigService.hasStelaceConfig();
    if (!hasConfig) {
        throw createError(400, 'There is no stelace config yet');
    }

    const config = await StelaceConfigService.getConfig();
    const features = await StelaceConfigService.getListFeatures();

    res.json({
        config,
        features,
    });
}

function create(req, res) {
    res.forbidden();
}

async function update(req, res) {
    if (!TokenService.isRole(req, 'admin')) {
        return res.forbidden();
    }

    const { config, features } = req.allParams();

    const result = {};

    if (typeof config === 'object') {
        result.config = await StelaceConfigService.updateConfig(config);
    }
    if (typeof features === 'object') {
        result.features = await StelaceConfigService.updateFeatures(features);
    }

    res.json(result);
}

function destroy(req, res) {
    res.forbidden();
}

async function installStatus(req, res) {
    const installationComplete = await StelaceConfigService.isInstallationComplete();

    res.json({ installed: installationComplete });
}

async function install(req, res) {
    const attrs = req.allParams();
    await StelaceConfigService.install(attrs);

    res.sendStatus(200);
}
