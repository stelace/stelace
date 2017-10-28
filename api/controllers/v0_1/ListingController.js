/* global ApiService, Listing, Media */

module.exports = {

    find,
    findOne,

};

async function find(req, res) {
    const access = 'self';
    const attrs = req.allParams();

    try {
        const fields = ApiService.parseFields(attrs);
        const pagination = ApiService.parsePagination(attrs);
        const populateMedia = _.includes(fields, 'media');

        let listings = await Listing.find().paginate(pagination);
        const hashMedias = populateMedia ? await Listing.getMedias(listings) : {};

        listings = _.map(listings, listing => {
            const exposedListing = Listing.expose(listing, access);
            if (populateMedia) {
                exposedListing.medias = Media.exposeAll(hashMedias[listing.id], access);
            }
            return exposedListing;
        });

        res.json(listings);
    } catch (err) {
        res.sendError(err);
    }
}

async function findOne(req, res) {
    const id = req.param('id');
    const access = 'self';

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
