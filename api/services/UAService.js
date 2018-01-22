module.exports = {

    isMobile: isMobile,
    isOldBrowser: isOldBrowser,
    isBot: isBot,
    isUpgradeVersion: isUpgradeVersion

};

const _ = require('lodash');
var useragent = require('useragent');
var isbot     = require('isbot');

function isMobile(userAgent) {
    var parsedUserAgent = useragent.parse(userAgent);
    return parsedUserAgent.device.family !== "Other";
}

function isOldBrowser(userAgent) {
    var parsedUserAgent = useragent.parse(userAgent);
    var userAgentIs     = useragent.is(userAgent);
    var major = parseInt(parsedUserAgent.major, 10);
    var minor = parseInt(parsedUserAgent.minor, 10);

    if (isMobile(userAgent)
     || parsedUserAgent.family.toLowerCase() === "phantomjs") {
        return false;
    }

    if ((userAgentIs.firefox && major < 22)
     || (userAgentIs.safari && major < 6)
     || (userAgentIs.ie && major < 10)
     || (userAgentIs.opera && (major < 12 || (major === 12 && minor < 1)))
    ) {
        return true;
    }

    return false;
}

function isBot(userAgent, types) {
    var allTypes = [
        "search",
        "facebook",
        "linkedin",
        "twitter",
        "seo",
        "phantomjs"
    ];

    if (! types) {
        return isBotFromTypes(allTypes) || isbot(userAgent);
    } else {
        return isBotFromTypes(types);
    }



    function isBotFromTypes(types) {
        return _.reduce(types, (memo, type) => {
            memo = memo || isBotFromType(type);
            return memo;
        }, false);
    }

    function isBotFromType(type) {
        switch (type) {
            case "search":
                return isSearch();

            case "facebook":
                return isFacebook();

            case "linkedin":
                return isLinkedin();

            case "twitter":
                return isTwitter();

            case "seo":
                return isSEOCrawler();

            case "phantomjs":
                return isPhantom();

            default:
                return false;
        }
    }

    function isSearch() {
        var regex = /googlebot|crawl|slurp|bingbot/gi;
        return regex.test(userAgent);
    }

    function isFacebook() {
        var regex = /facebookexternalhit|facebot/gi;
        return regex.test(userAgent);
    }

    function isLinkedin() {
        var regex = /linkedinbot/gi;
        return regex.test(userAgent);
    }

    function isTwitter() {
        var regex = /twitterbot/gi;
        return regex.test(userAgent);
    }

    function isSEOCrawler() {
        var regex = /woobot|dotbot|rogerbot/gi;
        // Woorank, Moz
        return regex.test(userAgent);
    }

    function isPhantom() {
        var regex = /phantomjs/gi;
        return regex.test(userAgent);
    }
}

function isUpgradeVersion(newUA, oldUA) {
    var parsedNewUA = useragent.parse(newUA);
    var parsedOldUA = useragent.parse(oldUA);

    var newMajor = parseInt(parsedNewUA.major, 10);
    var newMinor = parseInt(parsedNewUA.minor, 10);
    var oldMajor = parseInt(parsedOldUA.major, 10);
    var oldMinor = parseInt(parsedOldUA.minor, 10);

    return parsedNewUA.family === parsedOldUA.family
        && (newMajor > oldMajor || (newMajor === oldMajor && newMinor >= oldMinor));
}
