/* global Listing, ListingCategory */

module.exports = {

    createListingCategory,
    updateListingCategory,
    removeListingCategory,

    assignListings,

};

const createError = require('http-errors');

/**
 * @param {String} name
 * @param {Number} [parentId] - specify the parent category if needed
 * @result {Object} created listing category
 */
async function createListingCategory({ name, parentId }) {
    const [
        existingListingCategory,
        parentCategory,
    ] = await Promise.all([
        ListingCategory.find({ name }).limit(1).then(cats => cats[0]),
        parentId ? ListingCategory.findOne({ id: parentId }) : null,
    ]);

    if (existingListingCategory) {
        throw createError(400, 'Category already exists');
    }
    if (parentId && ! parentCategory) {
        throw createError(400, 'Parent category does not exist');
    }

    const listingCategory = await ListingCategory.createListingCategory({ name, parentId });
    return listingCategory;
}

/**
 * @param {Number} listingCategoryId
 * @param {Object} attrs
 * @param {String} attrs.name
 * @result {Object} updated listing category
 */
async function updateListingCategory(listingCategoryId, { name }) {
    if (!name) {
        throw createError(400);
    }

    const listingCategory = await ListingCategory.updateOne(listingCategoryId, { name });
    if (!listingCategory) {
        throw createError(404);
    }

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
