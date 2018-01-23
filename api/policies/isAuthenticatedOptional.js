/* global TokenService */

const Promise = require('bluebird');
var jwt = require('jsonwebtoken');

Promise.promisifyAll(jwt);

module.exports = function (req, res, next) {

    var authorization = req.headers.authorization;
    var rawToken      = TokenService.isValidBearerToken(authorization);

    if (! rawToken) {
        return next();
    }

    return TokenService
        .checkAuthToken({
            req: req,
            token: rawToken,
            isOptional: true
        })
        .then(() => next())
        .catch(res.sendError);

};
