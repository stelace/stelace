(function () {

    angular
        .module("blocks.exception")
        .factory("exception", exception);

    function exception($injector, platform) {
        var service = {
            catcher: catcher
        };
        var logger;

        return service;

        function catcher(message) {
            if (! logger) {
                logger = $injector.get("toastr");
            }

            return function (reason) {
                if (platform.getEnvironment() !== "prod") {
                    logger.error(message, reason);
                }
            };
        }
    }

})();
