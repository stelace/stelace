/**
 * ListingAvailability.js
 *
 * @description :: A model definition.  Represents a database table/collection/etc.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
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
            required: true,
            // index: true,
        },
        startDate: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        endDate: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        quantity: {
            type: 'number',
            columnType: 'int',
            defaultsTo: 1,
        },
        available: {
            type: 'boolean',
            columnType: 'tinyint(1)',
            allowNull: true,
        },
        type: { // 'period' or 'date'
            type: 'string',
            columnType: 'varchar(255)',
            maxLength: 255,
            required: true,
        },
        data: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
    },

    getAccessFields,
    isValidType,

};

const _ = require('lodash');

function getAccessFields(access) {
    var accessFields = {
        others: [
            'id',
            'listingId',
            'startDate',
            'endDate',
            'quantity',
            'available',
        ],
    };

    return accessFields[access];
}

function isValidType(type) {
    return _.includes(['period', 'date'], type);
}
