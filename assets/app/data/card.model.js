(function () {

    angular
        .module("app.data")
        .factory("Card", Card);

    function Card() {
        var service = {};
        service.mixInto = mixInto;

        return service;



        function mixInto(obj) {
            return angular.extend(obj, this);
        }
    }

})();
