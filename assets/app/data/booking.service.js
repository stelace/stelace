/* global moment */

(function () {

    angular
        .module("app.data")
        .factory("BookingService", BookingService);

    function BookingService($q, Restangular, Booking, cache, ListingService, time) {
        var service = Restangular.all("booking");
        service.getMine                               = getMine;

        service.checkAvailability                     = checkAvailability;
        service.getPredictedQuantity                  = getPredictedQuantity;
        service.getNbTimeUnits                        = getNbTimeUnits;
        service.getStartDateRange                     = getStartDateRange;
        service.getEndDateRange                       = getEndDateRange;
        service.isWithinRangeStartDate                = isWithinRangeStartDate;
        service.isWithinRangeEndDate                  = isWithinRangeEndDate;
        service.isValidDates                          = isValidDates;

        service.getContractUrl                        = getContractUrl;
        service.isNoTime                              = isNoTime;
        service.getLaunchDate                         = getLaunchDate;
        service.getDueDate                            = getDueDate;
        service.getFbTransactionType                  = getFbTransactionType;

        Restangular.extendModel("booking", function (obj) {
            return Booking.mixInto(obj);
        });

        return service;



        function getMine(as) {
            as = as || "taker";
            var deferred = $q.defer();

            var cacheBookingMine = cache.get("bookingMine");

            if (cacheBookingMine[as]) {
                deferred.resolve(cacheBookingMine[as]);
            } else {
                service.customGETLIST("my", { as: as })
                    .then(function (bookings) {
                        cacheBookingMine[as] = bookings;
                        deferred.resolve(bookings);
                    })
                    .catch(function (err) {
                        deferred.reject(err);
                    });
            }

            return deferred.promise;
        }

        /**
         * Check if booking dates are valid when calendar needed based on listing type config
         * @param  {String}  startDate
         * @param  {Number}  nbTimeUnits
         * @param  {String}  refDate
         * @param  {Object}  config
         * @return {Boolean}
         */
        function isValidDates(args) {
            var startDate   = args.startDate;
            var nbTimeUnits = args.nbTimeUnits;
            var refDate     = args.refDate;
            var config      = args.config;

            var errors          = {};
            var badParamsErrors = {};

            if (!time.isDateString(startDate)) {
                badParamsErrors.BAD_FORMAT_START_DATE = true;
            }
            if (!time.isDateString(refDate)) {
                badParamsErrors.MISSING_REF_DATE = true;
            }
            if (! _.isEmpty(badParamsErrors)) {
                errors.BAD_PARAMS = badParamsErrors;
                return exposeResult(errors);
            }

            var startDateMinLimit;
            var startDateMaxLimit;

            if (config.startDateMinDelta) {
                startDateMinLimit = moment(refDate).add(config.startDateMinDelta).toISOString();
            }
            if (config.startDateMaxDelta) {
                startDateMaxLimit = moment(refDate).add(config.startDateMaxDelta).toISOString();
            }

            var durationErrors  = {};
            var startDateErrors = {};

            if (nbTimeUnits <= 0) {
                durationErrors.INVALID = true;
            } else {
                if (nbTimeUnits && config.minDuration && nbTimeUnits < config.minDuration) {
                    durationErrors.BELOW_MIN = true;
                }
                if (nbTimeUnits && config.maxDuration && config.maxDuration < nbTimeUnits) {
                    durationErrors.ABOVE_MAX = true;
                }
            }
            if (startDateMinLimit && startDate < startDateMinLimit) {
                startDateErrors.BEFORE_MIN = true;
            }
            if (startDateMaxLimit && startDateMaxLimit < startDate) {
                startDateErrors.AFTER_MAX = true;
            }

            if (! _.isEmpty(durationErrors)) {
                errors.DURATION = durationErrors;
            }
            if (! _.isEmpty(startDateErrors)) {
                errors.START_DATE = startDateErrors;
            }

            return exposeResult(errors);



            function exposeResult(errors) {
                return {
                    result: ! _.keys(errors).length,
                    errors: errors
                };
            }
        }

        function checkAvailability(args) {
            var startDate        = args.startDate;
            var endDate          = args.endDate;
            var availablePeriods = args.availablePeriods || [];
            var quantity         = args.quantity || 1;
            var listing          = args.listing;
            var listingType      = args.listingType;

            var maxQuantity = ListingService.getMaxQuantity(listing, listingType);

            if (!availablePeriods.length) {
                return quantity <= maxQuantity;
            }

            var lastStep = availablePeriods[availablePeriods.length - 1];
            if (lastStep.date <= startDate) {
                return lastStep.quantity + quantity <= maxQuantity;
            }

            var tmpAvailablePeriods = _.clone(availablePeriods);

            tmpAvailablePeriods.push({
                date: startDate,
                quantity: quantity,
                newPeriod: 'start'
            });
            tmpAvailablePeriods.push({
                date: endDate,
                quantity: quantity,
                newPeriod: 'end'
            });

            tmpAvailablePeriods = _.sortBy(tmpAvailablePeriods, function (step) { return step.date });

            var processingPeriod = false;
            var startQuantity = 0;

            for (var i = 0, l = tmpAvailablePeriods.length; i < l; i++) {
                var step = tmpAvailablePeriods[i];

                // is available because no problem at the end
                if (step.newPeriod === 'end') {
                    return true;
                }

                // check if the new booking dates exceed listing quantity
                if (step.newPeriod === 'start') {
                    processingPeriod = true;
                    if (startQuantity + quantity > maxQuantity) {
                        return false;
                    }
                } else {
                    if (processingPeriod) {
                        if (step.quantity + quantity > maxQuantity) {
                            return false;
                        }
                    } else {
                        startQuantity = step.quantity;
                    }
                }
            }

            return true;
        }

        function getPredictedQuantity(date, availablePeriods, quantity) {
            quantity = quantity || 1;

            if (!availablePeriods.length) {
                return quantity;
            }

            var oldStep;

            for (var i = 0, l = availablePeriods.length; i < l; i++) {
                var step = availablePeriods[i];

                if (date === step.date) {
                    return step.quantity + quantity;
                } else if (oldStep && oldStep.date < step.date && date < step.date) {
                    return oldStep.quantity + quantity;
                }

                oldStep = step;
            }

            return oldStep.quantity + quantity;
        }

        function getNbTimeUnits(startDate, endDate, timeUnit) {
            return moment.duration(moment(endDate).diff(startDate)).as(timeUnit);
        }

        function getStartDateRange(args) {
            var refDate = args.refDate;
            var config = args.config;

            var startDateMinLimit;
            var startDateMaxLimit;

            if (config.startDateMinDelta) {
                startDateMinLimit = moment(refDate).add(config.startDateMinDelta).toISOString();
            }
            if (config.startDateMaxDelta) {
                startDateMaxLimit = moment(refDate).add(config.startDateMaxDelta).toISOString();
            }

            return {
                startDateMinLimit: startDateMinLimit || refDate,
                startDateMaxLimit: startDateMaxLimit
            };
        }

        function getEndDateRange(args) {
            var refDate = args.refDate;
            var config = args.config;

            var endDateMinLimit;
            var endDateMaxLimit;

            var startDateLimits = getStartDateRange({
                refDate: refDate,
                config: config
            });
            var startDateMinLimit = startDateLimits.startDateMinLimit;
            var startDateMaxLimit = startDateLimits.startDateMaxLimit;
            var duration;

            if (config.minDuration) {
                duration = {};
                duration[config.timeUnit] = config.minDuration;
                endDateMinLimit = moment(startDateMinLimit).add(duration).toISOString();
            }
            if (config.maxDuration && startDateMaxLimit) {
                duration = {};
                duration[config.timeUnit] = config.maxDuration;
                endDateMaxLimit = moment(startDateMaxLimit).add(duration).toISOString();
            }

            return {
                endDateMinLimit: endDateMinLimit,
                endDateMaxLimit: endDateMaxLimit
            };
        }

        function isWithinRangeStartDate(args) {
            var refDate = args.refDate;
            var config = args.config;
            var startDate = args.startDate;

            var startDateLimits = getStartDateRange({
                refDate: refDate,
                config: config
            });
            var startDateMinLimit = startDateLimits.startDateMinLimit;
            var startDateMaxLimit = startDateLimits.startDateMaxLimit;

            var isWithinRange = startDateMinLimit <= startDate;

            if (startDateMaxLimit) {
                isWithinRange = isWithinRange && startDate <= startDateMaxLimit;
            }

            return isWithinRange;
        }

        function isWithinRangeEndDate(args) {
            var refDate = args.refDate;
            var config = args.config;
            var endDate = args.endDate;

            var endDateLimits = getEndDateRange({
                refDate: refDate,
                config: config
            });
            var endDateMinLimit = endDateLimits.endDateMinLimit;
            var endDateMaxLimit = endDateLimits.endDateMaxLimit;

            var isWithinRange = true;

            if (endDateMinLimit) {
                isWithinRange = isWithinRange && endDateMinLimit <= endDate;
            }
            if (endDateMaxLimit) {
                isWithinRange = isWithinRange && endDate <= endDateMaxLimit;
            }

            return isWithinRange;
        }

        function getContractUrl(bookingId, token) {
            return "/api/booking/" + bookingId + "/contract?t=" + token;
        }

        function isNoTime(booking) {
            return booking.listingType.properties.TIME === 'NONE';
        }

        function getLaunchDate(booking) {
            if (booking.paidDate < booking.acceptedDate) {
                return booking.acceptedDate;
            } else {
                return booking.paidDate;
            }
        }

        /**
         * get due date
         * @param  {object} booking
         * @param  {string} type - one value of ["start", "end"]
         * @return {string} due date
         */
        function getDueDate(booking, type) {
            var dueDate;

            if (! _.includes(["start", "end"], type)) {
                throw new Error("Bad type");
            }

            if (isNoTime(booking)) {
                dueDate = getLaunchDate(booking);
                dueDate = moment(dueDate).add(2, "d").format("YYYY-MM-DD");
            } else {
                if (type === "start") {
                    dueDate = booking.startDate;
                } else { // type === "end"
                    dueDate = booking.endDate;
                }
            }

            return dueDate;
        }

        function getFbTransactionType(booking) {
            if (booking.listingType) {
                return booking.listingType.name;
            } else {
                return '';
            }
        }
    }

})();
