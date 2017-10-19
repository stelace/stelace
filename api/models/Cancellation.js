/**
* Cancellation.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        itemId: {
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
    triggers: ["owner", "taker"],
    reasonTypes: [
        // automatically cancelled reason types
        "no-action",
        "no-validation",
        "no-payment",
        "out-of-stock",

        "rejected",
        "booker-cancellation",

        "assessment-missed",
        "assessment-refused",

        "other"
    ],
    cancelPaymentReasonTypes: [
        "no-action",
        "no-validation",
        "no-payment",
        "out-of-stock",
        "rejected"
    ]
};

function getAccessFields(access) {
    var accessFields = {
        self: [ // req.user.id in (ownerId || taker)
            "id",
            "itemId",
            "reasonType",
            "reason",
            "createdDate",
            "ownerId",
            "takerId",
            "trigger"
        ],
        others: [
            "id",
            "itemId",
            "createdDate"
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

