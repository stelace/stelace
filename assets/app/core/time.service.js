/* global Cron */

(function () {

    angular
        .module("app.core")
        .factory("time", time);

    function time() {
        var service = {};
        service.isDate            = isDate;
        service.isDateString      = isDateString;
        service.isIntersection    = isIntersection;
        service.getDurationString = getDurationString;

        service.isValidCronPattern = isValidCronPattern;
        service.parseCronPattern = parseCronPattern;
        service.convertToCronPattern = convertToCronPattern;
        service.forceCronPattern = forceCronPattern;
        service.computeRecurringDates = computeRecurringDates;

        return service;



        function isDate(date) {
            return date.getTime && ! isNaN(date.getTime());
        }

        function isDateString(str, args) {
            args = args || {};
            var onlyDate = typeof args.onlyDate !== 'undefined' ? args.onlyDate : false;

            if (typeof str !== "string") {
                return false;
            }

            var regex;

            if (onlyDate) {
                regex = /^\d{4}-\d{2}-\d{2}$/;
            } else {
                regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
            }

            if (regex.test(str)) {
                var date = new Date(str);
                return isDate(date);
            } else {
                return false;
            }
        }

        function isIntersection(array, value) {
            return _.reduce(array, function (memo, element) {
                if (value.endDate <= element.startDate || element.endDate <= value.startDate) {
                    return memo;
                } else {
                    return memo || true;
                }
            }, false);
        }

        function getDurationString(nbSeconds, shortened) {
            if (nbSeconds < 300) {
                return (shortened ? "5 min." : "moins de 5 minutes");
            } else if (nbSeconds < 3600) {
                return parseInt(nbSeconds / 60, 10) + (shortened ? " min." : " minutes");
            } else {
                if (shortened && nbSeconds > 7200) { return "+ de 2h"; }

                var remainingSeconds = nbSeconds;
                var hours = parseInt(remainingSeconds / 3600, 10);
                remainingSeconds -= hours * 3600;
                var minutes = parseInt(remainingSeconds / 60, 10);

                return hours + "h" + (minutes < 10 ? "0" + minutes : minutes);
            }
        }

        function isValidCronPattern(pattern) {
            var cronInstance = new Cron();
            try {
                cronInstance.fromString(pattern);
                return true;
            } catch (e) {
                return false;
            }
        }

        function parseCronPattern(pattern) {
            var cronInstance = new Cron();

            cronInstance.fromString(pattern);
            var array = cronInstance.toArray();

            return {
                minute: array[0],
                hour: array[1],
                dayOfMonth: array[2],
                month: array[3],
                dayOfWeek: array[4],
            };
        }

        function convertToCronPattern(cronObj) {
            var cronInstance = new Cron();

            var array = [
                cronObj.minute,
                cronObj.hour,
                cronObj.dayOfMonth,
                cronObj.month,
                cronObj.dayOfWeek,
            ];

            return cronInstance.fromArray(array).toString();
        }

        /**
         * Force the cron pattern to not trigger below the provided time unit
         * e.g. if the time unit is day, do not trigger every minute or every hour
         * @param {String} pattern
         * @param {String} timeUnit - 'm', 'h', 'd'
         */
        function forceCronPattern(pattern, timeUnit) {
            if (!_.includes(['m', 'h', 'd'], timeUnit)) {
                throw new Error('Invalid time unit');
            }

            if (timeUnit === 'm') {
                return pattern;
            }

            var parsed = parseCronPattern(pattern);

            if (timeUnit === 'h') {
                parsed.minute = [0];
            } else if (timeUnit === 'd') {
                parsed.minute = [0];
                parsed.hour = [0];
            }

            return convertToCronPattern(parsed);
        }

        /**
         * @param {String} pattern
         * @param {Object} attrs
         * @param {String} attrs.startDate - inclusive
         * @param {String} attrs.endDate - exclusive
         * @param {String} [attrs.onlyPureDate = false] - returns date with 0 hours 0 minutes 0 seconds
         * @param {String[]} dates
         */
        function computeRecurringDates(pattern, args) {
            args = args || {};
            var startDate = args.startDate;
            var endDate = args.endDate;
            var onlyPureDate = args.onlyPureDate || false;

            if (!isDateString(startDate) || !isDateString(endDate)) {
                throw new Error('Expected start and end dates');
            }
            if (endDate < startDate) {
                throw new Error('Invalid dates');
            }

            var cronInstance = new Cron({
                timezone: 'Europe/London'
            });
            cronInstance.fromString(pattern);

            var schedule = cronInstance.schedule(startDate);

            var continueLoop = true;
            var dates = [];

            while (continueLoop) {
                var momentDate = schedule.next();

                var date;
                if (onlyPureDate) {
                    date = momentDate.format('YYYY-MM-DD') + 'T00:00:00.000Z';
                } else {
                    date = momentDate.toISOString();
                }

                continueLoop = date < endDate;

                if (continueLoop) {
                    dates.push(date);
                }
            }

            return dates;
        }
    }

})();
