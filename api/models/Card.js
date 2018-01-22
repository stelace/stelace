/* global Card, mangopay, TimeService */

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
        mangopayId: {
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
        expirationDate: { // "MMYY"
            type: 'string',
            columnType: 'varchar(255)',
            required: true,
            maxLength: 255,
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

        /*
            hash1 and hash2 are for card number unicity
            identical card number:
            cardA.hash1 === cardB.hash1 && cardA.hash2 === cardB.hash2
        */
        hash1: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        hash2: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
    },

    getAccessFields,
    synchronize,
    disable,
    isExpiredAt,

};

var moment = require('moment');

function getAccessFields(access) {
    var accessFields = {
        self: [
            "id",
            "userId",
            "expirationDate",
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

function synchronize(card) {
    return mangopay.card
        .fetch({ cardId: card.mangopayId })
        .then(c => {
            var updateAttrs = {
                expirationDate: c.ExpirationDate,
                currency: c.Currency,
                provider: c.CardProvider,
                type: c.CardType,
                alias: c.Alias,
                active: c.Active,
                validity: c.Validity
            };

            return Card.updateOne(card.id, updateAttrs);
        });
}

function disable(card) {
    return mangopay.card
        .edit({
            cardId: card.mangopayId,
            body: {
                Active: false
            }
        })
        .then(() => {
            return Card.updateOne(card.id, { active: false });
        });
}

function isExpiredAt(card, expiredDate) {
    if (! TimeService.isDateString(expiredDate, { onlyDate: true })) {
        throw new Error("Bad value");
    }

    var expirationYear  = parseInt("20" + card.expirationDate.substr(2, 2), 10);
    var expirationMonth = parseInt(card.expirationDate.substr(0, 2), 10);

    expiredDate = moment(expiredDate);
    var expiredYear  = expiredDate.year();
    var expiredMonth = expiredDate.month() + 1;

    return (expirationYear < expiredYear || (expirationYear === expiredYear && expirationMonth < expiredMonth));
}
