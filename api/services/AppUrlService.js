/* global Media */

module.exports = {

    getAppUrl: getAppUrl,
    getAppDomainUrl: getAppDomainUrl,
    getUrl: getUrl

};

const querystring = require('querystring');
const Url         = require('url');

var appUrl = sails.config.stelace.url;
var appDomain;

var urlTypes = {
    profile: getProfileUrl,
    userProfile: getUserProfileUrl,
    friendProfile: getFriendProfileUrl,
    itemSearch: getItemSearchUrl,
    myItems: getMyItemsUrl,
    invite: getInviteUrl,
    itemNew: getItemNewUrl,
    item: getItemUrl,
    conversation: getConversationUrl,
    bookmarkUnsubscribe: getBookmarkUnsubscribeUrl,
    recoveryPassword: getRecoveryPasswordUrl,
    emailCheck: getEmailCheckUrl,
    defaultItemImage: getDefaultItemImageUrl,
    media: getMediaUrl,

    help: getHelpUrl,
    terms: getTermsUrl,
};

function getAppUrl() {
    return appUrl;
}

function getAppDomainUrl() {
    if (appDomain) return appDomain;

    const parsedUrl = Url.parse(appUrl);
    appDomain = parsedUrl.host;

    return appDomain;
}

/**
 * get url
 * @param  {string}    name            url name
 * @param  {any|any[]} urlData         if multiple data, provide an array
 * @param  {object}    args
 * @param  {boolean}   args.domain     if true, add domain
 * @param  {boolean}   args.protocol   if true, add protocol
 * @return {string}
 */
function getUrl(name, urlData, args) {
    args = args || {};

    args.domain   = (typeof args.domain !== "undefined") ? args.domain : true;
    args.protocol = (typeof args.protocol !== "undefined") ? args.protocol : true;

    var fn = urlTypes[name];

    if (typeof fn !== "function") {
        throw new Error("Bad url name");
    }

    var str;

    if (_.isArray(urlData)) {
        str = fn.apply(null, urlData);
    } else {
        str = fn(urlData);
    }

    var hasDomain = (str.slice(0, 1) !== "/");

    if (! hasDomain && args.domain) {
        var prefix;

        if (args.protocol) {
            prefix = appUrl;
        } else {
            prefix = appDomain;
        }

        str = `${prefix}${str}`;
    }

    return str;
}



function getProfileUrl() {
    return `/account`;
}

function getUserProfileUrl(user) {
    return `/user/${user.id}`;
}

function getFriendProfileUrl(user, source) {
    var str = `/friend/${user.id}`;

    if (source) {
        str += `?s=${source}`;
    }

    return str;
}

function getItemSearchUrl(params) {
    var str = `/s`;

    if (typeof params === "object") {
        str += `?${querystring.stringify(params)}`;
    }

    return str;
}

function getMyItemsUrl() {
    return `/my-items`;
}

function getInviteUrl() {
    return `/invite`;
}

function getItemNewUrl() {
    return `/item/new`;
}

function getItemUrl(item) {
    return `/item/${item.nameURLSafe}-${item.id}`;
}

function getConversationUrl(conversation) {
    return `/inbox/${conversation.id}`;
}

function getBookmarkUnsubscribeUrl(bookmark) {
    return `/api/bookmark/${bookmark.id}/destroy?t=${bookmark.token}`;
}

function getRecoveryPasswordUrl(token) {
    return `/recovery-password/${token.id}/${token.value}`;
}

function getEmailCheckUrl(token, firstCheck) {
    var str = `/email-check?i=${token.id}&t=${token.value}`;

    if (firstCheck) {
        str += `&f=1`;
    }

    return str;
}

function getDefaultItemImageUrl() {
    return Media.getDefaultItemImageUrl();
}

function getMediaUrl(media, args) {
    return Media.getUrl(media, args);
}

function getHelpUrl(questionId) {
    return `/help${ questionId ? "#" + questionId : ""}`;
}

function getTermsUrl() {
    return `/terms`;
}
