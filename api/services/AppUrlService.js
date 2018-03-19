/* global Media */

module.exports = {

    getAppUrl: getAppUrl,
    getAppDomainUrl: getAppDomainUrl,
    getUrl: getUrl

};

const querystring = require('querystring');
const Url         = require('url');
const _ = require('lodash');

let appUrl;
let appDomain;

var urlTypes = {
    profile: getProfileUrl,
    userProfile: getUserProfileUrl,
    friendProfile: getFriendProfileUrl,
    listingSearch: getListingSearchUrl,
    myListings: getMyListingsUrl,
    invite: getInviteUrl,
    listingNew: getListingNewUrl,
    listing: getListingUrl,
    conversation: getConversationUrl,
    bookmarkUnsubscribe: getBookmarkUnsubscribeUrl,
    recoveryPassword: getRecoveryPasswordUrl,
    emailCheck: getEmailCheckUrl,
    defaultListingImage: getDefaultListingImageUrl,
    media: getMediaUrl,

    help: getHelpUrl,
    terms: getTermsUrl,
};

function getAppUrl() {
    if (!appUrl) {
        appUrl = sails.config.stelace.url;
    }
    return appUrl;
}

function getAppDomainUrl() {
    if (appDomain) return appDomain;

    const appUrl = getAppUrl();
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
    const appUrl = getAppUrl();

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

function getListingSearchUrl(params) {
    var str = `/s`;

    if (typeof params === "object") {
        str += `?${querystring.stringify(params)}`;
    }

    return str;
}

function getMyListingsUrl() {
    return `/my-listings`;
}

function getInviteUrl() {
    return `/invite`;
}

function getListingNewUrl() {
    return `/l/n`;
}

function getListingUrl(listing) {
    return `/l/${listing.nameURLSafe}-${listing.id}`;
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

function getDefaultListingImageUrl() {
    return Media.getDefaultListingImageUrl();
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
