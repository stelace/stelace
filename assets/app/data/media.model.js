(function () {

    angular
        .module("app.data")
        .factory("Media", Media);

    function Media() {
        var service = {};
        service.mixInto = mixInto;
        service.update  = update;

        return service;



        function mixInto(obj) {
            return angular.extend(obj, this);
        }

        function update(name) {
            var media = this;

            return media.customPUT({ name: name })
                .then(function () {
                    media.name = name;
                });
        }
    }

})();
