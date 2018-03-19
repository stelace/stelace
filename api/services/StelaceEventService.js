/* global AppUrlService, IPService, TokenService, ToolsService, StelaceConfigService, StelaceEvent, StelaceSession, UAService, UrlService, Webhook */

module.exports = {

    createEvent: createEvent,

    getCurrentVersion: getCurrentVersion,
    isFromExternalUrl: isFromExternalUrl,
    getSessionId: getSessionId,
    setSessionId: setSessionId,
    unsetSession: unsetSession,
    isSessionExpired: isSessionExpired,
    isNewUser: isNewUser,
    isSessionReusable: isSessionReusable,
    skipSaving: skipSaving,
    extractParamsFromReq: extractParamsFromReq,
    extractParamsFromUrl: extractParamsFromUrl,
    extractListingId: extractListingId,
    extractBookingId: extractBookingId,
    extractFromData: extractFromData,
    extractUtmTags: extractUtmTags,
    setUtmTags: setUtmTags,
    getType: getType,
    getSessionChangeAttrs: getSessionChangeAttrs

};

var useragent   = require('useragent');
var moment      = require('moment');
var NodeCache   = require('node-cache');
var Url         = require('url');
var querystring = require('querystring');
var toSnakeCase = require('to-snake-case');
var UrlPattern  = require('url-pattern');
const request = require('request');
const _ = require('lodash');
const Promise = require('bluebird');

Promise.promisifyAll(request, { multiArgs: true });

var listingIdPatterns;
var bookingIdPatterns;

var sessionField = "sessionHash";

var SessionCache = new NodeCache({ stdTTL: 10 * 60 }); // 10 min

var utmFields = [
    "utmCampaign",
    "utmSource",
    "utmContent",
    "utmMedium",
    "utmTerm"
];
var startUtmFields;
var endUtmFields;

function getCurrentVersion() {
    return "0.3";
}

function isFromExternalUrl(url) {
    var parsedUrl = Url.parse(url || "");

    return !! (parsedUrl.host && parsedUrl.host !== AppUrlService.getAppDomainUrl());
}

// session by cookie
function getSessionId(req) {
    var sessionHash = req.signedCookies[sessionField];
    var sessionId = parseInt(sessionHash, 10);

    return ! isNaN(sessionId) ? sessionId : null;
}

// session by HTTP body
function getSessionParams(req) {
    return {
        sessionId: req.param("sessionId"),
        sessionToken: req.param("sessionToken")
    };
}

function setSessionId(res, sessionId) {
    res.cookie(sessionField, sessionId, {
        expires: moment().add(1, "y").toDate(),
        httpOnly: true,
        signed: true
    });
}

function unsetSession(res) {
    res.clearCookie(sessionField);
}

function isSessionExpired(currDate, prevDate) {
    var maxInactivityDuration = {
        d: 7
    };

    return prevDate < moment(currDate).subtract(maxInactivityDuration).toISOString();
}

function isNewUser(currUserId, prevUserId) {
    return currUserId && prevUserId && currUserId !== prevUserId;
}

/**
 * is session reusable
 * @param  {object} currState
 * @param  {string} currState.date
 * @param  {number} currState.userId
 * @param  {object} prevState
 * @param  {string} prevState.date
 * @param  {number} prevState.userId
 * @return {Boolean}
 */
function isSessionReusable(currState, prevState) {
    return ! isSessionExpired(currState.date, prevState.date)
        && ! isNewUser(currState.userId, prevState.userId);
}

function skipSaving(args) {
    var userAgent     = args.userAgent;
    var ip            = args.ip;
    var skipPrivateIp = typeof args.skipPrivateIp !== "undefined" ? args.skipPrivateIp : true;

    var isBot        = (userAgent && UAService.isBot(userAgent));
    var isPrivateIp  = (ip && skipPrivateIp && IPService.isPrivate(ip));

    return isBot || isPrivateIp;
}

function getUserInfo(req) {
    var originalUser   = TokenService.getOriginalUser(req);
    var originalUserId = originalUser && originalUser.id;
    var realUser       = req.user;
    var realUserId     = realUser && realUser.id;

    var userId;
    var loginAsUserId;

    if (originalUserId) {
        userId = originalUserId;
        if (originalUserId !== realUserId) {
            loginAsUserId = realUserId;
        }
    } else {
        userId = realUserId;
    }

    return {
        userId: userId,
        loginAsUserId: loginAsUserId
    };
}

