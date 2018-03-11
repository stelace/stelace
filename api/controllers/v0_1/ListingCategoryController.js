/* global ApiService, Listing, ListingCategory, ListingCategoryService, StelaceConfigService */

module.exports = {

    find,
    findOne,
    create,
    update,
    destroy,
    assignListings,

};

const _ = require('lodash');
const createError = require('http-errors');

async function find(req, res) {
    const attrs = req.allParams();
    const access = 'api';

    const fields = ApiService.parseFields(attrs);
    const populateListingsCount = _.includes(fields, 'listingsCount');

    const config = await StelaceConfigService.getConfig();
    const locale = config.lang;
    const fallbackLocale = config.lang;

    let listingCategories = await ListingCategory.find();
    listingCategories = ListingCategory.sortListingCategories(listingCategories, { locale, fallbackLocale });

    if (populateListingsCount) {
        const sqlQuery = `
            SELECT listingCategoryId, count(*) as sum
            FROM listing
            GROUP BY listingCategoryId
        `;

        const countListings = await Listing.sendNativeQuery(sqlQuery);
        const indexedCountListings = _.indexBy(countListings, 'listingCategoryId');

        const hashParentCount = {};

        _.forEach(listingCategories, listingCategory => {
            const count = indexedCountListings[listingCategory.id];
            listingCategory.listingsCount = count ? count.sum : 0;
            if (listingCategory.parentId) {
                hashParentCount[listingCategory.parentId] = (hashParentCount[listingCategory.parentId] || 0) + listingCategory.listingsCount;
            }
        });

        _.forEach(listingCategories, listingCategory => {
            const totalCount = hashParentCount[listingCategory.id] || 0;
            listingCategory.listingsTotalCount = totalCount + listingCategory.listingsCount;
        });
    }

    res.json(ListingCategory.exposeAll(listingCategories, access, { locale, fallbackLocale }));
}

async function findOne(req, res) {
    const id = req.param('id');
    const access = 'api';

    const config = await StelaceConfigService.getConfig();
    const locale = config.lang;
    const fallbackLocale = config.lang;

    const listingCategory = await ListingCategory.findOne({ id });
    if (!listingCategory) {
        throw createError(404);
    }

    res.json(ListingCategory.expose(listingCategory, access, { locale, fallbackLocale }));
}

async function create(req, res) {
    const name = req.param('name');
    const parentId = req.param('parentId');

    const access = 'api';

    const config = await StelaceConfigService.getConfig();
    const locale = config.lang;
    const fallbackLocale = config.lang;

    const listingCategory = await ListingCategoryService.createListingCategory({ name, parentId }, { locale, fallbackLocale });
    res.json(ListingCategory.expose(listingCategory, access, { locale, fallbackLocale }));
}

async function update(req, res) {
    const id = req.param('id');
    const name = req.param('name');

    const access = 'api';

    const config = await StelaceConfigService.getConfig();
    const locale = config.lang;
    const fallbackLocale = config.lang;

    const listingCategory = await ListingCategoryService.updateListingCategory(id, { name }, { locale, fallbackLocale });
    res.json(ListingCategory.expose(listingCategory, access, { locale, fallbackLocale }));
}

async function destroy(req, res) {
    const id = req.param('id');
    const fallbackCategoryId = req.param('fallbackCategoryId');

    await ListingCategoryService.removeListingCategory(id, { fallbackCategoryId });
    res.json({ id });
}

async function assignListings(req, res) {
    const fromListingCategoryId = req.param('fromListingCategoryId');
    const toListingCategoryId = req.param('toListingCategoryId');

    if (!fromListingCategoryId || !toListingCategoryId) {
        return res.badRequest();
    }

    await ListingCategoryService.assignListings(fromListingCategoryId, toListingCategoryId);
    res.json({ ok: true });
}
