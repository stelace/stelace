(function () {

    angular
        .module("app.data")
        .factory("BackofficeService", BackofficeService);

    function BackofficeService($q, $http, apiBaseUrl) {
        var service = {};

        service.getImcompleteBookings = getImcompleteBookings;
        service.setAction             = setAction;
        service.getBooking            = getBooking;
        service.cancelBooking         = cancelBooking;

        return service;



        function getImcompleteBookings(itemMode) {
            var url = apiBaseUrl + "/backoffice/incompleteBookings"
                + (itemMode ? "?itemMode=" + itemMode : "");

            return $http.get(url)
                .then(function (res) {
                    return res.data;
                });
        }

        function setAction(actionId, usersIds) {
            var data = {
                actionId: actionId,
                usersIds: usersIds
            };

            return $http.post(apiBaseUrl + "/backoffice/setAction", data)
                .then(function (res) {
                    return res.data;
                });
        }

        function getBooking(bookingId) {
            return $http.get(apiBaseUrl + "/backoffice/booking/" + bookingId)
                .then(function (res) {
                    return res.data;
                });
        }

        function cancelBooking(bookingId, args) {
            return $http.post(apiBaseUrl + "/backoffice/booking/" + bookingId + "/cancel", args)
                .then(function (res) {
                    return res.data;
                });
        }

    }

})();
