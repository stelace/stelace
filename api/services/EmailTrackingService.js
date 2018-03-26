/* global Bookmark, EmailContent, EmailLog, EmailTracking, MicroService, User */

// Useful links for Sparkpost events
// https://www.sparkpost.com/docs/user-guide/comparing-data
// https://www.sparkpost.com/docs/tech-resources/webhook-event-reference
// https://www.sparkpost.com/docs/tech-resources/sparkpost-event-metrics-definitions

module.exports = {

    isMandrillRequest: isMandrillRequest,
    saveEvents: saveEvents,
    getMandrillMessageIds: getMandrillMessageIds,
    saveEventsContent: saveEventsContent,

    saveSparkpostEvent,
    isSparkpostRequest,
    processSparkpostEvents,

};

const _ = require('lodash');
const Promise = require('bluebird');
const moment   = require('moment');
const useragent = require('useragent');
const mandrill = require('mandrill-api/mandrill');
let mandrillClient;

const messageEventTypes = [
    "send",
    "blacklist",
    "deferral",
    "hard_bounce",
    "soft_bounce",
    "open",
    "click",
    "spam",
    "unsub",
    "reject"
];

function isMandrillRequest(bodyParams, mandrillSignatureHeader) {
    if (!sails.config.mandrill) {
        throw new Error('Mandrill config not defined');
    }

    const webhookKey = sails.config.mandrill.webhook.key;
    const webhookUrl = sails.config.mandrill.webhook.url;

    var mandrillSignature = EmailTracking.getMandrillSignature(webhookKey, webhookUrl, bodyParams);

    return mandrillSignature === mandrillSignatureHeader;
}

function saveEvents(mandrillEvents, logger) {
    var eventTypes = {};

    return Promise.coroutine(function* () {
        yield Promise.each(mandrillEvents, mandrillEvent => {
            return Promise.coroutine(function* () {
                var emailTracking = yield saveEvent(mandrillEvent);

                if (! eventTypes[emailTracking.eventType]) {
                    eventTypes[emailTracking.eventType] = [];
                }

                eventTypes[emailTracking.eventType].push({
                    id: emailTracking.id,
                    mandrillMessageId: emailTracking.mandrillMessageId
                });
            })();
        });

        try {
            if (eventTypes.spam && eventTypes.spam.length) {
                var spamIds = _.pluck(eventTypes.spam, "mandrillMessageId");

                var usersIds = yield getUsersIdsFromMandrillMessagesIds(spamIds);
                usersIds = MicroService.escapeListForQueries(usersIds);

                yield Promise.props({
                    // remove bookmarks
                    bookmarks: Bookmark.update(
                        {
                            userId: usersIds,
                            active: true
                        },
                        { active: false }
                    ),
                    // do not send newsletter anymore
                    users: User.update(
                        {
                            userId: usersIds,
                            newsletter: true
                        },
                        { newsletter: false }
                    )
                });
            }
        } catch (e) {
            logger.error({ err: e }, "Mandrill webhook, fail to disable bookmarks and newsletters");
        }
    })();
}

function getMandrillMessageIds(mandrillEvents) {
    return MicroService.escapeListForQueries(_.map(mandrillEvents, mandrillEvent => mandrillEvent._id));
}

function saveSparkpostEvent(event, batchId) {
    const geoIp = event.geo_ip;
    const userAgent = event.user_agent;
    const parsedUserAgent = userAgent && useragent.parse(userAgent);

    const createAttrs = {
        sparkpostTransmissionId: event.transmission_id,
        sparkpostMessageId: event.message_id,
        sparkpostBatchId: batchId,
        email: event.rcpt_to,
        eventType: event.type,
        eventDate: new Date(event.timestamp * 1000).toISOString(),
        clickedUrl: event.target_link_url,
        ip: event.ip_address,
        country: geoIp && geoIp.country,
        region: geoIp && geoIp.region,
        userAgent: event.user_agent,
        os: parsedUserAgent && parsedUserAgent.os.toString(),
        browser: parsedUserAgent && parsedUserAgent.toAgent(),
        rejectReason: event.raw_reason,
        data: {
            event,
        },
    };

    return EmailTracking.create(createAttrs);
}

function isSparkpostRequest(authorization, { user, password }) {
    if (authorization
     && typeof authorization === 'string'
     && _.startsWith(authorization, 'Basic ')
    ) {
        const credentials = authorization.slice(6);
        const decodedCredentials = new Buffer(credentials, 'base64').toString('binary'); // node.js has no atob()
        return decodedCredentials === `${user}:${password}`;
    }

    return false;
}

async function processSparkpostEvents(emailTrackings) {
    const transmissionsIds = MicroService.escapeListForQueries(_.pluck(emailTrackings, 'sparkpostTransmissionId'));
    const emailLogs = await EmailLog.find({ sparkpostTransmissionId: transmissionsIds });
    const indexedEmailLogs = _.indexBy(emailLogs, 'sparkpostTransmissionId');

    const removeBookmarkUsersIds = [];
    const unsubscribeUsersIds = [];

    _.forEach(emailTrackings, emailTracking => {
        const emailLog = indexedEmailLogs[emailTracking.sparkpostTransmissionId];
        if (!emailLog || !emailLog.userId) {
            return;
        }

        const type = emailTracking.eventType;
        const userId = emailLog.userId;

        if (type === 'spam_complaint') {
            removeBookmarkUsersIds.push(userId);
            unsubscribeUsersIds.push(userId);
        } else if (_.includes(['list_unsubscribe', 'link_unsubscribe'], type)) {
            unsubscribeUsersIds.push(userId);
        }
    });

    await Promise.all([
        // remove bookmarks
        Bookmark.update(
            {
                userId: MicroService.escapeListForQueries(removeBookmarkUsersIds),
                active: true
            },
            { active: false }
        ).catch(() => { /* do nothing */ }),
        // do not send newsletter anymore
        User.update(
            {
                userId: MicroService.escapeListForQueries(unsubscribeUsersIds),
                newsletter: true
            },
            { newsletter: false }
        ).catch(() => { /* do nothing */ }),
    ]);
}

