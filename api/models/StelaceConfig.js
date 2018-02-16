/**
 * StelaceConfig.js
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
        config: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
        features: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
        secretData: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
    },

};

