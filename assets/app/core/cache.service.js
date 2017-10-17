/* global moment */

(function () {

    angular
        .module("app.core")
        .factory("cache", cache);

    function cache() {
        var _cache = {};
        var expirationCache = {};

        var service = {};
        service.get      = get;
        service.set      = set;
        service.unset    = unset;
        service.clearAll = clearAll;

        return service;



        function get(prop) {
            if (expirationCache[prop] && expirationCache[prop] < new Date()) {
                unset(prop);
                delete expirationCache[prop];
            }

            return _cache[prop];
        }

        function set(prop, value, expiration) {
            _cache[prop] = value;

            if (expiration) {
                var expirationDate = moment();
                if (expiration.d) {
                    expirationDate.add(expiration.d, "d");
                }
                if (expiration.h) {
                    expirationDate.add(expiration.h, "h");
                }
                if (expiration.m) {
                    expirationDate.add(expiration.m, "m");
                }

                expirationCache[prop] = expirationDate.toDate();
            }
        }

        function unset(prop) {
            delete _cache[prop];
        }

        function clearAll() {
            _cache = {};
        }
    }

})();
