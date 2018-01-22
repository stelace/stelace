/* global EmailService, Sms, StelaceConfigService, User */

module.exports = {

    sendPhoneCheckSms: sendPhoneCheckSms,
    sendTextSms: sendTextSms,
    verifyNumber: verifyNumber,
    checkVerifyRequest: checkVerifyRequest,

};

var nexmo = require('easynexmo');
const _ = require('lodash');
const Promise = require('bluebird');

Promise.promisifyAll(nexmo);

nexmo.initialize(sails.config.nexmo.apiKey, sails.config.nexmo.apiSecret, false);

var debugSms = sails.config.debugSms;

function sendPhoneCheckSms(args) {
    var from = args.from;
    var to   = args.to;
    var text = args.text;

    // args can also include other options not used for the moment
    return nexmo.sendTextMessageAsync(from, to, text, args);
}

/**
 * Given user id and text, send him the sms
 * @param  {Object} args
 * @param  {Number} args.toUserId
 * @param  {String} args.text
 */
async function sendTextSms(args) {
    const from        = Sms.get('senderId');
    const toUserId    = args.toUserId;
    const text        = args.text;
    const createAttrs = {};

    const active = await StelaceConfigService.isFeatureActive('SMS');
    if (!active) return;

    const toUser = await User.findOne({ id: toUserId });
    if (!toUser || !toUser.phoneCheck || !toUser.phone) {
        throw new Error(`no valid phone for user ${toUserId}`);
    }

    // remove leading zeros and prepend countryCode
    // WARNING : France's +33 hardcoded for now
    createAttrs.countryCode = toUser.phoneCountryCode || '33';
    createAttrs.to          = '' + createAttrs.countryCode + parseInt(toUser.phone, 10);

    let response;
    if (debugSms) {
        response = await sendDebugSms(from, toUser.phone, text, debugSms);
    } else {
        // args can also include other options not used for the moment
        response = await nexmo.sendTextMessageAsync(from, createAttrs.to, text, args);
    }

    createAttrs.from          = from;
    createAttrs.userId        = toUserId;
    createAttrs.type          = 'text';
    createAttrs.text          = text;
    createAttrs.messagesCount = response && response['message-count'];

    // TODO handle several messages
    let firstMessage;
    let lastMessage;

    if (response && response.messages) {
        firstMessage = _.first(response.messages);
        lastMessage  = _.last(response.messages);
    }

    createAttrs.messageId          = firstMessage && firstMessage['message-id'];
    createAttrs.price              = firstMessage && firstMessage['message-price'];
    createAttrs.remainingBalance   = lastMessage && lastMessage['remaining-balance'];
    createAttrs.providerStatusCode = firstMessage && firstMessage.status;
    createAttrs.providerError      = firstMessage && firstMessage['error-text'];

    try {
        const sms = await Sms.create(createAttrs);
        return sms;
    } catch (e) {
        // no error handling
    }
}

async function sendDebugSms(from, to, text, toEmail) {
    await EmailService.sendHtmlEmail({
        fromEmail: sails.config.stelace.hello.email,
        toEmail,
        subject: `Sms from ${from} to ${to}`,
        html: text,
    });

    const response = {
        'message-count': 1,
        messages: [
            {
                'message-id': `message-${new Date().getTime()}`,
                'message-price': 0,
                'remaining-balance': 0,
                status: 0,
                'error-text': null
            },
        ],
    };
    return response;
}

/**
 * Send a sms with a verification code
 * @param  {Object} args
 * @param  {String} args.to - phone number to verify
 * @param  {String} args.from - name of the sender
 * @return {Object} response
 * @return {Number} response.status
 * @return {String} response.request_id
 */
async function verifyNumber(args) {
    const active = await StelaceConfigService.isFeatureActive('SMS');
    if (!active) return;

    const params = {
        number: args.to,
        brand: args.from,
        sender_id: args.from,
        pin_expiry: '600' // 10 minutes instead of 5 by default
    };

    if (debugSms) {
        const res = await debugVerifyNumber();
        return res;
    } else {
        const res = await nexmo.verifyNumberAsync(params);
        return res;
    }
}

async function debugVerifyNumber() {
    await Promise.resolve().delay(1000); // simulate network

    const response = {
        status: 0,
        request_id: `request-${new Date().getTime()}`,
    };
    return response;
}

/**
 * Check if the verification code is correct, so the associated phone number is valid
 * @param  {Object} args
 * @param  {String} args.request_id
 * @param  {String} args.code
 * @return {Object} response
 * @return {Number} response.status
 * @return {String} response.event_id
 * @return {Number} response.price
 * @return {String} response.error_text
 */
async function checkVerifyRequest(args) {
    const active = await StelaceConfigService.isFeatureActive('SMS');
    if (!active) return;

    const params = {
        request_id: args.request_id,
        code: args.code,
    };

    if (debugSms) {
        const res = await debugCheckVerifyRequest(args.code);
        return res;
    } else {
        const res = await nexmo.checkVerifyRequestAsync(params);
        return res;
    }
}

async function debugCheckVerifyRequest(code) {
    const isValidCode = (code) => code === '1234';

    await Promise.resolve().delay(1000); // simulate network

    const response = {
        status: isValidCode(code) ? 0 : 16,
        event_id: `event-${new Date().getTime()}`,
        price: 0,
        error_text: isValidCode(code) ? null : 'Bad code',
    };
    return response;
}
