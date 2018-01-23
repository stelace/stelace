/* global ApiService, Booking, CancellationService, TransactionService */

module.exports = {

    find,
    findOne,
    cancel,

};

const createError = require('http-errors');

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

        const fetchBookings = () => {
            if (pagination) {
                return Booking.find().sort(sorting).paginate(pagination);
            } else {
                return Booking.find().sort(sorting);
            }
        };

        const [
            bookings,
            countBookings,
        ] = await Promise.all([
            fetchBookings(),
            Booking.count(),
        ]);

        const returnedObj = ApiService.getPaginationMeta({
            totalResults: countBookings,
            limit: pagination && pagination.limit,
            allResults: !pagination,
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
            throw createError(404);
        }

        res.json(Booking.expose(booking, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function cancel(req, res) {
    const id = req.param('id');

    const access = 'api';

    try {
        let booking = await Booking.findOne({ id });
        if (!booking) {
            throw createError(404);
        }

        const transactionManagers = await TransactionService.getBookingTransactionsManagers([booking.id]);
        const transactionManager  = transactionManagers[booking.id];

        booking = await CancellationService.cancelBooking(booking, transactionManager, {
            reasonType: 'booking-cancelled',
            trigger: 'admin',
            cancelPayment: true,
        });

        res.json(Booking.expose(booking, access));
    } catch (err) {
        res.sendError(err);
    }
}
