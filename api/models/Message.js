/* global
    Booking, Conversation, EmailTemplateService, Item, LoggerService, Message,
    User, SmsTemplateService, ToolsService
*/

/**
* Message.js
*
* @description :: Messages of each conversation are saved here. Public and private part of first message are concatenated here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        conversationId: {
            type: "integer",
            index: true,
            required: true
        },
        senderId: {
            type: "integer",
            index: true,
            required: true
        },
        receiverId: {
            type: "integer",
            index: true
        },
        privateContent: {
            type: "text",
            maxLength: 2000
        },
        publicContent: {
            type: "text",
            maxLength: 2000
        },
        read: { // populated for future use, per message. For the moment read status of whole conversation is used for simplicity
            type: "boolean",
            defaultsTo: false
        },
        bookingId: {
            type: "integer",
            index: true
        },
        bookingStatus: "string",
        agreementStatus: "string",
        answerDelay: "integer" // seconds. User stat also in Conversation (unique per conversation for the moment)
    },

    getAccessFields: getAccessFields,
    createMessage: createMessage


};

var moment = require('moment');

function getAccessFields(access) {
    var accessFields = {
        self: [
            "conversationId",
            "senderId",
            "receiverId",
            "privateContent",
            "publicContent",
            "read",
            "bookingId",
            "bookingStatus",
            "agreementStatus",
            "createdDate",
            "updatedDate"
        ],
        others: [
            "conversationId",
            "senderId",
            "receiverId",
            "publicContent",
            "createdDate"
        ]
    };

    return accessFields[access];
}

/**
 * @param {integer} userId
 * @param {object}  createAttrs
 * @param {integer} createAttrs.itemId
 * @param {integer} createAttrs.conversationId
 * @param {integer} createAttrs.senderId
 * @param {integer} createAttrs.receiverId
 * @param {string}  [createAttrs.privateContent]
 * @param {string}  [createAttrs.publicContent]
 * @param {integer} [createAttrs.bookingId]
 * @param {string}  [createAttrs.bookingStatus]
 * @param {string}  [createAttrs.agreementStatus]
 * @param {object}  params
 * @param {object}  [params.logger]                         - Source request logger
 * @param {boolean} [params.skipEmailAndSms = false]
 * @param {boolean} [params.forceNewConversation = false]
 * @param {boolean} [params.allowEmptyConversation = false] - Allow conversation creation with no message (for automatic actions)
 * @param {boolean} [params.allowEmpty = false]             - Allow empty conversation AND empty message creation
 * @param {object}  [params.emptyConversationMeta]          - Allow to set conversation's private/public content despite empty message
 * @param {object}  [params.noObfuscate = false]            - Allow to stop obfuscating messages
 *
 * @returns {object} Message created OR empty conversationId singleton if no message were created using one allowEmpty parameter
 */
