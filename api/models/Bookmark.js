/* global Bookmark, GeneratorService */

/**
* Bookmark.js
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
        listingId: {
            type: 'number',
            columnType: 'int',
            // index: true,
            required: true,
        },
        userId: {
            type: 'number',
            columnType: 'int',
            // index: true,
            required: true,
        },
        type: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        active: {
            type: 'boolean',
            columnType: 'tinyint(1)',
            defaultsTo: true,
        },
        token: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        wishDate: { // start date of the future wished booking
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        lastBookingId: { // last booking id when send push email
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        lastSentDate: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        count: {
            type: 'number',
            columnType: 'int',
            defaultsTo: 0,
        },
        reference: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
    },

    getAccessFields,
    get,
    beforeCreate,
    isBookmarked,

};

var params = {
    types: ["push"]    // add 'list' later
};

function getAccessFields(access) {
    var accessFields = {
        self: [
            "id",
            "listingId",
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

async function beforeCreate(values, next) {
    try {
        Bookmark.beforeCreateDates(values);
        values.token = await GeneratorService.getRandomString(20);

        next();
    } catch (err) {
        next(err);
    }
}

async function isBookmarked(listingId, userId) {
    const [bookmark] = await Bookmark
        .find({
            listingId,
            userId,
            active: true,
        })
        .limit(1);

    return !!bookmark;
}
