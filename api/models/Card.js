/* global Card, PaymentMangopayService, StelaceConfigService, TimeService, User */

/**
* Card.js
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
        paymentProvider: { // 'stripe' or 'mangopay'
            type: 'string',
            columnType: 'varchar(255)',
            required: true,
            maxLength: 255,
        },
        resourceOwnerId: {
            type: 'string',
            columnType: 'varchar(191)',
            required: true,
            maxLength: 191,
            // index: true,
        },
        resourceId: {
            type: 'string',
            columnType: 'varchar(191)',
            required: true,
            maxLength: 191,
            // index: true,
        },
        userId: {
            type: 'number',
            columnType: 'int',
            required: true,
            // index: true,
        },
        expirationMonth: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        expirationYear: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        currency: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        provider: { // "CB" || "VISA" || "MASTERCARD" ...
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        type: { // "CB_VISA_MASTERCARD"
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        alias: { // card number with missing characters (ex: "356999XXXXXX0165")
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
        active: {
            type: 'boolean',
            columnType: 'tinyint(1)',
            allowNull: true,
        },
        validity: { // "UNKNOWN" || "VALID" || "INVALID"
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        forget: { // if true, do not use again this card
            type: 'boolean',
            columnType: 'tinyint(1)',
            defaultsTo: false,
        },
        data: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
        fingerprint: {
            type: 'string',
            columnType: 'varchar(255)',
            maxLength: 255,
            allowNull: true,
        },
    },

    getAccessFields,
    synchronize,
    disable,
    isInvalid,
    hasUnknownStatus,
    fetchCards,
    isExpiredAt,
    parseMangopayExpirationDate,
    parseMangopayData,
    parseStripeData,

};

var moment = require('moment');

function getAccessFields(access) {
    var accessFields = {
        self: [
            "id",
            "userId",
            "expirationMonth",
            "expirationYear",
            "currency",
            "provider",
            "type",
            "alias",
            "active",
            "validity"
        ]
    };

    return accessFields[access];
}

async function synchronize(card) {
    if (card.paymentProvider === 'mangopay') {
        const updatedCard = await PaymentMangopayService.refreshCard(card);
        return updatedCard;
    }
}

async function disable(card) {
    if (card.paymentProvider === 'mangopay') {
        const updatedCard = await PaymentMangopayService.deactivateCard(card);
        return updatedCard;
    }
}

function isInvalid(card) {
    if (card.paymentProvider === 'mangopay') {
        return card.validity === 'INVALID';
    }

    return false;
}

function hasUnknownStatus(card) {
    if (card.paymentProvider === 'mangopay') {
        return card.validity === 'UNKNOWN';
    }

    return false;
}

async function fetchCards(user) {
    const config = await StelaceConfigService.getConfig();
    const paymentProvider = config.payment_provider;

    let resourceOwnerId;
    if (paymentProvider === 'mangopay') {
        resourceOwnerId = User.getMangopayUserId(user);
    } else if (paymentProvider === 'stripe') {
        resourceOwnerId = User.getStripeCustomerId(user);
    }

    if (!resourceOwnerId) {
        return [];
    }

    let findAttrs = {
        resourceOwnerId,
        forget: false,
        active: true,
    };

    const oneHourAgo = moment().subtract(1, 'h').toISOString();

    if (paymentProvider === 'mangopay') {
        findAttrs = Object.assign(findAttrs, {
            paymentProvider: 'mangopay',
            or: [
                { validity: 'VALID' },
                {
                    validity: 'UNKNOWN',
                    createdDate: { '>': oneHourAgo },
                },
            ],
        });
    } else { // paymentProvider === 'stripe'
        findAttrs = Object.assign(findAttrs, {
            paymentProvider: 'stripe',
        });
    }

    const cards = await Card.find(findAttrs);
    return cards;
}

function isExpiredAt(card, expiredDate) {
    if (! TimeService.isDateString(expiredDate, { onlyDate: true })) {
        throw new Error('Bad value');
    }

    const expirationYear = card.expirationYear;
    const expirationMonth = card.expirationMonth;

    expiredDate = moment(expiredDate);
    const expiredYear  = expiredDate.year();
    const expiredMonth = expiredDate.month() + 1;

    return (expirationYear < expiredYear || (expirationYear === expiredYear && expirationMonth < expiredMonth));
}

function parseMangopayExpirationDate(value) {
    const result = {
        expirationMonth: null,
        expirationYear: null,
    };

    if (typeof value !== 'string'
     || !/^\d{4}$/.test(value)
    ) {
        return result;
    }

    result.expirationMonth = parseInt(value.substr(0, 2), 10);
    result.expirationYear = parseInt('20' + value.substr(2, 4), 10);

    return result;
}

// https://docs.mangopay.com/endpoints/v2.01/cards
function parseMangopayData(rawJson) {
    let expirationDate = {};
    if (rawJson.ExpirationDate) {
        expirationDate = parseMangopayExpirationDate(rawJson.ExpirationDate);
    }

    const data = {};
    if (rawJson.Product) {
        data.product = rawJson.Product;
    }
    if (rawJson.BankCode) {
        data.bankCode = rawJson.BankCode;
    }

    return {
        paymentProvider: 'mangopay',
        resourceOwnerId: rawJson.UserId,
        resourceId: rawJson.Id,
        expirationMonth: expirationDate.expirationMonth,
        expirationYear: expirationDate.expirationYear,
        country: rawJson.Country,
        currency: rawJson.Currency,
        provider: rawJson.CardProvider,
        type: rawJson.CardType,
        alias: rawJson.Alias,
        active: rawJson.Active,
        validity: rawJson.Validity,
        fingerprint: rawJson.Fingerprint,
        data,
    };
}

// https://stripe.com/docs/api/node#card_object
function parseStripeData(rawJson) {
    const locationFields = [
        'address_city',
        'address_country',
        'address_line1',
        'address_line1_check',
        'address_line2',
        'address_state',
        'address_zip',
        'address_zip_check',
    ];

    const data = {
        ownerName: rawJson.name,
        funding: rawJson.funding,
    };

    locationFields.forEach(field => {
        data[field] = rawJson[field];
    });

    return {
        paymentProvider: 'stripe',
        resourceOwnerId: rawJson.customer,
        resourceId: rawJson.id,
        expirationMonth: rawJson.exp_month,
        expirationYear: rawJson.exp_year,
        country: rawJson.country,
        currency: null,
        provider: null,
        type: rawJson.brand,
        alias: rawJson.last4,
        active: true,
        validity: null,
        fingerprint: rawJson.fingerprint,
        data,
    };
}
