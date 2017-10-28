/* global UrlService, Webhook */

module.exports = {

    find,
    create,
    destroy,

};

const maxNbWebhooks = 2;

async function find(req, res) {
    const access = 'api';

    try {
        const webhooks = await Webhook.find({ apiKeyId: req.apiKey.id });
        res.json(Webhook.exposeAll(webhooks, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function create(req, res) {
    const url = req.param('url');

    const access = 'api';

    if (!url || !UrlService.isUrl(url)) {
        return res.badRequest();
    }

    try {
        const webhooks = await Webhook.find({ apiKeyId: req.apiKey.id });
        if (webhooks.length >= maxNbWebhooks) {
            throw new BadRequestError();
        }

        const webhook = await Webhook.create({
            apiKeyId: req.apiKey.id,
            url,
        });

        res.json(Webhook.expose(webhook, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function destroy(req, res) {
    const id = req.param('id');

    try {
        await Webhook.destroy({
            apiKeyId: req.apiKey.id,
            id,
        });

        res.ok();
    } catch (err) {
        res.sendError(err);
    }
}
