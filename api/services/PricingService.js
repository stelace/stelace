/* global MathService */

module.exports = {

    get,
    roundPrice,
    getDurationPrice,
    getPricing,
    getPriceAfterRebateAndFees,
    getDutyFreePrice,

    isValidCustomDurationConfig,

};

var moment = require('moment');
const _ = require('lodash');

var params = {
    ownerFeesPercent: 5,
    takerFeesPercent: 15,
    maxDiscountPercent: 80, // used when extend booking
    ownerFeesPurchasePercent: 7,
    takerFeesPurchasePercent: 0,
    maxDiscountPurchasePercent: 80 // used when purchase after rental
};

// Example

// var pricing = [
//     {
//         id: 1,
//         startDate: "",
//         endDate: "",
//         priority: 0,
//         pause: false,
//         config: {
//             daily: 0.6, // ratio based on the first day
//             deposit: 14, // ratio based on the first day
//             breakpoints: [
//                 {
//                     day: 1,
//                     value: 1
//                 },
//                 {
//                     day: 8,
//                     value: 0.6
//                 }
//             ]
//         }
//     }
// ];

var pricing = [
    {
        id: 1,
        startDate: "",
        endDate: "",
        priority: 0,
        pause: false,
        config: {
            daily: 0.6,
            deposit: 14,
            breakpoints: [
                {
                    day: 1,
                    value: 1
                },
                {
                    day: 3,
                    value: 0.8
                },
                {
                    day: 7,
                    value: 0.6
                },
                {
                    day: 14,
                    value: 0.4
                }
            ]
        }
    }
];

function get(prop) {
    if (prop) {
        return params[prop];
    } else {
        return params;
    }
}

function _selectConfig(config, id) {
    var now = moment().toISOString();
    var results;

    if (id) {
        results = _.filter(config, function (object) {
            return object.id === id;
        });
    } else {
        results = _(config)
            .filter(function (object) {
                if (object.pause) {
                    return false;
                }
                if (object.startDate && now < object.startDate) {
                    return false;
                }
                if (object.endDate && object.endDate <= now) {
                    return false;
                }
                return true;
            })
            .sortBy(function (object) {
                return - object.priority;
            })
            .value();
    }

    if (! results.length) {
        return;
    }

    var filteredAttrs = [
        "id",
        "config"
    ];

    return _.pick(results[0], filteredAttrs);
}

function roundPrice(price) {
    if (typeof price === "string") {
        price = parseFloat(price);
    }

    if (price < 3) {
        return MathService.roundDecimal(price, 1);
    } else {
        return Math.floor(price);
    }
}

/**
 * Get price depending on duration
 * @param {Number} nbTimeUnits
 * @param {Number} timeUnitPrice
 * @param {Object} customConfig
 * @param {Boolean} [array = false] - if true, get array of prices
 * @return {Number|Number[]} price or array of prices
 */
function getDurationPrice({ nbTimeUnits, timeUnitPrice, customConfig, array = false }) {
    if (typeof nbTimeUnits !== 'number'
     || typeof timeUnitPrice !== 'number'
    ) {
        throw new Error('Missing parameters');
    }

    let iterator;

    if (customConfig && customConfig.duration) {
        iterator = _getCustomDurationPriceIterator({ customConfig });
    } else {
        iterator = _getDefaultDurationPriceIterator({ timeUnitPrice });
    }

    const prices = [];

    _.times(nbTimeUnits, () => {
        var price = iterator.next().value;
        price     = roundPrice(price);
        price     = (price >= 0 ? price : 0);
        prices.push(price);
    });

    if (array) {
        return prices;
    } else {
        return _.last(prices);
    }
}

function _getDefaultDurationPriceIterator({ timeUnitPrice }) {
    const iterator = {
        _nbUnits: 1,
        _timeUnitPrice: timeUnitPrice,
    };

    iterator.next = () => {
        const value = iterator._nbUnits * iterator._timeUnitPrice;
        iterator._nbUnits += 1;

        return {
            value,
            done: false,
        };
    };

    return iterator;
}

