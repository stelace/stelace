(function () {

    angular
        .module("app.widgets")
        .directive("sipPricingTable", sipPricingTable);

    function sipPricingTable(BookingService, ListingService, pricing, tools) {
        var priceResult;

        /**
         * {object}  booking - if provided, it autofills variables (only need listing)
         * {object}  listing
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
                listingType: "=?",
                listing: "=",
                bookingParams: "=?",
                data: "=?"
            },
            link: link,
            templateUrl: "/assets/app/widgets/pricing-table/pricing-table.html"
        };

        function link(scope) {
            init();

            // if listing is changed, recompute all data (all params depend on listing)
            scope.$watch("listing", function (newValue, oldValue) {
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
                "listingType",
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
                    scope.applyFreeFees = scope.booking.priceData.takerFreeFees;
                }

                scope.noTime = isNoTime();
                populateListing();
                setBookingParams();
            }

            function populateListing() {
                if (scope.noTime) {
                    return;
                }

                var listingType = getListingType();
                var nbDays;

                if (scope.booking) {
                    // no need to compute more than booking nb booked days
                    nbDays = scope.booking.nbTimeUnits;
                } else {
                    nbDays = listingType.config.bookingTime.maxDuration || 100;
                }

                ListingService.populate(scope.listing, {
                    nbDaysPricing: nbDays
                });
            }

            function getBookingDuration() {
                if (scope.noTime) {
                    return 0;
                }

                if (scope.booking) {
                    return scope.booking.nbTimeUnits;
                }

                var listingType = getListingType();
                return BookingService.getNbTimeUnits(scope.startDate, scope.endDate, listingType.config.bookingTime.timeUnit);
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
                    scope.dayOnePrice = scope.booking.timeUnitPrice;
                } else {
                    scope.dayOnePrice = scope.listing.prices[0];
                }

                scope.nbTimeUnits          = getBookingDuration();
                priceResult                = getPriceResult();
                scope.fullPrice            = getFullPrice();
                scope.discount             = getDiscount();
                scope.durationDiscount     = getDurationDiscount();
                scope.durationDiscountRate = getDurationDiscountRate();
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

            function getListingType() {
                if (scope.booking) {
                    return scope.booking.listingType;
                } else {
                    return scope.listingType;
                }
            }

            function isNoTime() {
                var listingType = getListingType();

                return listingType.properties.TIME === 'NONE';
            }

            function getFullPrice() {
                if (! scope.noTime) {
                    return scope.nbTimeUnits * scope.listing.prices[0];
                } else {
                    return scope.listing.sellingPrice;
                }
            }

            function getRealPrice() {
                if (! scope.noTime) {
                    return scope.listing.prices[scope.nbTimeUnits - 1];
                } else {
                    return scope.listing.sellingPrice;
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
                var listingType = getListingType();

                if (scope.booking) {
                    priceResult = pricing.getPriceAfterRebateAndFees({ booking: scope.booking });
                } else {
                    priceResult = pricing.getPriceAfterRebateAndFees({
                        ownerPrice: getRealPrice(),
                        freeValue: getDiscount(),
                        ownerFeesPercent: 0, // do not care about owner fees
                        takerFeesPercent: ! scope.applyFreeFees ? getTakerFeesPercent() : 0,
                        maxDiscountPercent: listingType.config.pricing.maxDiscountPercent
                    });
                }

                return priceResult;
            }

            function getTakerFeesPercent() {
                if (scope.booking) {
                    return scope.booking.takerFeesPercent;
                }

                var listingType = getListingType();
                return listingType.config.pricing.takerFeesPercent || 0;
            }

            function getTakerFees() {
                return priceResult.takerFees;
            }

            function getTotalPrice() {
                return priceResult.takerPrice;
            }

            function getDailyPrice() {
                if (scope.noTime) {
                    return 0;
                }

                return tools.roundDecimal(getTotalPrice(priceResult) / scope.nbTimeUnits, 1);
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
