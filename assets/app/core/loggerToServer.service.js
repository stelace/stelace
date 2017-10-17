(function () {

    angular
        .module("app.core")
        .factory("loggerToServer", loggerToServer);

    function loggerToServer($http, $location, apiBaseUrl, stacktrace) {
        var service = {};

        service.error = error;

        return service;




        function error(err) {
            stacktrace.print(err)
                .then(function (stack) {
                    return sendError(err, stack);
                })
                .catch(function () {
                    return sendError(err);
                });


            function sendError(err, stack) {
                var error;
                if (! (err instanceof Error)) {
                    error = err;
                } else {
                    error = {
                        message: err.message,
                        name: err.name
                    };

                    if (err.cause) {
                        error.cause = err.cause;
                    }
                    if (stack) {
                        error.stackTrace = stack;
                    }
                }

                var params = {
                    error: error,
                    url: $location.url()
                };

                return $http.post(apiBaseUrl + "/clientLog/error", params);
            }
        }

    }

})();
