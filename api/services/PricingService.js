/* global MathService */

module.exports = {

    get: get,
    roundPrice: roundPrice,
    getPrice: getPrice,
    getPricing: getPricing,
    getPriceAfterRebateAndFees: getPriceAfterRebateAndFees,
    getDutyFreePrice: getDutyFreePrice,

    isValidCustomConfig: isValidCustomConfig

};

var moment = require('moment');

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
 * get price
 * @param  {object}  args
 * @param  {number}  args.nbDays
 * @param  {object}  args.config
 * @param  {number}  args.dayOne - required if custom is false
 * @param  {boolean} [args.custom = false] - if true, use custom config
 * @param  {boolean} [args.array = false] - if true, get array of prices
 * @return {number|number[]} price or array of prices (price per day)
 */
function getPrice(args) {
    args = args || {};
    var nbDays = args.nbDays;
    var custom = args.custom || false;
    var array  = args.array || false;

    var it;

    if (! custom) {
        it = _getRegressivePriceIterator(args);
    } else {
        it = _getCustomPriceIterator(args);
    }

    var prices = [];

    _.times(nbDays, () => {
        var price = it.next().value;
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

/**
 * get regressive price iterator
 * @param  {object}   args
 * @param  {number}   args.dayOne
 * @param  {number}   args.nbDays
 *
 * @param  {object}   args.config - config from _selectConfig()
 * @param  {object[]} args.config.breakpoints
 * @param  {number}   args.config.breakpoints.day
 * @param  {number}   args.config.breakpoints.value
 * @param  {number}   args.config.daily
 *
 * @return {object}   iterator
 * @return {function} iterator.next
 */
function _getRegressivePriceIterator(args) {
    var dayOne = args.dayOne;
    var nbDays = args.nbDays;
    var config = args.config;

    if ((! dayOne && dayOne !== 0) // allow free
     || ! nbDays
     || ! config
    ) {
        throw new Error("Missing params");
    }

    var breakpoints = _.sortBy(config.breakpoints, function (breakpoint) {
        return breakpoint.day;
    });
    var basisPricePerDay = dayOne * config.daily;

    if (breakpoints[0].day !== 1) {
        throw new Error("Bad config");
    }

    var PriceIterator = function (breakpoints) {
        var price           = 0;
        var dayNum          = 1;
        var breakpointIndex = 0;
        var lastBreakpoint  = _.last(breakpoints);
        var currentBreakpoint;
        var nextBreakpoint;

        var setBreakpointState = function () {
            currentBreakpoint    = breakpoints[breakpointIndex];
            var isLastBreakpoint = (currentBreakpoint.day === lastBreakpoint.day);
            nextBreakpoint       = (! isLastBreakpoint ? breakpoints[breakpointIndex + 1] : null);
        };

        setBreakpointState();

        var next = function () {
            if (dayNum === 1) {
                price = dayOne;
            } else {
                if (nextBreakpoint && nextBreakpoint.day === dayNum) {
                    ++breakpointIndex;
                    setBreakpointState();
                }

                price += basisPricePerDay * currentBreakpoint.value;
            }
            ++dayNum;

            return {
                value: price,
                done: false
            };
        };

        return {
            next: next
        };
    };

    return new PriceIterator(breakpoints);
}

/**
 * get custom price iterator
 * @param  {object}   args
 * @param  {number}   args.nbDays
 *
 * @param  {object}   args.config - custom config
 * @param  {object[]} args.config.breakpoints
 * @param  {number}   args.config.breakpoints.day
 * @param  {number}   args.config.breakpoints.price
 *
 * @return {object}   iterator
 * @return {function} iterator.next
 */
function _getCustomPriceIterator(args) {
    var nbDays = args.nbDays;
    var config = args.config;

    if (! nbDays
     || ! isValidCustomConfig(config)
    ) {
        throw new Error("Missing params");
    }

    var breakpoints = config.breakpoints;

    var PriceIterator = function (breakpoints) {
        var dayNum          = 1;
        var breakpointIndex = 0;
        var price           = 0;
        var deltaPrice      = 0;
        var lastBreakpoint  = _.last(breakpoints);
        var currentBreakpoint;
        var nextBreakpoint;

        var setBreakpointState = function () {
            currentBreakpoint    = breakpoints[breakpointIndex];
            var isLastBreakpoint = (currentBreakpoint.day === lastBreakpoint.day);
            nextBreakpoint       = (! isLastBreakpoint ? breakpoints[breakpointIndex + 1] : null);

            if (nextBreakpoint) {
                deltaPrice = (nextBreakpoint.price - currentBreakpoint.price) / (nextBreakpoint.day - currentBreakpoint.day);
            }
        };

        setBreakpointState();

        var next = function () {
            if (dayNum === 1) {
                price = currentBreakpoint.price;
            } else if (nextBreakpoint && nextBreakpoint.day === dayNum) {
                price = nextBreakpoint.price;
                ++breakpointIndex;
                setBreakpointState();
            } else {
                price += deltaPrice;
            }
            ++dayNum;

            return {
                value: price,
                done: false
            };
        };

        return {
            next: next
        };
    };

    return new PriceIterator(breakpoints);
}

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
 * is valid custom config
 * @param  {object}   config
 * @param  {object[]} config.breakpoints
 * @param  {number}   config.breakpoints.day
 * @param  {number}   config.breakpoints.price
 * @return {boolean}
 */
function isValidCustomConfig(config) {
    if (typeof config !== "object"
     || ! config
     || ! _.isArray(config.breakpoints)
     || config.breakpoints.length < 2
    ) {
        return false;
    }

    var lastBreakpoint;

    return _.reduce(config.breakpoints, (memo, breakpoint, index) => {
        if (! memo) {
            return memo;
        }

        if (! isCustomConfigBreakpoint(breakpoint)) {
            return false;
        }

        if (index === 0) {
            // the first breakpoint must be day one
            if (breakpoint.day !== 1) {
                return false;
            }
        } else {
            // the breakpoint day and price must be higher than the previous one
            if (breakpoint.day <= lastBreakpoint.day
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
    return typeof breakpoint === "object"
        && typeof breakpoint.day === "number"
        && typeof breakpoint.price === "number"
        && breakpoint
        && breakpoint.day > 0
        && breakpoint.price >= 0;
}
