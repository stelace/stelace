/**
 * ListingAvailability.js
 *
 * @description :: A model definition.  Represents a database table/collection/etc.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

module.exports = {

    attributes: {
        listingId: {
            type: 'integer',
            index: true,
        },
        startDate: 'string',
        endDate: 'string',
        quantity: {
            type: 'integer',
            default: 1,
        },
        available: 'boolean',
    },

};

