/* global GeneratorService, Token, TokenService, UAService, User */

module.exports = {

    isValidBearerToken: isValidBearerToken,
    createAuthToken: createAuthToken,
    isValidFormatAuthToken: isValidFormatAuthToken,
    populateReqAuthToken: populateReqAuthToken,
    isValidToken: isValidToken,
    checkAuthToken: checkAuthToken,
    getSecret: getSecret,
    isRole: isRole,
    getOriginalUser: getOriginalUser,
    getIncomeReportTokenName: getIncomeReportTokenName,
    getIncomeReportToken: getIncomeReportToken,
    getUrlSafeToken: getUrlSafeToken,

};

var CryptoJS = require('crypto-js');
var jwt      = require('jsonwebtoken');
var moment   = require('moment');
const _ = require('lodash');
const Promise = require('bluebird');
const createError = require('http-errors');

function isValidBearerToken(token) {
    if (typeof token !== "string") {
        return false;
    }

    var tokenType    = token.substring(0, 7);
    var tokenContent = token.substring(7);

    if (tokenType !== "Bearer ") {
        return false;
    }

    return tokenContent;
}

function createAuthToken(user, data) {
    data = data || {};

    var secret               = sails.config.stelace.token.authSecret;
    var forceRefreshInHours  = sails.config.stelace.token.forceRefreshInHours;
    var authExpirationInDays = sails.config.stelace.token.authExpirationInDays;

    var userAgent   = data.userAgent || "Unknown useragent";
    var loggedAt    = parseInt(moment().format("X"), 10);
    var toRefreshAt = parseInt(moment().add(forceRefreshInHours, "h").format("X"), 10);

    delete data.userAgent;

    var encodingToken = _.defaults(data, {
        loggedAt: loggedAt,
        toRefreshAt: toRefreshAt,
        userId: user.id,
        role: user.role
    });

    encodingToken.s = getSecret(userAgent);

    var token = jwt.sign(encodingToken, secret, {
        expiresIn: authExpirationInDays * 24 * 3600
    });

    return token;
}

function isValidFormatAuthToken(token) {
    if (token.iat
     && token.exp
     && token.loggedAt
     && token.toRefreshAt
     && token.s
     && token.userId
    ) {
        return true;
    } else {
        return false;
    }
}

function populateReqAuthToken(req, decodedToken, rawToken) {
    req.authTokenRaw = rawToken;
    req.authToken    = decodedToken;

    req.user = {
        id: decodedToken.userId,
        role: decodedToken.role
    };
    req.user.hasSameId = function (id) {
        return User.hasSameId(req.user, id);
    };
}

function isValidToken(token, userAgent) {
    if (! token.s
     || ! userAgent
    ) {
        return false;
    }

    var secret;

    try {
        secret = JSON.parse(
            CryptoJS.AES.decrypt(token.s, sails.config.stelace.secret).toString(CryptoJS.enc.Utf8)
        );
    } catch (e) {
        return false;
    }

    if (! secret.version) {
        return false;
    }

    if (secret.version === "v1") {
        return UAService.isUpgradeVersion(userAgent, secret.userAgent);
    } else {
        return false;
    }
}

/**
 * checkAuthToken
 * @param  {object}  args
 * @param  {object}  args.req
 * @param  {string}  args.token
 * @param  {string}  [args.userAgent]
 * @param  {string}  [args.secret]
 * @param  {number}  [args.authExpirationInDays]
 * @param  {boolean} [args.isOptional = false]
 * @param  {boolean} [args.isRefreshing = false]
 * @return {Promise<object>} decoded token
 */
function checkAuthToken(args) {
    var req                  = args.req;
    var token                = args.token;
    var userAgent            = args.userAgent || req.headers["user-agent"] || "Unknown useragent";
    var secret               = args.secret || sails.config.stelace.token.authSecret;
    var authExpirationInDays = args.authExpirationInDays || sails.config.stelace.token.authExpirationInDays;
    var isOptional           = args.isOptional;
    var isRefreshing         = args.isRefreshing;

    return Promise
        .resolve()
        .then(() => {
            return jwt.verifyAsync(token, secret)
                .catch(err => {
                    if (_.contains(["TokenExpiredError", "JsonWebTokenError"], err.name)) {
                        throw createError(403, 'ForceAuthentication');
                    } else {
                        throw err;
                    }
                });
        })
        .then(decodedToken => {
            if (! TokenService.isValidFormatAuthToken(decodedToken)
             || ! TokenService.isValidToken(decodedToken, userAgent)
            ) {
                throw createError(403, 'ForceAuthentication');
            }

            if (isRefreshing) {
                // must reauthenticate, because login too long
                var now             = moment();
                var forceReauthDate = moment(decodedToken.loggedAt * 1000).add(authExpirationInDays, "d");

                if (forceReauthDate.isBefore(now)) {
                    var error = createError(403, 'ForceAuthentication');
                    error.expose = true;
                    throw error;
                }

                // cannot refresh an unexpired token
                if (new Date().getTime() < new Date(decodedToken.toRefreshAt * 1000).getTime()) {
                    throw createError(403);
                }
            } else {
                // must refresh an expired token
                if (new Date(decodedToken.toRefreshAt * 1000).getTime() <= new Date().getTime()) {
                    throw createError(403, 'AuthenticationNeeded');
                }
            }

            TokenService.populateReqAuthToken(req, decodedToken, token);

            // TODO: check revoke access token and blocked/destroyed user

            return decodedToken;
        })
        .catch(err => {
            if (isOptional) {
                return;
            } else {
                throw err;
            }
        });
}

function getSecret(userAgent) {
    var secret = {
        version: "v1",
        userAgent: userAgent
    };

    return CryptoJS.AES.encrypt(JSON.stringify(secret), sails.config.stelace.secret).toString();
}

function isRole(req, role, type) {
    var realUserRole     = req.user && req.user.role;
    var originalUserRole = req.authToken && req.authToken.original && req.authToken.original.role;

    if (type === "real") {
        return role === realUserRole;
    } else if (type === "original") {
        return role === originalUserRole;
    } else { // type === "all"
        return role === realUserRole || role === originalUserRole;
    }
}

function getOriginalUser(req) {
    return req.authToken && req.authToken.original;
}

function getIncomeReportTokenName(year) {
    return `incomeReport_${year}`;
}

// durations are object duration from moment
function getIncomeReportToken(userId, year, expirationDuration, refreshDuration) {
    var now = moment().toISOString();

    return Promise.coroutine(function* () {
        var results = yield Promise.props({
            randomString: GeneratorService.getRandomString(20),
            token: Token.find({
                type: getIncomeReportTokenName(year),
                userId: userId
            })
            .sort('createdDate DESC')
            .limit(1)
            .then(tokens => tokens[0]),
        });

        var randomString = results.randomString;
        var token        = results.token;

        if (! token || refreshToken(token, now, refreshDuration)) {
            var createAttrs = {
                type: `incomeReport_${year}`,
                value: randomString,
                userId: userId,
                expirationDate: moment().add(expirationDuration).toISOString()
            };

            token = yield Token.create(createAttrs);
        }

        return token;
    })();



    function refreshToken(token, now, refreshDuration) {
        if (! token) {
            return true;
        }

        return refreshDuration
            ? moment(token.createdDate).add(refreshDuration).toISOString() < now
            : true;
    }
}

function getUrlSafeToken(length = 6) {
    const max = Math.pow(36, length);
    const randomNb = _.random(0, max);

    let token = randomNb.toString(36);
    token = _.padLeft(token, length, '0');
    return token;
}
