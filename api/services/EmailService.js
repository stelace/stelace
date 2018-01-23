/* global EmailHelperService, EmailLog, EmailTracking, EmailUtmService, LoggerService, MicroService, UrlService, User */

module.exports = {

    sendSimpleEmail: sendSimpleEmail,
    sendHtmlEmail: sendHtmlEmail,
    sendEmail: sendEmail,

    generateText: generateText,

    getTrackingStats: getTrackingStats

};

const _ = require('lodash');
const Promise = require('bluebird');
const fs         = require('fs');
const path       = require('path');
const moment     = require('moment');
const nodemailer = require('nodemailer');
const Handlebars = require('handlebars');
const cheerio    = require('cheerio');
const Sparkpost  = require('sparkpost');
const sparkpostClient = new Sparkpost(sails.config.sparkpost.apiKey);

Promise.promisifyAll(nodemailer);

registerHbsHelpers(Handlebars);

const templateCache = {};

/**
 * Send simple email
 * @param  {string} from - email
 * @param  {string} to - email
 * @param  {string} [subject]
 * @param  {string} [text]
 * @param  {string} [replyTo] - email
 */
async function sendSimpleEmail({
    from,
    to,
    subject,
    text,
    replyTo,
}) {
    if (!MicroService.isEmail(from)
     || !MicroService.isEmail(to)
     || (replyTo && !MicroService.isEmail(replyTo))
    ) {
        throw new Error('Invalid fields');
    }

    const config = sails.config.stelace.smtp;

    const smtpTransport = nodemailer.createTransport('SMTP', {
        host: config.host,
        port: config.port,
        auth: {
            user: config.user,
            pass: config.password,
        },
    });

    return await new Promise((resolve, reject) => {
        const params = {
            from,
            to,
            subject,
            text,
            replyTo,
        };

        smtpTransport.sendMail(params, err => {
            smtpTransport.close();
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

/**
 * Send HTML email
 * @param {string}   html
 * @param {string}   [text] - alternate version of html for not-supported mail client
 * @param {number}   [userId] - the receiver user id
 * @param {string}   fromEmail
 * @param {string}   [fromName]
 * @param {string}   toEmail
 * @param {string}   [toName]
 * @param {string}   [subject]
 * @param {string}   [replyTo]
 * @param {string[]} [tags = []]
 * @param {boolean}  [noCopyEmail = false]
 * @param {boolean}  [transactional = true]
 * @param {object}   [logger]
 */
async function sendHtmlEmail({
    html,
    text,
    userId,
    fromEmail,
    fromName,
    toEmail,
    toName,
    subject,
    replyTo,
    tags = [],
    noCopyEmail = false,
    transactional = true,
    logger,
}) {
    logger = logger || LoggerService.getLogger('app', {
        service: 'EmailService',
        action: 'sendEmail',
    });

    if (! fromEmail
     || ! toEmail
     || ! html
    ) {
        throw new Error("Invalid fields");
    }

    const debugEmail = sails.config.debugMail;
    const copyEmail = sails.config.copyMail;
    const enableTracking = !debugEmail;

    if (copyEmail && !MicroService.isEmail(copyEmail)) {
        throw new Error('Copy email is not a valid email');
    }

    const sendTags = _.clone(tags);

    if (!text) {
        text = generateText(html, ['.headerContainer', '.bodyContainer']);
    }

    const params = getSparkpostEmailConfig({
        html,
        text,
        fromEmail,
        fromName,
        toEmail,
        toName,
        subject,
        replyTo,
        tags: sendTags,
        debugEmail,
        transactional,
        enableOpenTracking: enableTracking,
        enableClickTracking: enableTracking,
    });

    if (sails.config.localEmailResult) {
        const filepath = getLocalEmailResultFilepath();
        fs.writeFileSync(filepath, html);
        return;
    }

    const { results: sparkpostResult } = await sparkpostClient.transmissions.send(params);

    const createAttrs = {
        userId,
        fromEmail,
        fromName,
        toEmail,
        toName,
        replyTo,
        subject,
        tags: sendTags,
        sentDate: moment().toISOString(),
        status: 'sent',
        sparkpostTransmissionId: sparkpostResult.id,
        html,
    };

    await EmailLog
        .create(createAttrs)
        .catch(err => {
            logger.error({ err }, 'EmailLog not created');
        });

    try {
        if (!debugEmail && copyEmail && !noCopyEmail) {
            const params = getSparkpostEmailConfig({
                html,
                text,
                fromEmail,
                fromName,
                toEmail: copyEmail,
                subject,
                replyTo,
                tags: sendTags.concat(['copy']),
                transactional,
                enableOpenTracking: false,
                enableClickTracking: false,
            });

            await sparkpostClient.transmissions.send(params);
        }
    } catch (e) {
        logger.error({ err: e }, 'Copy email failed');
    }
}

/**
 * Send email via template
 * @param  {string}   templateName
 * @param  {string}   specificTemplateName
 * @param  {string}   [text]
 * @param  {string}   subject
 * @param  {string}   [fromEmail]
 * @param  {string}   [fromName]
 * @param  {object}   toUser - fromEmail or toUser must be defined
 * @param  {string}   toEmail
 * @param  {string}   [toName]
 * @param  {string}   [replyTo]
 * @param  {object}   [data = {}]
 * @param  {string[]} [tags = []]
 * @param  {boolean}  [noCopyEmail = false]
 * @param  {boolean}  [transactional = true]
 * @param  {object}   [logger]
 */
async function sendEmail({
    templateName,
    specificTemplateName,
    text,
    subject,
    fromEmail,
    fromName,
    toUser,
    toEmail,
    toName,
    replyTo,
    data = {},
    noCopyEmail = false,
    transactional = true,
    tags = [],
    logger,
}) {
    logger = logger || LoggerService.getLogger('app', {
        service: 'EmailService',
        action: 'sendEmail',
    });

    const helloConfig = sails.config.stelace.hello;

    if (!fromEmail) {
        fromEmail = helloConfig.email;
        fromName = helloConfig.name;
    }
    toEmail = toEmail || (toUser && toUser.email);
    toName = toName || (toUser ? User.getName(toUser) : null);
    replyTo = replyTo || helloConfig.email;

    if (!templateName
     || !specificTemplateName
     || !toEmail
     || !subject
    ) {
        throw new Error('Invalid fields');
    }

    const debugEmail = sails.config.debugMail;
    const copyEmail = sails.config.copyMail;
    const enableTracking = !debugEmail;

    if (copyEmail && !MicroService.isEmail(copyEmail)) {
        throw new Error('Copy email is not a valid email');
    }

    const realTemplateName = getRealTemplateName(templateName, specificTemplateName);
    setUtmTagsToTemplateUrls(realTemplateName, data);
    if (data.authToken) {
        setAuthTokenToTemplateUrls(data.authToken, data);
    }

    const html = generateHtml(templateName, data);

    if (!text) {
        text = generateText(html, ['.headerContainer', '.bodyContainer']);
    }

    const sendTags = _.clone(tags);

    const params = getSparkpostEmailConfig({
        html,
        text,
        fromEmail,
        fromName,
        toEmail,
        toName,
        subject,
        replyTo,
        tags: sendTags,
        debugEmail,
        transactional,
        enableOpenTracking: true,
        enableClickTracking: enableTracking,
    });

    if (sails.config.localEmailResult) {
        const filepath = getLocalEmailResultFilepath(realTemplateName);
        fs.writeFileSync(filepath, html);
        return;
    }

    const { results: sparkpostResult } = await sparkpostClient.transmissions.send(params);

    const createAttrs = {
        userId: toUser && toUser.id,
        fromEmail,
        fromName,
        toEmail,
        toName,
        replyTo,
        templateName,
        specificTemplateName,
        subject,
        data,
        tags: sendTags,
        sentDate: moment().toISOString(),
        status: 'sent',
        sparkpostTransmissionId: sparkpostResult.id,
        html,
    };

    await EmailLog
        .create(createAttrs)
        .catch(err => {
            logger.error({ err }, 'EmailLog not created');
        });

    try {
        if (!debugEmail && copyEmail && !noCopyEmail) {
            const params = getSparkpostEmailConfig({
                html,
                text,
                fromEmail,
                fromName,
                toEmail: copyEmail,
                subject,
                replyTo,
                tags: sendTags.concat(['copy']),
                enableOpenTracking: false,
                enableClickTracking: false,
            });

            await sparkpostClient.transmissions.send(params);
        }
    } catch (e) {
        logger.error({ err: e }, 'Copy email failed');
    }
}

function generateText(html, selectors) {
    const $ = cheerio.load(html);

    let text = '';

    _.forEach(selectors, selector => {
        const $el = $(selector);
        if ($el.length) {
            const elText = $el.text();
            if (elText) {
                const trimmed = elText.trim();
                text += _generateText(trimmed) + '\n';
            }
        }
    });

    if (!text) {
        return;
    }

    return text.trim();
}

function _generateText(text) {
    if (!text) {
        return '';
    }

    let refinedText = '';
    const lines = text.split('\n');

    _.forEach(lines, line => {
        const trimmed = line.trim();
        if (trimmed) {
            refinedText += trimmed + '\n';
        }
    });

    return refinedText;
}

/**
 * Get tracking stats from email logs
 * @param  {object[]} emailLogs
 * @return {object}   hash[emailLogId] - hash indexed by email log id
 * @return {object}   hash[emailLogId].stats[eventType] - hash indexed by event types, the value is a number (nb of event types)
 * @return {object[]} hash[emailLogId].details - array of sorted events (details from aggregated stats data)
 */
async function getTrackingStats(emailLogs) {
    const mandrillMessagesIds = _.pluck(emailLogs, 'mandrillMessageId');
    const sparkpostTransmissionsIds = _.pluck(emailLogs, 'sparkpostTransmissionId');

    const emailTrackings = await EmailTracking
        .find({
            or: [
                { mandrillMessageId: mandrillMessagesIds },
                { sparkpostTransmissionId: sparkpostTransmissionsIds },
            ],
        })
        .sort('eventDate DESC');

    const mandrillHashMap = {};
    const sparkpostHashMap = {};

    _.forEach(emailLogs, emailLog => {
        if (emailLog.mandrillMessageId) {
            mandrillHashMap[emailLog.mandrillMessageId] = emailLog.id;
        } else if (emailLog.sparkpostTransmissionId) {
            sparkpostHashMap[emailLog.sparkpostTransmissionId] = emailLog.id;
        }
    });

    const trackingStats = _.reduce(emailLogs, (memo, emailLog) => {
        memo[emailLog.id] = {
            stats: {},
            details: [],
        };
        return memo;
    }, {});

    const exposedFields = [
        'createdDate',
        'eventType',
    ];

    _.forEach(emailTrackings, emailTracking => {
        let trackingStat;
        if (emailTracking.mandrillMessageId) {
            trackingStat = trackingStats[mandrillHashMap[emailTracking.mandrillMessageId]];
        } else if (emailTracking.sparkpostTransmissionId) {
            trackingStat = trackingStats[sparkpostHashMap[emailTracking.sparkpostTransmissionId]];
        }

        if (trackingStat) {
            trackingStat.stats[emailTracking.eventType] = (trackingStat.stats[emailTracking.eventType] || 0) + 1;
            trackingStat.details.push(_.pick(emailTracking, exposedFields));
        }
    });

    return trackingStats;
}

/**
 * Get sparkpot email config for send transmission
 * See: https://developers.sparkpost.com/api/transmissions.html
 * @param  {string}   html
 * @param  {string}   [text]
 * @param  {string}   fromEmail
 * @param  {string}   [fromName]
 * @param  {string}   toEmail
 * @param  {string}   [toName]
 * @param  {string}   [subject]
 * @param  {string}   [replyTo]
 * @param  {string[]} [tags = []]
 * @param  {string}   [debugEmail]
 * @param  {boolean}  [enableOpenTracking = false]
 * @param  {boolean}  [enableClickTracking = false]
 * @param  {boolean}  [transactional = true]
 * @param  {boolean}  [minifyHtml = true]
 *
 * @result {object}   sparkpost config
 */
function getSparkpostEmailConfig({
    html,
    text,
    fromEmail,
    fromName,
    toEmail,
    toName,
    subject,
    replyTo,
    tags = [],
    debugEmail,
    enableOpenTracking = false,
    enableClickTracking = false,
    transactional = true,
    minifyHtml = true,
}) {
    if (!html
     || (!fromEmail || !MicroService.isEmail(fromEmail))
     || (!toEmail || !MicroService.isEmail(toEmail))
     || (replyTo && !MicroService.isEmail(replyTo))
     || (debugEmail && !MicroService.isEmail(debugEmail))
    ) {
        throw new Error('Missing fields');
    }

    const options = {
        transactional,
        open_tracking: enableOpenTracking,
        click_tracking: enableClickTracking,
    };

    const content = {
        from: {
            name: fromName,
            email: fromEmail,
        },
        reply_to: replyTo,
        subject,
        html: minifyHtml ? EmailHelperService.minifyHtml(html) : html,
        text,
    };

    const to = {
        name: toName,
        email: toEmail,
    };

    if (debugEmail) {
        to.name = (to.name ? `${to.name} ` : '');
        to.name += `[origin: ${toEmail}]`;
        to.email = debugEmail;

        tags.push('debug');
    }

    const params = {
        options,
        content,
        recipients: [
            {
                address: to,
                tags,
            },
        ],
    };

    return params;
}

function getRealTemplateName(templateName, specificTemplateName) {
    if (templateName === "general-notification-template") {
        return specificTemplateName;
    }

    return templateName;
}

/**
 * Set UTM tags for exposed URLs specific to template data format
 * (custom data is not exposed : see filteredFields in EmailTemplateService)
 *
 * @param {string}   templateName
 * @param {object}   data             data object containing URLs
 */
function setUtmTagsToTemplateUrls(templateName, data) {
    _.forEach(data, (value, field) => {
        if (UrlService.isUrl(value)
         && UrlService.isStelaceAppUrl(value)
        ) {
            var utmTags = EmailUtmService.getUtmTags(templateName, field);
            data[field] = UrlService.setUtmTags(value, utmTags); // no override of custom data
        }
    });
}

function setAuthTokenToTemplateUrls(authToken, data) {
    _.forEach(data, (value, field) => {
        if (UrlService.isUrl(value)
         && UrlService.isStelaceAppUrl(value)
        ) {
            data[field] = UrlService.addQueryParams(value, { aut: authToken });
        }
    });
}

function registerHbsHelpers(Handlebars) {
    Handlebars.registerHelper('date', format => {
        return moment().format(format);
    });
}

function generateHtml(templateName, data) {
    let template = templateCache[templateName];

    if (!template) {
        const content = getTemplateContent(templateName);
        const compiledTemplate = Handlebars.compile(content);
        templateCache[templateName] = compiledTemplate;
        template = compiledTemplate;
    }

    return template(data);
}

function getTemplateContent(templateName) {
    const templatePath = path.join(__dirname, '../assets/emailsTemplates', templateName + '.html');

    try {
        return fs.readFileSync(templatePath, 'utf8');
    } catch (e) {
        throw new Error(`Template "${templateName}" does not exist`);
    }
}

function getLocalEmailResultFilepath(templateName) {
    const fileFolder = path.join(__dirname, '../../emailTests');
    const filename = new Date().toISOString() + (templateName ? '_' + templateName : '') + '.html';
    return path.join(fileFolder, filename);
}
