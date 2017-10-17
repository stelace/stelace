/* global ItemCategory */

/**
* ItemCategory.js
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
    createItemCategory: createItemCategory,
    removeItemCategory: removeItemCategory,

};

function getAccessFields(access) {
    var accessFields = {
        others: [
            "id",
            "name",
            "lft",
            "rgt",
            "parentId"
        ]
    };

    return accessFields[access];
}

function _createSpace(left) {
    return Promise
        .resolve()
        .then(() => {
            return ItemCategory
                .find({ rgt: { '>=': left } })
                .sort({ lft: 1 });
        })
        .each(itemCategory => {
            var updateAttrs = {
                rgt: itemCategory.rgt + 2
            };

            if (itemCategory.lft >= left) {
                updateAttrs.lft = itemCategory.lft + 2;
            }

            return ItemCategory.updateOne(itemCategory.id, updateAttrs);
        });
}

function _removeSpace(left) {
    return Promise
        .resolve()
        .then(() => {
            return ItemCategory
                .find({ rgt: { '>=': left } })
                .sort({ lft: 1 });
        })
        .each(itemCategory => {
            var updateAttrs = {
                rgt: itemCategory.rgt - 2
            };

            if (itemCategory.lft >= left) {
                updateAttrs.lft = itemCategory.lft - 2;
            }

            return ItemCategory.updateOne(itemCategory.id, updateAttrs);
        });
}

function s_hasChildrenCategories() {
    return this.lft + 1 !== this.rgt;
}

function hasChildrenCategories(categoryId) {
    return Promise
        .resolve()
        .then(() => {
            return ItemCategory.findOne({ id: categoryId });
        })
        .then(itemCategory => {
            if (! itemCategory) {
                var error = new Error("ItemCategory not found");
                error.itemCategoryId = categoryId;
                throw error;
            }

            return itemCategory.hasChildrenCategories();
        });
}

function getChildrenCategories(categoryId, includeSelf) {
    return Promise
        .resolve()
        .then(() => {
            return ItemCategory.findOne({ id: categoryId });
        })
        .then(itemCategory => {
            if (! itemCategory) {
                var error = new NotFoundError("ItemCategory not found");
                error.itemCategoryId = categoryId;
                throw error;
            }

            var findAttrs;
            if (includeSelf) {
                findAttrs = {
                    lft: { '>=': itemCategory.lft },
                    rgt: { '<=': itemCategory.rgt }
                };
            } else {
                findAttrs = {
                    lft: { '>': itemCategory.lft },
                    rgt: { '<': itemCategory.rgt }
                };
            }

            return ItemCategory
                .find(findAttrs)
                .sort({ lft: 1 });
        });
}

function s_getParentCategories(includeSelf) {
    var itemCategory = this;

    return Promise
        .resolve()
        .then(() => {
            if (! itemCategory.parentId) {
                return (includeSelf ? [itemCategory] : []);
            }

            var findAttrs;
            if (includeSelf) {
                findAttrs = {
                    lft: { '<=': itemCategory.lft },
                    rgt: { '>=': itemCategory.rgt }
                };
            } else {
                findAttrs = {
                    lft: { '<': itemCategory.lft },
                    rgt: { '>': itemCategory.rgt }
                };
            }

            return ItemCategory
                .find(findAttrs)
                .sort({ lft: -1 });
        });
}

function getParentCategories(categoryId, includeSelf) {
    return Promise
        .resolve()
        .then(() => {
            return ItemCategory.findOne({ id: categoryId });
        })
        .then(itemCategory => {
            if (! itemCategory) {
                var error = new NotFoundError("Item category not found");
                error.itemCategoryId = categoryId;
                throw error;
            }

            return itemCategory.getParentCategories(includeSelf);
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
            return ItemCategory.find({ parentId: parentId });
        })
        .then(itemCategories => {
            var sortedItemCategories = _.sortBy(itemCategories, function (itemCategory) {
                return itemCategory.name.toLowerCase();
            });
            var alphabeticallyNextItemCategory = _.find(sortedItemCategories, function (itemCategory) {
                return name.toLowerCase() < itemCategory.name.toLowerCase();
            });
            var lastItemCategory = _.last(sortedItemCategories);

            // if first level category and no category after the new one
            if (! parentId && ! alphabeticallyNextItemCategory) {
                // if the new category is the first one
                if (! lastItemCategory) {
                    createAttrs.lft = 1;
                    createAttrs.rgt = 2;
                } else {
                    createAttrs.lft = lastItemCategory.rgt + 1;
                    createAttrs.rgt = lastItemCategory.rgt + 2;
                }
            } else {
                needCreateSpace = true;

                if (alphabeticallyNextItemCategory) {
                    createAttrs.lft = alphabeticallyNextItemCategory.lft;
                    createAttrs.rgt = alphabeticallyNextItemCategory.lft + 1;
                } else {
                    createAttrs.lft = parent.rgt;
                    createAttrs.rgt = parent.rgt + 1;
                }
            }

            if (needCreateSpace) {
                return _createSpace(createAttrs.lft)
                    .then(() => {
                        return ItemCategory.create(createAttrs);
                    });
            } else {
                return ItemCategory.create(createAttrs);
            }
        });
}

/**
 * @param args
 * - *name
 * - parentId
 */
function createItemCategory(args) {
    var name     = args.name;
    var parentId = args.parentId;

    return Promise
        .resolve()
        .then(() => {
            if (parentId) {
                return ItemCategory
                    .findOne({ id: parentId })
                    .then(itemCategory => {
                        if (! itemCategory) {
                            var error = new NotFoundError("Parent category not found");
                            error.itemCategoryId = parentId;
                            throw error;
                        }

                        return _insertIntoParent({
                            name: name,
                            parentId: parentId,
                            parent: itemCategory
                        });
                    });
            } else {
                return _insertIntoParent({ name: name });
            }
        });
}

function removeItemCategory(categoryId) {
    return Promise
        .resolve()
        .then(() => {
            return ItemCategory.findOne({ id: categoryId });
        })
        .then(itemCategory => {
            if (! itemCategory) {
                var error = new NotFoundError("ItemCategory not found");
                error.itemCategoryId = categoryId;
                throw error;
            }
            if (itemCategory.hasChildrenCategories()) {
                throw new ForbiddenError("ItemCategory cannot be removed: has children categories");
            }

            return ItemCategory
                .destroy({ id: itemCategory.id })
                .then(() => {
                    return _removeSpace(itemCategory.lft);
                });
        });
}
