/* global ApiService, Booking */

module.exports = {

    find,
    findOne,

};

async function find(req, res) {
    const access = 'self';
    const attrs = req.allParams();

    try {
        const pagination = ApiService.parsePagination(attrs);

        const bookings = await Booking.find().paginate(pagination);
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
