/* global BookingService */

const { expect } = require('chai');

describe('BookingService', () => {
    describe('.getAvailabilityPeriodGraph()', () => {
        it('returns no dates if there is no bookings', () => {
            const futureBookings = [];
            const maxQuantity = 1;
            const availabilityGraph = BookingService.getAvailabilityPeriodGraph({ futureBookings, maxQuantity });

            expect(availabilityGraph.graphDates.length).to.equal(0);
            expect(availabilityGraph.defaultMaxQuantity).to.equal(maxQuantity);
        });

        it('displays used and max quantity for each graph date', () => {
            const futureBookings = [
                {
                    startDate: '2018-01-01T00:00:00.000Z',
                    endDate: '2018-01-05T00:00:00.000Z',
                    quantity: 1,
                },
                {
                    startDate: '2018-01-03T00:00:00.000Z', // overlaps the previous booking
                    endDate: '2018-01-06T00:00:00.000Z',
                    quantity: 2,
                },
            ];
            const maxQuantity = 3;
            const graphDates = [
                { date: '2018-01-01T00:00:00.000Z', usedQuantity: 1, maxQuantity: 3 },
                { date: '2018-01-03T00:00:00.000Z', usedQuantity: 3, maxQuantity: 3 },
                { date: '2018-01-05T00:00:00.000Z', usedQuantity: 2, maxQuantity: 3 },
                { date: '2018-01-06T00:00:00.000Z', usedQuantity: 0, maxQuantity: 3 },
            ];
            const availabilityGraph = BookingService.getAvailabilityPeriodGraph({ futureBookings, maxQuantity });

            expect(availabilityGraph.graphDates).to.deep.equal(graphDates);
            expect(availabilityGraph.defaultMaxQuantity).to.equal(maxQuantity);
        });

        it('should affect max quantity with listing availabilities', () => {
            const futureBookings = [
                {
                    startDate: '2018-01-01T00:00:00.000Z',
                    endDate: '2018-01-05T00:00:00.000Z',
                    quantity: 1,
                },
                {
                    startDate: '2018-01-03T00:00:00.000Z', // overlaps the previous booking
                    endDate: '2018-01-06T00:00:00.000Z',
                    quantity: 2,
                },
                {
                    startDate: '2018-01-06T00:00:00.000Z', // continue the previous booking
                    endDate: '2018-01-10T00:00:00.000Z',
                    quantity: 5,
                },
                {
                    startDate: '2018-02-01T00:00:00.000Z', // doesn't overlap the previous booking
                    endDate: '2018-02-03T00:00:00.000Z',
                    quantity: 3,
                },
            ];
            const listingAvailabilities = [
                {
                    startDate: '2018-01-05T00:00:00.000Z',
                    endDate: '2018-01-15T00:00:00.000Z',
                    quantity: 10,
                },
                {
                    startDate: '2018-01-16T00:00:00.000Z',
                    endDate: '2018-01-18T00:00:00.000Z',
                    quantity: 0,
                },
            ];
            const maxQuantity = 3;
            const graphDates = [
                { date: '2018-01-01T00:00:00.000Z', usedQuantity: 1, maxQuantity: 3 },
                { date: '2018-01-03T00:00:00.000Z', usedQuantity: 3, maxQuantity: 3 },
                { date: '2018-01-05T00:00:00.000Z', usedQuantity: 2, maxQuantity: 10 },
                { date: '2018-01-06T00:00:00.000Z', usedQuantity: 5, maxQuantity: 10 },
                { date: '2018-01-10T00:00:00.000Z', usedQuantity: 0, maxQuantity: 10 },
                { date: '2018-01-15T00:00:00.000Z', usedQuantity: 0, maxQuantity: 3 },
                { date: '2018-01-16T00:00:00.000Z', usedQuantity: 0, maxQuantity: 0 },
                { date: '2018-01-18T00:00:00.000Z', usedQuantity: 0, maxQuantity: 3 },
                { date: '2018-02-01T00:00:00.000Z', usedQuantity: 3, maxQuantity: 3 },
                { date: '2018-02-03T00:00:00.000Z', usedQuantity: 0, maxQuantity: 3 },
            ];

            const availabilityGraph = BookingService.getAvailabilityPeriodGraph({ futureBookings, listingAvailabilities, maxQuantity });

            expect(availabilityGraph.graphDates).to.deep.equal(graphDates);
            expect(availabilityGraph.defaultMaxQuantity).to.equal(maxQuantity);
        });
    });

    describe('.getAvailabilityPeriodInfo()', () => {
        it('is available if no graph and quantity is inferior than max quantity', () => {
            const futureBookings = [];
            const maxQuantity = 2;
            const availabilityGraph = BookingService.getAvailabilityPeriodGraph({ futureBookings, maxQuantity });

            const newBooking = {
                startDate: '2018-01-03T00:00:00.000Z',
                endDate: '2018-01-05T00:00:00.000Z',
                quantity: 2,
            };

            const info = BookingService.getAvailabilityPeriodInfo(availabilityGraph, newBooking);
            expect(info.isAvailable).to.be.true;
            expect(info.maxRemainingQuantity).to.equal(2);
        });

        it('gets the remaining quantity at the date', () => {
            const futureBookings = [
                {
                    startDate: '2018-01-01T00:00:00.000Z',
                    endDate: '2018-01-05T00:00:00.000Z',
                    quantity: 1,
                },
                {
                    startDate: '2018-01-03T00:00:00.000Z', // overlaps the previous booking
                    endDate: '2018-01-06T00:00:00.000Z',
                    quantity: 2,
                },
                {
                    startDate: '2018-01-06T00:00:00.000Z', // continue the previous booking
                    endDate: '2018-01-10T00:00:00.000Z',
                    quantity: 5,
                },
                {
                    startDate: '2018-02-01T00:00:00.000Z', // doesn't overlap the previous booking
                    endDate: '2018-02-03T00:00:00.000Z',
                    quantity: 3,
                },
            ];
            const listingAvailabilities = [
                {
                    startDate: '2018-01-05T00:00:00.000Z',
                    endDate: '2018-01-15T00:00:00.000Z',
                    quantity: 10,
                },
                {
                    startDate: '2018-01-16T00:00:00.000Z',
                    endDate: '2018-01-18T00:00:00.000Z',
                    quantity: 0,
                },
            ];
            const maxQuantity = 3;
            const availabilityGraph = BookingService.getAvailabilityPeriodGraph({ futureBookings, maxQuantity, listingAvailabilities });

            const newBooking = {
                startDate: '2018-01-03T00:00:00.000Z',
                quantity: 0,
            };

            const info = BookingService.getAvailabilityPeriodInfo(availabilityGraph, newBooking);
            expect(info.isAvailable).to.be.false;
            expect(info.maxRemainingQuantity).to.equal(0);
        });

        it('is not available if the new booking quantity exceeds remaining quantity', () => {
            const futureBookings = [
                {
                    startDate: '2018-01-01T00:00:00.000Z',
                    endDate: '2018-01-05T00:00:00.000Z',
                    quantity: 1,
                },
                {
                    startDate: '2018-01-03T00:00:00.000Z', // overlaps the previous booking
                    endDate: '2018-01-06T00:00:00.000Z',
                    quantity: 2,
                },
                {
                    startDate: '2018-01-06T00:00:00.000Z', // continue the previous booking
                    endDate: '2018-01-10T00:00:00.000Z',
                    quantity: 5,
                },
                {
                    startDate: '2018-02-01T00:00:00.000Z', // doesn't overlap the previous booking
                    endDate: '2018-02-03T00:00:00.000Z',
                    quantity: 3,
                },
            ];
            const listingAvailabilities = [
                {
                    startDate: '2018-01-05T00:00:00.000Z',
                    endDate: '2018-01-15T00:00:00.000Z',
                    quantity: 10,
                },
                {
                    startDate: '2018-01-16T00:00:00.000Z',
                    endDate: '2018-01-18T00:00:00.000Z',
                    quantity: 0,
                },
            ];
            const maxQuantity = 3;
            const availabilityGraph = BookingService.getAvailabilityPeriodGraph({ futureBookings, maxQuantity, listingAvailabilities });

            const newBooking = {
                startDate: '2018-01-05T00:00:00.000Z',
                endDate: '2018-01-07T00:00:00.000Z',
                quantity: 7,
            };

            const info = BookingService.getAvailabilityPeriodInfo(availabilityGraph, newBooking);
            expect(info.isAvailable).to.be.false;
            expect(info.maxRemainingQuantity).to.equal(5);
        });
    });

    describe('.getAvailabilityDateGraph()', () => {
        it('returns no dates if there is no bookings', () => {
            const futureBookings = [];
            const maxQuantity = 1;
            const availabilityGraph = BookingService.getAvailabilityDateGraph({ futureBookings, maxQuantity });

            expect(availabilityGraph.graphDates.length).to.equal(0);
            expect(availabilityGraph.defaultMaxQuantity).to.equal(maxQuantity);
        });

        it('displays used and max quantity for each graph date', () => {
            const futureBookings = [
                {
                    startDate: '2018-01-01T00:00:00.000Z',
                    quantity: 1,
                },
                {
                    startDate: '2018-01-03T00:00:00.000Z', // overlaps the previous booking
                    quantity: 2,
                },
            ];
            const maxQuantity = 3;
            const graphDates = [
                { date: '2018-01-01T00:00:00.000Z', usedQuantity: 1, maxQuantity: 3, custom: false },
                { date: '2018-01-03T00:00:00.000Z', usedQuantity: 2, maxQuantity: 3, custom: false },
            ];
            const availabilityGraph = BookingService.getAvailabilityDateGraph({ futureBookings, maxQuantity });

            expect(availabilityGraph.graphDates).to.deep.equal(graphDates);
            expect(availabilityGraph.defaultMaxQuantity).to.equal(maxQuantity);
        });

        it('should affect max quantity with listing availabilities', () => {
            const futureBookings = [
                {
                    startDate: '2018-01-01T00:00:00.000Z',
                    quantity: 1,
                },
                {
                    startDate: '2018-01-03T00:00:00.000Z',
                    quantity: 2,
                },
                {
                    startDate: '2018-01-06T00:00:00.000Z',
                    quantity: 5,
                },
                {
                    startDate: '2018-02-01T00:00:00.000Z',
                    quantity: 3,
                },
            ];
            const listingAvailabilities = [
                {
                    startDate: '2018-01-06T00:00:00.000Z',
                    quantity: 10,
                },
            ];
            const maxQuantity = 3;
            const graphDates = [
                { date: '2018-01-01T00:00:00.000Z', usedQuantity: 1, maxQuantity: 3, custom: false },
                { date: '2018-01-03T00:00:00.000Z', usedQuantity: 2, maxQuantity: 3, custom: false },
                { date: '2018-01-06T00:00:00.000Z', usedQuantity: 5, maxQuantity: 10, custom: true },
                { date: '2018-02-01T00:00:00.000Z', usedQuantity: 3, maxQuantity: 3, custom: false },
            ];

            const availabilityGraph = BookingService.getAvailabilityDateGraph({ futureBookings, listingAvailabilities, maxQuantity });

            expect(availabilityGraph.graphDates).to.deep.equal(graphDates);
            expect(availabilityGraph.defaultMaxQuantity).to.equal(maxQuantity);
        });
    });

    describe('.getAvailabilityDateInfo()', () => {
        it('is available if no graph and quantity is inferior than max quantity', () => {
            const futureBookings = [];
            const maxQuantity = 2;
            const availabilityGraph = BookingService.getAvailabilityDateGraph({ futureBookings, maxQuantity });

            const newBooking = {
                startDate: '2018-01-03T00:00:00.000Z',
                quantity: 2,
            };

            const info = BookingService.getAvailabilityDateInfo(availabilityGraph, newBooking);
            expect(info.isAvailable).to.be.true;
            expect(info.maxRemainingQuantity).to.equal(2);
        });

        it('is not available if the new booking quantity exceeds remaining quantity', () => {
            const futureBookings = [
                {
                    startDate: '2018-01-01T00:00:00.000Z',
                    quantity: 1,
                },
                {
                    startDate: '2018-01-03T00:00:00.000Z',
                    quantity: 1,
                },
                {
                    startDate: '2018-01-06T00:00:00.000Z',
                    quantity: 5,
                },
                {
                    startDate: '2018-02-01T00:00:00.000Z',
                    quantity: 3,
                },
            ];
            const listingAvailabilities = [
                {
                    startDate: '2018-01-06T00:00:00.000Z',
                    quantity: 10,
                },
            ];
            const maxQuantity = 2;
            const availabilityGraph = BookingService.getAvailabilityDateGraph({ futureBookings, maxQuantity, listingAvailabilities });

            const newBooking = {
                startDate: '2018-01-03T00:00:00.000Z',
                quantity: 2,
            };

            const info = BookingService.getAvailabilityDateInfo(availabilityGraph, newBooking);
            expect(info.isAvailable).to.be.false;
            expect(info.maxRemainingQuantity).to.equal(1);
        });
    });
});
