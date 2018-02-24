/* global BookingService */

const { expect } = require('chai');

describe('BookingService', () => {
    describe('.getAvailabilityPeriods()', () => {
        it('is available if there is no future bookings and no new booking is provided', () => {
            const availability = BookingService.getAvailabilityPeriods();

            expect(availability.isAvailable).to.be.true;
            expect(availability.availablePeriods.length).to.equal(0);
        });

        it(`is available if there is no future bookings and new booking is provided`, () => {
            const newBooking = {
                startDate: '2018-01-01T00:00:00.000Z',
                endDate: '2018-01-02T00:00:00.000Z',
                quantity: 1,
            };
            const availablePeriods = [
                { date: '2017-12-31T00:00:00.000Z', quantity: 0 },
                { date: '2018-01-01T00:00:00.000Z', quantity: 1, newPeriod: 'start' },
                { date: '2018-01-02T00:00:00.000Z', quantity: 0, newPeriod: 'end' },
            ];
            const availability = BookingService.getAvailabilityPeriods({ newBooking });

            expect(availability.isAvailable).to.be.true;
            expect(availability.availablePeriods).to.deep.equal(availablePeriods);
        });

        it(`isn't available if the new booking quantity exceeds the max quantity`, () => {
            const newBooking = {
                startDate: '2018-01-01T00:00:00.000Z',
                endDate: '2018-01-02T00:00:00.000Z',
                quantity: 2,
            };
            const availablePeriods = [
                { date: '2017-12-31T00:00:00.000Z', quantity: 0 },
                { date: '2018-01-01T00:00:00.000Z', quantity: 2, newPeriod: 'start' },
                { date: '2018-01-02T00:00:00.000Z', quantity: 0, newPeriod: 'end' },
            ];
            const availability = BookingService.getAvailabilityPeriods({ newBooking, maxQuantity: 1 });

            expect(availability.isAvailable).to.be.false;
            expect(availability.availablePeriods).to.deep.equal(availablePeriods);
        });

        it('returns the availability periods graph to see how the quantity evolves', () => {
            const futureBookings = [
                {
                    startDate: '2018-01-01T00:00:00.000Z',
                    endDate: '2018-01-05T00:00:00.000Z',
                    quantity: 1,
                },
                {
                    startDate: '2018-01-03T00:00:00.000Z',
                    endDate: '2018-01-06T00:00:00.000Z',
                    quantity: 5,
                },
                {
                    startDate: '2018-01-06T00:00:00.000Z', // overlaps the previous booking
                    endDate: '2018-01-10T00:00:00.000Z',
                    quantity: 2,
                },
                {
                    startDate: '2018-02-01T00:00:00.000Z', // doesn't overlap the previous booking
                    endDate: '2018-02-03T00:00:00.000Z',
                    quantity: 3,
                },
            ];
            const listingAvailabilities = [
                {
                    startDate: '2018-01-01T00:00:00.000Z',
                    endDate: '2018-01-02T00:00:00.000Z',
                    available: true,
                    quantity: 1,
                },
                {
                    startDate: '2018-01-05T00:00:00.000Z',
                    endDate: '2018-01-11T00:00:00.000Z',
                    available: false,
                    quantity: 2,
                },
            ];
            const newBooking = {
                startDate: '2018-01-04T00:00:00.000Z',
                endDate: '2018-01-08T00:00:00.000Z',
                quantity: 4,
            };
            const availablePeriods = [
                { date: '2017-12-31T00:00:00.000Z', quantity: 0 },
                { date: '2018-01-01T00:00:00.000Z', quantity: 0 },
                { date: '2018-01-02T00:00:00.000Z', quantity: 1 },
                { date: '2018-01-03T00:00:00.000Z', quantity: 6 },
                { date: '2018-01-04T00:00:00.000Z', quantity: 10, newPeriod: 'start' },
                { date: '2018-01-05T00:00:00.000Z', quantity: 11 },
                { date: '2018-01-06T00:00:00.000Z', quantity: 8 },
                { date: '2018-01-08T00:00:00.000Z', quantity: 4, newPeriod: 'end' },
                { date: '2018-01-10T00:00:00.000Z', quantity: 2 },
                { date: '2018-01-11T00:00:00.000Z', quantity: 0 },
                { date: '2018-02-01T00:00:00.000Z', quantity: 3 },
                { date: '2018-02-03T00:00:00.000Z', quantity: 0 },
            ];

            const availability = BookingService.getAvailabilityPeriods({ futureBookings, listingAvailabilities, newBooking });

            expect(availability.isAvailable).to.be.true;
            expect(availability.availablePeriods).to.deep.equal(availablePeriods);
        });
    });
});
