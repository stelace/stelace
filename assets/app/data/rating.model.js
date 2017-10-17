(function () {

    angular
        .module("app.data")
        .factory("Rating", Rating);

    function Rating() {
        var service = {};
        service.mixInto = mixInto;

        return service;



        function mixInto(obj) {
            return angular.extend(obj, this);
        }
    }

})();
