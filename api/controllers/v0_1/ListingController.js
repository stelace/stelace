/* global ApiService, Listing, ListingService, Media */

module.exports = {

    find,
    findOne,
    create,
    update,
    destroy,
    validate,

};

async function find(req, res) {
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

    try {
        const fields = ApiService.parseFields(attrs);
        const pagination = ApiService.parsePagination(attrs);
        const populateMedia = _.includes(fields, 'media');

        const sorting = ApiService.parseSorting(attrs, sortFields);
        const searchAttrs = ApiService.parseSearchQuery(attrs, searchFields);

        let [
            listings,
            countListings,
        ] = await Promise.all([
            Listing.find(searchAttrs).sort(sorting).paginate(pagination),
            Listing.count(searchAttrs),
        ]);

        const hashMedias = populateMedia ? await Listing.getMedias(listings) : {};

        listings = _.map(listings, listing => {
            const exposedListing = Listing.expose(listing, access);
            if (populateMedia) {
                exposedListing.medias = Media.exposeAll(hashMedias[listing.id], access);
            }
            return exposedListing;
        });

        const returnedObj = ApiService.getPaginationMeta({
            totalResults: countListings,
            limit: pagination.limit,
        });
        returnedObj.results = listings;

        res.json(returnedObj);
    } catch (err) {
        res.sendError(err);
    }
}

async function findOne(req, res) {
    const id = req.param('id');
    const access = 'api';

    try {
        const listing = await Listing.findOne({ id });
        if (!listing) {
            throw new NotFoundError();
        }

        res.json(Listing.expose(listing, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function create(req, res) {
    const attrs = req.allParams();

    const access = 'api';

    try {
        const listing = await ListingService.createListing(attrs, { req, res });
        res.json(Listing.expose(listing, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function update(req, res) {
    const id = req.param('id');
    const attrs = req.allParams();

    const access = 'api';

    try {
        const listing = await ListingService.updateListing(id, attrs);
        res.json(Listing.expose(listing, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function destroy(req, res) {
    const id = req.param('id');

    try {
        await ListingService.destroyListing(id, { req, res });

        res.json({ id });
    } catch (err) {
        res.sendError(err);
    }
}

async function validate(req, res) {
    const id = req.param('id');

    const access = 'api';

    try {
        const listing = await ListingService.validateListing(id);
        res.json(Listing.expose(listing, access));
    } catch (err) {
        res.sendError(err);
    }
}
