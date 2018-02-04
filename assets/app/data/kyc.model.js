(function () {

    angular
        .module("app.data")
        .factory("Kyc", Kyc);

    function Kyc(tools) {
        var service = {};
        service.mixInto = mixInto;
        service.updateKyc = updateKyc;

        return service;



        function mixInto(obj) {
            return angular.extend(obj, this);
        }

        function updateKyc(data) {
            var kyc = this;

            return kyc.customPATCH({
                id: kyc.id,
                data: data
            })
            .then(function (newKyc) {
                return tools.clearRestangular(newKyc);
            });
        }
    }

})();
