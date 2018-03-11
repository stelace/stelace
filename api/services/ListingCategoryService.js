/* global Listing, ListingCategory */

module.exports = {

    createListingCategory,
    updateListingCategory,
    removeListingCategory,

    assignListings,

};

const createError = require('http-errors');
const _ = require('lodash');

/**
 * @param {String} name
 * @param {Number} [parentId] - specify the parent category if needed
 * @param {Object} options
 * @param {String} options.locale
 * @param {String} options.fallbackLocale
 * @result {Object} created listing category
 */
async function createListingCategory({ name, parentId }, { locale, fallbackLocale } = {}) {
    const parentCategory = parentId ? await ListingCategory.findOne({ id: parentId }) : null;

    if (parentId && ! parentCategory) {
        throw createError(400, 'Parent category does not exist');
    }

    const listingCategory = await ListingCategory.createListingCategory({ name, parentId }, { locale, fallbackLocale });
    return listingCategory;
}

/**
 * @param {Number} listingCategoryId
 * @param {Object} attrs
 * @param {String} attrs.name
 * @param {Object} options
 * @param {String} options.locale
 * @param {String} options.fallbackLocale
 * @result {Object} updated listing category
 */
async function updateListingCategory(listingCategoryId, { name }, { locale, fallbackLocale } = {}) {
    if (!name) {
        throw createError(400);
    }

    let listingCategory = await ListingCategory.findOne({ id: listingCategoryId });
    if (!listingCategory) {
        throw createError(404);
    }

    let updateAttrs = { name };

    const modelDelta = ListingCategory.getI18nModelDelta(listingCategory, updateAttrs, { locale, fallbackLocale });
    updateAttrs = _.merge({}, updateAttrs, modelDelta);

    listingCategory = await ListingCategory.updateOne(listingCategoryId, updateAttrs);

    return listingCategory;
}

/**
 *
 * @param {Number} listingCategoryId
 * @param {Object} [options]
 * @param {Number} [options.fallbackCategoryId] - must specify it if there are listings referencing the removing listing category
 */
async function removeListingCategory(listingCategoryId, { fallbackCategoryId }) {
    const nbListings = await Listing.count({ listingCategoryId });

    if (nbListings && !fallbackCategoryId) {
        throw new createError(400, 'Listing category is still used');
    }

    await assignListings(listingCategoryId, fallbackCategoryId);
    await ListingCategory.removeListingCategory(listingCategoryId);
}

async function assignListings(fromListingCategoryId, toListingCategoryId) {
    await Listing.update(
        { listingCategoryId: fromListingCategoryId },
        { listingCategoryId: toListingCategoryId },
    );
}