function _getCustomDurationPriceIterator({ customConfig }) {
    if (!customConfig || !customConfig.duration) {
        throw new Error('Missing duration config');
    }

    const config = customConfig.duration;

    if (! isValidCustomDurationConfig(config)) {
        throw new Error('Invalid custom duration config');
    }

    const PriceIterator = function (breakpoints) {
        const lastBreakpoint = _.last(breakpoints);
        let currentNbUnits   = 1;
        let breakpointIndex  = 0;
        let price            = 0;
        let deltaPrice       = 0;
        let currentBreakpoint;
        let nextBreakpoint;

        const setBreakpointState = function () {
            currentBreakpoint    = breakpoints[breakpointIndex];
            const isLastBreakpoint = (currentBreakpoint.nbUnits === lastBreakpoint.nbUnits);
            nextBreakpoint       = (! isLastBreakpoint ? breakpoints[breakpointIndex + 1] : null);

            if (nextBreakpoint) {
                deltaPrice = (nextBreakpoint.price - currentBreakpoint.price) / (nextBreakpoint.nbUnits - currentBreakpoint.nbUnits);
            }
        };

        setBreakpointState();

        const next = function () {
            if (currentNbUnits === 1) {
                price = currentBreakpoint.price;
            } else if (nextBreakpoint && nextBreakpoint.nbUnits === currentNbUnits) {
                price = nextBreakpoint.price;
                ++breakpointIndex;
                setBreakpointState();
            } else {
                price += deltaPrice;
            }
            ++currentNbUnits;

            return {
                value: price,
                done: false
            };
        };

        return { next };
    };

    return new PriceIterator(config.breakpoints);
}

// /**
//  * get regressive price iterator
//  * @param  {object}   args
//  * @param  {number}   args.dayOne
//  * @param  {number}   args.nbDays
//  *
//  * @param  {object}   args.config - config from _selectConfig()
//  * @param  {object[]} args.config.breakpoints
//  * @param  {number}   args.config.breakpoints.day
//  * @param  {number}   args.config.breakpoints.value
//  * @param  {number}   args.config.daily
//  *
//  * @return {object}   iterator
//  * @return {function} iterator.next
//  */
// function _getRegressivePriceIterator(args) {
//     var dayOne = args.dayOne;
//     var nbDays = args.nbDays;
//     var config = args.config;

//     if ((! dayOne && dayOne !== 0) // allow free
//      || ! nbDays
//      || ! config
//     ) {
//         throw new Error("Missing params");
//     }

//     var breakpoints = _.sortBy(config.breakpoints, function (breakpoint) {
//         return breakpoint.day;
//     });
//     var basisPricePerDay = dayOne * config.daily;

//     if (breakpoints[0].day !== 1) {
//         throw new Error("Bad config");
//     }

//     var PriceIterator = function (breakpoints) {
//         var price           = 0;
//         var dayNum          = 1;
//         var breakpointIndex = 0;
//         var lastBreakpoint  = _.last(breakpoints);
//         var currentBreakpoint;
//         var nextBreakpoint;

//         var setBreakpointState = function () {
//             currentBreakpoint    = breakpoints[breakpointIndex];
//             var isLastBreakpoint = (currentBreakpoint.day === lastBreakpoint.day);
//             nextBreakpoint       = (! isLastBreakpoint ? breakpoints[breakpointIndex + 1] : null);
//         };

//         setBreakpointState();

//         var next = function () {
//             if (dayNum === 1) {
//                 price = dayOne;
//             } else {
//                 if (nextBreakpoint && nextBreakpoint.day === dayNum) {
//                     ++breakpointIndex;
//                     setBreakpointState();
//                 }

//                 price += basisPricePerDay * currentBreakpoint.value;
//             }
//             ++dayNum;

//             return {
//                 value: price,
//                 done: false
//             };
//         };

//         return {
//             next: next
//         };
//     };

//     return new PriceIterator(breakpoints);
// }

function getPricing(pricingId) {
    return _selectConfig(pricing, pricingId);
}

