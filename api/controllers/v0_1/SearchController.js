/* global SearchEvent */

module.exports = {

    find,
    findOne,

};

async function find(req, res) {
    const access = 'self';

    try {
        const searchEvents = await SearchEvent.find();
        res.json(SearchEvent.exposeAll(searchEvents, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function findOne(req, res) {
    const id = req.param('id');
    const access = 'self';

    try {
        const searchEvent = await SearchEvent.findOne({ id });
        if (!searchEvent) {
            throw new NotFoundError();
        }

        res.json(SearchEvent.expose(searchEvent, access));
    } catch (err) {
        res.sendError(err);
    }
}
