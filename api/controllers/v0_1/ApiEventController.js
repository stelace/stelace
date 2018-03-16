/* global ApiKey, ApiService */

module.exports = {

    getCount,

};

const createError = require('http-errors');

async function getCount(req, res) {
    const allowed = await ApiService.isAllowed(req, 'api', 'view');
    if (!allowed) {
        throw createError(403);
    }

    const count = await ApiKey.count({
        apiKeyId: { '!=': null },
    });

    res.json({
        count,
    });
}
