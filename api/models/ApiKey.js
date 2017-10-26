/**
 * ApiKey.js
 *
 * @description :: A model definition.  Represents a database table/collection/etc.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

module.exports = {

    attributes: {
        key: {
            type: 'string',
            unique: true,
            size: 191,
            maxLength: 191,
            required: true,
        },
    },

};

