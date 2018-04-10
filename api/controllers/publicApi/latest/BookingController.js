/* global ApiService, Booking, CancellationService, TransactionService */

module.exports = {

    find,
    findOne,
    cancel,

};

const createError = require('http-errors');

async function find(req, res) {
    const allowed = await ApiService.isAllowed(req, 'transactionList', 'view');
    if (!allowed) {
        throw createError(403);
    }

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

    const pagination = ApiService.parsePagination(attrs);

    const sorting = ApiService.parseSorting(attrs, sortFields);

    const fetchBookings = () => {
        if (pagination) {
            return Booking
                .find()
                .sort(sorting)
                .skip((pagination.page - 1) * pagination.limit)
                .limit(pagination.limit);
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
}

async function findOne(req, res) {
    const allowed = await ApiService.isAllowed(req, 'transactionList', 'view');
    if (!allowed) {
        throw createError(403);
    }

    const id = req.param('id');
    const access = 'api';

    const booking = await Booking.findOne({ id });
    if (!booking) {
        throw createError(404);
    }

    res.json(Booking.expose(booking, access));
}

async function cancel(req, res) {
    const allowed = await ApiService.isAllowed(req, 'transactionList', 'remove');
    if (!allowed) {
        throw createError(403);
    }

    const id = req.param('id');

    const access = 'api';

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
}
