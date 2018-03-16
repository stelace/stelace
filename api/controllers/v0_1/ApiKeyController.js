/* global ApiKey, ApiService */

module.exports = {

    findMain,
    create,
    destroy,

};

const createError = require('http-errors');

async function findMain(req, res) {
    const allowed = await ApiService.isAllowed(req, 'apiKey', 'view');
    if (!allowed) {
        throw createError(403);
    }

    const access = 'api';

    let [apiKey] = await ApiKey
        .find({ revokedDate: { '!=': null } })
        .limit(1);

    if (!apiKey) {
        throw createError(404);
    }

    res.json(ApiKey.expose(apiKey, access));
}

async function create(req, res) {
    const allowed = await ApiService.isAllowed(req, 'apiKey', 'create');
    if (!allowed) {
        throw createError(403);
    }

    const access = 'api';

    const key = ApiKey.generateKey();

    const apiKey = await ApiKey.create({ key });
    res.json(ApiKey.expose(apiKey, access));
}

async function destroy(req, res) {
    const allowed = await ApiService.isAllowed(req, 'apiKey', 'remove');
    if (!allowed) {
        throw createError(403);
    }

    const id = req.param('id');

    await ApiKey.updateOne(id, { revokedDate: new Date().toISOString() });

    res.sendStatus(200);
}
