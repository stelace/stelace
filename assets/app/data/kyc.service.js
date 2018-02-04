(function () {

    angular
        .module("app.data")
        .factory("KycService", KycService);

    function KycService(CleanService, Kyc, Restangular, tools) {
        var service = Restangular.all("kyc");
        service.getMine = getMine;
        service.updateKyc = updateKyc;

        CleanService.clean(service);

        Restangular.extendModel("kyc", function (obj) {
            return Kyc.mixInto(obj);
        });



        return service;


        function getMine() {
            return service.customGET("my")
                .then(function (kyc) {
                    kyc = tools.clearRestangular(kyc);
                    return kyc;
                });
        }

        function updateKyc(kyc, data) {
            var k = Restangular.restangularizeElement(null, kyc, 'kyc');

            return k.updateKyc(data)
                .then(function (newKyc) {
                    return tools.clearRestangular(newKyc);
                });
        }
    }

})();
