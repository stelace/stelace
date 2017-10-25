(function () {

    angular
        .module("app.data")
        .factory("ListingCategory", ListingCategory);

    function ListingCategory() {
        var service = {};
        service.mixInto = mixInto;

        return service;



        function mixInto(obj) {
            return angular.extend(obj, this);
        }
    }

})();
