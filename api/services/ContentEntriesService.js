/* global Translation */

module.exports = {

    getDefaultLang,
    getAvailableLangs,
    isLangAllowed,
    getBestLang,

    getTranslations,
    fetchDefaultTranslations,
    updateDefaultTranslations,

    updateTranslations,
    updateUserTranslations,
    refreshTranslations,
    getMetadata,

    parseMetadata,
    computeTranslations,

};

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const i18nCompile = require('i18n-compile');
const yaml = require('js-yaml');
const Promise = require('bluebird');

Promise.promisifyAll(fs);

const editableKeyLabelSuffix = '__EDITOR_LABEL';
const editableKeyHelperSuffix = '__EDITOR_HELPER';

const defaultLang = 'en';
const availableLangs = ['en', 'fr'];

const translationFolder = path.join(__dirname, '../../translations');

const sourceFilepath = path.join(translationFolder, './source/main.yaml');
const sourceModifiedFilepath = path.join(translationFolder, './modified/main-modified.yaml');
const sourceModifiedDeltaFilepath = path.join(translationFolder, './modified/main-modified-delta.yaml');

let cachedDefaultTranslations = {};
let cachedUserTranslations = {};
let cachedMetadatas = {};

function getDefaultLang() {
    return defaultLang;
}

function getAvailableLangs() {
    return availableLangs.slice();
}

function isLangAllowed(lang) {
    return _.includes(availableLangs, lang);
}

function getBestLang(lang) {
    if (isLangAllowed(lang)) {
        return lang;
    }

    return getDefaultLang();
}

async function getTranslations({
    lang,
    displayContext,
    onlyEditableKeys,
}) {
    const {
        translations,
        userTranslations,
        metadata,
    } = await _getTranslations(lang);

    return computeTranslations({
        translations,
        userTranslations,
        metadata,
        displayContext,
        onlyEditableKeys,
    });
}

async function _getTranslations(lang) {
    if (!isLangAllowed(lang)) {
        throw new Error('Invalid lang');
    }

    const [
        translations,
        userTranslations,
    ] = await Promise.all([
        fetchDefaultTranslations(lang),
        fetchUserTranslations(lang),
    ]);

    if (!sails.config.useCacheTranslations) {
        cachedMetadatas[lang] = null;
    }

    if (!cachedMetadatas[lang]) {
        const metadata = parseMetadata(translations);
        cachedMetadatas[lang] = metadata;
    }

    return {
        translations,
        userTranslations,
        metadata: cachedMetadatas[lang],
    };
}

async function updateTranslations(lang, newTranslations) {
    const keys = getAllKeys(newTranslations);

    const existingTranslations = await fetchDefaultTranslations(lang);
    const existingKeys = getAllKeys(existingTranslations);

    const filteredKeys = _.intersection(keys, existingKeys);

    const updatingTranslations = {};

    filteredKeys.forEach(key => {
        _.set(updatingTranslations, key, _.get(newTranslations, key));
    });

    await updateDefaultTranslations(lang, updatingTranslations);
}

async function updateUserTranslations(lang, newTranslations) {
    const keys = getAllKeys(newTranslations);
    const { metadata } = await _getTranslations(lang);

    const editableKeys = _.intersection(keys, metadata.editableKeys); // filter out non valid editable keys

    const existingUserTranslations = await Translation.find({ lang, key: editableKeys });
    const indexedExistingUserTranslations = _.indexBy(existingUserTranslations, 'key');

    await Promise.map(editableKeys, async (key) => {
        const content = _.get(newTranslations, key);

        const existingUserTranslation = indexedExistingUserTranslations[key];

        if (existingUserTranslation) {
            await Translation.updateOne(existingUserTranslation.id, { content });
        } else {
            await Translation.create({
                lang,
                namespace: 'default',
                key,
                content,
            });
        }

        _.set(cachedUserTranslations[lang], key, content);
    });
}

async function refreshTranslations() {
    cachedDefaultTranslations = {};
    cachedUserTranslations = {};
    cachedMetadatas = {};
}

