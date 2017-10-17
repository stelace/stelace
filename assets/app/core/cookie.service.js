(function () {

    angular
        .module("app.core")
        .factory("cookie", cookie);

    /** see https://github.com/ivpusic/angular-cookie **/
    function cookie(ipCookie) {
        var service = {};

        service.isCompatible = isCompatible;
        service.getAll       = getAll;
        service.get          = get;
        service.set          = set;
        service.remove       = remove;

        return service;




        function isCompatible() {
            var testField = "_cookieTest";

            try {
                set(testField, testField);
                remove(testField);
                return true;
            } catch (e) {
                return false;
            }
        }

        function getAll() {
            return ipCookie();
        }

        function get(key) {
            return ipCookie(key);
        }

        function set(key, value, options) {
            options = options || {};
            ipCookie(key, value, options);
        }

        function remove(key, options) {
            options = options || {};
            ipCookie.remove(key, options);
        }

    }

})();