/**
 * get price after rebate and fees
 * FEES POLICY:
 * - taker fees are round to superior unit
 * - owner fees are round to superior 1/10 unit
 *
 * @param  {object} args
 * @param  {object} args.booking                     booking or ownerPrice (if booking provided, autofill other fields)
 * @param  {number} args.ownerPrice
 * @param  {number} [args.freeValue = 0]
 * @param  {number} [args.ownerFeesPercent = 0]      do not mix fees and fees percent (use one of them)
 * @param  {number} [args.takerFeesPercent = 0]      owner and takerFeesPercent must be used together
 * @param  {number} [args.ownerFees = 0]
 * @param  {number} [args.takerFees = 0]             owner and takerFees must be used together
 * @param  {number} [args.discountValue = 0]
 * @param  {number} [args.maxDiscountPercent = 80]   discount cannot exceed that rate from ownerPrice
 *
 * @return {object} obj
 * @return {number} obj.ownerPriceAfterRebate
 * @return {number} obj.ownerNetIncome
 * @return {number} obj.takerPrice
 * @return {number} obj.ownerFees
 * @return {number} obj.ownerFeesPercent
 * @return {number} obj.takerFees
 * @return {number} obj.takerFeesPercent
 * @return {number} obj.realDiscountValue - discount value that is really applied
 */
function getPriceAfterRebateAndFees(args) {
    var ownerFeesThreshold = 20; // 20€

    var booking = args.booking;

    if (booking) {
        return getPriceAfterRebateAndFees({
            ownerPrice: booking.ownerPrice,
            freeValue: booking.priceData.freeValue,
            ownerFees: booking.ownerFees,
            takerFees: booking.takerFees,
            discountValue: booking.priceData.discountValue,
            maxDiscountPercent: booking.listingType.config.pricing.maxDiscountPercent
        });
    }

    var useFeesPercent = typeof args.ownerFeesPercent !== "undefined"
        && typeof args.takerFeesPercent !== "undefined";

    var useFees = typeof args.ownerFees !== "undefined"
        && typeof args.takerFees !== "undefined";

    var useDefaultFees;

    if (useFeesPercent && useFees) {
        throw new Error("No fees mix expected");
    }

    if (! useFeesPercent && ! useFees) {
        useFeesPercent = true;
        useDefaultFees = true;
    }

    var ownerPrice         = args.ownerPrice;
    var freeValue          = args.freeValue || 0;
    var discountValue      = args.discountValue || 0;
    var maxDiscountPercent = args.maxDiscountPercent || 80;

    var ownerPriceAfterRebate = ownerPrice;
    var ownerNetIncome;
    var takerPrice;
    var ownerFeesPercent;
    var takerFeesPercent;
    var ownerFees;
    var takerFees;
    var realDiscountValue;

    ownerPriceAfterRebate = _getPriceAfterDiscount(ownerPriceAfterRebate, freeValue);
    realDiscountValue     = _getRealDiscountValue(ownerPriceAfterRebate, discountValue, maxDiscountPercent);
    ownerPriceAfterRebate = _getPriceAfterDiscount(ownerPriceAfterRebate, realDiscountValue);

    // wrap all arithmetic operations because of floating precision
    if (useFees) {
        ownerFees = args.ownerFees || 0;
        takerFees = args.takerFees || 0;

        ownerNetIncome   = _getOwnerNetIncome(ownerPriceAfterRebate, ownerFees);
        ownerFeesPercent = _getFeesPercent(ownerFees, ownerPriceAfterRebate);

        takerPrice       = _getTakerPrice(ownerPriceAfterRebate, takerFees);
        takerFeesPercent = _getFeesPercent(takerFees, takerPrice);
    } else { // useFeesPercent
        ownerFeesPercent = args.ownerFeesPercent || (useDefaultFees ? params.ownerFeesPercent : 0);
        takerFeesPercent = args.takerFeesPercent || (useDefaultFees ? params.takerFeesPercent : 0);

        var ownerFeesRate        = ownerFeesPercent / 100;
        var takerFeesRate        = takerFeesPercent / 100;
        var reverseTakerFeesRate = takerFeesRate / (1 - takerFeesRate);

        ownerFees      = ownerFeesRate * ownerPriceAfterRebate;
        ownerFees      = _roundOwnerFees(ownerFees, ownerPriceAfterRebate, ownerFeesThreshold);
        ownerNetIncome = _getOwnerNetIncome(ownerPriceAfterRebate, ownerFees);

        takerFees  = _roundTakerFees(reverseTakerFeesRate * ownerPriceAfterRebate);
        takerPrice = _getTakerPrice(ownerPriceAfterRebate, takerFees);
    }

    return {
        ownerPriceAfterRebate: ownerPriceAfterRebate,
        ownerNetIncome: ownerNetIncome,
        takerPrice: takerPrice,
        ownerFeesPercent: ownerFeesPercent,
        takerFeesPercent: takerFeesPercent,
        ownerFees: ownerFees,
        takerFees: takerFees,
        realDiscountValue: realDiscountValue
    };
}

