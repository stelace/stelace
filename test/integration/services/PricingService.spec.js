/* global PricingService */

const { expect } = require('chai');

describe('PricingService', () => {
    describe('.getPrice()', () => {
        it('gets the correct price', () => {
            const config = {
                daily: 0.6,
                deposit: 14,
                breakpoints: [
                    { day: 1, value: 1, price: 10 },
                    { day: 3, value: 0.8, price: 30 },
                    { day: 7, value: 0.6, price: 70 },
                    { day: 14, value: 0.4, price: 140 },
                ],
            };

            const tests = [
                {
                    input: {
                        dayOne: 10,
                        nbDays: 30,
                        array: true,
                        config,
                    },
                    expected: [10, 16, 20, 25, 30, 35, 38, 42, 46, 49, 53, 56, 60, 62, 65, 67, 70, 72, 74, 77, 79, 82, 84, 86, 89, 91, 94, 96, 98, 101],
                },
                {
                    input: {
                        dayOne: 10,
                        nbDays: 30,
                        config,
                    },
                    expected: 101,
                },
            ];

            tests.forEach(test => {
                expect(PricingService.getPrice(test.input)).to.deep.equal(test.expected);
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