function extractParamsFromReq(req) {
    var usersInfo = getUserInfo(req);
    var params    = req.allParams();

    return {
        sessionId: getSessionId(req),
        userId: usersInfo.userId,
        loginAsUserId: usersInfo.loginAsUserId,
        refererUrl: req.headers.referer,
        srcUrl: params.srcUrl || (sails.config.stelace.url + req.url),
        targetUrl: params.targetUrl,
        lang: req.headers["accept-language"],
        ip: req.ip,
        userAgent: req.headers["user-agent"]
    };
}

function extractParamsFromUrl(url) {
    var parsedUrl = Url.parse(url || "");

    var listingId    = extractListingId(url, parsedUrl);
    var bookingId = extractBookingId(url, parsedUrl);
    var utmTags   = extractUtmTags(url, parsedUrl);

    var params = _.extend({}, utmTags);

    if (listingId) {
        params.listingId = listingId;
    }
    if (bookingId) {
        params.bookingId = bookingId;
    }

    return params;
}

function extractListingId(url, parsedUrl) {
    parsedUrl = parsedUrl || Url.parse(url || "");
    var pathname = parsedUrl.pathname;

    if (! pathname) {
        return;
    }

    var listingViewField    = "/l/:slug";
    var myListingsViewField = "/my-listings/:id";

    var fields = [
        listingViewField,
        myListingsViewField
    ];

    if (! listingIdPatterns) {
        listingIdPatterns = _.reduce(fields, (memo, field) => {
            memo[field] = new UrlPattern(field);
            return memo;
        }, {});
    }

    return _.reduce(fields, (memo, field) => {
        if (memo !== null) {
            return memo;
        }

        var tokens = listingIdPatterns[field].match(pathname);

        if (tokens) {
            if (field === listingViewField) {
                return getListingIdByListingView(tokens);
            } else if (field === myListingsViewField) {
                return getSimpleId(tokens);
            }
        }

        return memo;
    }, null);
}

function getListingIdByListingView(tokens) {
    var slugId = _.last(tokens.slug.split("-"));
    slugId = parseInt(slugId, 10);
    if (! slugId || isNaN(slugId)) {
        return null;
    } else {
        return slugId;
    }
}

function getSimpleId(tokens) {
    var id = tokens.id;
    if (! id || isNaN(id)) {
        return null;
    } else {
        return id;
    }
}

function extractBookingId(url, parsedUrl) {
    parsedUrl = parsedUrl || Url.parse(url || "");
    var pathname = parsedUrl.pathname;

    if (! pathname) {
        return;
    }

    var bookingPaymentViewField      = "/booking-payment/:id";
    var bookingConfirmationViewField = "/booking-confirmation/:id";

    var fields = [
        bookingPaymentViewField,
        bookingConfirmationViewField
    ];

    if (! bookingIdPatterns) {
        bookingIdPatterns = _.reduce(fields, (memo, field) => {
            memo[field] = new UrlPattern(field);
            return memo;
        }, {});
    }

    return _.reduce(fields, (memo, field) => {
        if (memo !== null) {
            return memo;
        }

        var tokens = bookingIdPatterns[field].match(pathname);

        if (tokens) {
            if (field === bookingPaymentViewField
             || field === bookingConfirmationViewField
            ) {
                return getSimpleId(tokens);
            }
        }

        return memo;
    }, null);
}

function extractUtmTags(url, parsedUrl) {
    parsedUrl = parsedUrl || Url.parse(url || "");
    var query = parsedUrl.query;

    var params = (query ? querystring.parse(query) : {});

    return _.reduce(utmFields, (memo, field) => {
        if (params[field]) {
            memo[field] = params[field];
        } else {
            var snakeField = toSnakeCase(field);
            if (params[snakeField]) {
                memo[field] = params[snakeField];
            }
        }
        return memo;
    }, {});
}

