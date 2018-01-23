/* global TokenService */

const Promise = require('bluebird');
var jwt = require('jsonwebtoken');

Promise.promisifyAll(jwt);

module.exports = function (req, res, next) {

    var rawToken  = TokenService.isValidBearerToken(res.cookie("authToken"));

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
