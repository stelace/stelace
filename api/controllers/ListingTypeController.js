/* global ListingType, ListingTypeService, StelaceConfigService */

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
    const access = 'others';

    const config = await StelaceConfigService.getConfig();
    const locale = config.lang;
    const fallbackLocale = config.lang;

    const listingTypes = await ListingTypeService.getListingTypes();

    res.json(ListingType.exposeAll(listingTypes, access, { locale, fallbackLocale }));
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
