/* global Booking */

module.exports = {

    find,
    findOne,

};

async function find(req, res) {
    const access = 'self';

    try {
        const bookings = await Booking.find();
        res.json(Booking.exposeAll(bookings, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function findOne(req, res) {
    const id = req.param('id');
    const access = 'self';

    try {
        const booking = await Booking.findOne({ id });
        if (!booking) {
            throw new NotFoundError();
        }

        res.json(Booking.expose(booking, access));
    } catch (err) {
        res.sendError(err);
    }
}
