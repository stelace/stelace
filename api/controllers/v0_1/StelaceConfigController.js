/* global ApiService, StelaceConfigService */

module.exports = {

    findOne,
    update,
    updatePlan,

    refresh,

};

const createError = require('http-errors');

async function findOne(req, res) {
    const allowed = await ApiService.isAllowed(req, 'settings', 'view');

    const config = await StelaceConfigService.getConfig();
    const features = await StelaceConfigService.getListFeatures();
    const secretData = await StelaceConfigService.getSecretData();
    const plan = await StelaceConfigService.getPlan();

    res.json({
        config,
        features,
        secretData: allowed ? secretData : {},
        plan: allowed ? plan : {},
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

async function updatePlan(req, res) {
    const { plan, planDiff } = req.allParams();

    const result = {};

    if (typeof plan === 'object') {
        result.plan = await StelaceConfigService.updatePlan(plan);
    }
    if (typeof planDiff === 'object') {
        result.planDiff = await StelaceConfigService.updatePlanDiff(planDiff);
    }

    res.json(result);
}

function refresh(req, res) {
    StelaceConfigService.refreshStelaceConfig();

    res.json({ ok: true });
}
