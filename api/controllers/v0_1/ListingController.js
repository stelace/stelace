/* global Listing */

module.exports = {

    find,
    findOne,

};

async function find(req, res) {
    const access = 'self';

    try {
        const listings = await Listing.find();
        res.json(Listing.exposeAll(listings, access));
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
