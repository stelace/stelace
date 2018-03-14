/* global UrlService, Webhook */

module.exports = {

    find,
    create,
    destroy,

};

const createError = require('http-errors');

const maxNbWebhooks = 2;

async function find(req, res) {
    const access = 'api';

    const webhooks = await Webhook.find({ apiKeyId: req.apiKey.id });
    res.json(Webhook.exposeAll(webhooks, access));
}

async function create(req, res) {
    const url = req.param('url');

    const access = 'api';

    if (!url || !UrlService.isUrl(url)) {
        return res.badRequest();
    }

    const webhooks = await Webhook.find({ apiKeyId: req.apiKey.id });
    if (webhooks.length >= maxNbWebhooks) {
        throw createError(400);
    }

    const webhook = await Webhook.create({
        apiKeyId: req.apiKey.id,
        url,
    });

    res.json(Webhook.expose(webhook, access));
}

async function destroy(req, res) {
    const id = req.param('id');

    await Webhook.destroy({
        apiKeyId: req.apiKey.id,
        id,
    });

    res.sendStatus(200);
}
