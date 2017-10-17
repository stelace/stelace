/* global Card, IPService, PaymentError */

/**
 * PaymentError.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
 */

module.exports = {

    attributes: {
        userId: 'integer',
        bookingId: 'integer',
        cardId: 'integer',
        cardNumber: 'string',
        message: 'string',
        code: 'string',
        amount: 'float',
        ip: 'string',
        country: 'string',
        region: 'string',
        city: 'string',
        userAgent: 'string',
        os: 'string',
        browser: 'string',
        device: 'string',
        url: 'string',
        refererUrl: 'string',
        data: 'json',
    },

    createError,

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
async function createError({
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
            createAttrs.device = parsedUserAgent.device.toString();
        }

        createAttrs.ip = req.ip;
        if (req.ip) {
            const ipInfo = await IPService.getInfo(req.ip);
            createAttrs.country = ipInfo.country;
            createAttrs.region = ipInfo.region;
            createAttrs.city = ipInfo.city;
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
