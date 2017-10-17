/**
* Token.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        type: "string",
        value: {
            type: "string",
            index: true,
            size: 191,
            maxLength: 191
        },
        userId: {
            type: "integer",
            index: true
        },
        targetType: "string",
        targetId: "integer",
        reference: "json",
        expirationDate: "string",
        usedDate: "string"
    }

};

