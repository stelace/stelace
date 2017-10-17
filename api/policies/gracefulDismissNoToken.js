/* global TokenService */

module.exports = function (req, res, next) {

    var authorization = req.headers.authorization;
    var rawToken      = TokenService.isValidBearerToken(authorization);

    if (! rawToken) {
        // dismiss with HTTP 204 "No Content" response
        return res.send(204);
    }

    // isAuthenticated must check token validity
    next();

};
