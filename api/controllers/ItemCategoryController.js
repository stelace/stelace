/* global Brand, ItemCategory, TokenService */

/**
 * ItemCategoryController
 *
 * @description :: Server-side logic for managing itemcategories
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
    var access = "others";

    return ItemCategory
        .find()
        .then(itemCategories => {
            res.json(ItemCategory.exposeAll(itemCategories, access));
        })
        .catch(res.sendError);
}

function findOne(req, res) {
    var id = req.param("id");
    var access = "others";

    return ItemCategory
        .findOne({ id: id })
        .then(itemCategory => {
            if (! itemCategory) {
                throw new NotFoundError();
            }

            res.json(ItemCategory.expose(itemCategory, access));
        })
        .catch(res.sendError);
}

function create(req, res) {
    var name     = req.param("name");
    var parentId = req.param("parentId");
    var access = "admin";

    if (! TokenService.isRole(req, "admin")) {
        return res.forbidden();
    }

    return Promise
        .resolve()
        .then(() => {
            return [
                ItemCategory.findOne({ name: name }),
                parentId ? ItemCategory.findOne({ id: parentId }) : null
            ];
        })
        .spread((itemCategory, parentCategory) => {
            if (! itemCategory) {
                throw new BadRequestError("category already exists");
            }
            if (parentId && ! parentCategory) {
                throw new BadRequestError("parent category not exist");
            }

            var createAttrs = {
                name: name,
                parentId: parentId
            };

            return ItemCategory.createItemCategory(createAttrs);
        })
        .then(itemCategory => {
            res.json(ItemCategory.expose(itemCategory, access));
        })
        .catch(res.sendError);
}

function update(req, res) {
    var id = req.param("id");
    var name = req.param("name");
    var access = "admin";

    if (! TokenService.isRole(req, "admin")) {
        return res.forbidden();
    }
    if (! name) {
        return res.badRequest();
    }

    var updateAttrs = {
        name: name
    };

    return ItemCategory
        .updateOne(id, updateAttrs)
        .then(itemCategory => {
            res.json(ItemCategory.expose(itemCategory, access));
        })
        .catch(res.sendError);
}

// !!! Before destroying item category, check if any brand is associated with it or its children
function destroy(req, res) {
    var id = req.param("id");

    if (! TokenService.isRole(req, "admin")) {
        return res.forbidden();
    }

    return Promise
        .resolve()
        .then(() => {
            return Brand.find();
        })
        .then(brands => {
            return removeItemCategoryFromBrands(id, brands);
        })
        .then(() => {
            return ItemCategory.removeItemCategory(id);
        })
        .then(() => res.json({ id: id }))
        .catch(res.sendError);



    function removeItemCategoryFromBrands(id, brands) {
        id = parseInt(id, 10);

        return Promise
            .resolve(brands)
            .each(brand => {
                if (! brand.itemCategories || ! _.contains(brand.itemCategories, id)) {
                    return;
                }

                return Brand.updateOne(brand.id, { itemCategories: _.without(brand.itemCategories, id) });
            });
    }
}

