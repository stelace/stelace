/* global ApiKey, ApiEvent, TokenService, User */

const createError = require('http-errors');

module.exports = async function (req, res, next) {

    try {
        const key = req.headers['x-api-key'];
        const token = req.cookies.stl_id;

        if (!key && !token) {
            return res.status(401).send();
        }

        const createAttrs = {
            url: req.url,
        };

        if (key) {
            const apiKey = await ApiKey.findOne({ key });
            if (!apiKey) {
                return res.sendStatus(401);
            }
            if (apiKey.revokedDate) {
                throw createError(403, 'Revoked api key');
            }

            req.apiKey = apiKey;

            createAttrs.apiKeyId = apiKey.id;
        } else if (token) {
            const decodedToken = await TokenService.checkMinimalAuthToken(token);
            const user = await User.findOne({ id: decodedToken.u_id });
            if (!user) {
                throw createError(404, 'User not found');
            }

            req.user = user;

            createAttrs.userId = user.id;
        } else {
            throw new Error('Unknown authentication');
        }

        await ApiEvent.create(createAttrs).catch(() => null);

        next();
    } catch (err) {
        if (["TokenExpiredError", "JsonWebTokenError"].includes(err.name)) {
            next(createError(403, 'ForceAuthentication'));
        } else {
            next(err);
        }
    }

};
