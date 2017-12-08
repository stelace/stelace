/* global ApiService, Booking */

module.exports = {

    find,
    findOne,

};

async function find(req, res) {
    const attrs = req.allParams();
    const sortFields = [
        'id',
        'paidDate',
        'acceptedDate',
        'startDate',
        'endDate',
        'ownerPrice',
        'takerPrice',
        'ownerFees',
        'takerFees',
    ];

    const access = 'api';

    try {
        const pagination = ApiService.parsePagination(attrs);

        const sorting = ApiService.parseSorting(attrs, sortFields);

        const [
            bookings,
            countBookings,
        ] = await Promise.all([
            Booking.find().sort(sorting).paginate(pagination),
            Booking.count(),
        ]);

        const returnedObj = ApiService.getPaginationMeta({
            totalResults: countBookings,
            limit: pagination.limit,
        });
        returnedObj.results = Booking.exposeAll(bookings, access);

        res.json(returnedObj);
    } catch (err) {
        res.sendError(err);
    }
}

async function findOne(req, res) {
    const id = req.param('id');
    const access = 'api';

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
