/**
* Cancellation.js
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
            allowNull: true,
            // index: true,
        },
        reasonType: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        reason: {
            type: 'string',
            columnType: 'longtext CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 1000,
        },
        ownerId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
            // index: true,
        },
        takerId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
            // index: true,
        },
        trigger: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
            // index: true,
        },
        refundDate: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        data: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
    },

    getAccessFields: getAccessFields,
    get: get

};

var params = {
    triggers: ["admin", "owner", "taker"],
    reasonTypes: [
        // only set by admin
        "user-removed",
        "listing-removed",
        "booking-cancelled",

        // automatically cancelled reason types
        "no-action",
        "no-validation",
        "no-payment",
        "out-of-stock",

        "rejected",
        "taker-cancellation",

        "assessment-missed",
        "assessment-refused",

        "other"
    ],
    cancelPaymentReasonTypes: [
        "user-removed",
        "listing-removed",
        "booking-cancelled",
        "no-action",
        "no-validation",
        "no-payment",
        "out-of-stock",
        "rejected"
    ]
};

function getAccessFields(access) {
    const accessFields = {
        api: [
            'id',
            'listingId',
            'reasonType',
            'reason',
            'createdDate',
            'ownerId',
            'takerId',
            'trigger'
        ],
        self: [ // req.user.id in (ownerId || taker)
            'id',
            'listingId',
            'reasonType',
            'reason',
            'createdDate',
            'ownerId',
            'takerId',
            'trigger'
        ],
        others: [
            'id',
            'listingId',
            'createdDate'
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

