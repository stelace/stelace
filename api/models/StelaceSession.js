/* global GeneratorService */

/**
* StelaceSession.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        lastEventDate: "string",
        refererUrl: "string",
        userId: {
            type: "integer",
            index: true
        },
        ip: "string",
        lang: "string",
        country: "string",
        region: "string",
        city: "string",
        userAgent: "string",
        os: "string",
        browser: "string",
        device: "string",
        startUtmCampaign: "string",
        startUtmSource: "string",
        startUtmContent: "string",
        startUtmMedium: "string",
        startUtmTerm: "string",
        endUtmCampaign: "string",
        endUtmSource: "string",
        endUtmContent: "string",
        endUtmMedium: "string",
        endUtmTerm: "string",
        width: "integer",
        height: "integer",
        token: "string"
    },

    postBeforeCreate: postBeforeCreate

};

const Promise = require('bluebird');

function postBeforeCreate(values) {
    return Promise.coroutine(function* () {
        values.token = yield GeneratorService.getRandomString(10);
    })();
}
