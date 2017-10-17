(function () {

    angular
        .module("app.data")
        .factory("Location", Location);

    function Location() {
        var service = {};
        service.mixInto = mixInto;

        return service;



        function mixInto(obj) {
            return angular.extend(obj, this);
        }
    }

})();
