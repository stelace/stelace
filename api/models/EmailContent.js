/**
 * EmailContent.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
 */

module.exports = {

    attributes: {
        mandrillMessageId: {
            type: "string",
            index: true,
            size: 191,
            maxLength: 191
        },
        info: {
            type: "json"
        },
        content: {
            type: "json"
        }
    }

};

