/* global TokenService */

const Promise = require('bluebird');
const createError = require('http-errors');
var jwt = require('jsonwebtoken');

Promise.promisifyAll(jwt);

module.exports = function (req, res, next) {

    var authorization = req.headers.authorization;
    var rawToken      = TokenService.isValidBearerToken(authorization);

    if (! rawToken) {
        if (req.wantsJSON || req.xhr) {
            const error = createError(403, 'AuthenticationNeeded');
            return res.sendError(error);
        } else {
            return res.redirect("/login");
        }
    }

    return TokenService
        .checkAuthToken({
            req: req,
            token: rawToken
        })
        .then(() => next())
        .catch(res.sendError);

};
