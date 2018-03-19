/**
 * ListingType.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
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
        name: {
            type: 'string',
            columnType: 'varchar(191) CHARACTER SET utf8mb4',
            allowNull: true,
            unique: true,
            maxLength: 191,
        },
        namesI18n: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
        properties: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
        config: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
        customFields: {
            type: 'json',
            columnType: 'json',
            defaultsTo: [],
        },
        active: {
            type: 'boolean',
            columnType: 'tinyint(1)',
            defaultsTo: true,
        },
    },

    getAccessFields,
    getI18nMap,

};

function getAccessFields(access) {
    const accessFields = {
        api: [
            'id',
            'name',
            'properties',
            'config',
            'customFields',
            'active',
            'createdDate',
            'updatedDate',
        ],
        self: [
            'id',
            'name',
            'properties',
            'config',
            'customFields',
            'active',
            'createdDate',
            'updatedDate',
        ],
        others: [
            'id',
            'name',
            'properties',
            'config',
            'customFields',
            'active',
            'createdDate',
            'updatedDate',
        ],
    };

    return accessFields[access];
}

function getI18nMap() {
    return {
        name: 'namesI18n',
    };
}
