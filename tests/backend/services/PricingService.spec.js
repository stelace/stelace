var chai = require('chai');
var expect = chai.expect;

global._ = require('lodash');
global.ToolsService = require('../../../api/services/ToolsService');

var PricingService = require('../../../api/services/PricingService');

xdescribe("PricingService", function () {

    describe("#getPrice()", function () {
        it("should get price", function () {
            var config = {
                daily: 0.6,
                deposit: 14,
                breakpoints: [
                    {
                        day: 1,
                        value: 1,
                        price: 10
                    },
                    {
                        day: 3,
                        value: 0.8,
                        price: 30
                    },
                    {
                        day: 7,
                        value: 0.6,
                        price: 70
                    },
                    {
                        day: 14,
                        value: 0.4,
                        price: 140
                    }
                ]
            };

            var tests = [
                {
                    args: {
                        dayOne: 10,
                        nbDays: 30,
                        array: true,
                        config: config
                    },
                    expectedResult: [10, 16, 20, 25, 30, 35, 38, 42, 46, 49, 53, 56, 60, 62, 65, 67, 70, 72, 74, 77, 79, 82, 84, 86, 89, 91, 94, 96, 98, 101]
                },
                {
                    args: {
                        dayOne: 10,
                        nbDays: 30,
                        config: config
                    },
                    expectedResult: 101
                },
                {
                    args: {
                        dayOne: 10,
                        nbDays: 13,
                        custom: true,
                        array: true,
                        config: config
                    },
                    expectedResult: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130]
                }
            ];

            _.forEach(tests, function (test) {
                expect(PricingService.getPrice(test.args)).to.deep.equal(test.expectedResult);
            });
        });
    });

    describe("#roundPrice()", function () {
        it("should round price to cents", function () {
            var tests = [
                {
                    nb: 2.46,
                    expectedResult: 2.5
                },
                {
                    nb: 15.6547,
                    expectedResult: 15
                },
                {
                    nb: 789.78956,
                    expectedResult: 789
                }
            ];

            _.forEach(tests, function (test) {
                expect(PricingService.roundPrice(test.nb)).to.equal(test.expectedResult);
            });
        });
    });

});

