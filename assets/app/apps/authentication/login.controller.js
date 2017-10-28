(function () {

    angular
        .module("app.authentication")
        .controller("LoginController", LoginController);

    function LoginController($rootScope,
                                $scope,
                                $state,
                                $stateParams,
                                $timeout,
                                $translate,
                                $location,
                                authentication,
                                platform,
                                cache,
                                crossTabCommunication,
                                StelaceEvent,
                                toastr) {
        var listeners = [];

        var vm = this;
        vm.showSocialLogin = authentication.isSocialLoginAllowed();

        vm.login       = login;
        vm.socialLogin = socialLogin;

        activate();



        function activate() {
            var redirectURL;

            if ($stateParams.redirect) {
                try {
                    redirectURL = decodeURIComponent($stateParams.redirect);
                } catch (e) {
                    // do nothing
                }
            }

            if (window.opener) {
                if ($stateParams.error) {
                    localStorage.setItem("socialLoginError", $stateParams.error);
                    localStorage.removeItem("socialLoginError");
                }

                window.close();
                return;
            }

            if ($stateParams.error === "access_denied") {
                platform.showErrorMessage();
            } else if ($stateParams.error === "user_denied") {
                $translate("authentication.error.cancelled_social_auth")
                    .then(toastr.info);
            }

            if (redirectURL) {
                if ((/^\/my-listings/).test(redirectURL)) {
                    vm.redirectTarget = "myListings";
                }
            }

            var urlCanonical = platform.getBaseUrl() + $state.current.urlWithoutParams;
            platform.setCanonicalLink(urlCanonical);

            // Condition for PhantomJS rendering
            platform.setPageStatus("ready");

            var loginWrongIdentifiers = cache.get("loginWrongIdentifiers");
            if (loginWrongIdentifiers && loginWrongIdentifiers.email) {
                vm.email = loginWrongIdentifiers.email;
                cache.unset("loginWrongIdentifiers");
                _setFormAnimationError("other");
            }

            listeners.push(
                crossTabCommunication.subscribe("socialLogin", function (newValue) {
                    if (newValue === "success") {
                        authentication
                            .getToken(true)
                            .then(function (token) {
                                return afterSuccessfulLogin(token);
                            });
                    }
                })
            );
            listeners.push(
                $rootScope.$on("isAuthenticated", function (event, isAuthenticated) {
                    if (isAuthenticated) {
                        _redirectURL();
                    }
                })
            );

            StelaceEvent.sendEvent("Login view", {
                data: {
                    targetUrl: redirectURL
                }
            });

            $scope.$on("$destroy", function () {
                _.forEach(listeners, function (listener) {
                    listener();
                });
            });
        }

        function login() {
            if (! vm.email
             || ! vm.password
            ) {
                return _setFormAnimationError("empty");
            }

            authentication
                .login(vm.email, vm.password)
                .then(function (res) {
                    return afterSuccessfulLogin(res.data.access_token);
                })
                .catch(function (/* err */) {
                    vm.password = null;
                    _setFormAnimationError("other");
                });
        }

        function afterSuccessfulLogin(token) {
            return authentication.setToken(token)
                .then(function () {
                    authentication.setAuthenticated(true);

                    _redirectURL();

                    $rootScope.$emit("isAuthenticated", true);
                });
        }

        function socialLogin(provider) {
            authentication.socialLogin(provider);
        }

        function _redirectURL() {
            var encodedURL = $stateParams.redirect;

            if (! encodedURL) {
                $state.go("home");
            } else {
                try {
                    var redirectURL = decodeURIComponent(encodedURL);
                    $location.url(redirectURL);
                } catch (e) {
                    $state.go("home");
                }
            }
        }

        function _setFormAnimationError(errorType) {
            vm.formAnimationError = true;
            vm.errorType = errorType;

            $timeout(function () {
                vm.formAnimationError = false;
            }, 500);
        }
    }

})();
