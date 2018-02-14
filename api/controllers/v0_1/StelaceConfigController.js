/* global StelaceConfigService */

module.exports = {

    findOne,
    update,

};


async function findOne(req, res) {
    const config = await StelaceConfigService.getConfig();
    const features = await StelaceConfigService.getListFeatures();

    res.json({
        config,
        features,
    });
}

async function update(req, res) {
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