async function getMetadata(lang) {
    const { metadata } = await _getTranslations(lang);
    return metadata;
}

async function fetchDefaultTranslations(lang) {
    if (!sails.config.useCacheTranslations) {
        cachedDefaultTranslations[lang] = null;
    }

    if (cachedDefaultTranslations[lang]) {
        return cachedDefaultTranslations[lang];
    }

    const [
        rawSourceContent,
        rawSourceModifiedDeltaContent,
    ] = await Promise.all([
        fs.readFileAsync(sourceFilepath, 'utf8'),
        fs.readFileAsync(sourceModifiedDeltaFilepath, 'utf8').catch(_handleNotFoundError),
    ]);

    const sourceTranslations = i18nCompile.fromString(rawSourceContent);
    const sourceModifiedDeltaTranslations = rawSourceModifiedDeltaContent ? i18nCompile.fromString(rawSourceModifiedDeltaContent) : {};

    const mergedSourceTranslations = _.merge({}, sourceTranslations, sourceModifiedDeltaTranslations);

    const langs = Object.keys(mergedSourceTranslations);

    await Promise.each(langs, lang => _dumpTranslationLang(lang, mergedSourceTranslations[lang]));

    langs.forEach(lang => {
        cachedDefaultTranslations[lang] = mergedSourceTranslations[lang];
    });

    return cachedDefaultTranslations[lang];
}

async function updateDefaultTranslations(lang, translations) {
    const [
        rawSourceContent,
        rawSourceModifiedContent,
        rawSourceModifiedDeltaContent,
    ] = await Promise.all([
        fs.readFileAsync(sourceFilepath, 'utf8'),
        fs.readFileAsync(sourceModifiedFilepath, 'utf8').catch(_handleNotFoundError),
        fs.readFileAsync(sourceModifiedDeltaFilepath, 'utf8').catch(_handleNotFoundError),
    ]);

    const source = yaml.safeLoad(rawSourceContent);
    const sourceModified = rawSourceModifiedContent ? yaml.safeLoad(rawSourceModifiedContent) : {};
    const sourceModifiedDelta = rawSourceModifiedDeltaContent ? yaml.safeLoad(rawSourceModifiedDeltaContent) : {};

    const keys = getAllKeys(translations);

    const mergedSourceModified = _.merge({}, source, sourceModified);

    keys.forEach(key => {
        const keyLang = `${key}.${lang}`;
        _.set(mergedSourceModified, keyLang, _.get(translations, key));
        _.set(sourceModifiedDelta, keyLang, _.get(translations, key));
    });

    const yamlOptions = {
        indent: 4,
        lineWidth: 10000, // a big number that can't be reached in practice
    };

    const sourceModifiedYaml = yaml.safeDump(mergedSourceModified, yamlOptions);
    const sourceModifiedDeltaYaml = yaml.safeDump(sourceModifiedDelta, yamlOptions);

    await fs.writeFileAsync(sourceModifiedDeltaFilepath, sourceModifiedDeltaYaml, 'utf8');
    await fs.writeFileAsync(sourceModifiedFilepath, sourceModifiedYaml, 'utf8');

    const mergedSourceModifiedTranslations = i18nCompile.fromString(sourceModifiedYaml);

    await _dumpTranslationLang(lang, mergedSourceModifiedTranslations[lang]);
    cachedDefaultTranslations[lang] = mergedSourceModifiedTranslations[lang];
}

async function _dumpTranslationLang(lang, translations) {
    if (sails.config.noJsonTranslationsFiles) {
        return;
    }

    const filepath = path.join(translationFolder, `./build/${lang}.json`);
    await fs.writeFileAsync(filepath, JSON.stringify(translations, null, 2), 'utf8');
}

function _handleNotFoundError(err) {
    if (err.code === 'ENOENT') {
        return null;
    }
    throw err;
}

