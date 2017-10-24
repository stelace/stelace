/**
* Conversation.js
*
* @description :: Conversation IDs are managed here w/ basic metadata. Unique per taker/owner pair, conversations are associated to Message Model.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        newContentDate: "string", // only updated if new content if conversation (not for read status changes)
        itemId: {
            type: "integer",
            index: true,
            required: true
        },
        bookingId: {
            type: "integer",
            index: true
        },
        inputAssessmentId: {
            type: "integer",
            index: true
        },
        outputAssessmentId: {
            type: "integer",
            index: true
        },
        senderId: {
            type: "integer",
            index: true,
            required: true
        },
        receiverId: { // ownerId in general
            type: "integer",
            index: true
        },
        startDate: "string",
        endDate: "string",
        bookingStatus: "string",
        agreementStatus: "string",
        senderRead: {
            type: "boolean",
            defaultsTo: true // first message is always read by sender. Do not forget to update this
        },
        receiverRead: {
            type: "boolean",
            defaultsTo: false
        },
        privateContent: "text", // last message privateContent
        answerDelay: "integer"
    },

    getAccessFields: getAccessFields,
    get: get,
    postBeforeCreate: postBeforeCreate,
    postBeforeUpdate: postBeforeUpdate,
    isEmpty: isEmpty,
    isPartOfConversation: isPartOfConversation

};

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
            "itemId",
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
            "itemId",
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

function postBeforeCreate(values) {
    values.newContentDate = values.createdDate;
}

function postBeforeUpdate(values) {
    if (values.startDate
     || values.bookingStatus
     || values.agreementStatus
     || values.privateContent // if bookingStatus is not 'info', any new message must have a private content
     || values.newContentDate // timestamp produced in current function but this can ensure a manual update w/o new message
    ) {
        values.newContentDate = values.updatedDate;
    }
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
