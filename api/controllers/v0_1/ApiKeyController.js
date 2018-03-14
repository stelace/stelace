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

    await ApiKey.create({ key });
    res.sendStatus(200);
}

async function destroy(req, res) {
    const key = req.param('key');

    if (!key) {
        return res.badRequest();
    }

    const apiKey = await ApiKey.findOne({ key });

    if (apiKey) {
        await Webhook.destroy({ apiKeyId: apiKey.id });
        await ApiKey.destroy({ key });
    }

    res.sendStatus(200);
}
