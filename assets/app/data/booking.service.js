/* global moment */

(function () {

    angular
        .module("app.data")
        .factory("BookingService", BookingService);

    function BookingService($q, Restangular, Booking, cache, ListingService, time) {
        var service = Restangular.all("booking");
        service.getMine                               = getMine;

        service.getNbTimeUnits                        = getNbTimeUnits;
        service.getStartDateRange                     = getStartDateRange;
        service.getEndDateRange                       = getEndDateRange;
        service.isWithinRangeStartDate                = isWithinRangeStartDate;
        service.isWithinRangeEndDate                  = isWithinRangeEndDate;
        service.getPredefinedDates                    = getPredefinedDates;
        service.isValidDates                          = isValidDates;
        service.getAvailabilityPeriodInfo             = getAvailabilityPeriodInfo;
        service.getAvailabilityDateInfo               = getAvailabilityDateInfo;

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
         * @param  {Number}  [nbTimeUnits] - not required if no duration
         * @param  {String}  refDate
         * @param  {Object}  config
         * @param  {Object}  [canOmitDuration = false] - if true, nbTimeUnits not required
         * @return {Boolean}
         */
        function isValidDates(args) {
            var startDate   = args.startDate;
            var nbTimeUnits = args.nbTimeUnits;
            var refDate     = args.refDate;
            var config      = args.config;
            var canOmitDuration = args.canOmitDuration || false;

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

            if (!canOmitDuration) {
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

        /**
         * @param {Object} availabilityGraph
         * @param {Object} newBooking
         * @param {String} newBooking.startDate
         * @param {String} [newBooking.endDate] - if not provided, compute remaining quantity only on start date
         * @param {Number} newBooking.quantity
         * @return {Object} info
         * @return {Boolean} info.isAvailable
         * @return {Number} info.maxRemainingQuantity
         */
        function getAvailabilityPeriodInfo(availabilityGraph, newBooking) {
            var defaultMaxQuantity = availabilityGraph.defaultMaxQuantity;
            var graphDates = availabilityGraph.graphDates;

            var maxRemainingQuantity;

            var beforeStartGraphDate = _.last(_.filter(graphDates, function (graphDate) {
                return graphDate.date <= newBooking.startDate;
            }));

            // compute the remaining quantity at the start date only
            if (!newBooking.endDate) {
                if (beforeStartGraphDate) {
                    maxRemainingQuantity = Math.abs(beforeStartGraphDate.maxQuantity - beforeStartGraphDate.usedQuantity);
                } else {
                    maxRemainingQuantity = defaultMaxQuantity;
                }
            } else {
                var overlapGraphDates = _.filter(graphDates, function (graphDate) {
                    var startDate = beforeStartGraphDate ? beforeStartGraphDate.date : newBooking.startDate;
                    return startDate <= graphDate.date && graphDate.date < newBooking.endDate;
                });

                if (!overlapGraphDates.length) {
                    maxRemainingQuantity = defaultMaxQuantity;
                } else {
                    maxRemainingQuantity = Math.abs(overlapGraphDates[0].maxQuantity - overlapGraphDates[0].usedQuantity);

                    _.forEach(overlapGraphDates, function (graphDate) {
                        maxRemainingQuantity = Math.min(maxRemainingQuantity, Math.abs(graphDate.maxQuantity - graphDate.usedQuantity));
                    })
                }
            }

            return {
                isAvailable: newBooking.quantity <= maxRemainingQuantity && maxRemainingQuantity > 0,
                maxRemainingQuantity: maxRemainingQuantity
            };
        }

        /**
         * @param {Object} availabilityGraph
         * @param {Object} newBooking
         * @param {String} newBooking.startDate
         * @param {Number} newBooking.quantity
         * @return {Object} info
         * @return {Boolean} info.isAvailable
         * @return {Number} info.maxRemainingQuantity
         */
        function getAvailabilityDateInfo(availabilityGraph, newBooking) {
            var defaultMaxQuantity = availabilityGraph.defaultMaxQuantity;
            var graphDates = availabilityGraph.graphDates;

            var maxRemainingQuantity;

            var graphDate = _.find(graphDates, function (date) {
                return date.date === newBooking.startDate;
            });

            if (!graphDate) {
                maxRemainingQuantity = defaultMaxQuantity;
            } else {
                maxRemainingQuantity = Math.abs(graphDate.maxQuantity - graphDate.usedQuantity);
            }

            return {
                isAvailable: newBooking.quantity <= maxRemainingQuantity && maxRemainingQuantity > 0,
                maxRemainingQuantity: maxRemainingQuantity
            };
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

        function getPredefinedDates(listing, listingType, graphDates) {
            var refDate = moment().format('YYYY-MM-DD') + 'T00:00:00.000Z';
            var config = (listingType.config && listingType.config.bookingTime) || {};

            var range = getStartDateRange({
                refDate: refDate,
                config: config
            });

            var startDateMinLimit = range.startDateMinLimit;
            var startDateMaxLimit = range.startDateMaxLimit
                || moment(refDate).add({ d: 60 }).toISOString(); // max limit at 2 month if not specified

            var timeUnit = config.timeUnit || 'd';

            var dates;
            if (listing.recurringDatesPattern) {
                dates = time.computeRecurringDates(listing.recurringDatesPattern, {
                    startDate: startDateMinLimit,
                    endDate: startDateMaxLimit,
                    onlyPureDate: timeUnit === 'd' || timeUnit === 'M'
                });
            }

            _.forEach(graphDates || [], function (graphDate) {
                if (graphDate.custom) {
                    // if the owner sets to 0 purposely, do not put the date
                    if (graphDate.maxQuantity) {
                        dates.push(graphDate.date);
                    }
                }
            });

            dates = _.sortBy(_.uniq(dates));

            return dates;
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
