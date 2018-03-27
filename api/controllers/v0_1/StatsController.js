/* global ApiService, Booking, Listing, StatsService, User */

module.exports = {

    userRegistered,
    listingPublished,
    bookingPaid,

};

const _ = require('lodash');
const createError = require('http-errors');

async function userRegistered(req, res) {
    const allowed = await ApiService.isAllowed(req, 'generalStats', 'view');
    if (!allowed) {
        throw createError(403);
    }

    let { startDate, endDate, aggregate } = req.allParams();

    if (!StatsService.isValidPeriodDates(startDate, endDate)) {
        throw createError(400);
    }

    const upperEndDate = StatsService.getDayAfter(endDate);

    const getUsers = () => {
        return User
            .find({
                destroyed: false,
                createdDate: {
                    '>=': startDate,
                    '<': upperEndDate,
                },
            })
            .sort('createdDate ASC');
    };

    const getTotalUsers = () => {
        return User.count({
            destroyed: false,
            createdDate: { '<': startDate },
        });
    };

    const [
        users,
        total,
    ] = await Promise.all([
        getUsers(),
        aggregate === '1' ? getTotalUsers() : null,
    ]);

    const dates = _.pluck(users, 'createdDate');

    const countDate = StatsService.getDateCount(dates, { startDate, endDate, total });

    res.json(countDate);
}

async function listingPublished(req, res) {
    const allowed = await ApiService.isAllowed(req, 'generalStats', 'view');
    if (!allowed) {
        throw createError(403);
    }

    let { startDate, endDate, aggregate } = req.allParams();

    if (!StatsService.isValidPeriodDates(startDate, endDate)) {
        throw createError(400);
    }

    const upperEndDate = StatsService.getDayAfter(endDate);

    const getListings = () => {
        return Listing
            .find({
                createdDate: {
                    '>=': startDate,
                    '<': upperEndDate,
                },
            })
            .sort('createdDate ASC');
    };

    const getTotalListings = () => {
        return Listing.count({ createdDate: { '<': startDate } });
    };

    const [
        listings,
        total,
    ] = await Promise.all([
        getListings(),
        aggregate === '1' ? getTotalListings() : null,
    ]);

    const dates = _.pluck(listings, 'createdDate');

    const countDate = StatsService.getDateCount(dates, { startDate, endDate, total });

    res.json(countDate);
}

async function bookingPaid(req, res) {
    const allowed = await ApiService.isAllowed(req, 'generalStats', 'view');
    if (!allowed) {
        throw createError(403);
    }

    let { startDate, endDate, aggregate } = req.allParams();

    if (!StatsService.isValidPeriodDates(startDate, endDate)) {
        throw createError(400);
    }

    const upperEndDate = StatsService.getDayAfter(endDate);

    const getBookings = () => {
        return Booking
            .find({
                paidDate: {
                    '>=': startDate,
                    '<': upperEndDate,
                },
            })
            .sort('paidDate ASC');
    };

    const getTotalBookings = () => {
        return Booking.count({ paidDate: { '<': startDate } });
    };

    const [
        bookings,
        total,
    ] = await Promise.all([
        getBookings(),
        aggregate === '1' ? getTotalBookings() : null,
    ]);

    const dates = _.pluck(bookings, 'paidDate');

    const countDate = StatsService.getDateCount(dates, { startDate, endDate, total });

    res.json(countDate);
}
