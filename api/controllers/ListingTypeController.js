/* global ListingTypeService */

/**
 * ListingTypeController
 *
 * @description :: Server-side logic for managing listingtypes
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {

    find,
    findOne,
    create,
    update,
    destroy,

};

async function find(req, res) {
    try {
        const listingTypes = await ListingTypeService.getListingTypes();
        res.json(listingTypes);
    } catch (err) {
        res.sendError(err);
    }
}

function findOne(req, res) {
    return res.forbidden();
}

function create(req, res) {
    return res.forbidden();
}

function update(req, res) {
    return res.forbidden();
}

function destroy(req, res) {
    return res.forbidden();
}
