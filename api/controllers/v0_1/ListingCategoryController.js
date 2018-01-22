/* global ApiService, Listing, ListingCategory, ListingCategoryService */

module.exports = {

    find,
    findOne,
    create,
    update,
    destroy,
    assignListings,

};

const _ = require('lodash');

async function find(req, res) {
    const attrs = req.allParams();
    const access = 'api';

    try {
        const fields = ApiService.parseFields(attrs);
        const populateListingsCount = _.includes(fields, 'listingsCount');

        const listingCategories = await ListingCategory.find().sort({ lft: 1 });

        if (populateListingsCount) {
            const sqlQuery = `
                SELECT listingCategoryId, count(*) as sum
                FROM listing
                GROUP BY listingCategoryId
            `;

            const countListings = await Listing.query(sqlQuery);
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

        res.json(ListingCategory.exposeAll(listingCategories, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function findOne(req, res) {
    const id = req.param('id');
    const access = 'api';

    try {
        const listingCategory = await ListingCategory.findOne({ id });
        if (!listingCategory) {
            throw new NotFoundError();
        }

        res.json(ListingCategory.expose(listingCategory, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function create(req, res) {
    const name = req.param('name');
    const parentId = req.param('parentId');

    const access = 'api';

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

    const access = 'api';

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

    try {
        await ListingCategoryService.removeListingCategory(id, { fallbackCategoryId });
        res.json({ id });
    } catch (err) {
        res.sendError(err);
    }
}

async function assignListings(req, res) {
    const fromListingCategoryId = req.param('fromListingCategoryId');
    const toListingCategoryId = req.param('toListingCategoryId');

    if (!fromListingCategoryId || !toListingCategoryId) {
        return res.badRequest();
    }

    try {
        await ListingCategoryService.assignListings(fromListingCategoryId, toListingCategoryId);
        res.json({ ok: true });
    } catch (err) {
        res.sendError(err);
    }
}
