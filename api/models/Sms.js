/**
* Sms.js
*
* @description :: Wraps up SMS requests, responses and callbacks (DeLivery Receipt) data.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        // Sending request attributes
        userId: { // user id, nexmo 'client-ref'
            type: "integer",
            index: true,
            required: true
        },
        from: {
            type: "string",
            maxLength: 32
        },
        to: {
            type: "string",
            maxLength: 32
        },
        countryCode: "integer",
        reason: { // "phoneCheck" or "inbound" or messageId for automatic answers (future use)
            type: "string",
            maxLength: 32
        },
        type: { // 'text' (corresponds to Nexmo default's text 'type'), or 'verify'
            type: "string",
            maxLength: 32
        },
        text: "string",

        // Response attributes
        verifyId: "string", // Nexmo Verify API 'request_id'
        verifyStatus: "string", // 0 means success
        messageId: "string", // nexmo 'message-id' or call-id in Nexmo Verify API
        price: "float",
        remainingBalance: "float",
        providerStatusCode: "string", //nexmo 'status' in first request response
        providerError: "string", // nexmo 'error-text' or 'error_text' in verify  API
        messagesCount: "integer", // 'sms-text' type only : number of message's parts nexmo 'message-count'

        // Delevery receipt attributes (a dedicated log table may be needed if many fails)
        delivered: "boolean",
        deliveryStatus: "string", //nexmo DLR 'status'
        deliveryError: "string", // nexmo DLR 'err-code'
        deliveryTime: { // nexmo DLR 'scts'
            type: "string",
            maxLength: 255
        },
        providerTimestamp: { // nexmo dlr 'message-timestamp'
            type: "string",
            maxLength: 255
        },
        updateCount: {
            type: "integer",
            defaultsTo: 0
        }
    },

    get: get

};

var params = {
    senderId: ""
};

function get(prop) {
    if (prop) {
        return params[prop];
    } else {
        return params;
    }
}
