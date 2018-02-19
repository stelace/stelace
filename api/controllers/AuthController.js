/* global GamificationService, PassportService, StelaceEventService, TokenService, UAService, User */

const jwt    = require('jsonwebtoken');
const _ = require('lodash');
const Promise = require('bluebird');
const createError = require('http-errors');

Promise.promisifyAll(jwt);

module.exports = {

    logout: logout,
    provider: provider,
    callback: callback,
    refreshToken: refreshToken,
    loginAs: loginAs,
    basicAuth: basicAuth

};

/**
* Log out a user and return them to the homepage
*
* Passport exposes a logout() function on req (also aliased as logOut()) that
* can be called from any route handler which needs to terminate a login
* session. Invoking logout() will remove the req.user property and clear the
* login session (if any).
*
* For more information on logging out users in Passport.js, check out:
* http://passportjs.org/guide/logout/
*
* @param {Object} req
* @param {Object} res
*/
function logout(req, res) {
    return Promise.coroutine(function* () {
        yield StelaceEventService.createEvent({
            req: req,
            res: res,
            label: "user.logged_out",
            resetUser: true,
            type: 'core',
        });

        // TODO: revoke token
        res.sendStatus(200);
    })();
}

/**
* Create a third-party authentication endpoint
*
* @param {Object} req
* @param {Object} res
*/
async function provider(req, res) {
    const passport = await PassportService.getPassportInstance();
    passport.endpoint(req, res);
}

/**
* Create a authentication callback endpoint
*
* This endpoint handles everything related to creating and verifying Pass-
* ports and users, both locally and from third-aprty providers.
*
* Passport exposes a login() function on req (also aliased as logIn()) that
* can be used to establish a login session. When the login operation
* completes, user will be assigned to req.user.
*
* For more information on logging in users in Passport.js, check out:
* http://passportjs.org/guide/login/
*
* @param {Object} req
* @param {Object} res
*/
async function callback(req, res) {
    // error from social login
    if (req.query.error_reason === 'user_denied') {
        return res.redirect('/login?error=user_denied');
    } else if (req.query.error) {
        return res.redirect('/login?error=access_denied');
    }

    const passport = await PassportService.getPassportInstance();

    let user;
    try {
        user = await new Promise((resolve, reject) => {
            passport.callback(req, res, (err, user) => {
                if (err) return reject(err);
                resolve(user);
            });
        });
    } catch (err) {
        return tryAgain(err, { req, res });
    }

    try {
        await new Promise((resolve, reject) => {
            req.login(user, (loginErr) => {
                if (loginErr) return reject(loginErr);
                resolve();
            });
        });
    } catch (err) {
        return tryAgain(null, { req, res });
    }

    const userAgent = req.headers['user-agent'];
    const authToken = TokenService.createAuthToken(user, {
        userAgent: userAgent
    });

    _updateGamificationWhenLoggedIn(user, userAgent, req.logger, req);

    await StelaceEventService.createEvent({
        req: req,
        res: res,
        label: 'user.logged_in',
        defaultUserId: user.id,
        type: 'core',
    });

    User
        .updateOne(user.id, { lastConnectionDate: new Date().toISOString() })
        .catch(() => { /* do nothing */ });

    // Upon successful login, send the user to the homepage were req.user
    // will available.
    if (req.wantsJSON) {
        res.json({
            token_type: 'Bearer',
            access_token: authToken
        });
    } else {
        res.cookie('authToken', authToken);
        res.redirect('/social-auth');
    }
}

function tryAgain(err, { req, res }) {
    if (req.wantsJSON) { // login request from local
        res.serverError(err);
    } else { // login request from providers
        res.set("loginErr", err);

        res.redirect(req.param('action') === 'register' ? '/register' : '/login');
    }
}

function refreshToken(req, res) {
    var authorization        = req.headers.authorization;
    var rawToken             = TokenService.isValidBearerToken(authorization);

    if (! rawToken) {
        return res.forbidden();
    }

    return TokenService
        .checkAuthToken({
            req: req,
            token: rawToken,
            isRefreshing: true
        })
        .then(decodedToken => {
            return [
                decodedToken,
                User.findOne({
                    id: decodedToken.userId,
                    destroyed: false
                })
            ];
        })
        .spread((decodedToken, user) => {
            if (! user) {
                throw createError(403, 'UserNoLongerExists');
            }

            var userAgent = req.headers["user-agent"];

            var data = {
                loggedAt: decodedToken.loggedAt,
                userAgent: userAgent
            };

            if (decodedToken.original) {
                data.original = decodedToken.original;
            }

            var newToken = TokenService.createAuthToken(
                {
                    id: decodedToken.userId,
                    role: decodedToken.role
                },
                data
            );

            _updateGamificationWhenLoggedIn(user, userAgent, req.logger, req);

            res.json({
                token_type: "Bearer",
                access_token: newToken
            });
        })
        .catch(err => {
            if (err instanceof Error
             && _.contains(["AuthenticationNeeded", "ForceAuthentication"], err.message)
            ) {
                err.expose = true;
            }

            res.sendError(err);
        });
}

function loginAs(req, res) {
    var userId = req.param("userId");

    if (! TokenService.isRole(req, "admin")) {
        return res.forbidden();
    }

    return Promise.coroutine(function* () {
        var user = yield User.findOne({ id: userId });
        if (! user) {
            throw createError(404);
        }

        var originalUser = TokenService.getOriginalUser(req);

        var userAgent = req.headers["user-agent"];
        var authToken = TokenService.createAuthToken(user, {
            userAgent: userAgent,
            original: {
                id: (originalUser && originalUser.id) || req.user.id,
                role: (originalUser && originalUser.role) || req.user.role
            }
        });

        yield StelaceEventService.createEvent({
            req: req,
            res: res,
            targetUserId: user.id,
            label: "Login as"
        });

        res.json({
            token_type: "Bearer",
            access_token: authToken
        });
    })()
    .catch(res.sendError);
}

function basicAuth(req, res) {
    var auth = req.param("auth");

    if (! sails.config.basicAuth
     || auth !== sails.config.basicAuth
    ) {
        return res.sendStatus(200);
    }

    res.cookie("basicAuth", auth, { httpOnly: true });
    res.sendStatus(200);
}

function _updateGamificationWhenLoggedIn(user, userAgent, logger, req) {
    // some actions can be set if the user comes from social networks
    var actionsIds = [
        "CONNECTION_OF_THE_DAY",
        "ADD_FIRSTNAME",
        "ADD_LASTNAME",
        "ADD_PROFILE_IMAGE"
    ];
    var actionsData = {
        CONNECTION_OF_THE_DAY: { connectionDate: new Date().toISOString() }
    };

    if (UAService.isMobile(userAgent)) {
        actionsIds.push("FIRST_MOBILE_CONNECTION");
        actionsData.FIRST_MOBILE_CONNECTION = { userAgent: userAgent };
    }

    GamificationService.checkActions(user, actionsIds, actionsData, logger, req).then(() => {});
}
