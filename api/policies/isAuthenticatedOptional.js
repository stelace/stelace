/* global TokenService */

const _ = require('lodash');
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
        .catch(err => {
            if (err instanceof Error
             && _.contains(["AuthenticationNeeded", "ForceAuthentication"], err.message)
            ) {
                err.expose = true;
            }

            res.sendError(err);
        });

};
