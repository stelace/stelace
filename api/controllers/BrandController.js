/* global Brand, ListingCategory, MicroService, TokenService */

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

const _ = require('lodash');
const Promise = require('bluebird');

function find(req, res) {
    var listingCategoryId = req.param("listingCategoryId");
    var access = "others";

    return Promise
        .resolve()
        .then(() => {
            return findBrand(listingCategoryId);
        })
        .then(brands => {
            res.json(Brand.exposeAll(brands, access));
        })
        .catch(res.sendError);



    function findBrand(listingCategoryId) {
        if (! listingCategoryId) {
            return Brand
                .find()
                .sort('name ASC');
        } else {
            return Promise
                .resolve()
                .then(() => {
                    return [
                        ListingCategory.getParentCategories(listingCategoryId, true),
                        Brand.find()
                    ];
                })
                .spread((listingParentCategories, brands) => {
                    var listingParentCategoryIds = _.pluck(listingParentCategories, "id");

                    var matchBrands = _(brands)
                        .filter(brand => {
                            return ! brand.listingCategories
                                || ! _.intersection(brand.listingCategories, listingParentCategoryIds).length;
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
    var listingCategoryId = req.param("listingCategoryId");
    var access = "others";
    var createAttrs = {
        name: name,
        listingCategories: null
    };

    return Promise
        .resolve()
        .then(() => {
            return [
                listingCategoryId ? ListingCategory.findOne({ id: listingCategoryId }) : null,
                Brand.findOne({ name: name })
            ];
        })
        .spread((listingCategory, brand) => {
            if (brand) {
                throw new BadRequestError("existing brand");
            }
            if (listingCategoryId && ! listingCategory) {
                throw new BadRequestError("listing category doesn't exist");
            }

            if (listingCategoryId) {
                createAttrs.listingCategories = [listingCategoryId];
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
        "listingCategories"
    ];
    var updateAttrs = _.pick(req.allParams(), filteredAttrs);

    if (! TokenService.isRole(req, "admin")) {
        return res.forbidden();
    }
    if (! MicroService.checkArray(updateAttrs.listingCategories, "id")) {
        return res.badRequest();
    }

    return Promise
        .resolve()
        .then(() => {
            return ListingCategory.find({ id: updateAttrs.listingCategories });
        })
        .then(listingCategories => {
            if (listingCategories.length !== updateAttrs.listingCategories.length) {
                throw new BadRequestError("listing categories don't all exist");
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

