/**
 * Webhook.js
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
        name: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            required: true,
            maxLength: 255,
        },
        url: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            required: true,
            maxLength: 255,
        },
        events: {
            type: 'json',
            columnType: 'json',
        },
    },

    getAccessFields,

};

function getAccessFields(access) {
    const accessFields = {
        api: [
            'id',
            'name',
            'url',
            'events',
            'createdDate',
        ],
    };

    return accessFields[access];
}
