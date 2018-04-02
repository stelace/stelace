/* global ApiService, ContentEntriesService, EmailTemplateService, StelaceConfigService, User */

module.exports = {

    getListTemplates,
    preview,
    edit,
    getTemplateMetadata,

    findEditable,
    updateEditable,
    resetEditable,

    findDefault,
    updateDefault,

}

const createError = require('http-errors');

async function getListTemplates(req, res) {
    const templates = EmailTemplateService.getListTemplates();

    res.json({
        templates,
    });
}

async function preview(req, res) {
    const { template, locale } = req.allParams();

    const { html } = await _getTemplateResult({ template, lang: locale, currentUser: req.user, isEditMode: false });

    res.send(html);
}

async function edit(req, res) {
    const { template, locale } = req.allParams();

    const { html } = await _getTemplateResult({ template, lang: locale, currentUser: req.user, isEditMode: true });

    res.send(html);
}

async function getTemplateMetadata(req, res) {
    const { template, locale } = req.allParams();

    const { parameters } = await _getTemplateResult({ template, lang: locale, currentUser: req.user });
    const parametersMetadata = EmailTemplateService.getParametersMetadata(template);

    const filteredParameters = {};

    parametersMetadata.forEach(metadata => {
        filteredParameters[metadata.label] = parameters[metadata.label];
    });


    res.json({
        parameters: filteredParameters,
        parametersMetadata,
    });
}

async function _getTemplateResult({ template, lang, currentUser, isEditMode }) {
    const templates = EmailTemplateService.getListTemplates();
    if (!templates.includes(template)) {
        throw createError(404, 'Template not found');
    }
    if (lang && !ContentEntriesService.isLangAllowed(lang)) {
        throw createError(400, 'Not allowed language');
    }

    const config = await StelaceConfigService.getConfig();
    if (!lang) {
        lang = config.lang;
    }

    const exampleData = EmailTemplateService.getExampleData(template);

    let user;
    if (currentUser) {
        user = currentUser;
    } else {
        [user] = await User.find().limit(1);
    }

    const result = await EmailTemplateService.getTemplateResult(template, {
        lang,
        isEditMode,
        user,
        data: exampleData,
    });

    return result;
}

async function findEditable(req, res) {
    const attrs = req.allParams();

    // TODO: expose languages supported in config
    const lang = ContentEntriesService.getBestLang(attrs.locale);

    const translations = await ContentEntriesService.getTranslations({
        lang,
        displayContext: true,
        onlyEditableKeys: false,
        namespace: 'email',
    });

    res.json({
        editable: translations,
    });
}

async function updateEditable(req, res) {
    const allowedEditor = await ApiService.isAllowed(req, 'emailEditor', 'view');
    if (!allowedEditor) {
        throw createError(403);
    }

    const attrs = req.allParams();

    const lang = ContentEntriesService.getBestLang(attrs.locale);

    const updatedTranslations = await ContentEntriesService.updateUserTranslations(lang, attrs.translations, { namespace: 'email' });

    res.json(updatedTranslations);
}

async function resetEditable(req, res) {
    const allowedEditor = await ApiService.isAllowed(req, 'emailEditor', 'view');
    if (!allowedEditor) {
        throw createError(403);
    }

    const attrs = req.allParams();

    const lang = ContentEntriesService.getBestLang(attrs.locale);

    const resetTranslations = await ContentEntriesService.resetUserTranslations(lang, attrs.translationsKeys, { namespace: 'email' });

    res.json(resetTranslations);
}

async function findDefault(req, res) {
    const attrs = req.allParams();

    const lang = ContentEntriesService.getBestLang(attrs.locale);

    const translations = await ContentEntriesService.fetchDefaultTranslations(lang, { namespace: 'email' });
    res.json(translations);
}

async function updateDefault(req, res) {
    const allowedAdminEditor = await ApiService.isAllowed(req, 'adminEmailEditor', 'view');
    if (!allowedAdminEditor) {
        throw createError(403);
    }

    const attrs = req.allParams();

    const lang = ContentEntriesService.getBestLang(attrs.locale);

    const updatedTranslations = await ContentEntriesService.updateDefaultTranslations(lang, attrs.translations, { namespace: 'email' });

    res.json(updatedTranslations);
}
