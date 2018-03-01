(function () {

    angular
        .module("app.core", [
            // angular modules
            "ngAnimate",
            "ngCookies",

            // cross-app modules
            "blocks.exception",

            // 3rd-party modules
            "toastr",
            "restangular",
            "ui.router",
            "ui.select",
            "rzModule",
            "ipCookie",
            "LocalForageModule",
            "angular-jwt",
            "angularSpinner",
            "credit-cards",
            "ezfb",
            "uiGmapgoogle-maps",
            "ngAutocomplete",
            "foundation",
            "angularLazyImg",
            "ngRedux",
            "pascalprecht.translate",
            // "stelace.translationCache"
        ])
        .constant("CryptoJS", window.CryptoJS)
        .constant("moment", window.moment)
        .constant("apiBaseUrl", "/api")
        .config(configBlock)
        .run(runBlock);

    function configBlock($localForageProvider, $httpProvider, jwtInterceptorProvider, apiBaseUrl, toastrConfig) {
        var refreshTokenUrl = apiBaseUrl + "/auth/refresh-token";
        var tokenRequests = {
            processing: false,
            queue: [],
            response: null,
            token: null
        };

        $localForageProvider.config({
            name     : 'sharinplace',
            storeName: 'data'
        });

        /* @ngInject */
        jwtInterceptorProvider.tokenGetter = function ($q, $location, $state, config, jwtHelper, authentication) {
            // do it this way because of the ngInject
            return tokenGetter($q, $location, $state, config, jwtHelper, authentication);
        };

        $httpProvider.interceptors.push("jwtInterceptor");
        $httpProvider.interceptors.push("sipHttpInterceptor");

        angular.extend(toastrConfig, {
            closeButton: true,
            extendedTimeOut: 7000, // ensure that user hovering around has time to read toastr
            maxOpened: 3,
            timeOut: 7000,
            preventOpenDuplicates: true
        });



        function tokenGetter($q, $location, $state, config, jwtHelper, authentication) {
            if (config.url.substr(0, 5) !== "/api/") {
                return;
            }

            if (config.url === refreshTokenUrl) {
                return tokenRequests.token;
            } else if (tokenRequests.processing) {
                return $q(function (resolve, reject) {
                    tokenRequests.queue.push({
                        resolve: resolve,
                        reject: reject
                    });
                });
            } else {
                return getToken()
                    .then(function (data) {
                        var token        = data.token;
                        var tokenContent = data.tokenContent;

                        var now           = new Date();
                        var toRefreshDate = new Date(tokenContent.toRefreshAt * 1000);

                        if (now.getTime() <= toRefreshDate.getTime()) {
                            return token;
                        }

                        tokenRequests.processing = true;
                        tokenRequests.token      = token;

                        return refreshToken(token)
                            .then(function (refreshedToken) {
                                tokenRequests.response = { token: refreshedToken };
                                return refreshedToken;
                            })
                            .catch(function (err) {
                                tokenRequests.response = { err: err };
                                return $q.reject(err);
                            })
                            .finally(function () {
                                emptyRequestsQueue();
                            });
                    })
                    .catch(function () {
                        return;
                    });
            }



            function getToken() {
                var data = {};

                return authentication
                    .getToken()
                    .then(function (token) {
                        if (! token) {
                            return $q.reject("No token");
                        }

                        data.token = token;

                        try {
                            data.tokenContent = jwtHelper.decodeToken(token);
                        } catch (e) {
                            return $q.reject("Bad token");
                        }

                        return data;
                    })
                    .then(function (data) {
                        var tokenContent = data.tokenContent;
                        var token        = data.token;

                        if (! tokenContent.exp || ! tokenContent.toRefreshAt) {
                            return $q.reject("Bad token");
                        }
                        if (jwtHelper.isTokenExpired(token)) {
                            authentication.unsetToken();
                            authentication.setAuthenticated(false);
                            return $q.reject("Token expired");
                        }

                        return data;
                    });
            }

            function refreshToken(token) {
                return authentication
                    .refreshToken(token)
                    .catch(function (err) {
                        if (err.data && err.data.message === "ForceAuthentication") {
                            authentication.unsetToken();
                            authentication.setAuthenticated(false);

                            // redirect to login
                            var redirectURL        = $location.url();
                            var encodedRedirectURL = encodeURIComponent(redirectURL);

                            $state.go("login", { redirect: encodedRedirectURL });
                        }

                        return $q.reject(err);
                    });
            }

            function emptyRequestsQueue() {
                while (tokenRequests.queue.length) {
                    var listener = tokenRequests.queue.shift();

                    if (tokenRequests.response.token) {
                        listener.resolve(tokenRequests.response.token);
                    } else {
                        listener.reject(tokenRequests.response.err);
                    }
                }

                tokenRequests.processing = false;
                tokenRequests.token      = null;
                tokenRequests.response   = null;
            }
        }
    }

    function runBlock($log, logEnhancer) {
        logEnhancer.enhanceAngularLog($log);
    }

})();
