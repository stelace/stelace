(function () {

    angular
        .module("app.data")
        .factory("Brand", Brand);

    function Brand() {
        var service = {};
        service.mixInto = mixInto;

        return service;



        function mixInto(obj) {
            return angular.extend(obj, this);
        }
    }

})();
