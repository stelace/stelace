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
                if (value.endDate < element.startDate || element.endDate < value.startDate) {
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
    }

})();
