/* global Booking, BootstrapService, Listing, ListingTypeService, TimeService */

const Sails = require('sails');
const { getConfig } = require('../sailsrc');
const moment = require('moment');

const _ = require('lodash');
const Promise = require('bluebird');

Sails.load(getConfig(), async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail script launch: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    try {
        const listingTypes = await ListingTypeService.getListingTypes();

        const bookings = await Booking.find();

        await Promise.each(bookings, async (booking) => {
            const updateAttrs = {
                quantity: 1,
                timeUnit: 'd',
                nbTimeUnits: booking.nbBookedDays,
                currency: 'EUR',
            };

            if (booking.startDate && TimeService.isDateString(booking.startDate, { onlyDate: true })) {
                updateAttrs.startDate = booking.startDate + 'T00:00:00.000Z';
            }
            if (booking.endDate && TimeService.isDateString(booking.endDate, { onlyDate: true })) {
                updateAttrs.endDate = moment(booking.endDate + 'T00:00:00.000Z').add({ d: 1 }).toISOString();
            }

            if (!booking.listingTypeId) {
                let listingType;

                if (booking.bookingMode === 'renting') {
                    listingType = _.find(listingTypes, listingType => {
                        return listingType.properties.TIME === 'TIME_FLEXIBLE';
                    });
                } else {
                    listingType = _.find(listingTypes, listingType => {
                        return listingType.properties.TIME === 'NONE';
                    });
                }

                updateAttrs.listingTypeId = listingType.id;
                updateAttrs.listingType = listingType;
            }

            await Booking.updateOne(booking.id, updateAttrs);
        });

        const listings = await Listing.find();
        await Promise.map(listings, async (listing) => {
            await Listing.updateOne(listing.id, { quantity: 1 });
        });
    } catch (err) {
        console.log(err);

        if (err.stack) {
            console.log(err.stack);
        }
    } finally {
        sails.lowerSafe();
    }

});
