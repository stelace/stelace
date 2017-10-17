/* global Bookmark, GeneratorService */

/**
* Bookmark.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        itemId: {
            type: "integer",
            index: true,
            required: true
        },
        userId: {
            type: "integer",
            index: true,
            required: true
        },
        type: "string",
        active: {
            type: "boolean",
            defaultsTo: true
        },
        token: "string",
        wishDate: "string", // start date of the future wished booking
        lastBookingId: "integer", // last booking id when send push email
        lastSentDate: "string",
        count: {
            type: "integer",
            defaultsTo: 0
        },
        reference: "json"
    },

    getAccessFields: getAccessFields,
    get: get,
    postBeforeCreate: postBeforeCreate,
    isBookmarked: isBookmarked

};

var params = {
    types: ["push"]    // add 'list' later
};

function getAccessFields(access) {
    var accessFields = {
        self: [
            "id",
            "itemId",
            "userId",
            "type",
            "active",
            "token",
            "wishDate"
        ]
    };

    return accessFields[access];
}

function get(prop) {
    if (prop) {
        return params[prop];
    } else {
        return params;
    }
}

function postBeforeCreate(values) {
    return Promise.coroutine(function* () {
        values.token = yield GeneratorService.getRandomString(20);
    })();
}

function isBookmarked(itemId, userId) {
    return Promise
        .resolve()
        .then(() => {
            return Bookmark
                .findOne({
                    itemId: itemId,
                    userId: userId,
                    active: true
                });
        })
        .then(bookmark => !! bookmark);
}
