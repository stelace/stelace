/* global fbq, ga */

(function () {

    angular
        .module("app.authentication")
        .controller("RegisterController", RegisterController);

    function RegisterController($location,
                                $rootScope,
                                $scope,
                                $state,
                                $stateParams,
                                $timeout,
                                authentication,
                                cache,
                                crossTabCommunication,
                                platform,
                                referral,
                                StelaceEvent,
                                storage,
                                toastr,
                                tools,
                                UserService) {
        var listeners = [];
        var debouncedAction = tools.debounceAction(_register);

        var vm = this;
        vm.showSocialLogin = authentication.isSocialLoginAllowed();
        vm.submitDisabled  = true;

        vm.register    = register;
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

            if (redirectURL) {
                if ((/^\/my-items/).test(redirectURL)) {
                    vm.redirectTarget = "myItems";
                }
            }

            listeners.push(
                crossTabCommunication.subscribe("socialLogin", function (newValue) {
                    if (newValue === "success") {
                        authentication
                            .getToken(true)
                            .then(function (token) {
                                return afterSuccessfulRegistration(token);
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

            StelaceEvent.sendEvent("Register view", {
                data: {
                    targetUrl: redirectURL
                }
            });

            $scope.$on("$destroy", function () {
                _.forEach(listeners, function (listener) {
                    listener();
                });
            });

            var urlCanonical = platform.getBaseUrl() + $state.current.urlWithoutParams;
            platform.setCanonicalLink(urlCanonical);

            // Condition for PhantomJS rendering
            platform.setPageStatus("ready");
        }


        function register() {
            return debouncedAction.process();
        }

        function _register() {
            if (! vm.email
             || ! vm.password
            ) {
                return _setFormAnimationError("empty");
            }
            if (! tools.isEmail(vm.email)) {
                return _setFormAnimationError("bad email");
            }

            return authentication
                .register(vm.email, vm.password)
                .then(function (/* res */) {
                    return authentication.login(vm.email, vm.password);
                })
                .then(function (res) {
                    return afterSuccessfulRegistration(res.data.access_token);
                })
                .catch(registrationError);
        }

        function afterSuccessfulRegistration(token) {
            var url = $location.protocol() + "://" + $location.host() + ($state.current.url || "");
            // Google Analytics event
            ga('send', 'event', 'Accounts', 'Register', url);
            // Facebook event
            fbq('track', 'CompleteRegistration');

            return authentication.setToken(token)
                .then(function () {
                    return UserService.getCurrentUser(true);
                })
                .then(function () {
                    authentication.setAuthenticated(true);

                    storage.getItem("referralInfo")
                        .then(function (referralInfo) {
                            referralInfo = referralInfo || {};

                            referral.afterRegister(referralInfo.referrerId, referralInfo.date, referralInfo.source)
                                .then(function () {
                                    storage.removeItem("referralInfo");
                                });
                        });

                    _redirectURL();

                    $rootScope.$emit("isAuthenticated", true);
                })
                .catch(registrationError);
        }

        function registrationError(err) {
            if (err.data && err.data.message === "email exists") {
                authentication
                    .login(vm.email, vm.password)
                    .then(function (res) {
                        return authentication.setToken(res.data.access_token);
                    })
                    .then(function () {
                        authentication.setAuthenticated(true);

                        _redirectURL();

                        // Allows to display sidebar to authenticated users
                        $rootScope.$emit("isAuthenticated", true);
                    })
                    .catch(function (/* err */) {
                        cache.set("loginWrongIdentifiers", {
                            email: vm.email,
                            password: vm.password
                        });
                        $state.go("login", $stateParams);
                    });
            } else {
                _setFormAnimationError("other");
            }

            vm.password = null;
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