function extractFromData(args) {
    if (! args.data) {
        return args;
    }

    var fields = [
        "userId",
        "targetUserId",
        "loginAsUserId",
        "defaultUserId",
        "defaultLoginAsUserId",
        "listingId",
        "tagsIds",
        "bookingId",
        "searchId",
        "type",
        "refererUrl",
        "srcUrl",
        "targetUrl",
        "width",
        "height"
    ];

    var data = _.cloneDeep(args.data);

    _.forEach(fields, field => {
        if (args[field] || ! data[field]) {
            return;
        }

        args[field] = data[field];
        delete data[field];
    });

    args.data = data;

    return args;
}

function isFromGoogleCpc(refererUrl, srcUrl) {
    return !! UrlService.getQueryParams(refererUrl).gclid
        || !! UrlService.getQueryParams(srcUrl).gclid;
}

/**
 * create event
 * @param  {object}   args
 * @param  {string}   args.label
 * @param  {object}   [args.req]
 * @param  {object}   [args.res]
 * @param  {number}   [args.userId]
 * @param  {number}   [args.targetUserId]
 * @param  {number}   [args.loginAsUserId]
 * @param  {number}   [args.defaultUserId]
 * @param  {number}   [args.defaultLoginAsUserId]
 * @param  {number}   [args.listingId]
 * @param  {number[]} [args.tagsIds]
 * @param  {number}   [args.bookingId]
 * @param  {number}   [args.searchId]
 * @param  {string}   [args.type]
 * @param  {string}   [args.refererUrl]
 * @param  {string}   [args.srcUrl]
 * @param  {string}   [args.targetUrl]
 * @param  {string}   [args.ip]
 * @param  {string}   [args.userAgent]
 * @param  {string}   [args.utmCampaign]
 * @param  {string}   [args.utmSource]
 * @param  {string}   [args.utmContent]
 * @param  {string}   [args.utmMedium]
 * @param  {string}   [args.utmTerm]
 * @param  {number}   [args.width]
 * @param  {number}   [args.height]
 * @param  {number}   [args.scrollPercent]
 * @param  {object}   [args.data]
 * @param  {boolean}  [args.resetUser]
 * @param  {string}   [args.version]
 * @param  {boolean}  [args.forceNewSession]
 * @param  {boolean}  [args.skipIfNoSession]
 * @param  {boolean}  [args.keepError]
 */
