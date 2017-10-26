/* global ApiKey */

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
        res.ok();
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
        await ApiKey.destroy({ key });
        res.ok();
    } catch (err) {
        res.sendError(err);
    }
}
