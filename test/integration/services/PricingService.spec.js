/* global PricingService */

const { expect } = require('chai');

describe('PricingService', () => {
    describe('.getDurationPrice()', () => {
        it('gets the price with custom duration config', () => {
            const config = {
                duration: {
                    breakpoints: [
                        { nbUnits: 1, price: 10 },
                        { nbUnits: 2, price: 20 },
                        { nbUnits: 3, price: 60 },
                    ],
                },
            };

            const tests = [
                {
                    input: {
                        timeUnitPrice: 10,
                        nbTimeUnits: 7,
                        customConfig: config,
                        array: true,
                    },
                    expected: [10, 20, 60, 100, 140, 180, 220],
                },
                {
                    input: {
                        timeUnitPrice: 10,
                        nbTimeUnits: 7,
                        customConfig: config,
                        array: false,
                    },
                    expected: 220,
                },
            ];

            tests.forEach(test => {
                expect(PricingService.getDurationPrice(test.input)).to.deep.equal(test.expected);
            });
        });
    });

    describe('.roundPrice()', () => {
        it('rounds price to cents', () => {
            const tests = [
                {
                    nb: 2.46,
                    expected: 2.5,
                },
                {
                    nb: 15.6547,
                    expected: 15,
                },
                {
                    nb: 789.78956,
                    expected: 789,
                }
            ];

            tests.forEach(test => {
                expect(PricingService.roundPrice(test.nb)).to.equal(test.expected);
            });
        });
    });
});
