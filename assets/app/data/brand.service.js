(function () {

    angular
        .module("app.data")
        .factory("BrandService", BrandService);

    function BrandService(Restangular, Brand) {
        var service = Restangular.all("brand");

        Restangular.extendModel("brand", function (obj) {
            return Brand.mixInto(obj);
        });

        return service;
    }

})();
