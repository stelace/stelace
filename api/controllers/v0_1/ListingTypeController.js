/* global ApiService, ListingType, ListingTypeService */

module.exports = {

    find,
    findOne,
    create,
    update,
    destroy,

};

async function find(req, res) {
    const access = 'api';
    const attrs = req.allParams();

    try {
        const pagination = ApiService.parsePagination(attrs);

        const [
            listingTypes,
            countListingTypes,
        ] = await Promise.all([
            ListingType.find().paginate(pagination),
            ListingType.count(),
        ]);

        const returnedObj = ApiService.getPaginationMeta({
            totalResults: countListingTypes,
            limit: pagination.limit,
        });
        returnedObj.results = ListingType.exposeAll(listingTypes, access);

        res.json(returnedObj);
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
            throw new NotFoundError();
        }

        res.json(ListingType.expose(listingType, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function create(req, res) {
    const attrs = req.allParams();
    const access = 'api';

    try {
        const listingType = await ListingTypeService.create(attrs);

        res.json(ListingType.expose(listingType, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function update(req, res) {
    const id = req.param('id');
    const attrs = req.allParams();
    const access = 'api';

    try {
        const listingType = await ListingTypeService.updateListingId(id, attrs);

        res.json(ListingType.expose(listingType, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function destroy(req, res) {
    const id = req.param('id');

    try {
        await ListingTypeService.destroyListingType(id);
        res.json({ ok: true });
    } catch (err) {
        res.sendError(err);
    }
}
