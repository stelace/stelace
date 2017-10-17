(function () {

    angular
        .module("app.widgets")
        .directive("sipPricingTable", sipPricingTable);

    function sipPricingTable(BookingService, ItemService, pricing, tools) {
        var priceResult;

        /**
         * {object}  booking - if provided, it autofills variables (only need item)
         * {object}  item
         * {object}  [parentBooking] - only needed for leasing discount in rental-purchase mode
         * {string}  itemMode - ["classic"]
         * {string}  bookingMode - ["renting", "purchase", "rental-purchase"]
         * {object}  itemPricing
         * {number}  maxBookingDuration
         * {object}  data - to get data from internal to external
         *
         * {object}  bookingParams
         * {string}  bookingParams.startDate
         * {string}  bookingParams.endDate
         * {boolean} [bookingParams.applyFreeFees = false]
         */
        return {
            restrict: "EA",
            scope: {
                booking: "=?",
                item: "=",
                parentBooking: "=?",
                itemMode: "=?",
                bookingMode: "=?",
                itemPricing: "=?",
                maxBookingDuration: "=?",
                bookingParams: "=?",
                data: "=?"
            },
            link: link,
            templateUrl: "/assets/app/widgets/pricing-table/pricing-table.html"
        };

        function link(scope) {
            init();

            // if item is changed, recompute all data (all params depend on item)
            scope.$watch("item", function (newValue, oldValue) {
                // do not init twice
                if (newValue === oldValue) {
                    return;
                }

                init();
            });

            scope.$watch("booking", function (newValue, oldValue) {
                // do not init twice
                if (newValue === oldValue) {
                    return;
                }

                init();
            });

            scope.$watchGroup([
                "parentBooking",
                "itemMode",
                "bookingMode",
                "itemPricing",
                "maxBookingDuration"
            ], function (newValue, oldValue) {
                // do not init twice
                if (newValue === oldValue) {
                    return;
                }

                // if booking is set, do not care the changes
                if (scope.booking) {
                    return;
                }

                init();
            });

            // only booking params change, so do not recompute booking config
            scope.$watch("bookingParams", function (newValue, oldValue) {
                // do not init twice
                if (newValue === oldValue) {
                    return;
                }

                // if booking is set, do not care the changes
                if (scope.booking) {
                    return;
                }

                setBookingParams();
            }, true);



            ////////////////////
            // IMPLEMENTATION //
            ////////////////////
            function init() {
                if (scope.booking) {
                    scope.itemMode      = scope.booking.itemMode;
                    scope.bookingMode   = scope.booking.bookingMode;
                    scope.applyFreeFees = scope.booking.takerFreeFees;
                }

                scope.purchase = isPurchase();
                populateItem();
                setBookingParams();
            }

            function populateItem() {
                if (scope.purchase) {
                    return;
                }

                var nbDays;

                if (scope.booking) {
                    // no need to compute more than booking nb booked days
                    nbDays = scope.booking.nbBookedDays;
                } else {
                    nbDays = scope.maxBookingDuration;
                }

                ItemService.populate(scope.item, {
                    nbDaysPricing: nbDays
                });
            }

            function getBookingDuration() {
                if (scope.purchase) {
                    return 0;
                }

                if (scope.booking) {
                    return scope.booking.nbBookedDays;
                }

                return BookingService.getBookingDuration(scope.startDate, scope.endDate);
            }

            function setBookingParams() {
                if (scope.booking) {
                    scope.startDate     = scope.booking.startDate;
                    scope.endDate       = scope.booking.endDate;
                    scope.applyFreeFees = scope.booking.applyFreeFees || false;
                } else {
                    scope.startDate     = scope.bookingParams.startDate;
                    scope.endDate       = scope.bookingParams.endDate;
                    scope.applyFreeFees = scope.bookingParams.applyFreeFees || false;
                }

                if (scope.booking) {
                    scope.dayOnePrice = scope.booking.dayOnePrice;
                } else {
                    scope.dayOnePrice = scope.item.prices[0];
                }

                scope.nbBookedDays         = getBookingDuration();
                priceResult                = getPriceResult();
                scope.fullPrice            = getFullPrice();
                scope.discount             = getDiscount();
                scope.durationDiscount     = getDurationDiscount();
                scope.durationDiscountRate = getDurationDiscountRate();
                scope.leasingDiscount      = getLeasingDiscount();
                scope.leasingDiscountRate  = getLeasingDiscountRate();
                scope.takerFees            = getTakerFees();
                scope.takerFeesStr         = getTakerFeesDescription(
                    scope.applyFreeFees,
                    priceResult.ownerPriceAfterRebate
                );
                scope.totalPrice    = getTotalPrice();
                scope.dailyPrice    = getDailyPrice();
                scope.dailyPriceStr = scope.dailyPrice.toLocaleString();

                // copy isolated scope to external
                if (typeof scope.data === "object") {
                    _.forEach(_.keys(scope.data), function (field) {
                        scope.data[field] = scope[field];
                    });
                }
            }

            function isPurchase() {
                return _.includes(["rental-purchase", "purchase"], scope.bookingMode);
            }

            function getFullPrice() {
                if (! scope.purchase) {
                    return scope.nbBookedDays * scope.item.prices[0];
                } else {
                    return scope.item.sellingPrice;
                }
            }

            function getRealPrice() {
                if (! scope.purchase) {
                    return scope.item.prices[scope.nbBookedDays - 1];
                } else {
                    return scope.item.sellingPrice;
                }
            }

            function getDiscount() {
                return 0;
            }

            function getDurationDiscount() {
                return Math.round(getFullPrice() - getRealPrice());
            }

            function getDurationDiscountRate() {
                return Math.round(getDurationDiscount() / getFullPrice() * 100);
            }

            function getPriceResult() {
                var priceResult;

                if (scope.booking) {
                    priceResult = pricing.getPriceAfterRebateAndFees({ booking: scope.booking });
                } else {
                    var discountValue = 0;

                    // leasing
                    if (scope.bookingMode === "rental-purchase" && scope.parentBooking) {
                        var parentPriceResult = pricing.getPriceAfterRebateAndFees({ booking: scope.parentBooking });
                        discountValue = parentPriceResult.ownerPriceAfterRebate;
                    }

                    priceResult = pricing.getPriceAfterRebateAndFees({
                        ownerPrice: getRealPrice(),
                        freeValue: getDiscount(),
                        ownerFeesPercent: 0, // do not care about owner fees
                        takerFeesPercent: ! scope.applyFreeFees ? getTakerFeesPercent() : 0,
                        discountValue: discountValue,
                        maxDiscountPercent: scope.itemPricing.maxDiscountPurchasePercent
                    });
                }

                return priceResult;
            }

            function getTakerFeesPercent() {
                if (scope.booking) {
                    return scope.booking.takerFeesPercent;
                }

                if (scope.purchase) {
                    return scope.itemPricing.takerFeesPurchasePercent;
                } else {
                    return scope.itemPricing.takerFeesPercent;
                }
            }

            function getLeasingDiscount() {
                if (! scope.purchase) {
                    return 0;
                }

                return priceResult.realDiscountValue;
            }

            function getLeasingDiscountRate() {
                return Math.round(getLeasingDiscount() / getFullPrice() * 100);
            }

            function getTakerFees() {
                return priceResult.takerFees;
            }

            function getTotalPrice() {
                return priceResult.takerPrice;
            }

            function getDailyPrice() {
                if (scope.purchase) {
                    return 0;
                }

                return tools.roundDecimal(getTotalPrice(priceResult) / scope.nbBookedDays, 1);
            }

            function getTakerFeesDescription(applyFreeFees, amount) {
                var str = "Ces frais participent au fonctionnement de la plateforme et nous permettent de vous offrir la meilleure qualité de service.";

                if (applyFreeFees) {
                    str += " Vous avez activé l'option 0 commission.";
                }

                if (amount) {
                    str += " Les " + amount + "€ restants correspondent au prix fixé par le propriétaire.";
                }

                return str;
            }
        }
    }

})();
