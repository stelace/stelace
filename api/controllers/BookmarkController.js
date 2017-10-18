/* global Bookmark, Item, TimeService */

/**
 * BookmarkController
 *
 * @description :: Server-side logic for managing bookmarks
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

module.exports = {

    find: find,
    findOne: findOne,
    create: create,
    update: update,
    destroy: destroy,

    destroyLink: destroyLink,
    my: my

};

function find(req, res) {
    return res.forbidden();
}

function findOne(req, res) {
    return res.forbidden();
}

function create(req, res) {
    var filteredAttrs = [
        "itemId",
        "type",
        "wishDate",
        "reference"
    ];
    var attrs = _.pick(req.allParams(), filteredAttrs);
    var access = "self";

    if (! attrs.itemId
        || ! _.contains(Bookmark.get("types"), attrs.type)
        || (attrs.wishDate && ! TimeService.isDateString(attrs.wishDate, { onlyDate: true }))
        || (attrs.reference && typeof attrs.reference !== "object")
    ) {
        return res.badRequest();
    }

    return Promise
        .resolve()
        .then(() => {
            return Item.findOne({ id: attrs.itemId });
        })
        .then(item => {
            if (! item) {
                throw new NotFoundError;
            }
            if (item.ownerId === req.user.id) {
                throw new ForbiddenError("owner can't bookmark own items");
            }

            return Bookmark.findOne({
                itemId: item.id,
                userId: req.user.id
            });
        })
        .then(bookmark => {
            if (bookmark) {
                attrs.active = true;
                return Bookmark.updateOne(bookmark.id, attrs);
            } else {
                attrs.userId = req.user.id;
                return Bookmark.create(attrs);
            }
        })
        .then(bookmark => {
            res.json(Bookmark.expose(bookmark, access));
        })
        .catch(res.sendError);
}

function update(req, res) {
    return res.forbidden();
}

function destroy(req, res) {
    var id = req.param("id");
    var token = req.param("token");

    // authentication isn't needed
    // deactivate bookmark by matching id and token

    return Bookmark
        .update(
            {
                id: id,
                token: token
            },
            { active: false }
        )
        .then(() => res.ok({ id: id }))
        .catch(res.sendError);
}

function destroyLink(req, res) {
    var id = req.param("id");
    var token = req.param("t");

    // authentication isn't needed
    // deactivate bookmark by matching id and token

    return Promise
        .resolve()
        .then(() => {
            return Bookmark
                .update(
                    {
                        id: id,
                        token: token
                    },
                    { active: false }
                );
        })
        .then(bookmarks => {
            if (! bookmarks.length) {
                res.redirect("/?destroy-bookmark=success");
            } else {
                return Item
                    .findOne({ id: bookmarks[0].itemId })
                    .then(item => {
                        if (! item) {
                            res.redirect("/?destroy-bookmark=success");
                        } else {
                            var redirectURL = sails.config.stelace.url + "/item/" + item.nameURLSafe + "-" + item.id + "?destroy-bookmark=success";
                            res.redirect(redirectURL);
                        }
                    });
            }
        })
        .catch(() => {
            res.redirect("/?destroy-bookmark=fail");
        });
}

function my(req, res) {
    var access = "self";

    return Bookmark
        .find({
            userId: req.user.id,
            active: true
        })
        .then(bookmarks => {
            res.json(Bookmark.exposeAll(bookmarks, access));
        })
        .catch(res.sendError);
}
