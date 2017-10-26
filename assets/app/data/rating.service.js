(function () {

    angular
        .module("app.data")
        .factory("RatingService", RatingService);

    function RatingService($q, Restangular, Rating) {
        var service = Restangular.all("rating");
        service.getFromBooking       = getFromBooking;
        service.getTargetUserRatings = getTargetUserRatings;

        Restangular.extendModel("rating", function (obj) {
            return Rating.mixInto(obj);
        });

        return service;



        function getFromBooking(bookingId) {
            return service.customGET(null, { bookingId: bookingId })
                .then(function (res) {
                    res = res.plain();

                    _.forEach(res, function (result, key) {
                        if (result && typeof result === "object" && result.id) {
                            res[key] = Restangular.restangularizeElement(null, result, "rating");
                        }
                    });

                    return res;
                });
        }

        /**
         * @param {Object} Containing targetId and optional populateListings boolean
         */
        function getTargetUserRatings(args) {
            return service.customGET("", args)
                .then(function (res) {
                    return res.plain();
                });
        }

    }

})();
