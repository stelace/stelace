/* global ApiKey, ApiKeyEvent */

module.exports = async function (req, res, next) {

    try {
        const key = req.headers['x-api-key'];
        if (!key) {
            return res.status(401).send();
        }

        const apiKey = await ApiKey.findOne({ key });
        if (!apiKey) {
            return res.status(401).send();
        }

        const createAttrs = {
            key,
            url: req.url,
        };
        await ApiKeyEvent.create(createAttrs).catch(() => null);

        next();
    } catch (err) {
        next(err);
    }

};
