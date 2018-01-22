/**
* ListingXTag.js
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
        listingId: {
            type: 'number',
            columnType: 'int',
            // index: true,
            required: true,
        },
        tagId: {
            type: 'number',
            columnType: 'int',
            // index: true,
            required: true,
        },
    }

};

