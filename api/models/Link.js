/**
* Link.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        fromUserId: {
            type: "integer",
            index: true
        },
        relationship: "string",
        toUserId: {
            type: "integer",
            index: true
        },
        validated: {
            type: "boolean",
            defaultsTo: false
        },
        email: {
            type: "string",
            index: true,
            size: 191,
            maxLength: 191
        },
        source: "string"
    },

    get: get

};

var params = {
    relationships: [
        "refer"
    ],
    sources: [
        "facebook",
        "twitter",
        "email"
    ]
};

function get(prop) {
    if (prop) {
        return params[prop];
    } else {
        return params;
    }
}
