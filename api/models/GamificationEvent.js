/**
* GamificationEvent.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        userId: {
            type: "integer",
            index: true
        },
        sessionId: {
            type: "integer",
            index: true
        },
        type: "string",
        levelId: "string",
        badgeId: "string",
        actionId: "string",
        points: "integer",
        reference: "json"
    },

    get: get,
    getAccessFields: getAccessFields

};

var params = {
    types: ["action", "badge", "level"]
};

function getAccessFields(access) {
    var accessFields = {
        self: [
            "id",
            "levelId",
            "badgeId",
            "actionId",
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
