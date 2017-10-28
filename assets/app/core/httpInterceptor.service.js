(function () {

    angular
        .module("app.core")
        .provider("sipHttpInterceptor", sipHttpInterceptor);

    function sipHttpInterceptor() {
        var provider = {};

        /* @ngInject */
        provider.$get = function ($q, platform) {
            return {
                responseError: function (res) {
                    if (platform.getEnvironment() !== "prod") {
                        if (! (res instanceof Error) && res && res.config) {
                            console.log(res.config.url, res); // eslint-disable-line no-console
                        }
                    }
                    return $q.reject(res);
                }
            };
        };

        return provider;
    }

})();
