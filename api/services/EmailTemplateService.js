/* global EmailService, EmailHelperService */

module.exports = {

    sendGeneralNotificationEmail,
    sendEmailTemplate,

};

const _ = require('lodash');

const general = {
    filteredFields: [
        "mainTitle",
        "trailingContact",
        "previewContent",
        "leadingContent",
        "notificationImageAlt",
        "notificationImageUrl",
        "notificationImageHref",
        "notificationImageWidth",
        "notificationImageMaxWidth",
        "notificationImageCustomStyles",
        "content",
        "ctaButtonText",
        "ctaUrl",
        "trailingContent",
        "featured",
        "featuredImageUrl",
        "featuredImageAlt",
        "featuredImageHref",
        "featuredTitle",
        "featuredContent",
        "postFeaturedContent",
        "customGoodbye",
        "noSocialBlock",
        "footerContent"
    ],
    userFields: [
        "id",
        "firstname",
        "email"
    ],
    notificationFields: [
        "notificationImageAlt",
        "notificationImageUrl",
        "notificationImageHref",
        "notificationImageWidth",
        "notificationImageMaxWidth",
        "notificationImageCustomStyles"
    ],
    featuredFields: [
        "featured",
        "featuredImageUrl",
        "featuredImageAlt",
        "featuredImageHref",
        "featuredTitle",
        "featuredContent"
    ]
};

/**
 * send general notification email
 * @param {object}   args
 * @param {object}   args.user                          user or email must be required
 * @param {string}   args.email                         user or email must be required
 * @param {string[]} args.templateTags                  email tagging
 * @param {string}   [args.mainTitle]                   can be HTML
 * @param {string}   [args.specificTemplateName]        useful to differentiate from other general template use
 * @param {string}   [args.replyTo]                     Reply-To email header
 * @param {string}   args.subject                       email subject
 * @param {string}   [args.previewContent]              preview for mobile email client
 * @param {string}   [args.leadingContent]              can be HTML
 * @param {string}   [args.notificationImageUrl]        image source
 * @param {string}   [args.notificationImageAlt]        image alt
 * @param {string}   [args.notificationImageHref]       image link
 * @param {string}   [args.notificationImageWidth]      image width (required if notificationImageUrl is defined)
 * @param {string}   [args.notificationImageMaxWidth]   image max width (required if notificationImageUrl is defined)
 * @param {string}   [args.content]                     can be HTML
 * @param {string}   [args.ctaButtonText]               button call to action
 * @param {string}   [args.ctaUrl]                      button link (required if ctaButtonText is defined)
 * @param {string}   [args.trailingContent]             can be HTML
 * @param {boolean}  [args.featured = false]            enable feature section
 * @param {string}   [args.featuredImageUrl]            feature image source
 * @param {string}   [args.featuredImageAlt]            feature image alt
 * @param {string}   [args.featuredImageHref]           feature image link
 * @param {string}   [args.featuredTitle]               feature title
 * @param {string}   [args.featuredContent]             can be HTML
 * @param {string}   [args.customGoodBye]               can be HTML
 * @param {boolean}  [args.noSocialBlock = false]       display social icons
 * @param {string}   [args.footerContent]               can be HTML
 * @param {boolean}  [args.noCopyEmail]                 force no copy of this email
 * @param {boolean}  [args.transactional]               is transaction email (false for newsletter)
 */
function sendGeneralNotificationEmail(args) {
    args = args || {};
    const templateTags  = args.templateTags || [];
    const user          = args.user;
    const email         = args.email;
    const replyTo       = args.replyTo;
    const noCopyEmail   = args.noCopyEmail;
    const transactional = args.transactional;
    let subject         = args.subject;

    let data = _.pick(args, general.filteredFields);
    data = omitUnusedFields(data);

    data = _.reduce(data, (memo, value, key) => {
        memo[key] = EmailHelperService.minifyHtml(value);
        return memo;
    }, {});

    subject = EmailHelperService.minifyHtml(subject);

    return EmailService
        .sendEmail({
            templateName: "general-notification-template",
            specificTemplateName: args.specificTemplateName || "general-notification-template",
            toUser: _.pick(user, general.userFields),
            toEmail: email,
            replyTo: replyTo,
            subject: subject,
            data: data,
            tags: templateTags,
            noCopyEmail: noCopyEmail,
            transactional: transactional,
        });
}

function omitUnusedFields(data) {
    let omitFields = [];

    if (! data.notificationImageUrl) {
        omitFields = omitFields.concat(general.notificationFields);
    }
    if (! data.featured) {
        omitFields = omitFields.concat(general.featuredFields);
    }

    if (! omitFields.length) {
        return data;
    } else {
        return _.omit(data, omitFields);
    }
}

async function sendEmailTemplate(/* templateName, args */) {
    // TODO: replace with real templates
    await Promise.resolve();
}
