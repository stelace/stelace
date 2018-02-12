/* global ContentEntriesService */

module.exports = {

    findEditable,
    updateEditable,

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

    await ContentEntriesService.updateUserTranslations({ lang, newTranslations: attrs.translations });

    res.json({ ok: true });
}
