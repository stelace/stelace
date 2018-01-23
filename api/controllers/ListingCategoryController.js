/* global ListingCategory, ListingCategoryService, TokenService */

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

    try {
        const listingCategories = await ListingCategory.find();
        res.json(ListingCategory.exposeAll(listingCategories, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function findOne(req, res) {
    const id = req.param('id');
    const access = 'others';

    try {
        const listingCategory = await ListingCategory.findOne({ id });
        if (!listingCategory) {
            throw createError(404);
        }

        res.json(ListingCategory.expose(listingCategory, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function create(req, res) {
    const name = req.param('name');
    const parentId = req.param('parentId');

    const access = 'admin';

    if (! TokenService.isRole(req, "admin")) {
        return res.forbidden();
    }

    try {
        const listingCategory = await ListingCategoryService.createListingCategory({ name, parentId });
        res.json(ListingCategory.expose(listingCategory, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function update(req, res) {
    const id = req.param('id');
    const name = req.param('name');

    const access = 'admin';

    if (! TokenService.isRole(req, "admin")) {
        return res.forbidden();
    }

    try {
        const listingCategory = await ListingCategoryService.updateListingCategory(id, { name });
        res.json(ListingCategory.expose(listingCategory, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function destroy(req, res) {
    const id = req.param('id');
    const fallbackCategoryId = req.param('fallbackCategoryId');

    if (! TokenService.isRole(req, "admin")) {
        return res.forbidden();
    }

    try {
        await ListingCategoryService.removeListingCategory(id, { fallbackCategoryId });
        res.json({ id });
    } catch (err) {
        res.sendError(err);
    }
}

