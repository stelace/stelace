/**
* Token.js
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
        value: {
            type: 'string',
            columnType: 'varchar(191)',
            required: true,
            maxLength: 191,
            // index: true,
        },
        userId: {
            type: 'number',
            columnType: 'int',
            // index: true,
            allowNull: true,
        },
        targetType: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        targetId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        reference: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
        expirationDate: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        usedDate: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
    }

};

