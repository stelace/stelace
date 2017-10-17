/* global moment */

(function () {

    angular
        .module("app.data")
        .factory("BookingService", BookingService);

    function BookingService($q, Restangular, Booking, cache, time, tools) {
        var service = Restangular.all("booking");
        service.getParams                             = getParams;
        service.getMine                               = getMine;
        service.isValidDates                          = isValidDates;
        service.isDatesCompatibleWithExistingBookings = isDatesCompatibleWithExistingBookings;
        service.getContractUrl                        = getContractUrl;
        service.getBookingDuration                    = getBookingDuration;
        service.isPurchase                            = isPurchase;
        service.getLaunchDate                         = getLaunchDate;
        service.getDueDate                            = getDueDate;
        service.getFbTransactionType                  = getFbTransactionType;

        Restangular.extendModel("booking", function (obj) {
            return Booking.mixInto(obj);
        });

        return service;



        function getParams() {
            return $q.when()
                .then(function () {
                    var cacheBookingParams = cache.get("bookingParams");

                    if (cacheBookingParams) {
                        return cacheBookingParams;
                    } else {
                        return service.customGET("params")
                            .then(function (params) {
                                params = tools.clearRestangular(params);
                                cache.set("bookingParams", params);
                                return params;
                            })
                            .catch(function (err) {
                                return $q.reject(err);
                            });
                    }
                });
        }

        function getMine(as) {
            as = as || "booker";
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
         * is valid dates
         * @param  {object}   args
         * @param  {string}   [args.startDate]
         * @param  {string}   [args.endDate]
         * @param  {string}   args.refDate
         * @param  {object}   config
         * @return {object}   obj
         * @return {boolean}  obj.result
         * @return {object}   obj.errors
         */
        function isValidDates(args, config) {
            var formatDate = "YYYY-MM-DD";
            var startDate = args.startDate;
            var endDate   = args.endDate;
            var refDate   = args.refDate;

            var errors          = {};
            var badParamsErrors = {};

            if (startDate && ! time.isDateString(startDate, true)) {
                badParamsErrors.BAD_FORMAT_START_DATE = true;
            }
            if (endDate && ! time.isDateString(endDate, true)) {
                badParamsErrors.BAD_FORMAT_END_DATE = true;
            }
            if (! time.isDateString(refDate, true)) {
                badParamsErrors.MISSING_REF_DATE = true;
            }
            if (! startDate && ! endDate) {
                badParamsErrors.MISSING_DATES = true;
            }
            if (startDate && endDate && endDate < startDate) {
                badParamsErrors.END_DATE_BEFORE_START_DATE = true;
            }
            if (! _.isEmpty(badParamsErrors)) {
                errors.BAD_PARAMS = badParamsErrors;
                return exposeResult(errors);
            }

            var durationDays;
            var startDateMinLimit;
            var startDateMaxLimit;
            var endDateMinLimit;
            var endDateMaxLimit;

            if (startDate && endDate) {
                durationDays = moment(endDate).diff(moment(startDate), "d") + 1;
            }
            if (config.startDateMinDelta) {
                startDateMinLimit = moment(refDate).add(config.startDateMinDelta, "d").format(formatDate);
            }
            if (config.startDateMaxDelta) {
                startDateMaxLimit = moment(refDate).add(config.startDateMaxDelta, "d").format(formatDate);
            }
            if (config.endDateMinDelta) {
                endDateMinLimit = moment(refDate).add(config.endDateMinDelta, "d").format(formatDate);
            } else if (config.startDateMinDelta) {
                if (config.minDuration) {
                    endDateMinLimit = moment(startDateMinLimit).add(config.minDuration - 1, "d").format(formatDate);
                } else {
                    endDateMinLimit = startDateMinLimit;
                }
            }
            if (config.endDateMaxDelta) {
                endDateMaxLimit = moment(refDate).add(config.endDateMaxDelta, "d").format(formatDate);
            } else if (config.startDateMaxDelta) {
                if (config.maxDuration) {
                    endDateMaxLimit = moment(startDateMaxLimit).add(config.maxDuration - 1, "d").format(formatDate);
                } else {
                    endDateMaxLimit = startDateMaxLimit;
                }
            }

            var durationErrors  = {};
            var startDateErrors = {};
            var endDateErrors   = {};

            if (durationDays && config.minDuration && durationDays < config.minDuration) {
                durationErrors.BELOW_MIN = true;
            }
            if (durationDays && config.maxDuration && config.maxDuration < durationDays) {
                durationErrors.ABOVE_MAX = true;
            }
            if (startDate && startDateMinLimit && startDate < startDateMinLimit) {
                startDateErrors.BEFORE_MIN = true;
            }
            if (startDate && startDateMaxLimit && startDateMaxLimit < startDate) {
                startDateErrors.AFTER_MAX = true;
            }
            if (endDate && endDateMinLimit && endDate < endDateMinLimit) {
                endDateErrors.BEFORE_MIN = true;
            }
            if (endDate && endDateMaxLimit && endDateMaxLimit < endDate) {
                endDateErrors.AFTER_MAX = true;
            }

            if (! _.isEmpty(durationErrors)) {
                errors.DURATION = durationErrors;
            }
            if (! _.isEmpty(startDateErrors)) {
                errors.START_DATE = startDateErrors;
            }
            if (! _.isEmpty(endDateErrors)) {
                errors.END_DATE = endDateErrors;
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
         * is dates compatible withs existing bookings
         * @param  {object}    args
         * @param  {string}    args.startDate
         * @param  {string}    [args.endDate]
         * @param  {string}    [args.refDate]
         * @param  {object}    args.item
         * @param  {object[]}  args.futureBookings
         * @return {object}    obj
         * @return {boolean}   obj.result
         * @return {object}    obj.errors
         */
        function isDatesCompatibleWithExistingBookings(args) {
            var startDate      = args.startDate;
            var endDate        = args.endDate;
            var refDate        = args.refDate;
            var item           = args.item;
            var futureBookings = args.futureBookings;

            var errors          = {};
            var badParamsErrors = {};

            if (! time.isDateString(startDate, true)) {
                badParamsErrors.BAD_FORMAT_START_DATE = true;
            }
            if (endDate && ! time.isDateString(endDate, true)) {
                badParamsErrors.BAD_FORMAT_END_DATE = true;
            }
            if (refDate && ! time.isDateString(refDate, true)) {
                badParamsErrors.BAD_FORMAT_REF_DATE = true;
            }
            if (item.mode === "classic" && ! endDate) {
                badParamsErrors.CLASSIC_MISSING_END_DATE = true;
            }
            if (startDate && endDate && endDate < startDate) {
                badParamsErrors.END_DATE_BEFORE_START_DATE = true;
            }
            if (! item) {
                badParamsErrors.MISSING_ITEM = true;
            }
            if (! futureBookings) {
                badParamsErrors.MISSING_FUTURE_BOOKINGS = true;
            }

            if (! _.isEmpty(badParamsErrors)) {
                errors.BAD_PARAMS = badParamsErrors;
                return exposeResult(errors);
            }

            var intersection = time.isIntersection(futureBookings, {
                startDate: startDate,
                endDate: endDate
            });

            // no overlap between booking dates
            if (intersection) {
                errors.BOOKINGS_INTERSECTION = true;
                return exposeResult(errors);
            }

            return exposeResult(errors);



            function exposeResult(errors) {
                return {
                    result: ! _.keys(errors).length,
                    errors: errors
                };
            }
        }

        function getContractUrl(bookingId, token) {
            return "/api/booking/" + bookingId + "/contract?t=" + token;
        }

        function getBookingDuration(startDate, endDate) {
            return moment(endDate).diff(startDate, "d") + 1;
        }

        function isPurchase(booking) {
            return _.includes(["rental-purchase", "purchase"], booking.bookingMode);
        }

        function getLaunchDate(booking) {
            if (booking.confirmedDate < booking.validatedDate) {
                return booking.validatedDate;
            } else {
                return booking.confirmedDate;
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

            if (isPurchase(booking)) {
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
            return booking.bookingMode;
        }
    }

})();