function saveEvent(mandrillEvent) {
    var createAttrs = {
        eventDate: moment(new Date(mandrillEvent.ts * 1000)).toISOString(),
        eventType: mandrillEvent.event || mandrillEvent.type
    };

    if (_.contains(messageEventTypes, mandrillEvent.event)) {
        createAttrs.mandrillMessageId = mandrillEvent._id;

        mandrillEvent.msg = mandrillEvent.msg || {};
        createAttrs.email = mandrillEvent.msg.email;
    }

    if (mandrillEvent.event === "click") {
        createAttrs.clickedUrl = mandrillEvent.url;
    }

    if (mandrillEvent.event === "click"
     || mandrillEvent.event === "open"
    ) {
        createAttrs.ip        = mandrillEvent.ip;
        createAttrs.userAgent = mandrillEvent.user_agent;

        mandrillEvent.location = mandrillEvent.location || {};
        createAttrs.country = mandrillEvent.location.country_long;
        createAttrs.region  = mandrillEvent.location.region;

        mandrillEvent.user_agent_parsed = mandrillEvent.user_agent_parsed || {};
        createAttrs.mobile        = mandrillEvent.user_agent_parsed.mobile;
        createAttrs.userAgentType = mandrillEvent.user_agent_parsed.type;
        createAttrs.os            = mandrillEvent.user_agent_parsed.os_name;
        createAttrs.browser       = mandrillEvent.user_agent_parsed.ua_name;
    }

    if (mandrillEvent.type === "whitelist"
     || mandrillEvent.type === "blacklist"
    ) {
        createAttrs.syncAction = mandrillEvent.action;

        mandrillEvent.reject = mandrillEvent.reject || {};
        createAttrs.email                = mandrillEvent.reject.email;
        createAttrs.rejectReason         = mandrillEvent.reject.reason;
        createAttrs.rejectExpirationDate = mandrillEvent.reject.expires_at;
    }

    if (mandrillEvent.event === "inbound") {
        mandrillEvent.msg = mandrillEvent.msg || {};
        createAttrs.email         = mandrillEvent.msg.from_email;
        createAttrs.receiverEmail = mandrillEvent.msg.email;

        mandrillEvent.msg.spam_report = mandrillEvent.msg.spam_report || {};
        createAttrs.spamScore = mandrillEvent.msg.spam_report.score;
    }

    return EmailTracking.create(createAttrs);
}

function getUsersIdsFromMandrillMessagesIds(mandrillMessagesIds) {
    return Promise.coroutine(function* () {
        var emailLogs = yield EmailLog.find({
            mandrillMessageId: MicroService.escapeListForQueries(mandrillMessagesIds),
            userId: { '!=': null }
        });

        return MicroService.escapeListForQueries(_.pluck(emailLogs, "userId"));
    })();
}

function saveEventsContent(mandrillMessagesIds, logger) {
    return Promise.coroutine(function* () {
        var emailContents = yield EmailContent.find({
            mandrillMessageId: mandrillMessagesIds
        });

        var indexedIds = _.indexBy(emailContents, "mandrillMessageId");

        yield Promise.map(mandrillMessagesIds, mandrillMessageId => {
            return Promise.coroutine(function* () {
                try {
                    var emailContent = indexedIds[mandrillMessageId];
                    var metadata;

                    if (! emailContent) {
                        metadata = yield getEmailMetadata(mandrillMessageId, false);

                        var createAttrs = {
                            mandrillMessageId: mandrillMessageId,
                            info: metadata.info,
                            content: metadata.content
                        };

                        yield EmailContent.create(createAttrs);
                    } else {
                        metadata = yield getEmailMetadata(mandrillMessageId, true);

                        var updateAttrs = {
                            info: metadata.info
                        };

                        yield EmailContent.updateOne({ id: emailContent.id }, updateAttrs);
                    }
                } catch (e) {
                    logger.error({
                        err: e,
                        mandrillMessageId: mandrillMessageId
                    }, "Mandrill webhook, fail to get email content");
                }
            })();
        }, { concurrency: 100 });
    })();
}

function getMandrillClient() {
    if (mandrillClient) return mandrillClient;

    mandrillClient = new mandrill.Mandrill(sails.config.mandrill.apiKey);
    return mandrillClient;
}

function getContent(id) {
    const mandrillClient = getMandrillClient();

    return new Promise((resolve, reject) => {
        mandrillClient.messages.content({ id: id }, resolve, reject);
    });
}

function getInfo(id) {
    const mandrillClient = getMandrillClient();

    return new Promise((resolve, reject) => {
        mandrillClient.messages.info({ id: id }, resolve, reject);
    });
}

function getEmailMetadata(mandrillMessageId, noContent) {
    return Promise.props({
        content: noContent ? null : getContent(mandrillMessageId),
        info: getInfo(mandrillMessageId)
    });
}