function createEvent(args) {
    var req = args.req;
    var res = args.res;

    var reqVars = req ? extractParamsFromReq(req) : {};
    args = extractFromData(args);

    var sessionId       = args.sessionId || reqVars.sessionId;
    var label           = args.label;
    var userId          = args.userId || reqVars.userId || args.defaultUserId;
    var targetUserId    = args.targetUserId;
    var listingId          = args.listingId;
    var tagsIds         = args.tagsIds;
    var bookingId       = args.bookingId;
    var searchId        = args.searchId;
    var loginAsUserId   = args.loginAsUserId || reqVars.loginAsUserId || args.defaultLoginAsUserId;
    var type            = (args.type !== "null" ? args.type : null); // use "null" because `type` variable name is generic
    var refererUrl      = args.refererUrl || reqVars.refererUrl;
    var srcUrl          = args.srcUrl || reqVars.srcUrl;
    var targetUrl       = args.targetUrl || reqVars.targetUrl;
    var lang            = args.lang || reqVars.lang;
    var ip              = args.ip || reqVars.ip;
    var userAgent       = args.userAgent || reqVars.userAgent;
    var width           = args.width;
    var height          = args.height;
    var scrollPercent   = args.scrollPercent;
    var data            = args.data || {};
    var resetUser       = args.resetUser;
    var version         = args.version || getCurrentVersion();
    var forceNewSession = args.forceNewSession;
    var skipIfNoSession = args.skipIfNoSession;
    var keepError       = args.keepError;
    var fromExternal    = isFromExternalUrl(refererUrl);
    var utmCampaign;
    var utmSource;
    var utmContent;
    var utmMedium;
    var utmTerm;

    var ua            = {};
    var ipInfo        = {};
    var sessionParams = {};

    var now = moment().toISOString();

    var defaultResult = {
        stelaceSession: null,
        stelaceEvent: null
    };

    var srcUrlParams = extractParamsFromUrl(srcUrl);

    if (isAtLeastOneSet(args, utmFields)) {
        utmCampaign = args.utmCampaign;
        utmSource   = args.utmSource;
        utmContent  = args.utmContent;
        utmMedium   = args.utmMedium;
        utmTerm     = args.utmTerm;
    } else if (isAtLeastOneSet(srcUrlParams, utmFields)) {
        utmCampaign = srcUrlParams.utmCampaign;
        utmSource   = srcUrlParams.utmSource;
        utmContent  = srcUrlParams.utmContent;
        utmMedium   = srcUrlParams.utmMedium;
        utmTerm     = srcUrlParams.utmTerm;
    } else if (isFromGoogleCpc(refererUrl, srcUrl)) {
        utmMedium = "cpc";
        utmSource = "google";
    }

    if (! listingId) {
        listingId = srcUrlParams.listingId;
    }
    if (! bookingId) {
        bookingId = srcUrlParams.bookingId;
    }
    if (! type && label) {
        type = getType(label);
    }
    if (targetUrl) {
        targetUrl = convertToAbsUrl(targetUrl);
    }

    if (loginAsUserId === userId) {
        loginAsUserId = null;
    }

    return Promise.coroutine(function* () {
        if (! label) {
            throw new Error("Missing label");
        }

        const active = yield StelaceConfigService.isFeatureActive('EVENTS');
        if (!active) {
            return defaultResult;
        }

        var skip = skipSaving({
            userAgent: userAgent,
            ip: ip,
            skipPrivateIp: sails.config.environment === "production"
        });

        if (skip) {
            return defaultResult;
        }

        if (userAgent) {
            var parsedUserAgent = useragent.parse(userAgent);

            ua.os      = parsedUserAgent.os.toString();
            ua.browser = parsedUserAgent.toAgent();
            ua.device  = parsedUserAgent.device.toString();
        }

        if (ip) {
            ipInfo = yield IPService.getInfo(ip);
        }

        if (forceNewSession) {
            sessionId = null;
        } else {
            if (! sessionId) {
                sessionParams = getSessionParams(req);
            }
        }

        var sessionInfo = yield getSessionInfo(sessionId, sessionParams);
        var stelaceSession = sessionInfo.stelaceSession;

        if (stelaceSession) {
            var currState = {
                date: moment().toISOString(),
                userId: userId
            };
            var prevState = {
                date: stelaceSession.lastEventDate,
                userId: stelaceSession.userId
            };

            if (! isSessionReusable(currState, prevState)) {
                stelaceSession = null;
            }
        }

        if (stelaceSession) {
            stelaceSession = yield updateSession(stelaceSession);
        } else {
            if (skipIfNoSession) {
                return defaultResult;
            }

            stelaceSession = yield createNewSession();

            if (res) {
                setSessionId(res, stelaceSession.id);
            }
        }

        // useful for logout
        if (sessionInfo.resetUser) {
            userId        = null;
            loginAsUserId = null;
        } else if (! userId && ! loginAsUserId) {
            userId        = sessionInfo.userId;
            loginAsUserId = sessionInfo.loginAsUserId;
        }

        // caching before the creation event to avoid racing with the following request
        sessionInfo.stelaceSession = stelaceSession;
        sessionInfo.userId          = userId;
        sessionInfo.loginAsUserId   = loginAsUserId;
        sessionInfo.resetUser       = resetUser;
        SessionCache.set(stelaceSession.id, sessionInfo);

        var stelaceEvent = yield _createEvent(stelaceSession.id);

        triggerWebhooks(stelaceEvent);

        return {
            stelaceSession: stelaceSession,
            stelaceEvent: stelaceEvent
        };
    })()
    .catch(err => {
        if (keepError) {
            throw err;
        } else {
            return defaultResult;
        }
    });



    function createNewSession() {
        return StelaceSession.create({
            lastEventDate: now,
            refererUrl: refererUrl,
            userId: userId,
            ip: ip,
            lang: lang,
            country: ipInfo.country,
            region: ipInfo.region,
            city: ipInfo.city,
            userAgent: userAgent,
            os: ua.os,
            browser: ua.browser,
            device: ua.device,
            startUtmCampaign: utmCampaign,
            startUtmSource: utmSource,
            startUtmContent: utmContent,
            startUtmMedium: utmMedium,
            startUtmTerm: utmTerm,
            width: width,
            height: height
        });
    }

    function updateSession(stelaceSession) {
        var updateAttrs = getSessionChangeAttrs(stelaceSession, {
            date: now,
            utmCampaign: utmCampaign,
            utmSource: utmSource,
            utmContent: utmContent,
            utmMedium: utmMedium,
            utmTerm: utmTerm,
            refererUrl: refererUrl,
            userId: userId,
            ip: ip,
            country: ipInfo.country,
            region: ipInfo.region,
            city: ipInfo.city,
            lang: lang,
            userAgent: userAgent,
            os: ua.os,
            browser: ua.browser,
            device: ua.device,
            width: width,
            height: height
        });

        return StelaceSession
            .updateOne(stelaceSession.id, updateAttrs)
            .catch(err => {
                // if no stelace session found, remove from caching
                if (err.message && err.message === "Update one - not found") {
                    SessionCache.set(stelaceSession.id, null);
                }
                throw err;
            });
    }

    function _createEvent(sessionId) {
        return StelaceEvent.create({
            label: label,
            sessionId: sessionId,
            userId: userId,
            targetUserId: targetUserId,
            listingId: listingId,
            tagsIds: tagsIds,
            bookingId: bookingId,
            searchId: searchId,
            loginAsUserId: loginAsUserId,
            fromExternal: fromExternal,
            type: type,
            refererUrl: refererUrl,
            srcUrl: srcUrl,
            targetUrl: targetUrl,
            ip: ip,
            lang: lang,
            country: ipInfo.country,
            region: ipInfo.region,
            city: ipInfo.city,
            userAgent: userAgent,
            os: ua.os,
            browser: ua.browser,
            device: ua.device,
            utmCampaign: utmCampaign,
            utmSource: utmSource,
            utmContent: utmContent,
            utmMedium: utmMedium,
            utmTerm: utmTerm,
            scrollPercent: scrollPercent,
            data: data,
            resetUser: resetUser,
            version: version
        });
    }

    async function triggerWebhooks(stelaceEvent) {
        if (stelaceEvent.type !== 'core') {
            return;
        }

        try {
            const webhooks = await Webhook.find();
            const webhooksUrls = _.pluck(webhooks, 'url');

            await Promise.map(webhooksUrls, url => {
                const options = {
                    url,
                    headers: {
                        'x-webhook-source': 'stelace',
                    },
                    body: {
                        events: [StelaceEvent.expose(stelaceEvent, 'api')],
                    },
                    json: true
                }

                return request.postAsync(url, options);
            });
        } catch (err) {
            // do nothing
        }
    }
}

