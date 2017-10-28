/* global StelaceConfig */

module.exports = {

    getTimeGranularities,
    getDefaultListingTypeProperties,

    getConfig,

    getListFeatures,
    isFeatureActive,

    updateConfig,
    updateFeatures,

};

const defaultConfig = sails.config.stelace.defaultConfig || {
    SERVICE_NAME: null,
};
const defaultFeatures = sails.config.stelace.defaultFeatures || {
    GAMIFICATION: true,
    TAGS: true,
    EVENTS: true,
    SOCIAL_LOGIN: true,
    INCOME_REPORT: true,
    SMS: true,
    MAP: true,
};

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
    'MAP',
    'SMS',
    'SOCIAL_LOGIN',
    'TAGS',
];

let cached = false;
let stelaceConfigId;
let features;
let config;

const timeGranularities = [
    'm', // minutes
    'h', // hours
    'd', // days
    'w', // weeks
    'M', // months
];

const defaultListingTypeProperties = {
    TIME: 'NONE',
    ASSESSMENTS: 'NONE',
    AVAILABILITY: 'NONE',
    DYNAMIC_PRICING: 'NONE',
    PLACE: 'NONE',
};

function getTimeGranularities() {
    return timeGranularities;
}

function getDefaultListingTypeProperties() {
    return defaultListingTypeProperties;
}

async function _fetchConfig() {
    if (cached) return;

    const stelaceConfigs = await StelaceConfig.find().limit(1);

    if (!stelaceConfigs.length) {
        throw new Error('No Stelace config available');
    }

    const stelaceConfig = stelaceConfigs[0];
    _updateCache(stelaceConfig);
    cached = true;
}

async function _updateCache(stelaceConfig) {
    _loadConfig(stelaceConfig);
    _loadFeatures(stelaceConfig);
    stelaceConfigId = stelaceConfig.id;
}

function _loadConfig(stelaceConfig) {
    config = _.defaults({}, stelaceConfig.config, defaultConfig);
}

async function getConfig() {
    await _fetchConfig();
    return config;
}

async function _loadFeatures(stelaceConfig) {
    features = _.defaults({}, stelaceConfig.features, defaultFeatures);

    features.PRICE_RECOMMENDATION = !!sails.config.priceRecommendationUrl;

    // create alias for some features
    _.assign(features, {
        LISTING_CATEGORIES: features.TAGS,
        REFERRAL: features.GAMIFICATION,
    });

    features = _.pick(features, featureNames);
}

async function getListFeatures() {
    await _fetchConfig();
    return features;
}

async function isFeatureActive(name) {
    await _fetchConfig();

    if (typeof features[name] === 'undefined') {
        throw new Error('Unknown feature');
    }

    return features[name];
}

async function updateConfig(updatedConfig) {
    await _fetchConfig();

    const newConfig = _.defaults({}, updatedConfig, config);
    const updateAttrs = {
        config: newConfig,
    };

    const stelaceConfig = await StelaceConfig.updateOne(stelaceConfigId, updateAttrs);
    _updateCache(stelaceConfig);
    return config;
}

async function updateFeatures(updatedFeatures) {
    await _fetchConfig();

    const newFeatures = _.defaults({}, updatedFeatures, features);
    const updateAttrs = {
        features: _.pick(newFeatures, dbFeatureNames),
    };

    const stelaceConfig = await StelaceConfig.updateOne(stelaceConfigId, updateAttrs);
    _updateCache(stelaceConfig);
    return features;
}
