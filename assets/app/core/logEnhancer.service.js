(function () {

    angular
        .module("app.core")
        .factory("logEnhancer", logEnhancer);

    function logEnhancer(moment) {
        var service = {};
        service.enhanceAngularLog = enhanceAngularLog;

        return service;



        function enhanceAngularLog($log) {
            $log.enabledContexts = [];

            $log.getInstance = function (context) {
                return {
                    log: enhanceLogging($log.log, context),
                    info: enhanceLogging($log.info, context),
                    warn: enhanceLogging($log.warn, context),
                    debug: enhanceLogging($log.debug, context),
                    error: enhanceLogging($log.error, context),
                    enableLogging: function (enable) {
                        $log.enabledContexts[context] = enable;
                    }
                };
            };

            function enhanceLogging(loggingFunc, context) {
                return function () {
                    var contextEnabled = $log.enabledContexts[context];
                    if (typeof contextEnabled === "undefined" || contextEnabled) {
                        var modifiedArguments = [].slice.call(arguments);
                        modifiedArguments.unshift(moment().format("HH:mm:ss") + " - " + context + " : ");
                        loggingFunc.apply(null, modifiedArguments);
                    }
                };
            }
        }
    }

})();
