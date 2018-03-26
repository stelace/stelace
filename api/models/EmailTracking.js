/**
* EmailTracking.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        id: {
            type: 'number',
            columnType: 'int',
            autoIncrement: true,
        },
        createdDate: {
            type: 'string',
            columnType: 'varchar(255)',
            maxLength: 255,
        },
        updatedDate: {
            type: 'string',
            columnType: 'varchar(255)',
            maxLength: 255,
        },
        mandrillMessageId: {
            type: 'string',
            columnType: 'varchar(191)',
            // index: true,
            maxLength: 191,
            allowNull: true,
        },
        sparkpostTransmissionId: {
            type: 'string',
            columnType: 'varchar(191)',
            // index: true,
            maxLength: 191,
            allowNull: true,
        },
        sparkpostMessageId: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        sparkpostBatchId: {
            type: 'string',
            columnType: 'varchar(191)',
            // index: true,
            maxLength: 191,
            allowNull: true,
        },
        email: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        eventType: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        eventDate: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        clickedUrl: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        ip: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        country: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        region: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        userAgent: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        mobile: {
            type: 'boolean',
            columnType: 'tinyint(1)',
            allowNull: true,
        },
        userAgentType: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        os: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        browser: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        syncAction: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        rejectReason: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        rejectExpirationDate: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        data: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
    },

    getMandrillSignature: getMandrillSignature

};

var CryptoJS = require('crypto-js');
const _ = require('lodash');

function getMandrillSignature(webhookKey, url, bodyParams) {
    var signedData = url;
    var bodyParamsKeys = _(bodyParams).keys().sortBy().value();

    _.forEach(bodyParamsKeys, function (bodyParamKey) {
        signedData += bodyParamKey;
        signedData += bodyParams[bodyParamKey];
    });

    return CryptoJS.HmacSHA1(signedData, webhookKey).toString(CryptoJS.enc.Base64);
}

