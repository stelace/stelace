/* global ApiKey, Webhook */

module.exports = {

    create,
    destroy,

};

async function create(req, res) {
    const key = req.param('key');

    if (!key) {
        return res.badRequest();
    }

    try {
        await ApiKey.create({ key });
        res.sendStatus(200);
    } catch (err) {
        res.sendError(err);
    }
}

async function destroy(req, res) {
    const key = req.param('key');

    if (!key) {
        return res.badRequest();
    }

    try {
        const apiKey = await ApiKey.findOne({ key });

        if (apiKey) {
            await Webhook.destroy({ apiKeyId: apiKey.id });
            await ApiKey.destroy({ key });
        }

        res.sendStatus(200);
    } catch (err) {
        res.sendError(err);
    }
}
