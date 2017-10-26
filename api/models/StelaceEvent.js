/* global GeneratorService */

/**
* StelaceEvent.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        label: "string",
        sessionId: {
            type: "integer",
            index: true
        },
        userId: {
            type: "integer",
            index: true
        },
        targetUserId: {
            type: "integer",
            index: true
        },
        listingId: {
            type: "integer",
            index: true
        },
        tagsIds: "array",
        bookingId: {
            type: "integer",
            index: true
        },
        searchId: "integer",
        loginAsUserId: { // not empty when admin logs as
            type: "integer",
            index: true
        },
        fromExternal: {
            type: "boolean",
            defaultsTo: false
        },
        type: "string", // "click" or "view" for i.e.
        refererUrl: "string",
        srcUrl: "string",
        targetUrl: "string",
        ip: "string",
        lang: "string",
        country: "string",
        region: "string",
        city: "string",
        userAgent: "string",
        os: "string",
        browser: "string",
        device: "string",
        utmCampaign: "string",
        utmSource: "string",
        utmContent: "string",
        utmMedium: "string",
        utmTerm: "string",
        token: "string",
        scrollPercent: "integer",
        data: "json",
        resetUser: "boolean",
        version: "string"
    },

    postBeforeCreate: postBeforeCreate

};

function postBeforeCreate(values) {
    return Promise.coroutine(function* () {
        values.token = yield GeneratorService.getRandomString(10);
    })();
}
