/* global TokenService */

var jwt = require('jsonwebtoken');

Promise.promisifyAll(jwt);

module.exports = function (req, res, next) {

    var authorization = req.headers.authorization;
    var rawToken      = TokenService.isValidBearerToken(authorization);

    if (! rawToken) {
        if (req.wantsJSON || req.xhr) {
            var error = new ForbiddenError("AuthenticationNeeded");
            error.expose = true;
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
        .catch(err => {
            if (err instanceof Error
             && _.contains(["AuthenticationNeeded", "ForceAuthentication"], err.message)
            ) {
                err.expose = true;
            }

            res.sendError(err);
        });

};
