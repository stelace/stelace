/**
* EmailTracking.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        mandrillMessageId: {
            type: "string",
            index: true,
            size: 191,
            maxLength: 191
        },
        sparkpostTransmissionId: {
            type: "string",
            index: true,
            size: 191,
            maxLength: 191
        },
        sparkpostMessageId: "string",
        sparkpostBatchId: {
            type: "string",
            index: true,
            size: 191,
            maxLength: 191
        },
        email: "string",
        eventType: "string",
        eventDate: "string",
        clickedUrl: "string",
        ip: "string",
        country: "string",
        region: "string",
        city: "string",
        userAgent: "string",
        mobile: "boolean",
        userAgentType: "string",
        os: "string",
        browser: "string",
        syncAction: "string",
        rejectReason: "string",
        rejectExpirationDate: "string",
        data: "json",
    },

    getMandrillSignature: getMandrillSignature

};

var CryptoJS = require('crypto-js');

function getMandrillSignature(webhookKey, url, bodyParams) {
    var signedData = url;
    var bodyParamsKeys = _(bodyParams).keys().sortBy().value();

    _.forEach(bodyParamsKeys, function (bodyParamKey) {
        signedData += bodyParamKey;
        signedData += bodyParams[bodyParamKey];
    });

    return CryptoJS.HmacSHA1(signedData, webhookKey).toString(CryptoJS.enc.Base64);
}

