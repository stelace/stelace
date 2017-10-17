(function () {

    angular
        .module("app.data")
        .factory("CleanService", CleanService);

    function CleanService(tools) {
        var service = {};

        service.clean = clean;

        return service;



        function clean(serviceToClean) {
            serviceToClean.cleanGetList = function () {
                return serviceToClean.getList.apply(this, arguments)
                    .then(function (elements) {
                        return tools.clearRestangular(elements);
                    });
            };

            serviceToClean.cleanGet = function () {
                return serviceToClean.get.apply(this, arguments)
                    .then(function (element) {
                        return tools.clearRestangular(element);
                    });
            };
        }
    }

})();
