/**
 * Webhook.js
 *
 * @description :: A model definition.  Represents a database table/collection/etc.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

module.exports = {

    attributes: {
        apiKeyId: 'integer',
        url: 'string',
    },

    getAccessFields,

};

function getAccessFields(access) {
    const accessFields = {
        api: [
            'id',
            'url',
            'createdDate',
        ],
    };

    return accessFields[access];
}
