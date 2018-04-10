/* global ApiService, ListingType, ListingTypeService, StelaceConfigService */

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

    let onlyActive = attrs.active === '1';

    const config = await StelaceConfigService.getConfig();

    let listingTypes;
    if (onlyActive) {
        listingTypes = await ListingTypeService.getListingTypes();
    } else {
        listingTypes = await ListingTypeService.getAllListingTypes();
    }

    res.json(ListingType.exposeAll(listingTypes, access, { locale: config.lang, fallbackLocale: config.lang }));
}

async function findOne(req, res) {
    const id = req.param('id');
    const access = 'api';

    const config = await StelaceConfigService.getConfig();

    const listingType = await ListingType.findOne({ id });
    if (!listingType) {
        throw createError(404);
    }

    res.json(ListingType.expose(listingType, access, { locale: config.lang, fallbackLocale: config.lang }));
}

async function create(req, res) {
    const allowed = await ApiService.isAllowed(req, 'listingType', 'create');
    if (!allowed) {
        throw createError(403);
    }

    const attrs = req.allParams();
    const access = 'api';

    const config = await StelaceConfigService.getConfig();
    const locale = config.lang;
    const fallbackLocale = config.lang;

    const listingType = await ListingTypeService.createListingType(attrs, { locale, fallbackLocale });

    res.json(ListingType.expose(listingType, access, { locale, fallbackLocale }));
}

async function update(req, res) {
    const allowed = await ApiService.isAllowed(req, 'listingType', 'edit');
    if (!allowed) {
        throw createError(403);
    }

    const id = parseInt(req.param('id'), 10);
    const attrs = req.allParams();
    const access = 'api';

    const config = await StelaceConfigService.getConfig();
    const locale = config.lang;
    const fallbackLocale = config.lang;

    const listingType = await ListingTypeService.updateListingType(id, attrs, { locale, fallbackLocale });

    res.json(ListingType.expose(listingType, access, { locale, fallbackLocale }));
}

async function destroy(req, res) {
    const allowed = await ApiService.isAllowed(req, 'listingType', 'remove');
    if (!allowed) {
        throw createError(403);
    }

    const id = parseInt(req.param('id'), 10);

    await ListingTypeService.destroyListingType(id);
    res.json({ ok: true });
}
