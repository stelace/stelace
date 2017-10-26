/* global ListingType */

module.exports = {

    find,
    findOne,

};

async function find(req, res) {
    const access = 'self';

    try {
        const listingTypes = await ListingType.find();
        res.json(ListingType.exposeAll(listingTypes, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function findOne(req, res) {
    const id = req.param('id');
    const access = 'self';

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
