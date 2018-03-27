/* global AclService, MicroService, PassportService, PaymentMangopayService, PaymentStripeService, StelaceConfig, User, UserService */

module.exports = {

    getTimeGranularities,
    getDefaultCurrency,
    getDefaultPaymentProvider,
    getAllowedLangs,

    hasStelaceConfig,
    isInstallationComplete,
    install,
    refreshStelaceConfig,
    getConfig,
    getSecretData,
    getPlan,
    getPlanDiff,

    getListFeatures,
    isFeatureActive,

    createStelaceConfig,
    updateConfig,
    updateFeatures,
    updateSecretData,
    updatePlan,
    updatePlanDiff,

};

const _ = require('lodash');
const createError = require('http-errors');
const stelaceConfigHelper = require('./stelaceConfig');

let defaultConfig;
let defaultFeatures;

function getDefaultConfig() {
    if (!defaultConfig) {
        defaultConfig = sails.config.stelace.defaultConfig || {
            SERVICE_NAME: 'Stelace',
            lang: 'en',
        };
    }
    return defaultConfig;
}

function getDefaultFeatures() {
    if (!defaultFeatures) {
        defaultFeatures = sails.config.stelace.defaultFeatures || {
            GAMIFICATION: false,
            TAGS: false,
            EVENTS: true,
            SOCIAL_LOGIN: true,
            INCOME_REPORT: false,
            LISTING_CATEGORIES: false,
            SMS: true,
            MAP: true,
        };
    }
    return defaultFeatures;
}

const featureNames = [
    'EVENTS',
    'GAMIFICATION',
    'INCOME_REPORT',
    'LISTING_CATEGORIES',
    'MAP',
    'PRICE_RECOMMENDATION',
    'REFERRAL',
    'SMS',
    'SOCIAL_LOGIN',
    'TAGS',
];
const dbFeatureNames = [
    'EVENTS',
    'GAMIFICATION',
    'INCOME_REPORT',
    'LISTING_CATEGORIES',
    'MAP',
    'SMS',
    'SOCIAL_LOGIN',
    'TAGS',
];

let cached = false;
let stelaceConfigId;
let features;
let config;
let secretData;
let plan;
let planDiff;

const timeGranularities = [
    'm', // minutes
    'h', // hours
    'd', // days
    'M', // months
];

const defaultCurrency = 'EUR';
const defaultPaymentProvider = 'stripe';
const allowedLangs = [
    'en',
    'fr',
];

function getTimeGranularities() {
    return timeGranularities;
}

function getDefaultCurrency() {
    return defaultCurrency;
}

function getDefaultPaymentProvider() {
    return defaultPaymentProvider;
}

function getAllowedLangs() {
    return allowedLangs;
}

async function hasStelaceConfig() {
    const stelaceConfigs = await StelaceConfig.find().limit(1);
    return !!stelaceConfigs.length;
}

async function isInstallationComplete() {
    const hasConfig = await hasStelaceConfig();
    if (!hasConfig) return false;

    const users = await User.find();
    if (!users.length) return false;

    return true;
}

/**
 * @param {Object} params
 * @param {String} params.lang
 * @param {String} params.serviceName
 * @param {String} params.email
 * @param {String} params.password
 */
async function install(params) {
    const {
        lang,
        serviceName,
        email,
        password,
    } = params;

    const installationComplete = await isInstallationComplete();
    if (installationComplete) {
        throw createError(400, 'Installation already completed');
    }

    if (!_.includes(allowedLangs, lang)
     || (!serviceName || typeof serviceName !== 'string')
     || !MicroService.isEmail(email)
     || (typeof password !== 'string' || password.length < 8)
    ) {
        throw createError(400, 'Bad params');
    }

    await createStelaceConfig({ config: { SERVICE_NAME: serviceName, lang } });
    await UserService.createUser({
        email,
        password,
        roles: ['admin', 'user', 'seller'],
        userType: 'organization',
    }, { passwordRequired: true });
}

function refreshStelaceConfig() {
    PassportService.unsetPassportInstance();
    PaymentMangopayService.unsetMangopayInstance();
    PaymentStripeService.unsetStripeInstance();
    AclService.refresh();

    cached = false;
}

async function _fetchStelaceConfig() {
    if (cached) return;

    const stelaceConfigs = await StelaceConfig.find().limit(1);

    if (!stelaceConfigs.length) {
        throw new Error('No Stelace config available');
    }

    const stelaceConfig = _.defaultsDeep(stelaceConfigs[0], {
        config: { website__url: sails.config.stelace.url }
    });

    _updateCache(stelaceConfig);
    cached = true;
}

async function _updateCache(stelaceConfig) {
    _loadConfig(stelaceConfig);
    _loadFeatures(stelaceConfig);
    _loadSecretData(stelaceConfig);

    plan = stelaceConfig.plan;
    planDiff = stelaceConfig.diff;

    stelaceConfigId = stelaceConfig.id;
}

function _loadConfig(stelaceConfig) {
    const defaultConfig = getDefaultConfig();
    config = _.defaults({}, stelaceConfig.config, defaultConfig);
}

async function getConfig() {
    await _fetchStelaceConfig();
    return config;
}

async function getSecretData() {
    await _fetchStelaceConfig();
    return secretData;
}

async function getPlan() {
    await _fetchStelaceConfig();
    return plan;
}

async function getPlanDiff() {
    await _fetchStelaceConfig();
    return planDiff;
}

async function _loadFeatures(stelaceConfig) {
    const defaultFeatures = getDefaultFeatures();
    features = _.defaults({}, stelaceConfig.features, defaultFeatures);

    features.PRICE_RECOMMENDATION = !!sails.config.priceRecommendationUrl;

    // create alias for some features
    _.assign(features, {
        REFERRAL: features.GAMIFICATION,
    });

    features = _.pick(features, featureNames);
}

