(function () {

    angular
        .module("app.data")
        .factory("Item", Item);

    function Item($q) {
        var service = {};
        service.mixInto      = mixInto;
        service.updateMedias = updateMedias;
        service.pause        = pause;

        return service;



        function mixInto(obj) {
            return angular.extend(obj, this);
        }

        function updateMedias(mediasIds) {
            var item = this;

            return $q.when()
                .then(function () {
                    if (! mediasIds) {
                        return $q.reject("bad params");
                    }

                    var params = {
                        mediasIds: mediasIds,
                        mediaType: 'item'
                    };

                    return item.customPUT(params, "medias")
                        .then(function () {
                            item.mediasIds = mediasIds;
                            return true; // expected in itemCreate view
                        });
                });
        }

        function pause(pausedUntil) {
            var item = this;

            return $q.when()
                .then(function () {
                    return item.customPUT({ pausedUntil: pausedUntil }, "pause");
                });
        }
    }

})();
