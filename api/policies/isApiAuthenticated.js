/* global ApiKey, ApiKeyEvent, TokenService, User */

const createError = require('http-errors');

module.exports = async function (req, res, next) {

    try {
        const key = req.headers['x-api-key'];
        const token = req.cookies.stl_id;

        if (!key && !token) {
            return res.status(401).send();
        }

        if (key) {
            const apiKey = await ApiKey.findOne({ key });
            if (!apiKey) {
                return res.sendStatus(401);
            }

            req.apiKey = apiKey;

            const createAttrs = {
                key,
                url: req.url,
            };
            await ApiKeyEvent.create(createAttrs).catch(() => null);
        } else if (token) {
            const decodedToken = await TokenService.checkMinimalAuthToken(token);
            const user = await User.findOne({ id: decodedToken.u_id });
            if (!user) {
                throw createError(404, 'User not found');
            }

            req.user = user;
        } else {
            throw new Error('Unknown authentication');
        }

        next();
    } catch (err) {
        if (["TokenExpiredError", "JsonWebTokenError"].includes(err.name)) {
            next(createError(403, 'ForceAuthentication'));
        } else {
            next(err);
        }
    }

};
