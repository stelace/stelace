(function () {

    angular
        .module("app.data")
        .factory("Listing", Listing);

    function Listing($q) {
        var service = {};
        service.mixInto      = mixInto;
        service.updateMedias = updateMedias;
        service.pause        = pause;

        return service;



        function mixInto(obj) {
            return angular.extend(obj, this);
        }

        function updateMedias(mediasIds) {
            var listing = this;

            return $q.when()
                .then(function () {
                    if (! mediasIds) {
                        return $q.reject("bad params");
                    }

                    var params = {
                        mediasIds: mediasIds,
                        mediaType: 'listing'
                    };

                    return listing.customPUT(params, "medias")
                        .then(function () {
                            listing.mediasIds = mediasIds;
                            return true; // expected in listingCreate view
                        });
                });
        }

        function pause(pausedUntil) {
            var listing = this;

            return $q.when()
                .then(function () {
                    return listing.customPUT({ pausedUntil: pausedUntil }, "pause");
                });
        }
    }

})();
