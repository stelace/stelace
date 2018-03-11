/* global ListingCategory, ListingCategoryService, StelaceConfigService, TokenService */

/**
 * ListingCategoryController
 *
 * @description :: Server-side logic for managing listingcategories
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

module.exports = {

    find,
    findOne,
    create,
    update,
    destroy,

};

const createError = require('http-errors');

async function find(req, res) {
    const access = 'others';

    const config = await StelaceConfigService.getConfig();

    const locale = config.lang;
    const fallbackLocale = config.lang;

    let listingCategories = await ListingCategory.find();
    listingCategories = ListingCategory.sortListingCategories(listingCategories, { locale, fallbackLocale });
    res.json(ListingCategory.exposeAll(listingCategories, access, { locale, fallbackLocale }));
}

async function findOne(req, res) {
    const id = req.param('id');
    const access = 'others';

    const config = await StelaceConfigService.getConfig();

    const listingCategory = await ListingCategory.findOne({ id });
    if (!listingCategory) {
        throw createError(404);
    }

    res.json(ListingCategory.expose(listingCategory, access, { locale: config.lang, fallbackLocale: config.lang }));
}

async function create(req, res) {
    const name = req.param('name');
    const parentId = req.param('parentId');

    const access = 'admin';

    if (! TokenService.isRole(req, "admin")) {
        return res.forbidden();
    }

    const config = await StelaceConfigService.getConfig();
    const locale = config.lang;
    const fallbackLocale = config.lang;

    const listingCategory = await ListingCategoryService.createListingCategory({ name, parentId }, { locale, fallbackLocale });
    res.json(ListingCategory.expose(listingCategory, access, { locale, fallbackLocale }));
}

async function update(req, res) {
    const id = req.param('id');
    const name = req.param('name');

    const access = 'admin';

    if (! TokenService.isRole(req, "admin")) {
        return res.forbidden();
    }

    const config = await StelaceConfigService.getConfig();
    const locale = config.lang;
    const fallbackLocale = config.lang;

    const listingCategory = await ListingCategoryService.updateListingCategory(id, { name }, { locale, fallbackLocale });
    res.json(ListingCategory.expose(listingCategory, access, { locale, fallbackLocale }));
}

async function destroy(req, res) {
    const id = req.param('id');
    const fallbackCategoryId = req.param('fallbackCategoryId');

    if (! TokenService.isRole(req, "admin")) {
        return res.forbidden();
    }

    await ListingCategoryService.removeListingCategory(id, { fallbackCategoryId });
    res.json({ id });
}

