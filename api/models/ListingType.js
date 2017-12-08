/**
 * ListingType.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
 */

module.exports = {

    attributes: {
        name: {
            type: 'string',
            unique: true,
            maxLength: 191,
            size: 191,
        },
        properties: {
            type: 'json',
            defaultsTo: {},
        },
        config: {
            type: 'json',
            defaultsTo: {},
        },
        active: {
            type: 'boolean',
            defaultsTo: true,
        },
    },

    getAccessFields,

};

function getAccessFields(access) {
    const accessFields = {
        api: [
            'id',
            'name',
            'properties',
            'config',
            'active',
            'createdDate',
            'updatedDate',
        ],
        self: [
            'id',
            'name',
            'properties',
            'config',
            'active',
            'createdDate',
            'updatedDate',
        ],
    };

    return accessFields[access];
}
