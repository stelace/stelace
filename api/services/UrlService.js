module.exports = {

    isUrl: isUrl,
    setUtmTags: setUtmTags,
    isStelaceAppUrl: isStelaceAppUrl,
    getQueryParams: getQueryParams,
    addQueryParams: addQueryParams

};

var Url         = require('url');
var querystring = require('querystring');
var toSnakeCase = require('to-snake-case');
var appendQuery = require('append-query');

var utmFields = [
    "utmSource",
    "utmMedium",
    "utmCampaign",
    "utmContent",
    "utmTerm"
];
var excludedUrlPathPrefixes = [
    "/api",
    "/assets"
];

function isUrl(value) {
    if (! value || typeof value !== "string") {
        return false;
    }

    var parsedUrl = Url.parse(value);
    return !! (parsedUrl.protocol && parsedUrl.hostname);
}

/**
 * set utm tags
 * @param {string}  url
 * @param {object}  args
 * @param {string}  [args.utmSource]
 * @param {string}  [args.utmMedium]
 * @param {string}  [args.utmCampaign]
 * @param {string}  [args.utmContent]
 * @param {string}  [args.utmTerm]
 * @param {boolean} [override = false]
 * @return {string} url with utm tags
 */
function setUtmTags(url, args, override) {
    if (typeof url !== "string") {
        return url;
    }

    var utmTags = _.pick(args, utmFields);

    if (_.isEmpty(utmTags)) {
        return url;
    }

    var parsedUrl   = Url.parse(url);
    var parsedQuery = parsedUrl.query ? querystring.parse(parsedUrl.query) : {};

    var newQuery = _.reduce(utmFields, (memo, field) => {
        var snakeField = toSnakeCase(field);

        if (utmTags[field]) {
            if (! memo[snakeField]
             || (memo[snakeField] && override)
            ) {
                memo[snakeField] = utmTags[field];
            }
        }
        return memo;
    }, parsedQuery);

    var newQueryStr = querystring.stringify(newQuery);

    var pathname = parsedUrl.pathname || "";
    if (pathname === "/" && ! newQueryStr && ! parsedUrl.hash) {
        pathname = "";
    }

    return parsedUrl.protocol + "//"
        + parsedUrl.host
        + pathname
        + (newQueryStr ? "?" + newQueryStr : "")
        + (parsedUrl.hash || "");
}

function isStelaceAppUrl(url) {
    var pathname = Url.parse(url).pathname;

    if (! _.includes(url, sails.config.stelace.url)) {
        return false;
    }

    return _.reduce(excludedUrlPathPrefixes, (memo, value) => {
        if (_.startsWith(pathname, value)) {
            memo = memo && false;
        }
        return memo;
    }, true);
}

function getQueryParams(url) {
    if (typeof url !== "string") {
        return {};
    }

    var parsedUrl = Url.parse(url || "");
    var query     = parsedUrl.query;
    var params    = (query ? querystring.parse(query) : {});

    return params;
}

function addQueryParams(url, query) {
    return appendQuery(url, query);
}
