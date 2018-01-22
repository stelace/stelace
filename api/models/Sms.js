/**
* Sms.js
*
* @description :: Wraps up SMS requests, responses and callbacks (DeLivery Receipt) data.
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

        // Sending request attributes
        userId: { // user id, nexmo 'client-ref'
            type: 'number',
            columnType: 'int',
            // index: true,
            required: true,
        },
        from: {
            type: 'string',
            columnType: 'varchar(32)',
            allowNull: true,
            maxLength: 32,
        },
        to: {
            type: 'string',
            columnType: 'varchar(32)',
            allowNull: true,
            maxLength: 32,
        },
        countryCode: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        reason: { // "phoneCheck" or "inbound" or messageId for automatic answers (future use)
            type: 'string',
            columnType: 'varchar(32)',
            allowNull: true,
            maxLength: 32,
        },
        type: { // 'text' (corresponds to Nexmo default's text 'type'), or 'verify'
            type: 'string',
            columnType: 'varchar(32)',
            allowNull: true,
            maxLength: 32,
        },
        text: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },

        // Response attributes
        verifyId: { // Nexmo Verify API 'request_id'
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        verifyStatus: { // 0 means success
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        messageId: { // nexmo 'message-id' or call-id in Nexmo Verify API
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        price: {
            type: 'number',
            columnType: 'float',
            allowNull: true,
        },
        remainingBalance: {
            type: 'number',
            columnType: 'float',
            allowNull: true,
        },
        providerStatusCode: { // nexmo 'status' in first request response
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        providerError: { // nexmo 'error-text' or 'error_text' in verify  API
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        messagesCount: { // 'sms-text' type only : number of message's parts nexmo 'message-count'
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },

        // Delevery receipt attributes (a dedicated log table may be needed if many fails)
        delivered: {
            type: 'boolean',
            columnType: 'tinyint(1)',
            allowNull: true,
        },
        deliveryStatus: { // nexmo DLR 'status'
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
        },
        deliveryError: { // nexmo DLR 'err-code'
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
        },
        deliveryTime: { // nexmo DLR 'scts'
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
        },
        providerTimestamp: { // nexmo dlr 'message-timestamp'
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
        },
        updateCount: {
            type: 'number',
            columnType: 'int',
            defaultsTo: 0,
        },
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