function createMessage(userId, createAttrs, params) {
    var pickUpdateConversationAttrs = [
        "startDate",
        "endDate",
        "bookingId",
        "bookingStatus",
        "agreementStatus",
        "privateContent",
        "answerDelay",
        "newContentDate"
    ];
    var logger = params.logger || LoggerService.getLogger("app");

    var error;

    return Promise.coroutine(function* () {
        var results = yield Promise.props({
            item: Item.findOne({ id: createAttrs.itemId }),
            conversation: findExistingConversation(createAttrs),
            messages: createAttrs.conversationId ? Message.find({ conversationId: createAttrs.conversationId }) : [] // for duplicate detection (avoid email spam)
        });

        var item         = results.item;
        var conversation = results.conversation;
        var messages     = results.messages;

        if (! item) {
            throw new NotFoundError();
        }

        var booking;

        // can be undefined when current message is first one for this booking
        // In this case, we must try to find a relevant conversation or create one
        if (conversation && conversation.bookingId) {
            booking = yield Booking.findOne({ id: conversation.bookingId });

            if (! booking) {
                error = new NotFoundError("Missing conversation booking");
                error.conversationId = conversation.id;
                error.bookingId      = conversation.bookingId;
                throw error;
            }
        }

        var newBooking;
        if (createAttrs.bookingId) {
            newBooking = yield Booking.findOne({ id: createAttrs.bookingId });

            if (! newBooking) {
                throw new NotFoundError();
            }
        }

        // empty messages are only allowed if a first real message has been sent before (possibly in previous conversations)
        // should not happen since message content is required client-side when no previous conversation
        // WARNING: there can be empty conversations (e.g. automatically created new ones for bookings w/ repeated users and itemId)
        if (! (params.allowEmpty || params.allowEmptyConversation)
         && ! conversation
         && ! createAttrs.privateContent
         && ! createAttrs.publicContent
        ) {
            error = new BadRequestError("user must write a real message to create conversation");
            error.expose = true;
            throw error;
        }

        // obfuscate all messages if the booking isn't paid and validated
        // and if no obfuscate parameter is passed
        var paidAndValidatedBooking = booking && booking.confirmedDate;

        if (! params.noObfuscate
         && ! paidAndValidatedBooking
        ) {
            createAttrs.privateContent = ToolsService.obfuscateContactDetails(createAttrs.privateContent);
            createAttrs.publicContent  = ToolsService.obfuscateContactDetails(createAttrs.publicContent);
        }

        var newMessageData;

        // create new conversation for new (pre-)booking if preexisting paid booking that has not been cancelled (if pending > new conversation)
        // to avoid 2 effective bookings in same conversation. Note: Only (pre-)bookings have a bookingId
        var existingPaidBooking = booking && booking.confirmedDate && ! booking.cancellationId ? booking : null;
        var newBookingDifferentThanExisting = newBooking && existingPaidBooking && existingPaidBooking.id !== newBooking.id;

        if (params.forceNewConversation
         || ! conversation
         || newBookingDifferentThanExisting
        ) {
            newMessageData = yield createMessageWithNewConversation({
                createAttrs: createAttrs,
                pickUpdateConversationAttrs: pickUpdateConversationAttrs,
                params: params
            });
        } else {
            if (! Conversation.isPartOfConversation(conversation, userId)) {
                throw new BadRequestError();
            }

            newMessageData = yield createMessageWithExistingConversation({
                conversation: conversation,
                createAttrs: createAttrs,
                pickUpdateConversationAttrs: pickUpdateConversationAttrs,
                params: params,
                userId: userId
            });
        }

        var data = {
            conversation: newMessageData.conversation,
            message: newMessageData.message,
            messages: messages,
            item: item,
            firstMessage: newMessageData.isFirstMessage
        };

        // emails and sms are not critical, errors not promise-blocking
        if (! params.skipEmailAndSms) {
            _sendNewMessageEmailsAndSms(data, logger);
        }

        return newMessageData.message;
    })();
}

/**
 * find existing conversation based on new message metadata
 * @param  {object} createAttrs
 * @return {Promise<object>} existing conversation
 */
function findExistingConversation(createAttrs) {
    return Promise.coroutine(function* () {
        if (createAttrs.conversationId) {
            return yield Conversation.findOne({ id: createAttrs.conversationId });
        }

        // find relevant conversations
        // Only one conversation for given itemId and senderId-receiverId pair AND paid bookingId
        // Take last conversation by default (most recent booking if several booking between 2 users and createAttrs.bookingId)
        var usersIds = [createAttrs.senderId, createAttrs.receiverId];

        var conversations = yield Conversation
            .find({
                itemId: createAttrs.itemId,
                senderId: usersIds,
                receiverId: usersIds
            })
            .sort({ createdDate: -1 });

        // sort conversations by putting those who match booking first
        var sortedConversations = _.sortBy(conversations, conv => {
            if (! createAttrs.bookingId) {
                return 1;
            }
            return conv.bookingId === createAttrs.bookingId ? -1 : 1;
        });

        var rightConversation = _.find(sortedConversations, conv => {
            var isBookingAgreement = createAttrs.bookingId
             && (createAttrs.agreementStatus === "agreed" || createAttrs.agreementStatus === "rejected");

            // reuse conversations whose booking agreement is set by owner
            // or info conversations
            // or pre-booking conversations
            // or conversations whose existing booking isn't agreed
            return ((isBookingAgreement && (createAttrs.bookingId === conv.bookingId))
             || conv.bookingStatus === "info"
             || conv.bookingStatus === "pre-booking"
             || (conv.bookingStatus === "booking" && conv.agreementStatus !== "agreed")
            );
        });

        return rightConversation;
    })();
}

/**
 * create message with new conversation
 * @param  {object} args
 * @param  {object} args.createAttrs
 * @param  {object} args.pickUpdateConversationAttrs
 * @param  {object} args.params
 * @return {Promise<object>} newMessageData
 * @return {object}          newMessageData.message
 * @return {boolean}         newMessageData.isFirstMessage
 */
