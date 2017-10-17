/*
    global Item
*/

module.exports = {

    pauseItemToggle: pauseItemToggle

};

var moment = require('moment');

/**
 * toggle item paused state
 * @param  {number} options.itemId
 * @param  {boolean} [options.pause] - can force state rather than toggling
 * @param  {string} options.pausedUntil
 * @param  {object} options.req
 * @return {Promise<object>} item
 */
function pauseItemToggle({ itemId, pause, pausedUntil, req }) {
    if (! itemId) {
        throw new BadRequestError("itemId expected");
    }
    if (pausedUntil && ! moment.isDate(pausedUntil)) {
        throw new BadRequestError("Invalid date format");
    }

    return Promise.coroutine(function* () {
        var item = yield Item.findOne({ id: itemId });

        if (! item) {
            throw new NotFoundError();
        }
        if (! req.user || item.ownerId !== req.user.id) {
            throw new ForbiddenError();
        }

        // Do not toggle items locked by system
        if (item.locked && ! item.pausedUntil) {
            return item;
        }

        var untilDate   = (pausedUntil ? moment(pausedUntil) : moment().add(30, "d")).format("YYYY-MM-DD");
        var pauseState  = _.isBoolean(pause) ? pause : (! item.locked);
        var updateAttrs = {
            pausedUntil: (! item.locked) ? untilDate : null,
            locked: pauseState
        };

        var updatedItem = yield Item.updateOne(item.id, updateAttrs);

        return updatedItem;
    })();
}