function convertToAbsUrl(url) {
    if (typeof url !== "string") {
        return url;
    }

    var parsedUrl = Url.parse(url);

    if (! parsedUrl.host) {
        var isSlash = (parsedUrl.href.slice(0, 1) === "/");
        return sails.config.stelace.url + (isSlash ? parsedUrl.href : "/" + parsedUrl.href);
    } else {
        return url;
    }
}

function getSessionInfo(sessionId, sessionParams) {
    return Promise.coroutine(function* () {
        var checkToken = false;

        if (! sessionId) {
            if (! sessionParams.sessionId || ! sessionParams.sessionToken) {
                return {};
            } else {
                // when use session params from HTTP body, check token
                checkToken = true;
            }
        }

        var sessionInfo = SessionCache.get(sessionId) || {};

        if (sessionInfo && typeof sessionInfo.stelaceSession !== "undefined") {
            return sessionInfo;
        } else {
            var results = yield Promise.props({
                stelaceSession: StelaceSession.findOne({ id: sessionId }),
                stelaceEvent: StelaceEvent
                    .find({ sessionId: sessionId })
                    .sort('createdDate DESC')
                    .limit(1)
                    .then(events => events[0]),
            });

            var stelaceSession = results.stelaceSession;
            var stelaceEvent   = results.stelaceEvent;

            if (stelaceSession
             && checkToken
             && stelaceSession.token !== sessionParams.sessionToken
            ) {
                return sessionInfo;
            }

            sessionInfo = {
                stelaceSession: stelaceSession
            };

            if (stelaceEvent) {
                sessionInfo.userId        = stelaceEvent.userId;
                sessionInfo.loginAsUserId = stelaceEvent.loginAsUserId;
                sessionInfo.resetUser     = stelaceEvent.resetUser;
            }

            return sessionInfo;
        }
    })();
}