async function _loadSecretData(stelaceConfig) {
    secretData = stelaceConfig.secretData;
}

async function getListFeatures() {
    await _fetchStelaceConfig();
    return features;
}

async function isFeatureActive(name) {
    await _fetchStelaceConfig();

    if (typeof features[name] === 'undefined') {
        throw new Error('Unknown feature');
    }

    return features[name];
}

async function createStelaceConfig({ features, config } = {}) {
    const installationComplete = await isInstallationComplete();
    if (installationComplete) {
        throw new Error('Installation complete');
    }

    const createAttrs = {};
    createAttrs.features = _.defaults({}, features, getDefaultFeatures());
    createAttrs.config = _.defaults({}, config, getDefaultConfig());

    const stelaceConfig = await StelaceConfig.create(createAttrs);
    _updateCache(stelaceConfig);
    return stelaceConfig;
}

async function updateConfig(updatedConfig) {
    await _fetchStelaceConfig();

    // drop non editable fields
    const nonEditableFields = stelaceConfigHelper.config.getNonEditableFields();
    const updatingConfig = _.omit(updatedConfig, nonEditableFields);

    const valid = stelaceConfigHelper.config.validate(updatingConfig);
    if (!valid) {
        throw createError(400);
    }

    let newConfig = _.defaults({}, updatingConfig, config);

    if (newConfig.currency) {
        newConfig.currency = newConfig.currency.toUpperCase();
    }

    newConfig = _computeNewConfig({ config: newConfig, secretData });

    const updateAttrs = {
        config: newConfig,
    };

    const stelaceConfig = await StelaceConfig.updateOne(stelaceConfigId, updateAttrs);
    _updateCache(stelaceConfig);
    return config;
}

async function updateFeatures(updatedFeatures) {
    await _fetchStelaceConfig();

    const newFeatures = _.defaults({}, updatedFeatures, features);
    const updateAttrs = {
        features: _.pick(newFeatures, dbFeatureNames),
    };

    const stelaceConfig = await StelaceConfig.updateOne(stelaceConfigId, updateAttrs);
    _updateCache(stelaceConfig);
    return features;
}

async function updateSecretData(updatedSecretData) {
    await _fetchStelaceConfig();

    const valid = stelaceConfigHelper.secretData.validate(updatedSecretData);
    if (!valid) {
        throw createError(400);
    }

    const newSecretData = _.defaults({}, updatedSecretData, secretData);
    const newConfig = _computeNewConfig({ config, secretData: newSecretData });

    const socialLoginChanged = hasSocialLoginChanged(newSecretData, secretData);
    const mangopayChanged = hasMangopayChanged(newSecretData, secretData);
    const stripeChanged = hasStripeChanged(newSecretData, secretData);

    const updateAttrs = {
        secretData: newSecretData,
        config: newConfig,
    };

    const stelaceConfig = await StelaceConfig.updateOne(stelaceConfigId, updateAttrs);
    _updateCache(stelaceConfig);

    if (socialLoginChanged) {
        PassportService.unsetPassportInstance();
    }
    if (mangopayChanged) {
        PaymentMangopayService.unsetMangopayInstance();
    }
    if (stripeChanged) {
        PaymentStripeService.unsetStripeInstance();
    }

    return secretData;
}

async function updatePlan(plan) {
    await _fetchStelaceConfig();

    const valid = stelaceConfigHelper.plan.validate(plan);
    if (!valid) {
        throw createError(400);
    }

    const updateAttrs = {
        plan,
    };

    const stelaceConfig = await StelaceConfig.updateOne(stelaceConfigId, updateAttrs);
    _updateCache(stelaceConfig);

    return plan;
}

async function updatePlanDiff(planDiff) {
    await _fetchStelaceConfig();

    const valid = stelaceConfigHelper.plan.validate(planDiff);
    if (!valid) {
        throw createError(400);
    }

    const updateAttrs = {
        planDiff,
    };

    const stelaceConfig = await StelaceConfig.updateOne(stelaceConfigId, updateAttrs);
    _updateCache(stelaceConfig);

    return planDiff;
}

function _computeNewConfig({ config, secretData }) {
    const newConfig = Object.assign({}, config);

    newConfig.stripe_complete = !!(config.stripe__publish_key && secretData.stripe__secret_key);
    newConfig.mangopay_complete = !!(secretData.mangopay__client_id && secretData.mangopay__passphrase);
    newConfig.social_login__facebook_complete = !!(secretData.social_login__facebook__client_id && secretData.social_login__facebook__client_secret);
    newConfig.social_login__google_complete = !!(secretData.social_login__google__client_id && secretData.social_login__google__client_secret);

    return newConfig;
}

function hasSocialLoginChanged(newSecretData, oldSecretData) {
    const fields = [
        'social_login__facebook__client_id',
        'social_login__facebook__client_secret',
        'social_login__google__client_id',
        'social_login__google__client_secret',
    ];

    return !_.isEqual(_.pick(newSecretData, fields), _.pick(oldSecretData, fields));
}

function hasMangopayChanged(newSecretData, oldSecretData) {
    const fields = [
        'mangopay__client_id',
        'mangopay__passphrase',
    ];

    return !_.isEqual(_.pick(newSecretData, fields), _.pick(oldSecretData, fields));
}

function hasStripeChanged(newSecretData, oldSecretData) {
    const fields = [
        'stripe__secret_key',
    ];

    return !_.isEqual(_.pick(newSecretData, fields), _.pick(oldSecretData, fields));
}
