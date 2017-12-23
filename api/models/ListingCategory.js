/* global ListingCategory */

/**
* ListingCategory.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        name: {
            type: "string",
            maxLength: 255,
            required: true
        },
        lft: "integer",
        rgt: "integer",
        parentId: {
            type: "integer",
            index: true
        },

        hasChildrenCategories: s_hasChildrenCategories,
        getParentCategories: s_getParentCategories
    },

    getAccessFields: getAccessFields,
    hasChildrenCategories: hasChildrenCategories,
    getChildrenCategories: getChildrenCategories,
    getParentCategories: getParentCategories,
    createListingCategory: createListingCategory,
    removeListingCategory: removeListingCategory,

};

function getAccessFields(access) {
    var accessFields = {
        api: [
            "id",
            "name",
            "lft",
            "rgt",
            "parentId",
            "listingsCount",
            "listingsTotalCount",
        ],
        others: [
            "id",
            "name",
            "lft",
            "rgt",
            "parentId",
        ],
    };

    return accessFields[access];
}

function _createSpace(left) {
    return Promise
        .resolve()
        .then(() => {
            return ListingCategory
                .find({ rgt: { '>=': left } })
                .sort({ lft: 1 });
        })
        .each(listingCategory => {
            var updateAttrs = {
                rgt: listingCategory.rgt + 2
            };

            if (listingCategory.lft >= left) {
                updateAttrs.lft = listingCategory.lft + 2;
            }

            return ListingCategory.updateOne(listingCategory.id, updateAttrs);
        });
}

function _removeSpace(left) {
    return Promise
        .resolve()
        .then(() => {
            return ListingCategory
                .find({ rgt: { '>=': left } })
                .sort({ lft: 1 });
        })
        .each(listingCategory => {
            var updateAttrs = {
                rgt: listingCategory.rgt - 2
            };

            if (listingCategory.lft >= left) {
                updateAttrs.lft = listingCategory.lft - 2;
            }

            return ListingCategory.updateOne(listingCategory.id, updateAttrs);
        });
}

function s_hasChildrenCategories() {
    return this.lft + 1 !== this.rgt;
}

function hasChildrenCategories(categoryId) {
    return Promise
        .resolve()
        .then(() => {
            return ListingCategory.findOne({ id: categoryId });
        })
        .then(listingCategory => {
            if (! listingCategory) {
                var error = new Error("ListingCategory not found");
                error.listingCategoryId = categoryId;
                throw error;
            }

            return listingCategory.hasChildrenCategories();
        });
}

function getChildrenCategories(categoryId, includeSelf) {
    return Promise
        .resolve()
        .then(() => {
            return ListingCategory.findOne({ id: categoryId });
        })
        .then(listingCategory => {
            if (! listingCategory) {
                var error = new NotFoundError("ListingCategory not found");
                error.listingCategoryId = categoryId;
                throw error;
            }

            var findAttrs;
            if (includeSelf) {
                findAttrs = {
                    lft: { '>=': listingCategory.lft },
                    rgt: { '<=': listingCategory.rgt }
                };
            } else {
                findAttrs = {
                    lft: { '>': listingCategory.lft },
                    rgt: { '<': listingCategory.rgt }
                };
            }

            return ListingCategory
                .find(findAttrs)
                .sort({ lft: 1 });
        });
}

function s_getParentCategories(includeSelf) {
    var listingCategory = this;

    return Promise
        .resolve()
        .then(() => {
            if (! listingCategory.parentId) {
                return (includeSelf ? [listingCategory] : []);
            }

            var findAttrs;
            if (includeSelf) {
                findAttrs = {
                    lft: { '<=': listingCategory.lft },
                    rgt: { '>=': listingCategory.rgt }
                };
            } else {
                findAttrs = {
                    lft: { '<': listingCategory.lft },
                    rgt: { '>': listingCategory.rgt }
                };
            }

            return ListingCategory
                .find(findAttrs)
                .sort({ lft: -1 });
        });
}

function getParentCategories(categoryId, includeSelf) {
    return Promise
        .resolve()
        .then(() => {
            return ListingCategory.findOne({ id: categoryId });
        })
        .then(listingCategory => {
            if (! listingCategory) {
                var error = new NotFoundError("Listing category not found");
                error.listingCategoryId = categoryId;
                throw error;
            }

            return listingCategory.getParentCategories(includeSelf);
        });
}

/**
 * @param args
 * - *name
 * - parentId
 * - parent
 */
function _insertIntoParent(args) {
    var name     = args.name;
    var parentId = args.parentId;
    var parent   = args.parent;

    var createAttrs = {
        name: name,
        parentId: parentId
    };
    var needCreateSpace = false;

    return Promise
        .resolve()
        .then(() => {
            return ListingCategory.find({ parentId: parentId });
        })
        .then(listingCategories => {
            var sortedListingCategories = _.sortBy(listingCategories, function (listingCategory) {
                return listingCategory.name.toLowerCase();
            });
            var alphabeticallyNextListingCategory = _.find(sortedListingCategories, function (listingCategory) {
                return name.toLowerCase() < listingCategory.name.toLowerCase();
            });
            var lastListingCategory = _.last(sortedListingCategories);

            // if first level category and no category after the new one
            if (! parentId && ! alphabeticallyNextListingCategory) {
                // if the new category is the first one
                if (! lastListingCategory) {
                    createAttrs.lft = 1;
                    createAttrs.rgt = 2;
                } else {
                    createAttrs.lft = lastListingCategory.rgt + 1;
                    createAttrs.rgt = lastListingCategory.rgt + 2;
                }
            } else {
                needCreateSpace = true;

                if (alphabeticallyNextListingCategory) {
                    createAttrs.lft = alphabeticallyNextListingCategory.lft;
                    createAttrs.rgt = alphabeticallyNextListingCategory.lft + 1;
                } else {
                    createAttrs.lft = parent.rgt;
                    createAttrs.rgt = parent.rgt + 1;
                }
            }

            if (needCreateSpace) {
                return _createSpace(createAttrs.lft)
                    .then(() => {
                        return ListingCategory.create(createAttrs);
                    });
            } else {
                return ListingCategory.create(createAttrs);
            }
        });
}

/**
 * @param args
 * - *name
 * - parentId
 */
function createListingCategory(args) {
    var name     = args.name;
    var parentId = args.parentId;

    return Promise
        .resolve()
        .then(() => {
            if (parentId) {
                return ListingCategory
                    .findOne({ id: parentId })
                    .then(listingCategory => {
                        if (! listingCategory) {
                            var error = new NotFoundError("Parent category not found");
                            error.listingCategoryId = parentId;
                            throw error;
                        }

                        return _insertIntoParent({
                            name: name,
                            parentId: parentId,
                            parent: listingCategory
                        });
                    });
            } else {
                return _insertIntoParent({ name: name });
            }
        });
}

function removeListingCategory(categoryId) {
    return Promise
        .resolve()
        .then(() => {
            return ListingCategory.findOne({ id: categoryId });
        })
        .then(listingCategory => {
            if (! listingCategory) {
                var error = new NotFoundError("ListingCategory not found");
                error.listingCategoryId = categoryId;
                throw error;
            }
            if (listingCategory.hasChildrenCategories()) {
                throw new ForbiddenError("ListingCategory cannot be removed: has children categories");
            }

            return ListingCategory
                .destroy({ id: listingCategory.id })
                .then(() => {
                    return _removeSpace(listingCategory.lft);
                });
        });
}
