/**
* Cancellation.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        listingId: {
            type: "integer",
            index: true
        },
        reasonType: "string",
        reason: {
            type: "text",
            maxLength: 1000
        },
        ownerId: {
            type: "integer",
            index: true
        },
        takerId: {
            type: "integer",
            index: true
        },
        trigger: "string",
        refundDate: "string"
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

