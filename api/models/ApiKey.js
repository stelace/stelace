/**
 * ApiKey.js
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
        key: {
            type: 'string',
            unique: true,
            columnType: 'varchar(191) CHARACTER SET utf8mb4',
            maxLength: 191,
            required: true,
        },
        revokedDate: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
    },

    getAccessFields,
    generateKey,

};

const Uuid = require('uuid');

function getAccessFields(access) {
    var accessFields = {
        api: [
            'id',
            'key',
            'createdDate',
            'revokedDate',
        ],
    };

    return accessFields[access];
}

function generateKey() {
    return Uuid.v4();
}
