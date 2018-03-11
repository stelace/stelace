module.exports = {

    getI18nModel,
    setI18nModel,

    getI18nValue,
    getI18nModelDelta,
    setI18nValue,

};

const _ = require('lodash');

function getI18nModel(model, {
    i18nMap = {},
    locale,
    fallbackLocale,
}) {
    const obj = _.cloneDeep(model);

    Object.keys(i18nMap).forEach(key => {
        if (!i18nMap[key] || typeof i18nMap[key] !== 'string') {
            return;
        }

        obj[key] = getI18nValue(obj, {
            field: key,
            fieldI18n: i18nMap[key],
            locale,
            fallbackLocale,
        });
    });

    return obj;
}

function getI18nModelDelta(model, attrs, {
    i18nMap = {},
    locale,
    fallbackLocale,
}) {
    const delta = {};

    model = model || {};

    Object.keys(i18nMap).forEach(key => {
        const i18nKey = i18nMap[key];
        const value = attrs[key];

        if (i18nKey && typeof i18nKey === 'string') {
            if (typeof model[key] !== 'undefined') {
                delta[key] = model[key];
            }

            delta[i18nKey] = model[i18nKey] || {};

            setI18nValue(delta, value, {
                field: key,
                fieldI18n: i18nKey,
                locale,
                fallbackLocale,
            });
        }
    });

    return delta;
}

function setI18nModel(model, attrs, {
    i18nMap = {},
    locale,
    fallbackLocale,
}) {
    Object.keys(i18nMap).forEach(key => {
        const value = attrs[key];

        if (i18nMap[key] && typeof i18nMap[key] === 'string') {
            setI18nValue(model, value, {
                field: key,
                fieldI18n: i18nMap[key],
                locale,
                fallbackLocale,
            });
        }
    });

    return model;
}

function getI18nValue(model, {
    field,
    fieldI18n,
    locale,
    fallbackLocale,
}) {
    model[fieldI18n] = model[fieldI18n] || {};

    const localeValue = model[fieldI18n][locale];
    if (typeof localeValue !== 'undefined') {
        return localeValue;
    }

    const fallbackValue = model[fieldI18n][fallbackLocale];
    if (typeof fallbackValue !== 'undefined') {
        return fallbackValue;
    }

    return model[field];
}

function setI18nValue(model, value, {
    field,
    fieldI18n,
    locale,
    fallbackLocale,
}) {
    model[fieldI18n] = model[fieldI18n] || {};
    model[fieldI18n][locale] = value;

    const existFallback = fallbackLocale && typeof model[fieldI18n][fallbackLocale] === 'string';

    if (locale === fallbackLocale || !existFallback) {
        model[field] = value;
    }
}
