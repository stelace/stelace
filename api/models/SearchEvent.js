/**
* SearchEvent.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        type: "string",
        userId: "integer",
        tagsIds: "array",
        mode: "string",
        query: "string",
        page: "integer",
        limit: "integer",
        params: "json",
        os: "string",
        browser: "string",
        device: "string",
        userAgent: "string",
        completionDuration: "integer" // in milliseconds
    }

};
