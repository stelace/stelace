/**
* UserXTag.js
*
* @description :: Matchmaking between users searching listings and potentiel owners relies on this model
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
        userId: {
            type: 'number',
            columnType: 'int',
            required: true,
            // index: true,
        },
        tagId: {
            type: 'number',
            columnType: 'int',
            required: true,
            // index: true,
        },
    },

};

