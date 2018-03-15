/**
 * ApiKeyEvent.js
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
        userId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        apiKeyId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        url: {
            type: 'string',
            columnType: 'longtext CHARACTER SET utf8mb4',
            allowNull: true,
        },
    },

};

