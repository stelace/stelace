(function () {

    angular
        .module("app.core")
        .factory("pricing", pricing);

    function pricing($http, $q, tools, apiBaseUrl) {
        var service = {};
        service.roundPrice                 = roundPrice;
        service.getDurationPrice           = getDurationPrice;
        service.getPriceAfterRebateAndFees = getPriceAfterRebateAndFees;
        service.getDutyFreePrice           = getDutyFreePrice;
        service.isValidCustomDurationConfig = isValidCustomDurationConfig;
        service.rentingPriceRecommendation = rentingPriceRecommendation;

        return service;



        function roundPrice(price) {
            if (typeof price === "string") {
                price = parseFloat(price);
            }

            if (price < 3) {
                return tools.roundDecimal(price, 1);
            } else {
                return Math.floor(price);
            }
        }

        /**
         * Get price depending on duration
         * @param {Object} args
         * @param {Number} args.nbTimeUnits
         * @param {Number} args.timeUnitPrice
         * @param {Object} args.customConfig
         * @param {Boolean} [args.array = false] - if true, get array of prices
         * @return {Number|Number[]} price or array of prices
         */
        function getDurationPrice(args) {
            var nbTimeUnits = args.nbTimeUnits;
            var timeUnitPrice = args.timeUnitPrice;
            var customConfig = args.customConfig;
            var array = args.array || false;

            if (typeof nbTimeUnits !== 'number'
             || typeof timeUnitPrice !== 'number'
            ) {
                throw new Error('Missing parameters');
            }

            var iterator;

            if (customConfig && customConfig.duration) {
                iterator = _getCustomDurationPriceIterator({ customConfig: customConfig });
            } else {
                iterator = _getDefaultDurationPriceIterator({ timeUnitPrice: timeUnitPrice });
            }

            var prices = [];

            _.times(nbTimeUnits, function () {
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

        function _getDefaultDurationPriceIterator(args) {
            var timeUnitPrice = args.timeUnitPrice;

            var iterator = {
                _nbUnits: 1,
                _timeUnitPrice: timeUnitPrice,
            };

            iterator.next = function () {
                var value = iterator._nbUnits * iterator._timeUnitPrice;
                iterator._nbUnits += 1;

                return {
                    value: value,
                    done: false,
                };
            };

            return iterator;
        }

        function _getCustomDurationPriceIterator(args) {
            var customConfig = args.customConfig;

            if (!customConfig || !customConfig.duration) {
                throw new Error('Missing duration config');
            }

            var config = customConfig.duration;

            if (! isValidCustomDurationConfig(config)) {
                throw new Error('Invalid custom duration config');
            }

            var PriceIterator = function (breakpoints) {
                var lastBreakpoint = _.last(breakpoints);
                var currentNbUnits   = 1;
                var breakpointIndex  = 0;
                var price            = 0;
                var deltaPrice       = 0;
                var currentBreakpoint;
                var nextBreakpoint;

                var setBreakpointState = function () {
                    currentBreakpoint    = breakpoints[breakpointIndex];
                    var isLastBreakpoint = (currentBreakpoint.nbUnits === lastBreakpoint.nbUnits);
                    nextBreakpoint       = (! isLastBreakpoint ? breakpoints[breakpointIndex + 1] : null);

                    if (nextBreakpoint) {
                        deltaPrice = (nextBreakpoint.price - currentBreakpoint.price) / (nextBreakpoint.nbUnits - currentBreakpoint.nbUnits);
                    }
                };

                setBreakpointState();

                var next = function () {
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

                return { next: next };
            };

            return new PriceIterator(config.breakpoints);
        }

        /**
         * get price after rebate and fees
         * @param  {object} args
         * @param  {object} args.booking                    booking or ownerPrice (if booking provided, autofill other fields)
         * @param  {number} args.ownerPrice
         * @param  {number} [args.freeValue = 0]
         * @param  {number} [args.ownerFeesPercent = 0]     do not mix fees and fees percent (use one of them)
         * @param  {number} [args.takerFeesPercent = 0]     owner and takerFeesPercent must be used together
         * @param  {number} [args.ownerFees = 0]
         * @param  {number} [args.takerFees = 0]            owner and takerFees must be used together
         * @param  {number} [args.discountValue = 0]
         * @param  {number} [args.maxDiscountPercent = 80]  discount cannot exceed that rate from ownerPrice
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

            if (useFeesPercent && useFees) {
                throw new Error("No fees mix expected");
            }

            if (! useFeesPercent && ! useFees) {
                useFeesPercent = true;
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
                ownerFeesPercent = args.ownerFeesPercent || 0;
                takerFeesPercent = args.takerFeesPercent || 0;

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
            return tools.roundDecimal(ownerPriceAfterRebate - ownerFees, 1);
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
                return tools.roundDecimal(ownerFees, 1);
            }
        }

        function _roundTakerFees(takerFees) {
            return Math.ceil(takerFees);
        }

        function getDutyFreePrice(taxedPrice, taxPercent) {
            var dutyFreePrice = tools.roundDecimal(taxedPrice / (1 + taxPercent / 100), 2);
            var taxValue      = tools.roundDecimal(taxedPrice - dutyFreePrice, 2);

            return {
                dutyFreePrice: dutyFreePrice,
                taxValue: taxValue
            };
        }

        function rentingPriceRecommendation(sellingPrice) {
            var value = parseFloat(sellingPrice);

            if (! value) { // free or invalid
                return {
                    lowTimeUnitPrice: 0,
                    timeUnitPrice: 0,
                    highTimeUnitPrice: 0
                };
            }

            return $http.post(apiBaseUrl + "/listing/price-recommendation/time-unit-price", { value: value })
                .then(function (res) {
                    return res.data;
                });
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

            var lastBreakpoint;

            return _.reduce(config.breakpoints, function (memo, breakpoint, index) {
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
    }

})();