async function fetchUserTranslations(lang) {
    if (!sails.config.useCacheTranslations) {
        cachedUserTranslations[lang] = null;
    }

    if (cachedUserTranslations[lang]) {
        return cachedUserTranslations[lang];
    }

    const userTranslationsEntries = await Translation.find({ lang });

    const userTranslations = userTranslationsEntries.reduce((memo, entry) => {
        memo[entry.key] = entry.content;
        return memo;
    }, {});

    cachedUserTranslations[lang] = userTranslations;
    return cachedUserTranslations[lang];
}

function parseMetadata(translations) {
    const editableKeys = [];
    const keys = [];
    const helpers = [];

    loopTranslationsKeys({ translations, editableKeys, keys, helpers });

    return {
        keys,
        editableKeys,
        helpers,
    };
}

function getAllKeys(obj) {
    const keys = [];

    _getAllKeys({ obj, keys });

    return keys;
}

function _getAllKeys({ obj, currentPath = '', keys }) {
    for (const key in obj) {
        if (obj[key] instanceof Object) { // avoid null value
            _getAllKeys({
                obj: obj[key],
                currentPath: getKeyPath(currentPath, key),
                keys,
            });
        } else {
            keys.push(getKeyPath(currentPath, key));
        }
    }
}

function loopTranslationsKeys({ translations, currentPath = '', editableKeys, keys, helpers }) {
    for (const key in translations) {
        if (translations[key] instanceof Object) { // avoid null value
            loopTranslationsKeys({
                translations: translations[key],
                currentPath: getKeyPath(currentPath, key),
                editableKeys,
                keys,
                helpers
            });
        } else {
            const fullKey = getKeyPath(currentPath, key);

            if (isKeyLabel(key)) {
                const keyWithoutLabel = getKeyFromLabelKey(key);
                editableKeys.push(getKeyPath(currentPath, keyWithoutLabel));
            } else if (isKeyHelper(key)) {
                helpers.push(fullKey);
            } else {
                keys.push(fullKey);
            }
        }
    }
}

function getKeyPath(path, key) {
    if (!path) {
        return key;
    }

    return `${path}.${key}`;
}

function getKeyFromLabelKey(labelKey) {
    return labelKey.substr(0, labelKey.length - editableKeyLabelSuffix.length);
}

function getLabelKey(key) {
    return key + editableKeyLabelSuffix;
}

function getHelperKey(key) {
    return key + editableKeyHelperSuffix;
}

function isKeyLabel(key) {
    return key.substr(-editableKeyLabelSuffix.length) === editableKeyLabelSuffix;
}

function isKeyHelper(key) {
    return key.substr(-editableKeyHelperSuffix.length) === editableKeyHelperSuffix;
}

/**
 * Merge the default translations with the user ones
 * @param {Object} translations
 * @param {Object} userTranslations
 * @param {Object} metadata
 * @param {Boolean} [displayContext = false] - if true, display label and helper keys
 * @param {Boolean} [onlyEditableKeys = false] - if true, only return editable keys
 * @return {Object}
 */
function computeTranslations({
    translations,
    userTranslations,
    metadata,
    displayContext = false,
    onlyEditableKeys = false,
}) {
    const {
        editableKeys,
        keys,
    } = metadata;

    const computedTranslations = {};

    const workingKeys = onlyEditableKeys ? editableKeys : keys;

    workingKeys.forEach(key => {
        const userTranslation = _.get(userTranslations, key);

        const isEmptyValue = value => {
            return typeof value === 'undefined' || value === null;
        };

        const value = !isEmptyValue(userTranslation) ? userTranslation : _.get(translations, key);

        _.set(computedTranslations, key, value);

        if (displayContext) {
            const labelKey = getLabelKey(key);
            const helperKey = getHelperKey(key);

            const label = _.get(translations, labelKey);
            const helper = _.get(translations, helperKey);

            if (label) {
                _.set(computedTranslations, labelKey, label);
            }
            if (helper) {
                _.set(computedTranslations, helperKey, helper);
            }
        }
    });

    return computedTranslations;
}
