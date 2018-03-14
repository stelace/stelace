/* global ApiService, StelaceConfigService */

module.exports = {

    findOne,
    update,

};

const createError = require('http-errors');

async function findOne(req, res) {
    const allowed = await ApiService.isAllowed(req, 'settings', 'view');

    const config = await StelaceConfigService.getConfig();
    const features = await StelaceConfigService.getListFeatures();
    const secretData = await StelaceConfigService.getSecretData();

    res.json({
        config,
        features,
        secretData: allowed ? secretData : {},
    });
}

async function update(req, res) {
    const allowed = await ApiService.isAllowed(req, 'settings', 'edit');
    if (!allowed) {
        throw createError(403);
    }

    const { config, features, secretData } = req.allParams();

    const result = {};

    if (typeof config === 'object') {
        result.config = await StelaceConfigService.updateConfig(config);
    }
    if (typeof features === 'object') {
        result.features = await StelaceConfigService.updateFeatures(features);
    }
    if (typeof secretData === 'object') {
        result.secretData = await StelaceConfigService.updateSecretData(secretData);
    }

    res.json(result);
}
