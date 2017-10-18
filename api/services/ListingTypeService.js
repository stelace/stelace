/* global ListingType, StelaceConfigService */

module.exports = {

    getAllListingTypes,
    getListingTypes,
    getListingType,
    isValidListingTypesIds,

};

let cached = false;
let allListingTypes;
let listingTypes;
let indexedListingTypes;

async function _fetchTypes() {
    if (cached) return;

    const types = await ListingType.find();
    _updateCache(types);
    cached = true;
}

function _constructFromDefault(types) {
    const defaultProperties = StelaceConfigService.getDefaultListingTypeProperties();

    return _.reduce(types, (memo, type) => {
        const newType = _.assign({}, type);
        newType.properties = _.defaults({}, type.properties, defaultProperties);
        memo.push(newType);
        return memo;
    }, []);
}

async function _updateCache(types) {
    types = _constructFromDefault(types);
    allListingTypes = types;
    listingTypes = _.filter(types, type => type.active);
    indexedListingTypes = _.indexBy(listingTypes, 'id');
}

async function getAllListingTypes() {
    await _fetchTypes();
    return allListingTypes;
}

// returns only active listing types
async function getListingTypes() {
    await _fetchTypes();
    return listingTypes;
}

async function getListingType(listingTypeId) {
    await _fetchTypes();
    return _.find(listingTypes, listingType => listingType.id === listingTypeId);
}

async function isValidListingTypesIds(listingTypesIds) {
    await _fetchTypes();

    return _.reduce(listingTypesIds, (memo, listingTypeId) => {
        return memo && !!indexedListingTypes[listingTypeId];
    }, true);
}
