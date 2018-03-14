/* global ApiService, ContentEntriesService */

module.exports = {

    findEditable,
    updateEditable,

    findDefault,
    updateDefault,

};

const createError = require('http-errors');

async function findEditable(req, res) {
    const attrs = req.allParams();

    // TODO: expose languages supported in config
    const lang = ContentEntriesService.getBestLang(attrs.locale);

    const translations = await ContentEntriesService.getTranslations({ lang, displayContext: true, onlyEditableKeys: true });
    const metadata = await ContentEntriesService.getMetadata(lang);

    res.json({
        editableKeys: metadata.editableKeys,
        editable: translations,
    });
}

async function updateEditable(req, res) {
    const allowedTranslation = await ApiService.isAllowed(req, 'translation', 'edit');
    const allowedEditor = await ApiService.isAllowed(req, 'editor', 'view');
    if (!allowedTranslation || !allowedEditor) {
        throw createError(403);
    }

    const attrs = req.allParams();

    const lang = ContentEntriesService.getBestLang(attrs.locale);

    await ContentEntriesService.updateUserTranslations(lang, attrs.translations);

    res.json({ ok: true });
}

async function findDefault(req, res) {
    const attrs = req.allParams();

    const lang = ContentEntriesService.getBestLang(attrs.locale);

    const translations = await ContentEntriesService.fetchDefaultTranslations(lang);
    res.json(translations);
}

async function updateDefault(req, res) {
    const allowedTranslation = await ApiService.isAllowed(req, 'translation', 'edit');
    const allowedAdminEditor = await ApiService.isAllowed(req, 'adminEditor', 'view');
    if (!allowedTranslation || !allowedAdminEditor) {
        throw createError(403);
    }

    if (!sails.config.stelace.superAdmin) {
        return res.forbidden();
    }

    const attrs = req.allParams();

    const lang = ContentEntriesService.getBestLang(attrs.locale);

    await ContentEntriesService.updateTranslations(lang, attrs.translations);

    res.json({ ok: true });
}
