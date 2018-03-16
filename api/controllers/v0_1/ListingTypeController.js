/* global ApiService, ListingType, ListingTypeService */

module.exports = {

    find,
    findOne,
    create,
    update,
    destroy,

};

const createError = require('http-errors');

async function find(req, res) {
    const access = 'api';
    const attrs = req.allParams();

    try {
        let onlyActive = attrs.active === '1';

        let listingTypes;
        if (onlyActive) {
            listingTypes = await ListingTypeService.getListingTypes();
        } else {
            listingTypes = await ListingTypeService.getAllListingTypes();
        }

        res.json(ListingType.exposeAll(listingTypes, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function findOne(req, res) {
    const id = req.param('id');
    const access = 'api';

    try {
        const listingType = await ListingType.findOne({ id });
        if (!listingType) {
            throw createError(404);
        }

        res.json(ListingType.expose(listingType, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function create(req, res) {
    const allowed = await ApiService.isAllowed(req, 'listingType', 'create');
    if (!allowed) {
        throw createError(403);
    }

    const attrs = req.allParams();
    const access = 'api';

    try {
        const listingType = await ListingTypeService.createListingType(attrs);

        res.json(ListingType.expose(listingType, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function update(req, res) {
    const allowed = await ApiService.isAllowed(req, 'listingType', 'edit');
    if (!allowed) {
        throw createError(403);
    }

    const id = parseInt(req.param('id'), 10);
    const attrs = req.allParams();
    const access = 'api';

    try {
        const listingType = await ListingTypeService.updateListingType(id, attrs);

        res.json(ListingType.expose(listingType, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function destroy(req, res) {
    const allowed = await ApiService.isAllowed(req, 'listingType', 'remove');
    if (!allowed) {
        throw createError(403);
    }

    const id = parseInt(req.param('id'), 10);

    try {
        await ListingTypeService.destroyListingType(id);
        res.json({ ok: true });
    } catch (err) {
        res.sendError(err);
    }
}
