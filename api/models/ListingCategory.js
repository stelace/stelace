/* global ListingCategory */

/**
* ListingCategory.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        id: {
            type: 'number',
            columnType: 'int',
            autoIncrement: true,
        },
        createdDate: {
            type: 'string',
            columnType: 'varchar(255)',
            maxLength: 255,
        },
        updatedDate: {
            type: 'string',
            columnType: 'varchar(255)',
            maxLength: 255,
        },
        name: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            required: true,
            maxLength: 255,
        },
        namesI18n: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
        parentId: {
            type: 'number',
            columnType: 'int',
            // index: true,
            allowNull: true,
        },
    },

    getAccessFields,
    getI18nMap,

    hasChildrenCategories,
    getChildrenCategories,
    getParentCategories,
    createListingCategory,
    removeListingCategory,

    sortListingCategories,

};

const _ = require('lodash');
const createError = require('http-errors');
const diacritics = require('diacritics');

function getAccessFields(access) {
    var accessFields = {
        api: [
            "id",
            "name",
            "parentId",
            "listingsCount",
            "listingsTotalCount",
        ],
        others: [
            "id",
            "name",
            "parentId",
        ],
    };

    return accessFields[access];
}

function getI18nMap() {
    return {
        name: 'namesI18n',
    };
}

async function hasChildrenCategories(categoryId) {
    const childrenCategories = await ListingCategory.find({ parentId: categoryId });
    return !!childrenCategories.length;
}

/**
 * @param {Number} categoryId
 * @param {Object} [args]
 * @param {Boolean} [args.includeSelf = true]
 */
async function getChildrenCategories(categoryId, { includeSelf = true } = {}) {
    categoryId = parseInt(categoryId, 10);

    const listingCategories = await ListingCategory.find();
    const groupedCategories = _.groupBy(listingCategories, 'parentId');
    let childrenCategories = [];

    const listingCategory = _.find(listingCategories, cat => cat.id === categoryId);
    if (!listingCategory) {
        throw new Error('Listing category not found');
    }

    if (includeSelf) {
        childrenCategories.push(listingCategory);
    }

    let parentsIds = [listingCategory.id];

    while (parentsIds.length) {
        const parentId = parentsIds.shift();

        const categories = groupedCategories[parentId];
        if (categories && categories.length) {
            _.forEach(categories, cat => {
                parentsIds.push(cat.id);
                childrenCategories.push(cat);
            });
        }
    }

    return childrenCategories;
}

/**
 * @param {Number} categoryId
 * @param {Object} [args]
 * @param {Boolean} [args.includeSelf = true]
 */
async function getParentCategories(categoryId, { includeSelf = true } = {}) {
    categoryId = parseInt(categoryId, 10);

    const listingCategories = await ListingCategory.find();
    const indexedCategories = _.indexBy(listingCategories, 'id');
    const parentCategories = [];

    const listingCategory = indexedCategories[categoryId];
    if (!listingCategory) {
        throw new Error('Listing category not found');
    }

    if (includeSelf) {
        parentCategories.push(listingCategory);
    }

    let currentListingCategory = listingCategory;

    while (currentListingCategory && currentListingCategory.parentId) {
        currentListingCategory = indexedCategories[currentListingCategory.parentId];

        if (currentListingCategory) {
            parentCategories.push(currentListingCategory);
        }
    }

    return parentCategories;
}

/**
 * @param {String} name
 * @param {Number} [parentId]
 * @param {String} locale
 * @param {String} fallbackLocale
 */
async function createListingCategory({ name, parentId }, { locale, fallbackLocale } = {}) {
    if (!name) {
        throw new Error('Missing name');
    }

    let createAttrs = {
        name,
    };

    if (parentId) {
        const parentCategory = await ListingCategory.findOne({ id: parentId });
        if (!parentCategory) {
            throw createError('Parent category not found', { listingCategoryId: parentId });
        }

        createAttrs.parentId = parentId;
    }

    const modelDelta = ListingCategory.getI18nModelDelta(null, createAttrs, { locale, fallbackLocale });
    createAttrs = _.merge({}, createAttrs, modelDelta);

    const listingCategory = await ListingCategory.create(createAttrs);
    return listingCategory;
}

async function removeListingCategory(categoryId) {
    const hasChildren = await hasChildrenCategories(categoryId);
    if (hasChildren) {
        throw createError("ListingCategory cannot be removed: has children categories");
    }

    await ListingCategory.destroy({ id: categoryId });
}

function sortListingCategories(listingCategories, { locale, fallbackLocale } = {}) {
    return _.sortBy(listingCategories, cat => {
        const listingCategory = ListingCategory.getI18nModel(cat, { locale, fallbackLocale });
        const name = diacritics.remove(listingCategory.name || '').toLowerCase();
        return name;
    });
}
