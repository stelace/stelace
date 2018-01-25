/* global Conversation */

/**
* Conversation.js
*
* @description :: Conversation IDs are managed here w/ basic metadata. Unique per taker/owner pair, conversations are associated to Message Model.
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
        newContentDate: { // only updated if new content if conversation (not for read status changes)
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        listingId: {
            type: 'number',
            columnType: 'int',
            required: true,
            // index: true,
        },
        bookingId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
            // index: true,
        },
        inputAssessmentId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
            // index: true,
        },
        outputAssessmentId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
            // index: true,
        },
        senderId: {
            type: 'number',
            columnType: 'int',
            required: true,
            // index: true,
        },
        receiverId: { // ownerId in general
            type: 'number',
            columnType: 'int',
            required: true,
            // index: true,
        },
        startDate: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        endDate: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        bookingStatus: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        agreementStatus: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        senderRead: { // first message is always read by sender. Do not forget to update this
            type: 'boolean',
            columnType: 'tinyint(1)',
            defaultsTo: true,
        },
        receiverRead: {
            type: 'boolean',
            columnType: 'tinyint(1)',
            defaultsTo: false,
        },
        privateContent: { // last message privateContent
            type: 'string',
            columnType: 'longtext CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        answerDelay: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
    },

    getAccessFields,
    get,
    beforeCreate,
    beforeUpdate,
    isEmpty,
    isPartOfConversation,

};

const _ = require('lodash');

// Replicate this from message on each update (needs history with messages)
var params = {
    // pre-booking : info with startDate and endDate
    bookingStatus: [
        "info",
        "pre-booking",
        "booking",
        "recall"
    ],
    agreementStatus: [
        // "automatic",
        "agreed",
        "rejected",
        "rejected-by-other",
        "pending",
        "pending-giver",
        "cancelled",
        "recall"
    ]
};

function getAccessFields(access) {
    var accessFields = {
        self: [
            "id",
            "listingId",
            "bookingId",
            "inputAssessmentId",
            "outputAssessmentId",
            "senderId",
            "receiverId",
            "startDate",
            "endDate",
            "bookingStatus",
            "agreementStatus",
            "receiverRead",
            "senderRead",
            "privateContent",
            "answerDelay",
            "createdDate",
            "updatedDate",
            "newContentDate"
        ],
        others: [
            "id",
            "listingId",
            "bookingId",
            "senderId",
            "receiverId",
            "answerDelay",
            "createdDate",
            "updatedDate",
            "newContentDate"
        ]
    };

    return accessFields[access];
}

function get(prop) {
    if (prop) {
        return params[prop];
    } else {
        return params;
    }
}

function beforeCreate(values, next) {
    Conversation.beforeCreateDates(values)
    values.newContentDate = values.createdDate;

    next();
}

function beforeUpdate(values, next) {
    Conversation.beforeUpdateDates(values);

    if (values.startDate
     || values.bookingStatus
     || values.agreementStatus
     || values.privateContent // if bookingStatus is not 'info', any new message must have a private content
     || values.newContentDate // timestamp produced in current function but this can ensure a manual update w/o new message
    ) {
        values.newContentDate = values.updatedDate;
    }

    next();
}

function isEmpty(conversation) {
    // Testing for answerDelay ensures that conversations with no private content but with several messages
    // are not considered empty (if only public question AND answer)
    // New conversations' (no answer yet) empty privateContent case is dealt in MessageController
    return conversation.privateContent === null && conversation.answerDelay === null;
}

function isPartOfConversation(conversation, userId) {
    return _.includes([conversation.senderId, conversation.receiverId], userId);
}
