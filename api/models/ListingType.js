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

};
