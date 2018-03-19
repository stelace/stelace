/* global Modernizr */

(function () {

    angular
        .module("app.core")
        .factory("authentication", authentication);

    function authentication($rootScope,
                                $http,
                                $q,
                                $state,
                                $location,
                                $injector,
                                $window,
                                apiBaseUrl,
                                cache,
                                cookie,
                                CryptoJS,
                                crossTabCommunication,
                                referral,
                                StelaceConfig,
                                StelaceEvent,
                                toastr,
                                useragent) {
        var tokenSearched = false;
        var tokenField    = "authToken";
        var token;
        var isAuthed;

        var service = {};

        // Implementation functions
        service.getToken          = getToken;
        service.setToken          = setToken;
        service.unsetToken        = unsetToken;
        service.refreshToken      = refreshToken;

        // API
        service.login                = login;
        service.socialLogin          = socialLogin;
        service.isSocialLoginAllowed = isSocialLoginAllowed;
        service.logout               = logout;
        service.register             = register;
        service.loginAs              = loginAs;
        service.isAuthenticated      = isAuthenticated;
        service.setAuthenticated     = setAuthenticated;
        service.lostPassword         = lostPassword;
        service.recoveryPassword     = recoveryPassword;
        service.emailCheck           = emailCheck;
        service.emailNew             = emailNew;
        service.phoneSendCode        = phoneSendCode;
        service.phoneCheckCode       = phoneCheckCode;

        activate();

        return service;



        function activate() {
            _syncTokenAcrossTabs();
            _setSocialLoginErrors();
        }

        function _syncTokenAcrossTabs() {
            crossTabCommunication.subscribe(tokenField, function (newValue, oldValue) {
                isAuthed      = null;
                token         = null;
                tokenSearched = false;

                cache.clearAll();

                // if the user logout and the current view needs authentication
                if (! newValue && ! $state.current.noAuthNeeded) {
                    var redirectURL = encodeURIComponent($location.url());
                    return $state.go("login", { redirect: redirectURL });
                }

                if (! newValue && oldValue) {
                    $rootScope.$emit("isAuthenticated", false);
                } else if (newValue && ! oldValue) {
                    $rootScope.$emit("isAuthenticated", true);
                }
            });
        }

        function _setSocialLoginErrors() {
            crossTabCommunication.subscribe("socialLoginError", function (errorType) {
                if (errorType === "access_denied") {
                    toastr.warning("Merci de réessayer.", "Oups, la connexion a échoué");
                } else if (errorType === "user_denied") {
                    toastr.warning("Les informations que vous communiquez participent à compléter votre profil.", "Vous avez refusé la connexion");
                }
            });
        }

        function getToken() {
            return $q(function (resolve/*, reject */) {
                if (! Modernizr.localstorage) {
                    resolve();
                    return;
                }
                if (tokenSearched) {
                    resolve(token);
                    return;
                }

                token = localStorage.getItem(tokenField);
                tokenSearched = true;
                resolve(token);
            });
        }

        function setToken(newToken) {
            return $q(function (resolve/*, reject */) {
                if (! Modernizr.localstorage) {
                    resolve();
                    return;
                }

                localStorage.setItem(tokenField, newToken);
                token = newToken;
                tokenSearched = true;
                resolve();
            });
        }

        function unsetToken() {
            return $q(function (resolve/*, reject */) {
                if (! Modernizr.localstorage) {
                    resolve();
                    return;
                }

                localStorage.removeItem(tokenField);
                token = null;
                tokenSearched = false;
                resolve();
            });
        }

        function refreshToken() {
            return $http.post(apiBaseUrl + "/auth/refresh-token")
                .then(function (res) {
                    return res.data.access_token;
                })
                .then(function (refreshedToken) {
                    return setToken(refreshedToken)
                        .then(function () {
                            return refreshedToken;
                        });
                });
        }

        function login(email, password) {
            var hashedPassword = CryptoJS.SHA256(password).toString();
            var data = {
                identifier: email,
                password: hashedPassword,
                srcUrl: $location.absUrl()
            };

            return $http.post(apiBaseUrl + "/auth/local", data)
                .then(function (res) {
                    StelaceEvent.sendEvent("Login");
                    return res;
                });
        }

        function socialLogin(provider) {
            if (!isSocialLoginAllowed()) {
                return;
            }

            return getToken()
                .then(function (token) {
                    if (token) {
                        cookie.set("authToken", "Bearer " + token);
                    }
                })
                .then(function () {
                    var socialLoginConfig = {
                        provider: provider,
                        srcUrl: $location.absUrl()
                    };
                    localStorage.setItem("socialLoginConfig", JSON.stringify(socialLoginConfig));

                    window.open("/auth/" + provider);
                });
        }

        function isSocialLoginAllowed() {
            var isIE = useragent.detectIE();
            var enable = StelaceConfig.isFeatureActive('SOCIAL_LOGIN');
            var config = StelaceConfig.getConfig();

            return enable
                && (! isIE && Modernizr.localstorage && cookie.isCompatible())
                && (config.social_login__facebook_complete
                    || config.social_login__google_complete
                );
        }

        function logout() {
            return $http.post(apiBaseUrl + "/logout", { srcUrl: $location.absUrl() })
                .then(function () {
                    return unsetToken();
                })
                .then(function () {
                    setAuthenticated(false);
                    cache.clearAll();
                    $rootScope.$emit("isAuthenticated", false);

                    if (! $state.current.noAuthNeeded) {
                        $state.go("home");
                    } else {
                        $window.location.reload();
                    }
                });
        }

        function register(email, password) {
            var hashedPassword = CryptoJS.SHA256(password).toString();
            var data = {
                email: email,
                password: hashedPassword
            };

            return $http.post(apiBaseUrl + "/auth/local/register", data)
                .then(function (res) {
                    return res;
                });
        }

        function loginAs(userId) {
            // get 'UserService' this way because of circular dependencies
            var UserService = $injector.get("UserService");

            return $http.post(apiBaseUrl + "/auth/loginAs", { userId: userId })
                .then(function (res) {
                    UserService.unsetCurrentUser();
                    return setToken(res.data.access_token);
                });
        }

        function isAuthenticated(clearCache) {
            // get 'UserService' this way because of circular dependencies
            var UserService = $injector.get("UserService");

            return $q(function (resolve, reject) {
                if (clearCache) {
                    // check auth in other tabs with getToken (in interceptor)
                    isAuthed = null;
                    tokenSearched = false;
                    UserService.unsetCurrentUser();
                }

                if (typeof isAuthed !== "undefined" && isAuthed !== null) {
                    resolve(isAuthed);
                } else {
                    getToken()
                        .then(function (token) {
                            if (! token) {
                                isAuthed = false;
                                resolve(isAuthed);
                            } else {
                                return $http.get(apiBaseUrl + "/user/me")
                                    .then(function (res) {
                                        if (res.status === 204) {
                                            isAuthed = false;
                                        } else {
                                            isAuthed = true;
                                            UserService.setCurrentUser(res.data);
                                        }
                                        resolve(isAuthed);
                                    });
                            }
                        })
                        .catch(function (err) {
                            if (err.data && err.data.message === "AuthenticationNeeded") {
                                isAuthed = false;
                                resolve(isAuthed);
                            } else {
                                reject(err);
                            }
                        });
                }
            });
        }

        function setAuthenticated(authed) {
            isAuthed = authed;
        }

        function lostPassword(email) {
            return $http.post(apiBaseUrl + "/user/lost-password", { email: email })
                .then(function (res) {
                    StelaceEvent.sendEvent("Lost password email sent");
                    return res.data;
                });
        }

        function recoveryPassword(tokenId, tokenValue, password) {
            var data = {
                tokenId: tokenId,
                tokenValue: tokenValue
            };

            if (password) {
                data.password = CryptoJS.SHA256(password).toString();
            }

            return $http.put(apiBaseUrl + "/user/recovery-password", data)
                .then(function (res) {
                    return res.data;
                });
        }

        function emailCheck(args) {
            var email      = args.email;
            var tokenId    = args.tokenId;
            var tokenValue = args.tokenValue;
            var firstTime  = args.firstTime;
            var data;

            if (email && tokenValue) {
                data = {
                    email: email,
                    tokenValue: tokenValue
                };
            } else if (tokenId && tokenValue) {
                data = {
                    tokenId: tokenId,
                    tokenValue: tokenValue
                };
            } else {
                return $q.reject(new Error("missing params"));
            }

            if (firstTime) {
                data.firstTime = true;
            }

            return $http.put(apiBaseUrl + "/user/emailCheck", data)
                .then(function (res) {
                    var gamification = $injector.get("gamification");
                    gamification.checkStats();
                    return res;
                });
        }

        function emailNew(email) {
            return $http.post(apiBaseUrl + "/user/emailNew", { email: email });
        }

        function phoneSendCode(args) {
            return $http.post(apiBaseUrl + "/phone/sendCode", args)
                .then(function (res) {
                    return res.data;
                });
        }

        function phoneCheckCode(args) {
            return $http.post(apiBaseUrl + "/phone/checkCode", args)
                .then(function (res) {
                    var gamification = $injector.get("gamification");
                    gamification.checkStats();
                    return res.data;
                });
        }
    }

})();
