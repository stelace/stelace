/* global GeneratorService, StelaceEvent */

/**
* StelaceEvent.js
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
        label: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        sessionId: {
            type: 'number',
            columnType: 'int',
            // index: true,
            allowNull: true,
        },
        userId: {
            type: 'number',
            columnType: 'int',
            // index: true,
            allowNull: true,
        },
        targetUserId: {
            type: 'number',
            columnType: 'int',
            // index: true,
            allowNull: true,
        },
        listingId: {
            type: 'number',
            columnType: 'int',
            // index: true,
            allowNull: true,
        },
        tagsIds: {
            type: 'json',
            columnType: 'json',
            defaultsTo: [],
        },
        bookingId: {
            type: 'number',
            columnType: 'int',
            // index: true,
            allowNull: true,
        },
        searchId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        loginAsUserId: { // not empty when admin logs as
            type: 'number',
            columnType: 'int',
            // index: true,
            allowNull: true,
        },
        fromExternal: {
            type: 'boolean',
            columnType: 'tinyint(1)',
            defaultsTo: false,
        },
        type: { // "click" or "view" for i.e.
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        refererUrl: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        srcUrl: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        targetUrl: {
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
        lang: {
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
        city: {
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
        device: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        utmCampaign: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        utmSource: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        utmContent: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        utmMedium: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        utmTerm: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        token: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        scrollPercent: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        data: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
        resetUser: {
            type: 'boolean',
            columnType: 'tinyint(1)',
            allowNull: true,
        },
        version: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
    },

    getAccessFields,
    beforeCreate,

};

function getAccessFields(access) {
    const accessFields = {
        api: [
            'id',
            'label',
            'userId',
            'targetUserId',
            'listingId',
            'tagsIds',
            'bookingId',
            'type',
            'refererUrl',
            'srcUrl',
            'targetUrl',
            'country',
            'region',
            'city',
            'userAgent',
            'os',
            'browser',
            'data',
            'createdDate',
        ],
    };

    return accessFields[access];
}

async function beforeCreate(values, next) {
    try {
        StelaceEvent.beforeCreateDates(values);
        values.token = await GeneratorService.getRandomString(10);

        next();
    } catch (err) {
        next(err);
    }
}
