/**
* Link.js
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
        fromUserId: {
            type: 'number',
            columnType: 'int',
            // index: true,
            required: true,
        },
        relationship: {
            type: 'string',
            columnType: 'varchar(255)',
            required: true,
            maxLength: 255,
        },
        toUserId: {
            type: 'number',
            columnType: 'int',
            // index: true,
            required: true,
        },
        validated: {
            type: 'boolean',
            columnType: 'tinyint(1)',
            defaultsTo: false,
        },
        email: {
            type: 'string',
            columnType: 'varchar(191) CHARACTER SET utf8mb4',
            // index: true,
            maxLength: 191,
            allowNull: true,
        },
        source: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
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