function createMessageWithNewConversation(args) {
    var createAttrs                 = args.createAttrs;
    var pickUpdateConversationAttrs = args.pickUpdateConversationAttrs;
    var params                      = args.params;

    var createConvAttrs        = _.pick(createAttrs, pickUpdateConversationAttrs);
    createConvAttrs.itemId     = createAttrs.itemId;
    createConvAttrs.senderId   = createAttrs.senderId;
    createConvAttrs.receiverId = createAttrs.receiverId;

    // Populate conversation's privateContent with message's publicContent to avoid conversation emptyness (See Conversation.js)
    if (! createConvAttrs.privateContent && createAttrs.publicContent) {
        createConvAttrs.privateContent = createAttrs.publicContent;
    }

    // Populate conversation with pending message content (payment emails)
    if (params.allowEmptyConversation || params.allowEmpty) {
        _.defaults(createConvAttrs, params.emptyConversationMeta);
    }

    if (createAttrs.startDate && createAttrs.endDate && ! createConvAttrs.agreementStatus) {
        createConvAttrs.agreementStatus = "pending";
    }

    return Promise.coroutine(function* () {
        var conversation = yield Conversation.create(createConvAttrs);

        var shouldCreateMessage = createAttrs.privateContent || createAttrs.publicContent || params.allowEmpty;
        createAttrs.conversationId = conversation.id;

        var message;
        if (shouldCreateMessage) {
            message = yield Message.create(createAttrs);
        } else {
            message = { conversationId: conversation.id };
        }

        return {
            conversation: conversation,
            message: message,
            isFirstMessage: true
        };
    })();
}

/**
 * create message with existing conversation
 * @param  {object} args
 * @param  {object} args.conversation
 * @param  {object} args.createAttrs
 * @param  {object} args.pickUpdateConversationAttrs
 * @param  {object} args.params
 * @param  {number} args.userId
 * @return {Promise<object>} newMessageData
 * @return {object}          newMessageData.message
 * @return {boolean}         newMessageData.isFirstMessage
 */
function createMessageWithExistingConversation(args) {
    var conversation                = args.conversation;
    var createAttrs                 = args.createAttrs;
    var pickUpdateConversationAttrs = args.pickUpdateConversationAttrs;
    var params                      = args.params;
    var userId                      = args.userId;

    return Promise.coroutine(function* () {
        // fetch messages again because the conversation isn't necessarily the same as the beginning
        var messages = yield Message
            .find({ conversationId: conversation.id })
            .sort({ createdDate: 1 });

        var isFirstMessage = ! messages.length;

        if (conversation.senderId === createAttrs.senderId && createAttrs.publicContent) {
            // concatenate public and private parts for all booker messages except first one
            // should not happen if managed correctly client-side (public input hidden)
            if (! createAttrs.privateContent) {
                createAttrs.privateContent = createAttrs.publicContent;
            } else {
                createAttrs.privateContent += "\n" + createAttrs.publicContent;
            }
            createAttrs.publicContent = null;
        } else if (conversation.senderId === createAttrs.receiverId
            && messages.length
            && ! _.find(messages, { senderId: conversation.receiverId })
        ) {
            // compute answerDelay only if current message is owner's first answer
            // take updatedDate since message draft can be created when failing payment > overestimated answerDelay
            createAttrs.answerDelay = moment().diff(messages[0].updatedDate, "s");
        }

        if (conversation.senderId === createAttrs.senderId
         && createAttrs.startDate
         && createAttrs.endDate
         && (createAttrs.startDate !== conversation.startDate || createAttrs.endDate !== conversation.endDate)
        ) {
            // booking must be (pre-)accepted again
            createAttrs.agreementStatus = "pending";
        }

        var updateAttrs = _.pick(createAttrs, pickUpdateConversationAttrs);

        if (userId === conversation.senderId) {
            updateAttrs.receiverRead = false;
        } else {
            updateAttrs.senderRead = false;
        }

        // Update conversation with pending message content (payment emails)
        // allowEmptyConversation and emptyConversationMeta are only used during payment
        if (params.allowEmptyConversation || params.allowEmpty) {
            _.assign(updateAttrs, params.emptyConversationMeta);
        }

        conversation = yield Conversation.updateOne(conversation.id, updateAttrs);

        var shouldCreateMessage = createAttrs.privateContent || createAttrs.publicContent || params.allowEmpty;
        createAttrs.conversationId = conversation.id;

        var message;
        if (shouldCreateMessage) {
            message = yield Message.create(createAttrs);
        } else {
            message = { conversationId: conversation.id };
        }

        return {
            conversation: conversation,
            message: message,
            isFirstMessage: isFirstMessage
        };
    })();
}

