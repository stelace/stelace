/* global ApiService, UrlService, Webhook */

module.exports = {

    find,
    create,
    update,
    destroy,

};

const createError = require('http-errors');

const maxNbWebhooks = 2;

async function find(req, res) {
    const allowed = await ApiService.isAllowed(req, 'webhook', 'view');
    if (!allowed) {
        throw createError(403);
    }

    const access = 'api';

    const webhooks = await Webhook.find();
    res.json(Webhook.exposeAll(webhooks, access));
}

async function create(req, res) {
    const allowed = await ApiService.isAllowed(req, 'webhook', 'create');
    if (!allowed) {
        throw createError(403);
    }

    const { name, url } = req.allParams();

    const access = 'api';

    if (!name || !url || !UrlService.isUrl(url)) {
        return res.badRequest();
    }

    const webhooks = await Webhook.find();
    if (webhooks.length >= maxNbWebhooks) {
        throw createError(400);
    }

    const webhook = await Webhook.create({ name, url });

    res.json(Webhook.expose(webhook, access));
}

async function update(req, res) {
    const allowed = await ApiService.isAllowed(req, 'webhook', 'edit');
    if (!allowed) {
        throw createError(403);
    }

    const id = req.param('id');
    const { name } = req.allParams();

    const access = 'api';

    if (!name) {
        return res.badRequest();
    }

    const webhook = await Webhook.updateOne(id, { name });
    if (!webhook) {
        throw createError(404);
    }

    res.json(Webhook.expose(webhook, access));
}

async function destroy(req, res) {
    const allowed = await ApiService.isAllowed(req, 'webhook', 'remove');
    if (!allowed) {
        throw createError(403);
    }

    const id = req.param('id');

    await Webhook.destroy({ id });

    res.sendStatus(200);
}
