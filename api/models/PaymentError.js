/* global Card, CurrencyService, IPService, PaymentError */

/**
 * PaymentError.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
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
        userId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        bookingId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        cardId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        cardNumber: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        message: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        code: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        amount: {
            type: 'number',
            columnType: 'float',
            allowNull: true,
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
        url: {
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
        data: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
    },

    createMangopayError,
    createStripeError,

};

const useragent = require('useragent');

/**
 * Create payment error
 * @param  {object} preauthorization
 * @param  {number} userId
 * @param  {number} bookingId
 * @param  {number} cardId
 * @param  {object} [req]
 * @return {object}
 */
async function createMangopayError({
    preauthorization,
    userId,
    bookingId,
    cardId,
    req,
}) {
    // if there is no preauthorization or it's not a failed one
    if (!preauthorization || preauthorization.Status !== 'FAILED') {
        return;
    }

    const createAttrs = {
        userId,
        bookingId,
        cardId,
    };
    const data = {
        preauthorization: preauthorization,
    };

    createAttrs.message = preauthorization.ResultMessage;
    createAttrs.code = preauthorization.ResultCode;
    createAttrs.amount = preauthorization.DebitedFunds && preauthorization.DebitedFunds.Amount / 100;

    if (req) {
        createAttrs.url = sails.config.stelace.url + req.url;
        createAttrs.refererUrl = req.headers.referer;

        const userAgent = req.headers['user-agent'];
        createAttrs.userAgent = userAgent;

        if (userAgent) {
            const parsedUserAgent = useragent.parse(userAgent);
            createAttrs.os = parsedUserAgent.os.toString();
            createAttrs.browser = parsedUserAgent.toString();
        }

        createAttrs.ip = req.ip;
        if (req.ip) {
            const ipInfo = await IPService.getInfo(req.ip);
            createAttrs.country = ipInfo.country;
            createAttrs.region = ipInfo.region;
        }
    }

    if (cardId) {
        const card = await Card.findOne({ id: cardId }).catch(() => null);
        if (card) {
            createAttrs.cardNumber = card.alias;
        }
    }

    createAttrs.data = data;

    return await PaymentError.create(createAttrs);
}

/**
 * Create payment error
 * @param  {object} preauthorization
 * @param  {number} userId
 * @param  {number} bookingId
 * @param  {number} cardId
 * @param  {object} [req]
 * @return {object}
 */
async function createStripeError({
    charge,
    userId,
    bookingId,
    req,
}) {
    // if there is no charge or it's not a failed one
    if (!charge || charge.status !== 'failed') {
        return;
    }

    const createAttrs = {
        userId,
        bookingId,
        cardNumber: charge.source && charge.source.last4,
    };
    const data = {
        charge,
    };

    createAttrs.message = charge.outcome.reaon;
    createAttrs.code = charge.outcome.type;
    createAttrs.amount = CurrencyService.getStandardAmount(charge.amount.charge.currency);

    if (req) {
        createAttrs.url = sails.config.stelace.url + req.url;
        createAttrs.refererUrl = req.headers.referer;

        const userAgent = req.headers['user-agent'];
        createAttrs.userAgent = userAgent;

        if (userAgent) {
            const parsedUserAgent = useragent.parse(userAgent);
            createAttrs.os = parsedUserAgent.os.toString();
            createAttrs.browser = parsedUserAgent.toString();
        }

        createAttrs.ip = req.ip;
        if (req.ip) {
            const ipInfo = await IPService.getInfo(req.ip);
            createAttrs.country = ipInfo.country;
            createAttrs.region = ipInfo.region;
        }
    }

    createAttrs.data = data;

    return await PaymentError.create(createAttrs);
}