// WARNING : these emails and sms are not critical, catch the error
function _sendNewMessageEmailsAndSms(data, logger) {
    var conversation     = data.conversation;
    var message          = data.message;
    var messages         = data.messages;
    var item             = data.item;
    var firstMessage     = data.firstMessage;
    var receiverIsOwner  = (item.ownerId === message.receiverId);
    var isBookingMessage = _skipNewMessageSms(message);
    var error;

    if (_skipNewMessageNotification(conversation, message)) {
        return;
    }

    return Promise
        .resolve()
        .then(() => {
            return [
                User.findOne({ id: message.senderId }),
                User.findOne({ id: message.receiverId }),
                message.bookingId ? Booking.findOne({ id: message.bookingId }) : null
            ];
        })
        .spread((sender, receiver, booking) => {
            if (! sender || ! receiver) {
                error = new Error("Can't populate message's sender and receiver");
                error.messageId = message.id;
                throw error;
            }

            return [
                sender,
                receiver,
                booking,
                Item.getMedias([item]).then(itemMedias => itemMedias[item.id]),
                User.getMedia([sender]).then(senderMedia => senderMedia[sender.id])
            ];
        })
        .spread((sender, receiver, booking, itemMedias, senderMedia) => {
            var isDuplicate  = _.find(messages, function (msg) {
                // do not send email for duplicates in same day, but confirmation SMS should be sent anyway
                var sameDay    = moment(message.createdDate).isSame(msg.createdDate, "day");
                var sameContent = (("" + message.privateContent + message.publicContent) === ("" + msg.privateContent + msg.publicContent));
                return (sameDay && sameContent);
            });

            if (! isDuplicate) {
                EmailTemplateService
                    .sendEmailTemplate('new-message', {
                        user: receiver,
                        item: item,
                        itemMedias: itemMedias,
                        conversation: conversation,
                        firstMessage: firstMessage,
                        message: message,
                        sender: sender,
                        senderMedia: senderMedia,
                        booking: booking // to check if booking has already been validated
                    })
                    .catch(err => {
                        logger.error({ err: err }, "send new message email");
                    });
            }

            if (isBookingMessage) {
                return;
            }

            // Send SMS to owner when pre-booking or firstMessage, and to giver when firstMessage
            // SMS is already sent after booking payment (confirmation) or validation in Booking Controller
            if (message.bookingStatus === "pre-booking" || (firstMessage && receiverIsOwner)) {
                SmsTemplateService
                    .sendSmsTemplate('new-message', {
                        user: receiver,
                        booking,
                    })
                    .catch(err => {
                        logger.error({ err: err }, "send sms new message to owner");
                    });
            }
        })
        .catch(err => {
            logger.error({ err: err }, "send new message email");
        });
}

/**
 * Do not send sms when some are already sent in Booking Controller
 * @param {object}     message
 *
 * @returns {boolean}
 */
function _skipNewMessageSms(message) {
    return (message.bookingStatus === "booking" || message.agreementStatus === "agreed");
}

/**
 * Skip new-message notification to receiver, according to configuration in excludedNotificationStatus
 * When receiver as already received a booking call-to-action email (such as bookingPendingOwner)
 * @param {object}     conversation
 * @param {object}     message
 *
 * @returns {boolean}  skipMessageNotification
 */
function _skipNewMessageNotification(conversation, message) {
    var skipMessageNotification    = false;
    var excludedNotificationStatus = [{
        // Templates: bookingPendingOwner, bookingPendingGiver*
        "message.bookingStatus": "booking"
    }, /* OR */ {
        // Templates: prebookingPendingTaker (but not bookingConfirmedTaker)
        "conversation.bookingStatus": "pre-booking", // AND
        "message.agreementStatus": "agreed"
    }];
    // TODO: add { message.agreementStatus: "reject" } when sending cancellation email template

    // These statuses imply booking emails with message content have already been sent
    skipMessageNotification = _.reduce(excludedNotificationStatus, (skip, statusObject) => {
        var checkAgainst        = {
            "conversation.bookingStatus": conversation.bookingStatus,
            "conversation.agreementStatus": conversation.agreementStatus,
            "message.bookingStatus": message.bookingStatus,
            "message.agreementStatus": message.agreementStatus
        };

        return (skip || _.isEqual(_.pick(checkAgainst, _.keys(statusObject)), statusObject));
    }, false);

    return skipMessageNotification;
}
