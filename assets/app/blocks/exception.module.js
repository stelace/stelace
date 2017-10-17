(function () {

    angular
        .module("blocks.exception", [])
        .config(configBlock);

    function configBlock($provide) {
        $provide.decorator("$exceptionHandler", extendExceptionHandler);
    }

    function extendExceptionHandler($delegate, $injector) {
        var logger;
        var loggerToServer;
        var platform;

        return function (exception, cause) {
            $delegate(exception, cause);

            /**
             * Could add the error to a service's collection,
             * add errors to $rootScope, log errors to remote web server,
             * or log locally. Or throw hard. It is entirely up to you.
             * throw exception;
             */

            if (! logger) {
                logger = $injector.get("toastr");
            }
            if (! loggerToServer) {
                loggerToServer = $injector.get("loggerToServer");
            }
            if (! platform) {
                platform = $injector.get("platform");
            }

            if (platform.getEnvironment() !== "prod") {
                // don't display "stop" exception from normal process
                if (exception && exception !== "stop") {
                    loggerToServer.error(exception);

                    if (typeof exception === "object") {
                        logger.error(exception.message);
                    } else {
                        logger.error(exception);
                    }
                }
            }
        };
    }

})();
