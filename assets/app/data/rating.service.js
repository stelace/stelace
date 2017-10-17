(function () {

    angular
        .module("app.data")
        .factory("RatingService", RatingService);

    function RatingService($q, Restangular, Rating, cache, tools) {
        var service = Restangular.all("rating");
        service.getParams            = getParams;
        service.getFromBooking       = getFromBooking;
        service.getTargetUserRatings = getTargetUserRatings;

        Restangular.extendModel("rating", function (obj) {
            return Rating.mixInto(obj);
        });

        return service;



        function getParams() {
            return $q.when()
                .then(function () {
                    var cacheRatingParams = cache.get("ratingParams");

                    if (cacheRatingParams) {
                        return cacheRatingParams;
                    } else {
                        return service.customGET("params")
                            .then(function (params) {
                                params = tools.clearRestangular(params);
                                cache.set("ratingParams", params);
                                return params;
                            })
                            .catch(function (err) {
                                return $q.reject(err);
                            });
                    }
                });
        }

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
         * @param {Object} Containing targetId and optional populateItems boolean
         */
        function getTargetUserRatings(args) {
            return service.customGET("", args)
                .then(function (res) {
                    return res.plain();
                });
        }

    }

})();
