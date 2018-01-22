/* global Booking, Listing, StatsService, User */

module.exports = {

    userRegistered,
    listingPublished,
    bookingPaid,

};

const _ = require('lodash');

async function userRegistered(req, res) {
    let { startDate, endDate } = req.allParams();

    try {
        if (!StatsService.isValidPeriodDates(startDate, endDate)) {
            throw new BadRequestError();
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
            .sort({ createdDate: 1 });

        const dates = _.pluck(users, 'createdDate');

        const countDate = StatsService.getDateCount(dates, { startDate, endDate });

        res.json(countDate);
    } catch (err) {
        res.sendError(err);
    }
}

async function listingPublished(req, res) {
    let { startDate, endDate } = req.allParams();

    try {
        if (!StatsService.isValidPeriodDates(startDate, endDate)) {
            throw new BadRequestError();
        }

        const upperEndDate = StatsService.getDayAfter(endDate);

        const listings = await Listing
            .find({
                createdDate: {
                    '>=': startDate,
                    '<': upperEndDate,
                },
            })
            .sort({ createdDate: 1 });

        const dates = _.pluck(listings, 'createdDate');

        const countDate = StatsService.getDateCount(dates, { startDate, endDate });

        res.json(countDate);
    } catch (err) {
        res.sendError(err);
    }
}

async function bookingPaid(req, res) {
    let { startDate, endDate } = req.allParams();

    try {
        if (!StatsService.isValidPeriodDates(startDate, endDate)) {
            throw new BadRequestError();
        }

        const upperEndDate = StatsService.getDayAfter(endDate);

        const bookings = await Booking
            .find({
                paidDate: {
                    '>=': startDate,
                    '<': upperEndDate,
                },
            })
            .sort({ paidDate: 1 });

        const dates = _.pluck(bookings, 'paidDate');

        const countDate = StatsService.getDateCount(dates, { startDate, endDate });

        res.json(countDate);
    } catch (err) {
        res.sendError(err);
    }
}
