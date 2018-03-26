/* global GeneratorService, StelaceSession */

/**
* StelaceSession.js
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
        lastEventDate: {
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
        userId: {
            type: 'number',
            columnType: 'int',
            // index: true,
            allowNull: true,
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
        startUtmCampaign: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        startUtmSource: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        startUtmContent: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        startUtmMedium: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        startUtmTerm: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        endUtmCampaign: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        endUtmSource: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        endUtmContent: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        endUtmMedium: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        endUtmTerm: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        width: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        height: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        token: {
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

    beforeCreate,

};

async function beforeCreate(values, next) {
    try {
        StelaceSession.beforeCreateDates(values);
        values.token = await GeneratorService.getRandomString(10);

        next();
    } catch (err) {
        next(err);
    }
}
