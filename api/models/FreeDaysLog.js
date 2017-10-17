/**
* FreeDaysLog.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        total: {
            type: "integer",
            required: true
        },
        delta: {
            type: "integer",
            required: true
        },
        userId: {
            type: "integer",
            index: true,
            required: true
        },
        targetType: "string",
        targetId: "integer",
        reasonType: "string"
    },

    getAccessFields: getAccessFields

};

function getAccessFields(access) {
    var accessFields = {
        self: [
            "id",
            "total",
            "delta",
            "targetType",
            "targetId",
            "reasonType",
            "createdDate"
        ]
    };

    return accessFields[access];
}
