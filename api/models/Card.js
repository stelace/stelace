/* global Card, mangopay, TimeService */

/**
* Card.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        mangopayId: {
            type: "string",
            index: true,
            size: 191,
            maxLength: 191
        },
        userId: {
            type: "integer",
            index: true
        },
        expirationDate: "string", // "MMYY"
        currency: "string",
        provider: "string", // "CB" || "VISA" || "MASTERCARD" ...
        type: "string", // "CB_VISA_MASTERCARD"
        alias: "string", // card number with missing characters (ex: "356999XXXXXX0165")
        active: "boolean",
        validity: "string", // "UNKNOWN" || "VALID" || "INVALID"
        forget: { // if true, do not use again this card
            type: "boolean",
            defaultsTo: false
        },

        /*
            hash1 and hash2 are for card number unicity
            identical card number:
            cardA.hash1 === cardB.hash1 && cardA.hash2 === cardB.hash2
            */
        hash1: "string",
        hash2: "string",

        synchronize: s_synchronize,
        disable: s_disable,
        isExpiredAt: s_isExpiredAt
    },

    getAccessFields: getAccessFields

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

function s_synchronize() {
    var card = this;

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

function s_disable() {
    var card = this;

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

function s_isExpiredAt(expiredDate) {
    if (! TimeService.isDateString(expiredDate, { onlyDate: true })) {
        throw new Error("Bad value");
    }

    var card = this;

    var expirationYear  = parseInt("20" + card.expirationDate.substr(2, 2), 10);
    var expirationMonth = parseInt(card.expirationDate.substr(0, 2), 10);

    expiredDate = moment(expiredDate);
    var expiredYear  = expiredDate.year();
    var expiredMonth = expiredDate.month() + 1;

    return (expirationYear < expiredYear || (expirationYear === expiredYear && expirationMonth < expiredMonth));
}
