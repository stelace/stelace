(function () {

    angular
        .module("app.data")
        .factory("Assessment", Assessment);

    function Assessment() {
        var service = {};
        service.mixInto = mixInto;
        service.sign    = sign;

        return service;



        function mixInto(obj) {
            return angular.extend(obj, this);
        }

        function sign(args) {
            args = args || {};
            return this.customPUT(args, "sign");
        }
    }

})();
