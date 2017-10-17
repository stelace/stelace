/* global Brand, ItemCategory, TokenService */

/**
 * BrandController
 *
 * @description :: Server-side logic for managing brands
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

module.exports = {

    find: find,
    findOne: findOne,
    create: create,
    update: update,
    destroy: destroy

};

function find(req, res) {
    var itemCategoryId = req.param("itemCategoryId");
    var access = "others";

    return Promise
        .resolve()
        .then(() => {
            return findBrand(itemCategoryId);
        })
        .then(brands => {
            res.json(Brand.exposeAll(brands, access));
        })
        .catch(res.sendError);



    function findBrand(itemCategoryId) {
        if (! itemCategoryId) {
            return Brand
                .find()
                .sort({ name: 1 });
        } else {
            return Promise
                .resolve()
                .then(() => {
                    return [
                        ItemCategory.getParentCategories(itemCategoryId, true),
                        Brand.find()
                    ];
                })
                .spread((itemParentCategories, brands) => {
                    var itemParentCategoryIds = _.pluck(itemParentCategories, "id");

                    var matchBrands = _(brands)
                        .filter(brand => {
                            return ! brand.itemCategories
                                || ! _.intersection(brand.itemCategories, itemParentCategoryIds).length;
                        })
                        .sortBy(brand => brand.name)
                        .value();

                    return matchBrands;
                });
        }
    }
}

function findOne(req, res) {
    var id = req.param("id");
    var access = "others";

    return Promise
        .resolve()
        .then(() => {
            return Brand.findOne({ id: id });
        })
        .then(brand => {
            if (! brand) {
                throw new NotFoundError();
            }

            res.json(Brand.expose(brand, access));
        })
        .catch(res.sendError);
}

function create(req, res) {
    var name           = req.param("name");
    var itemCategoryId = req.param("itemCategoryId");
    var access = "others";
    var createAttrs = {
        name: name,
        itemCategories: null
    };

    return Promise
        .resolve()
        .then(() => {
            return [
                itemCategoryId ? ItemCategory.findOne({ id: itemCategoryId }) : null,
                Brand.findOne({ name: name })
            ];
        })
        .spread((itemCategory, brand) => {
            if (brand) {
                throw new BadRequestError("existing brand");
            }
            if (itemCategoryId && ! itemCategory) {
                throw new BadRequestError("item category doesn't exist");
            }

            if (itemCategoryId) {
                createAttrs.itemCategories = [itemCategoryId];
            }

            return Brand.create(createAttrs);
        })
        .then(brand => {
            res.json(Brand.expose(brand, access));
        })
        .catch(res.sendError);
}

function update(req, res) {
    var id = req.param("id");
    var access = "others";
    var filteredAttrs = [
        "name",
        "itemCategories"
    ];
    var updateAttrs = _.pick(req.allParams(), filteredAttrs);

    if (! TokenService.isRole(req, "admin")) {
        return res.forbidden();
    }
    if (! µ.checkArray(updateAttrs.itemCategories, "id")) {
        return res.badRequest();
    }

    return Promise
        .resolve()
        .then(() => {
            return ItemCategory.find({ id: updateAttrs.itemCategories });
        })
        .then(itemCategories => {
            if (itemCategories.length !== updateAttrs.itemCategories.length) {
                throw new BadRequestError("item categories don't all exist");
            }

            return Brand.updateOne(id, updateAttrs);
        })
        .then(brand => {
            res.json(Brand.expose(brand, access));
        })
        .catch(res.sendError);
}

function destroy(req, res) {
    return res.forbidden();
}