function _getPriceAfterDiscount(price, discount) {
    return Math.round(price - discount);
}

function _getRealDiscountValue(ownerPrice, discountValue, maxDiscountPercent) {
    var maxDiscountValue = Math.round(ownerPrice * maxDiscountPercent / 100);
    return Math.min(discountValue, maxDiscountValue);
}

function _getOwnerNetIncome(ownerPriceAfterRebate, ownerFees) {
    return MathService.roundDecimal(ownerPriceAfterRebate - ownerFees, 1);
}

function _getTakerPrice(ownerPriceAfterRebate, takerFees) {
    return Math.round(ownerPriceAfterRebate + takerFees);
}

function _getFeesPercent(fees, price) {
    return Math.round(fees * 100 / price);
}

function _roundOwnerFees(ownerFees, ownerPriceAfterRebate, ownerFeesThreshold) {
    if (ownerPriceAfterRebate >= ownerFeesThreshold) {
        return Math.round(ownerFees);
    } else {
        return MathService.roundDecimal(ownerFees, 1);
    }
}

function _roundTakerFees(takerFees) {
    return Math.ceil(takerFees);
}

function getDutyFreePrice(taxedPrice, taxPercent) {
    var dutyFreePrice = MathService.roundDecimal(taxedPrice / (1 + taxPercent / 100), 2);
    var taxValue      = MathService.roundDecimal(taxedPrice - dutyFreePrice, 2);

    return {
        dutyFreePrice: dutyFreePrice,
        taxValue: taxValue
    };
}

/**
 * Check valid custom duration config
 * @param  {Object}   config
 * @param  {Object[]} config.breakpoints
 * @param  {Number}   config.breakpoints.nbUnits
 * @param  {Number}   config.breakpoints.price
 * @return {Boolean}
 */
function isValidCustomDurationConfig(config) {
    if (typeof config !== "object"
     || ! config
     || ! _.isArray(config.breakpoints)
     || config.breakpoints.length < 2
    ) {
        return false;
    }

    let lastBreakpoint;

    return _.reduce(config.breakpoints, (memo, breakpoint, index) => {
        if (! memo) {
            return memo;
        }

        if (! isCustomConfigBreakpoint(breakpoint)) {
            return false;
        }

        if (index === 0) {
            // the first breakpoint must be unit one
            if (breakpoint.nbUnits !== 1) {
                return false;
            }
        } else {
            // the breakpoint nb units and price must be higher than the previous one
            if (breakpoint.nbUnits <= lastBreakpoint.nbUnits
             || breakpoint.price < lastBreakpoint.price
            ) {
                return false;
            }
        }

        lastBreakpoint = _.clone(breakpoint);

        return memo;
    }, true);
}

function isCustomConfigBreakpoint(breakpoint) {
    return typeof breakpoint === 'object'
        && typeof breakpoint.nbUnits === 'number'
        && typeof breakpoint.price === 'number'
        && breakpoint
        && breakpoint.nbUnits > 0
        && breakpoint.price >= 0;
}
