/**
* GamificationEvent.js
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
        },
        updatedDate: {
            type: 'string',
            columnType: 'varchar(255)',
        },
        userId: {
            type: 'number',
            columnType: 'int',
            required: true,
            // index: true,
        },
        sessionId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
            // index: true,
        },
        type: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        levelId: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        badgeId: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        actionId: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        points: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        reference: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
        data: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
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
