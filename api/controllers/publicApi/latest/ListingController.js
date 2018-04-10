/* global ApiService, Listing, ListingService, Media, StelaceConfigService */

module.exports = {

    find,
    findOne,
    create,
    update,
    destroy,
    validate,
    updateMedias,

};

const _ = require('lodash');
const createError = require('http-errors');

async function find(req, res) {
    const allowed = await ApiService.isAllowed(req, 'listingList', 'view');
    if (!allowed) {
        throw createError(403);
    }

    const attrs = req.allParams();
    const sortFields = [
        'id',
        'name',
        'description',
        'validated',
        'locked',
        'sellingPrice',
        'deposit',
        'createdDate',
    ];
    const searchFields = [
        'id',
        'name',
        'description',
    ];

    const access = 'api';

    const config = await StelaceConfigService.getConfig();

    const fields = ApiService.parseFields(attrs);
    const pagination = ApiService.parsePagination(attrs);
    const populateMedia = _.includes(fields, 'media');

    const sorting = ApiService.parseSorting(attrs, sortFields);
    let findAttrs = {};
    const searchAttrs = ApiService.parseSearchQuery(attrs, searchFields);
    const ids = ApiService.parseEntityIds(attrs);

    findAttrs = Object.assign({}, findAttrs, searchAttrs);
    if (ids) {
        findAttrs = Object.assign({}, findAttrs, { id: ids });
    }

    const fetchListings = () => {
        if (pagination) {
            return Listing
                .find(Object.assign({}, findAttrs))
                .sort(sorting)
                .skip((pagination.page - 1) * pagination.limit)
                .limit(pagination.limit);
        } else {
            return Listing.find(Object.assign({}, findAttrs)).sort(sorting);
        }
    };

    let [
        listings,
        countListings,
    ] = await Promise.all([
        fetchListings(),
        Listing.count(Object.assign({}, findAttrs)),
    ]);

    const hashMedias = populateMedia ? await Listing.getMedias(listings) : {};

    listings = _.map(listings, listing => {
        const exposedListing = Listing.expose(listing, access, { locale: config.lang, fallbackLocale: config.lang });
        if (populateMedia) {
            exposedListing.medias = Media.exposeAll(hashMedias[listing.id], access);
        }
        return exposedListing;
    });

    const returnedObj = ApiService.getPaginationMeta({
        totalResults: countListings,
        limit: pagination && pagination.limit,
        allResults: !pagination,
    });
    returnedObj.results = listings;

    res.json(returnedObj);
}

async function findOne(req, res) {
    const allowed = await ApiService.isAllowed(req, 'listingList', 'view');
    if (!allowed) {
        throw createError(403);
    }

    const id = req.param('id');
    const attrs = req.allParams();
    const access = 'api';

    const config = await StelaceConfigService.getConfig();

    const fields = ApiService.parseFields(attrs);
    const populateMedia = _.includes(fields, 'media');

    const listing = await Listing.findOne({ id });
    if (!listing) {
        throw createError(404);
    }

    const exposedListing = Listing.expose(listing, access, { locale: config.lang, fallbackLocale: config.lang });

    if (populateMedia) {
        const hashMedias = await Listing.getMedias([listing]);
        exposedListing.medias = Media.exposeAll(hashMedias[listing.id], access);
    }

    res.json(exposedListing);
}

async function create(req, res) {
    const allowed = await ApiService.isAllowed(req, 'listingList', 'create');
    if (!allowed) {
        throw createError(403);
    }

    const attrs = req.allParams();

    const access = 'api';

    const config = await StelaceConfigService.getConfig();

    const listing = await ListingService.createListing(attrs, { req, res });
    res.json(Listing.expose(listing, access, { locale: config.lang, fallbackLocale: config.lang }));
}

async function update(req, res) {
    const allowed = await ApiService.isAllowed(req, 'listingList', 'edit');
    if (!allowed) {
        throw createError(403);
    }

    const id = req.param('id');
    const attrs = req.allParams();

    const access = 'api';

    const config = await StelaceConfigService.getConfig();

    const listing = await ListingService.updateListing(id, attrs);
    res.json(Listing.expose(listing, access, { locale: config.lang, fallbackLocale: config.lang }));
}

async function destroy(req, res) {
    const allowed = await ApiService.isAllowed(req, 'listingList', 'remove');
    if (!allowed) {
        throw createError(403);
    }

    const id = req.param('id');

    await ListingService.destroyListing(id, {
        keepCommittedBookings: false,
        trigger: 'admin',
    }, { req, res });

    res.json({ id });
}

async function validate(req, res) {
    const allowed = await ApiService.isAllowed(req, 'listingList', 'edit');
    if (!allowed) {
        throw createError(403);
    }

    const id = req.param('id');

    const access = 'api';

    const config = await StelaceConfigService.getConfig();

    const listing = await ListingService.validateListing(id);
    res.json(Listing.expose(listing, access, { locale: config.lang, fallbackLocale: config.lang }));
}

async function updateMedias(req, res) {
    const allowed = await ApiService.isAllowed(req, 'listingList', 'edit');
    if (!allowed) {
        throw createError(403);
    }

    const id = req.param('id');
    const mediasIds = req.param('mediasIds');
    const mediaType = req.param('mediaType');

    await ListingService.updateListingMedias(id, { mediasIds, mediaType });
    res.json({ id });
}
