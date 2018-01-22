/* global EmailHelperService */

module.exports = getConfig;

const _ = require('lodash');

/**
 * get config
 * @param  {object} args
 * @param  {object} args.user
 * @param  {string} [args.firstname]
 * @param  {string} [args.email]
 * @return {object}
 */
function getConfig(args) {
    var templateName = "";
    var data         = getData(args);
    // Appropriate UTM tags for specific data (e.g. ctaUrl) can be set in EmailUtmService config
    // Custom getData variables ending with hrl/link/href (case-insensitive) are automatically tagged
    // (except for static resources)
    data = EmailHelperService.setUtmTags(templateName, data);

    return {
        specificTemplateName: templateName,
        user: data.user,
        email: data.email,
        templateTags: [],
        // replyTo: getReplyTo(data), // optional
        subject: getSubject(data),
        mainTitle: getMainTitle(data),
        previewContent: getPreviewContent(data),
        trailingContact: getTrailingContact(data),
        leadingContent: getLeadingContent(data),
        notificationImageAlt: getNotificationImageAlt(data),
        notificationImageUrl: getNotificationImageUrl(data),
        notificationImageHref: getNotificationImageHref(data),
        notificationImageWidth: getNotificationImageWidth(data),
        notificationImageMaxWidth: getNotificationImageMaxWidth(data),
        notificationImageCustomStyles: getNotificationImageCustomStyles(data),
        content: getContent(data),
        ctaButtonText: getCtaButtonText(data),
        ctaUrl: getCtaUrl(data),
        trailingContent: getTrailingContent(data),
        featured: getFeatured(data),
        featuredImageUrl: getFeaturedImageUrl(data),
        featuredImageAlt: getFeaturedImageAlt(data),
        featuredImageHref: getFeaturedImageHref(data),
        featuredTitle: getFeaturedTitle(data),
        featuredContent: getFeaturedContent(data),
        postFeaturedContent: getPostFeaturedContent(data),
        customGoodbye: getCustomGoodBye(data),
        noSocialBlock: getNoSocialBlock(data),
        footerContent: getFooterContent(data)
    };
}

function getData(args) {
    var fields = [];

    var data = _.pick(args, fields);
    // custom data to tag with UTM must be defined here with url/link/href suffix
    // e.g. data.customLink = ...

    return data;
}

// function getReplyTo() {
// }

function getSubject() {
    return;
}

function getMainTitle() {
    return;
}

function getPreviewContent() {
    return;
}

function getTrailingContact() {
    return;
}

function getLeadingContent() {
    return;
}

function getNotificationImageAlt() {
    return;
}

function getNotificationImageUrl() {
    return;
}

function getNotificationImageHref() {
    return;
}

function getNotificationImageWidth() {
    return;
}

function getNotificationImageMaxWidth() {
    return;
}

function getNotificationImageCustomStyles() {
    return;
}

function getContent() {
    return;
}

function getCtaButtonText() {
    return;
}

function getCtaUrl() {
    return;
}

function getTrailingContent() {
    return;
}

function getFeatured() {
    return;
}

function getFeaturedImageUrl() {
    return;
}

function getFeaturedImageAlt() {
    return;
}

function getFeaturedImageHref() {
    return;
}

function getFeaturedTitle() {
    return;
}

function getFeaturedContent() {
    return;
}

function getPostFeaturedContent() {
    return;
}

function getCustomGoodBye() {
    return;
}

function getNoSocialBlock() {
    return;
}

function getFooterContent() {
    return;
}
