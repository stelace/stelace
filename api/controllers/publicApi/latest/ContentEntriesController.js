/* global ApiService, ContentEntriesService */

module.exports = {

    findEditable,
    updateEditable,
    resetEditable,

    findDefault,
    updateDefault,

};

const createError = require('http-errors');

async function findEditable(req, res) {
    const attrs = req.allParams();

    // TODO: expose languages supported in config
    const lang = ContentEntriesService.getBestLang(attrs.locale);

    const translations = await ContentEntriesService.getTranslations({
        lang,
        displayContext: true,
        onlyEditableKeys: true,
        namespace: 'default',
    });
    const metadata = await ContentEntriesService.getMetadata(lang, { namespace: 'default' });

    res.json({
        editableKeys: metadata.editableKeys,
        editable: translations,
    });
}

async function updateEditable(req, res) {
    const allowedEditor = await ApiService.isAllowed(req, 'editor', 'view');
    if (!allowedEditor) {
        throw createError(403);
    }

    const attrs = req.allParams();

    const lang = ContentEntriesService.getBestLang(attrs.locale);

    const updatedTranslations = await ContentEntriesService.updateUserTranslations(lang, attrs.translations, { namespace: 'default' });

    res.json(updatedTranslations);
}

async function resetEditable(req, res) {
    const allowedEditor = await ApiService.isAllowed(req, 'editor', 'view');
    if (!allowedEditor) {
        throw createError(403);
    }

    const attrs = req.allParams();

    const lang = ContentEntriesService.getBestLang(attrs.locale);

    const resetTranslations = await ContentEntriesService.resetUserTranslations(lang, attrs.translationsKeys, { namespace: 'default' });

    res.json(resetTranslations);
}

async function findDefault(req, res) {
    const attrs = req.allParams();

    const lang = ContentEntriesService.getBestLang(attrs.locale);

    const translations = await ContentEntriesService.fetchDefaultTranslations(lang, { namespace: 'default' });
    res.json(translations);
}

async function updateDefault(req, res) {
    const allowedAdminEditor = await ApiService.isAllowed(req, 'adminEditor', 'view');
    if (!allowedAdminEditor) {
        throw createError(403);
    }

    const attrs = req.allParams();

    const lang = ContentEntriesService.getBestLang(attrs.locale);

    const updatedTranslations = await ContentEntriesService.updateDefaultTranslations(lang, attrs.translations, { namespace: 'default' });

    res.json(updatedTranslations);
}