function initUtmTags() {
    if (startUtmFields && endUtmFields) {
        return;
    }

    startUtmFields = _.map(utmFields, field => setUtmField(field, "start"));
    endUtmFields   = _.map(utmFields, field => setUtmField(field, "end"));
}

function setUtmTags(stelaceSession, utmTags, updateAttrs) {
    if (isAtLeastOneSet(utmTags, utmFields)) {
        initUtmTags();

        var startFields = _.pick(stelaceSession, startUtmFields);

        if (! isAtLeastOneSet(stelaceSession, startUtmFields)) {
            _.forEach(utmFields, field => {
                updateAttrs[setUtmField(field, "start")] = utmTags[field];
            });
        } else {
            var isSame = _.reduce(utmFields, (memo, field) => {
                var prev = startFields[setUtmField(field, "start")];
                var curr = utmTags[field];

                if (! prev && ! curr) {
                    return memo;
                } else {
                    return memo && prev === curr;
                }
            }, true);

            if (! isSame
             || (isSame && isAtLeastOneSet(stelaceSession, endUtmFields))
            ) {
                _.forEach(utmFields, field => {
                    updateAttrs[setUtmField(field, "end")] = utmTags[field];
                });
            }
        }
    }
}

function getType(label) {
    var lastWord = _.last(label.split(" ")).toLowerCase();

    if (lastWord === "click") {
        return "ui";
    } else if (lastWord === "view") {
        return "view";
    } else {
        return;
    }
}

function setUtmField(field, type) {
    return type + ToolsService.capitalizeFirstLetter(field);
}

function isAtLeastOneSet(model, fields) {
    return _.reduce(fields, (memo, field) => {
        if (model[field]) {
            memo = memo || true;
        }
        return memo;
    }, false);
}

/**
 * get session change
 * @param  {object} stelaceSession
 * @param  {object} args
 * @param  {string} args.date
 * @param  {string} args.utmCampaign
 * @param  {string} args.utmSource
 * @param  {string} args.utmContent
 * @param  {string} args.utmMedium
 * @param  {string} args.utmTerm
 * @param  {string} args.refererUrl
 * @param  {number} args.userId
 * @param  {string} args.ip
 * @param  {string} args.country
 * @param  {string} args.region
 * @param  {string} args.city
 * @param  {string} args.lang
 * @param  {string} args.userAgent
 * @param  {string} args.os
 * @param  {string} args.browser
 * @param  {string} args.device
 * @param  {number} args.width
 * @param  {number} args.height
 * @return {object}
 */
function getSessionChangeAttrs(stelaceSession, args) {
    var updateAttrs = {
        lastEventDate: args.date
    };

    setUtmTags(stelaceSession, {
        utmCampaign: args.utmCampaign,
        utmSource: args.utmSource,
        utmContent: args.utmContent,
        utmMedium: args.utmMedium,
        utmTerm: args.utmTerm
    }, updateAttrs);

    if (! stelaceSession.refererUrl) {
        updateAttrs.refererUrl = args.refererUrl;
    }

    if (! stelaceSession.userId) {
        updateAttrs.userId = args.userId;
    }

    if (! stelaceSession.ip) {
        updateAttrs.ip      = args.ip;
        updateAttrs.country = args.country;
        updateAttrs.region  = args.region;
        updateAttrs.city    = args.city;
    }

    if (! stelaceSession.lang) {
        updateAttrs.lang = args.lang;
    }

    if (! stelaceSession.userAgent) {
        updateAttrs.userAgent = args.userAgent;
        updateAttrs.os        = args.os;
        updateAttrs.browser   = args.browser;
        updateAttrs.device    = args.device;
    }

    if (! stelaceSession.width && ! stelaceSession.height) {
        updateAttrs.width  = args.width;
        updateAttrs.height = args.height;
    }

    return updateAttrs;
}
