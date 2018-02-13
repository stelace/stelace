/* global ContentEntriesService */

module.exports = {

    findEditable,
    updateEditable,

    findDefault,
    updateDefault,

};

async function findEditable(req, res) {
    const attrs = req.allParams();

    // TODO: expose languages supported in config
    const lang = ContentEntriesService.isLangAllowed(attrs.locale) ? attrs.locale : ContentEntriesService.getDefaultLang();

    const translations = await ContentEntriesService.getTranslations({ lang, displayContext: true, onlyEditableKeys: true });
    const metadata = await ContentEntriesService.getMetadata(lang);

    res.json({
        editableKeys: metadata.editableKeys,
        editable: translations,
    });
}

async function updateEditable(req, res) {
    const attrs = req.allParams();

    const lang = ContentEntriesService.isLangAllowed(attrs.locale) ? attrs.locale : ContentEntriesService.getDefaultLang();

    await ContentEntriesService.updateUserTranslations(lang, attrs.translations);

    res.json({ ok: true });
}

async function findDefault(req, res) {
    const attrs = req.allParams();

    const lang = ContentEntriesService.isLangAllowed(attrs.locale) ? attrs.locale : ContentEntriesService.getDefaultLang();

    const translations = await ContentEntriesService.fetchDefaultTranslations(lang);
    res.json(translations);
}

async function updateDefault(req, res) {
    if (!sails.config.stelace.superAdmin) {
        return res.forbidden();
    }

    const attrs = req.allParams();

    const lang = ContentEntriesService.isLangAllowed(attrs.locale) ? attrs.locale : ContentEntriesService.getDefaultLang();

    await ContentEntriesService.updateTranslations(lang, attrs.translations);

    res.json({ ok: true });
}
