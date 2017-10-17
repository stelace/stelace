(function () {

    angular
        .module("app.data")
        .factory("ItemCategory", ItemCategory);

    function ItemCategory() {
        var service = {};
        service.mixInto = mixInto;

        return service;



        function mixInto(obj) {
            return angular.extend(obj, this);
        }
    }

})();
