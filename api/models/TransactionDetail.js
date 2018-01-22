/**
* TransactionDetail.js
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
        transactionId: {
            type: 'number',
            columnType: 'int',
            // index: true,
        },
        credit: {
            type: 'number',
            columnType: 'float',
            defaultsTo: 0,
        },
        debit: {
            type: 'number',
            columnType: 'float',
            defaultsTo: 0,
        },
        payment: {
            type: 'number',
            columnType: 'float',
            defaultsTo: 0,
        },
        cashing: {
            type: 'number',
            columnType: 'float',
            defaultsTo: 0,
        },
        label: {
            type: 'string',
            columnType: 'varchar(255)',
            required: true,
            maxLength: 255,
        },
    }

};

