(function () {

    angular
        .module("app.data")
        .factory("Tag", Tag);

    function Tag() {
        var service = {};
        service.mixInto = mixInto;

        return service;



        function mixInto(obj) {
            return angular.extend(obj, this);
        }
    }

})();
