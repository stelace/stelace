/* global Translation */

module.exports = {

    getDefaultLang,
    getAvailableLangs,
    isLangAllowed,
    getBestLang,

    getTranslations,
    fetchDefaultTranslations,
    updateDefaultTranslations,
    updateUserTranslations,
    resetUserTranslations,
    refreshTranslations,
    getMetadata,

    parseMetadata,
    computeTranslations,

    getAllKeys,

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

const namespaces = {
    default: {
        sourceFilepath: path.join(translationFolder, './source/main.yaml'),
        sourceModifiedFilepath: path.join(translationFolder, './modified/main-modified.yaml'),
        sourceModifiedDeltaFilepath: path.join(translationFolder, './modified/main-modified-delta.yaml'),
        cachedDefaultTranslations: {},
        cachedUserTranslations: {},
        cachedMetadatas: {},
    },
    email: {
        sourceFilepath: path.join(translationFolder, './source/email.yaml'),
        sourceModifiedFilepath: path.join(translationFolder, './modified/email-modified.yaml'),
        sourceModifiedDeltaFilepath: path.join(translationFolder, './modified/email-modified-delta.yaml'),
        cachedDefaultTranslations: {},
        cachedUserTranslations: {},
        cachedMetadatas: {},
    },
};

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

function isValidNamespace(namespace) {
    return typeof namespaces[namespace] === 'object';
}

async function getTranslations({
    lang,
    displayContext,
    onlyEditableKeys,
    namespace,
}) {
    const {
        translations,
        userTranslations,
        metadata,
    } = await _getTranslations(lang, { namespace });

    return computeTranslations({
        translations,
        userTranslations,
        metadata,
        displayContext,
        onlyEditableKeys,
    });
}

async function _getTranslations(lang, { namespace }) {
    if (!isLangAllowed(lang)) {
        throw new Error('Invalid lang');
    }
    if (!isValidNamespace(namespace)) {
        throw new Error('Invalid namespace');
    }

    const space = namespaces[namespace];

    const [
        translations,
        userTranslations,
    ] = await Promise.all([
        fetchDefaultTranslations(lang, { namespace }),
        fetchUserTranslations(lang, { namespace }),
    ]);

    if (!sails.config.useCacheTranslations) {
        space.cachedMetadatas[lang] = null;
    }

    if (!space.cachedMetadatas[lang]) {
        const metadata = parseMetadata(translations);
        space.cachedMetadatas[lang] = metadata;
    }

    return {
        translations,
        userTranslations,
        metadata: space.cachedMetadatas[lang],
    };
}

async function updateDefaultTranslations(lang, newTranslations, { namespace }) {
    if (!isValidNamespace(namespace)) {
        throw new Error('Invalid namespace');
    }

    const keys = getAllKeys(newTranslations);

    const existingTranslations = await fetchDefaultTranslations(lang, { namespace });
    const existingKeys = getAllKeys(existingTranslations);

    const filteredKeys = _.intersection(keys, existingKeys);

    const updatingTranslations = {};

    filteredKeys.forEach(key => {
        _.set(updatingTranslations, key, _.get(newTranslations, key));
    });

    await _updateDefaultTranslations(lang, updatingTranslations, { namespace });

    return updatingTranslations;
}

async function updateUserTranslations(lang, newTranslations, { namespace }) {
    if (!isValidNamespace(namespace)) {
        throw new Error('Invalid namespace');
    }

    const space = namespaces[namespace];

    const keys = getAllKeys(newTranslations);

    let editableKeys;

    if (namespace !== 'email') {
        const { metadata } = await _getTranslations(lang, { namespace });

        editableKeys = _.intersection(keys, metadata.editableKeys); // filter out non valid editable keys
    } else {
        editableKeys = keys; // let users edit all available keys for email
    }

    const existingUserTranslations = await Translation.find({ lang, key: editableKeys, namespace });
    const indexedExistingUserTranslations = _.indexBy(existingUserTranslations, 'key');

    const defaultTranslations = await fetchDefaultTranslations(lang, { namespace });

    const updatedTranslations = {};

    await Promise.map(editableKeys, async (key) => {
        const defaultValue = _.get(defaultTranslations, key);
        const content = _.get(newTranslations, key);

        const existingUserTranslation = indexedExistingUserTranslations[key];

        if (isTranslationEqual(defaultValue, content)) {
            if (existingUserTranslation) {
                await Translation.destroy({ id: existingUserTranslation.id });
            }

            _.set(updatedTranslations, key, defaultValue);
            _.set(space.cachedUserTranslations[lang], key, null);
        } else {
            if (existingUserTranslation) {
                await Translation.updateOne(existingUserTranslation.id, { content });
            } else {
                await Translation.create({
                    lang,
                    namespace,
                    key,
                    content,
                });
            }

            _.set(updatedTranslations, key, content);
            _.set(space.cachedUserTranslations[lang], key, content);
        }
    });

    return updatedTranslations;
}

async function resetUserTranslations(lang, translationsKeys, { namespace }) {
    if (!isValidNamespace(namespace)) {
        throw new Error('Invalid namespace');
    }

    const space = namespaces[namespace];

    const keys = translationsKeys;

    let editableKeys;

    if (namespace !== 'email') {
        const { metadata } = await _getTranslations(lang, { namespace });

        editableKeys = _.intersection(keys, metadata.editableKeys); // filter out non valid editable keys
    } else {
        editableKeys = keys; // let users edit all available keys for email
    }

    const existingUserTranslations = await Translation.find({ lang, key: editableKeys, namespace });
    const indexedExistingUserTranslations = _.indexBy(existingUserTranslations, 'key');

    const existingTranslationsIds = editableKeys.reduce((memo, key) => {
        const existingUserTranslation = indexedExistingUserTranslations[key];

        if (existingUserTranslation) {
            memo.push(existingUserTranslation.id);
        }
        return memo;
    }, []);

    await Translation.destroy({ id: existingTranslationsIds });

    const defaultTranslations = await fetchDefaultTranslations(lang, { namespace });

    const resetTranslations = {};

    editableKeys.forEach(key => {
        const defaultValue = _.get(defaultTranslations, key);
        if (typeof defaultValue === 'undefined') {
            return;
        }

        _.set(resetTranslations, key, defaultValue);
        _.set(space.cachedUserTranslations[lang], key, null);
    });

    return resetTranslations;
}

async function refreshTranslations(namespace) {
    if (!isValidNamespace(namespace)) {
        throw new Error('Invalid namespace');
    }

    const space = namespaces[namespace];

    space.cachedDefaultTranslations = {};
    space.cachedUserTranslations = {};
    space.cachedMetadatas = {};
}

async function getMetadata(lang, { namespace }) {
    if (!isValidNamespace(namespace)) {
        throw new Error('Invalid namespace');
    }

    const { metadata } = await _getTranslations(lang, { namespace });
    return metadata;
}

async function fetchDefaultTranslations(lang, { namespace }) {
    if (!isValidNamespace(namespace)) {
        throw new Error('Invalid namespace');
    }

    const space = namespaces[namespace];

    if (!sails.config.useCacheTranslations) {
        space.cachedDefaultTranslations[lang] = null;
    }

    if (space.cachedDefaultTranslations[lang]) {
        return space.cachedDefaultTranslations[lang];
    }

    const [
        rawSourceContent,
        rawSourceModifiedDeltaContent,
    ] = await Promise.all([
        fs.readFileAsync(space.sourceFilepath, 'utf8'),
        fs.readFileAsync(space.sourceModifiedDeltaFilepath, 'utf8').catch(_handleNotFoundError),
    ]);

    const sourceTranslations = i18nCompile.fromString(rawSourceContent);
    const sourceModifiedDeltaTranslations = rawSourceModifiedDeltaContent ? i18nCompile.fromString(rawSourceModifiedDeltaContent) : {};

    const mergedSourceTranslations = _.merge({}, sourceTranslations, sourceModifiedDeltaTranslations);

    const langs = Object.keys(mergedSourceTranslations);

    await Promise.each(langs, lang => _dumpTranslationLang(lang, mergedSourceTranslations[lang], { namespace }));

    langs.forEach(lang => {
        space.cachedDefaultTranslations[lang] = mergedSourceTranslations[lang];
    });

    return space.cachedDefaultTranslations[lang];
}

async function _updateDefaultTranslations(lang, translations, { namespace }) {
    if (!isValidNamespace(namespace)) {
        throw new Error('Invalid namespace');
    }

    const space = namespaces[namespace];

    const [
        rawSourceContent,
        rawSourceModifiedContent,
        rawSourceModifiedDeltaContent,
    ] = await Promise.all([
        fs.readFileAsync(space.sourceFilepath, 'utf8'),
        fs.readFileAsync(space.sourceModifiedFilepath, 'utf8').catch(_handleNotFoundError),
        fs.readFileAsync(space.sourceModifiedDeltaFilepath, 'utf8').catch(_handleNotFoundError),
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

    await fs.writeFileAsync(space.sourceModifiedDeltaFilepath, sourceModifiedDeltaYaml, 'utf8');
    await fs.writeFileAsync(space.sourceModifiedFilepath, sourceModifiedYaml, 'utf8');

    const mergedSourceModifiedTranslations = i18nCompile.fromString(sourceModifiedYaml);

    await _dumpTranslationLang(lang, mergedSourceModifiedTranslations[lang], { namespace });
    space.cachedDefaultTranslations[lang] = mergedSourceModifiedTranslations[lang];
}

async function _dumpTranslationLang(lang, translations, { namespace }) {
    if (!isValidNamespace(namespace)) {
        throw new Error('Invalid namespace');
    }

    if (sails.config.noJsonTranslationsFiles) {
        return;
    }

    const namespaceFilename = namespace === 'default' ? lang : `${namespace}-${lang}`;

    const filepath = path.join(translationFolder, `./build/${namespaceFilename}.json`);
    await fs.writeFileAsync(filepath, JSON.stringify(translations, null, 2), 'utf8');
}

function _handleNotFoundError(err) {
    if (err.code === 'ENOENT') {
        return null;
    }
    throw err;
}

async function fetchUserTranslations(lang, { namespace }) {
    if (!isValidNamespace(namespace)) {
        throw new Error('Invalid namespace');
    }

    const space = namespaces[namespace];

    if (!sails.config.useCacheTranslations) {
        space.cachedUserTranslations[lang] = null;
    }

    if (space.cachedUserTranslations[lang]) {
        return space.cachedUserTranslations[lang];
    }

    const userTranslationsEntries = await Translation.find({ lang, namespace });

    const userTranslations = userTranslationsEntries.reduce((memo, entry) => {
        memo[entry.key] = entry.content;
        return memo;
    }, {});

    space.cachedUserTranslations[lang] = userTranslations;
    return space.cachedUserTranslations[lang];
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

// escape unbreakable spaces
function isTranslationEqual(value1, value2) {
    if (typeof value1 !== 'string' || typeof value2 !== 'string') {
      return false;
    }

    let escaped1 = value1.replace(/\xa0/gi, ' ');
    let escaped2 = value2.replace(/\xa0/gi, ' ');

    return escaped1 === escaped2;
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

            if (typeof label !== 'undefined') {
                _.set(computedTranslations, labelKey, label);
            }
            if (typeof helper !== 'undefined') {
                _.set(computedTranslations, helperKey, helper);
            }
        }
    });

    return computedTranslations;
}
