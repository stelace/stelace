/* global ContentEntriesService */

/**
 * ContentEntriesController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

module.exports = {

    find,
    findOne,
    create,
    update,
    destroy,

    findLanguage,

};

async function find(req, res) {
    return res.forbidden();
}

async function findOne(req, res) {
    return res.forbidden();
}

async function create(req, res) {
    return res.forbidden();
}

async function update(req, res) {
    return res.forbidden();
}

async function destroy(req, res) {
    return res.forbidden();
}

async function findLanguage(req, res) {
    const attrs = req.allParams();

    const lang = ContentEntriesService.getBestLang(attrs.lang);

    const translations = await ContentEntriesService.getTranslations({
        lang,
        displayContext: false,
        onlyEditableKeys: false,
        namespace: 'default',
    });

    res.json(translations);
}
