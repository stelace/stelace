(function () {

    angular
        .module("app.data")
        .factory("Feedback", Feedback);

    function Feedback() {
        var service = {};
        service.mixInto = mixInto;

        return service;



        function mixInto(obj) {
            return angular.extend(obj, this);
        }
    }

})();
