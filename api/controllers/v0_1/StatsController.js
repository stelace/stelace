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

    let { startDate, endDate } = req.allParams();

    if (!StatsService.isValidPeriodDates(startDate, endDate)) {
        throw createError(400);
    }

    const upperEndDate = StatsService.getDayAfter(endDate);

    const users = await User
        .find({
            destroyed: false,
            createdDate: {
                '>=': startDate,
                '<': upperEndDate,
            },
        })
        .sort('createdDate ASC');

    const dates = _.pluck(users, 'createdDate');

    const countDate = StatsService.getDateCount(dates, { startDate, endDate });

    res.json(countDate);
}

async function listingPublished(req, res) {
    const allowed = await ApiService.isAllowed(req, 'generalStats', 'view');
    if (!allowed) {
        throw createError(403);
    }

    let { startDate, endDate } = req.allParams();

    if (!StatsService.isValidPeriodDates(startDate, endDate)) {
        throw createError(400);
    }

    const upperEndDate = StatsService.getDayAfter(endDate);

    const listings = await Listing
        .find({
            createdDate: {
                '>=': startDate,
                '<': upperEndDate,
            },
        })
        .sort('createdDate ASC');

    const dates = _.pluck(listings, 'createdDate');

    const countDate = StatsService.getDateCount(dates, { startDate, endDate });

    res.json(countDate);
}

async function bookingPaid(req, res) {
    const allowed = await ApiService.isAllowed(req, 'generalStats', 'view');
    if (!allowed) {
        throw createError(403);
    }

    let { startDate, endDate } = req.allParams();

    if (!StatsService.isValidPeriodDates(startDate, endDate)) {
        throw createError(400);
    }

    const upperEndDate = StatsService.getDayAfter(endDate);

    const bookings = await Booking
        .find({
            paidDate: {
                '>=': startDate,
                '<': upperEndDate,
            },
        })
        .sort('paidDate ASC');

    const dates = _.pluck(bookings, 'paidDate');

    const countDate = StatsService.getDateCount(dates, { startDate, endDate });

    res.json(countDate);
}
