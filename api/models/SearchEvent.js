/**
* SearchEvent.js
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
        type: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        userId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        tagsIds: {
            type: 'json',
            columnType: 'json',
            defaultsTo: [],
        },
        listingTypesIds: {
            type: 'json',
            columnType: 'json',
        },
        query: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        page: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        limit: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        params: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
        os: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        browser: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        device: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        userAgent: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        completionDuration: { // in milliseconds
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
    },

    getAccessFields,

};

function getAccessFields(access) {
    const accessFields = {
        self: [
            'id',
            'type',
            'userId',
            'tagsIds',
            'listingTypesIds',
            'query',
            'page',
            'limit',
            'params',
            'createdDate',
        ],
    };

    return accessFields[access];
}
