/**
* Brand.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        name: {
            type: "string",
            maxLength: 191,
            required: true,
            size: 191,
            unique: true
        },
        listingCategories: "array"
    },

    getAccessFields: getAccessFields

};

function getAccessFields(access) {
    var accessFields = {
        others: [
            "id",
            "name"
        ]
    };

    return accessFields[access];
}
