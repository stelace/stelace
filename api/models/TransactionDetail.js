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
            allowNull: true,
        },
        debit: {
            type: 'number',
            columnType: 'float',
            allowNull: true,
        },
        payment: {
            type: 'number',
            columnType: 'float',
            allowNull: true,
        },
        cashing: {
            type: 'number',
            columnType: 'float',
            allowNull: true,
        },
        label: {
            type: 'string',
            columnType: 'varchar(255)',
            required: true,
            maxLength: 255,
        },
    }

};

